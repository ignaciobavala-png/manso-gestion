import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { DoorOpen, Download, QrCode } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * El tablero de salas: qué hay libre ahora y el QR para pegar en cada puerta.
 *
 * La ocupación se calcula en la base (vista cowork_ocupacion_salas) y no acá:
 * una sala está ocupada mientras su sesión no venció, y quien decide eso es
 * el mismo lugar que atiende los escaneos. Si se calculara en el front, el
 * cartel de la puerta y esta pantalla podrían decir cosas distintas.
 *
 * Se refresca sola cada medio minuto porque las sesiones vencen con el reloj:
 * sin eso, una sala se ve ocupada hasta que alguien recarga.
 */

interface Sala {
  id: string
  nombre: string
  capacidad: number | null
  ocupable: boolean
  activa: boolean
  orden: number
  adentro: number
  persona_nombre: string | null
  desde: string | null
  hasta: string | null
  token?: string
  minutos_bloque?: number
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export default function CoworkSalas() {
  const [salas, setSalas] = useState<Sala[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  const consultar = useCallback(async (): Promise<
    { salas: Sala[]; error?: undefined } | { salas?: undefined; error: string }
  > => {
    // La vista trae la ocupación; la tabla, el token del QR y el bloque. Dos
    // consultas porque la vista no expone el token a propósito: es lo único
    // que hace falta para ocupar una sala.
    const [ocupacion, config] = await Promise.all([
      supabase.from('cowork_ocupacion_salas').select('*').order('orden'),
      supabase.from('cowork_salas').select('id, token, minutos_bloque'),
    ])

    if (ocupacion.error) return { error: ocupacion.error.message }
    if (config.error) return { error: config.error.message }

    const extra = new Map(
      (config.data ?? []).map(c => [c.id as string, c as { token: string; minutos_bloque: number }])
    )

    return {
      salas: (ocupacion.data ?? []).map(s => ({
        ...(s as Sala),
        token: extra.get(s.id as string)?.token,
        minutos_bloque: extra.get(s.id as string)?.minutos_bloque,
      })),
    }
  }, [])

  useEffect(() => {
    let cancelado = false

    const cargar = () => consultar().then(r => {
      if (cancelado) return
      if (r.salas) {
        setSalas(r.salas)
        setError('')
      } else {
        setError(r.error)
      }
      setCargando(false)
    })

    cargar()
    // Las sesiones vencen solas con el reloj, así que el tablero tiene que
    // volver a preguntar aunque nadie toque nada.
    const reloj = setInterval(cargar, 30_000)

    return () => { cancelado = true; clearInterval(reloj) }
  }, [consultar, recarga])

  const liberar = async (sala: Sala) => {
    const { error: err } = await supabase
      .from('cowork_sesiones_sala')
      .update({ cerrada_at: new Date().toISOString(), cerrada_por: 'liberada desde el panel' })
      .eq('sala_id', sala.id)
      .is('cerrada_at', null)
      .gt('vence_at', new Date().toISOString())

    if (err) setError(err.message)
    setRecarga(n => n + 1)
  }

  const cambiarOcupable = async (sala: Sala) => {
    const { error: err } = await supabase
      .from('cowork_salas')
      .update({ ocupable: !sala.ocupable })
      .eq('id', sala.id)

    if (err) setError(err.message)
    setRecarga(n => n + 1)
  }

  if (cargando) {
    return (
      <div className="bg-neutral-900 border border-white/20 rounded-2xl p-6 text-center">
        <p className="text-gray-400 text-sm">Cargando salas…</p>
      </div>
    )
  }

  const ocupadas = salas.filter(s => s.hasta).length
  const disponibles = salas.filter(s => s.ocupable && s.activa).length

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-3">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-neutral-900 border border-white/20 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Ocupadas ahora</p>
          <p className="text-white font-bold text-2xl">
            {ocupadas}<span className="text-gray-400 text-sm font-normal"> / {disponibles}</span>
          </p>
        </div>
        <div className="bg-neutral-900 border border-white/20 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Espacios</p>
          <p className="text-white font-bold text-2xl">{salas.length}</p>
        </div>
      </div>

      <div className="space-y-2">
        {salas.map(sala => (
          <FilaSala
            key={sala.id}
            sala={sala}
            abierta={abierta === sala.id}
            onToggle={() => setAbierta(prev => (prev === sala.id ? null : sala.id))}
            onLiberar={() => liberar(sala)}
            onCambiarOcupable={() => cambiarOcupable(sala)}
          />
        ))}
      </div>

      <p className="text-gray-500 text-xs leading-relaxed px-1">
        El QR de cada sala se imprime y se pega en su puerta. El miembro lo
        apunta con la cámara y dice que está ahí; la sala se libera sola al
        terminar el bloque, sin que nadie tenga que acordarse de nada.
      </p>
    </div>
  )
}

function FilaSala({
  sala, abierta, onToggle, onLiberar, onCambiarOcupable,
}: {
  sala: Sala
  abierta: boolean
  onToggle: () => void
  onLiberar: () => void
  onCambiarOcupable: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!abierta || !canvasRef.current || !sala.token) return
    // Una URL y no nuestro formato interno: este QR lo lee la cámara del
    // celular del miembro, que sabe abrir links y no sabe de `manso-cowork|`.
    QRCode.toCanvas(canvasRef.current, `${window.location.origin}/sala/${sala.token}`, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [abierta, sala.token])

  const descargar = () => {
    if (!canvasRef.current) return
    const enlace = document.createElement('a')
    enlace.download = `sala-${sala.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
    enlace.href = canvasRef.current.toDataURL('image/png')
    enlace.click()
  }

  const semaforo =
    !sala.ocupable || !sala.activa ? 'bg-gray-600'
    : sala.hasta                   ? 'bg-amber-400'
    : 'bg-emerald-500'

  const leyenda =
    !sala.activa   ? 'Desactivada'
    : !sala.ocupable ? 'Uso común'
    : sala.hasta && sala.persona_nombre
      ? `${sala.persona_nombre} · hasta las ${hora(sala.hasta)}`
      : 'Libre'

  return (
    <div className="bg-neutral-900 border border-white/20 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${semaforo}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-white font-semibold text-sm truncate">{sala.nombre}</span>
          <span className="block text-gray-400 text-xs truncate">{leyenda}</span>
        </span>
        <QrCode size={18} className="flex-shrink-0 text-gray-400" aria-hidden />
      </button>

      {abierta && (
        <div className="border-t border-white/10 p-4">
          {sala.hasta && (
            <button
              onClick={onLiberar}
              className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl py-2.5 transition-colors mb-4"
            >
              <DoorOpen size={15} aria-hidden /> Liberar ahora
            </button>
          )}

          <label className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-white text-sm">Se puede ocupar</span>
              <span className="block text-gray-400 text-xs leading-relaxed">
                Apagalo para los espacios comunes, que se muestran en la web
                pero no tiene sentido reservar.
              </span>
            </span>
            <input
              type="checkbox"
              checked={sala.ocupable}
              onChange={onCambiarOcupable}
              className="flex-shrink-0 w-5 h-5 accent-terra-600"
            />
          </label>

          {sala.ocupable && sala.token && (
            <div className="mt-4 flex flex-col items-center">
              <canvas ref={canvasRef} className="rounded-xl" />
              <p className="text-gray-400 text-xs mt-2">
                Bloque de {sala.minutos_bloque} minutos
              </p>
              <button
                onClick={descargar}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl px-3.5 py-2 mt-3 transition-colors"
              >
                <Download size={14} aria-hidden /> Bajar para imprimir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
