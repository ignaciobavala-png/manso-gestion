import { useEffect, useRef, useState } from 'react'
import { Camera, Check, DoorOpen, Download, QrCode, ScanLine, UserCheck } from 'lucide-react'
import QRCode from 'qrcode'
import QrScanner, { OPCIONES_ESCANER } from '../../lib/escanerQr'
import { supabase } from '../../lib/supabase'

/**
 * La puerta: el staff escanea el carnet de un miembro y registra su ingreso.
 *
 * Vive acá y no en /admin/entradas por una razón de fondo: aquella pantalla
 * trabaja siempre contra el evento activo y sin evento no abre. Una visita de
 * cowork no tiene nada que ver con qué show hay esa noche — un martes a las
 * diez de la mañana no hay evento activo y la puerta tiene que funcionar
 * igual.
 *
 * El QR del carnet lleva nuestro formato interno (`manso-cowork|<token>`) y no
 * una URL, justamente porque lo lee este scanner y no la cámara del sistema.
 * El semáforo lo calcula la base (cowork_validar_qr): esta pantalla lo muestra
 * y nada más, así la puerta y el panel nunca dicen cosas distintas.
 *
 * Arriba está la otra mitad de lo mismo: el cartel que se pega en la entrada,
 * que hace el mismo trabajo al revés —lo escanea el miembro con su celular— y
 * no necesita que haya nadie del staff disponible. En la práctica es el que va
 * a registrar casi todas las visitas; el scanner queda para cuando alguien
 * quiera chequear a una persona en particular.
 */

const PREFIJO = 'manso-cowork|'

interface Ficha {
  persona_id: string | null
  nombre: string | null
  foto_url: string | null
  estado: string | null
  puede_entrar: boolean
  motivo: string | null
  llave_tipo: 'dia' | 'mensual' | null
  llave_plan: string | null
  llave_hasta: string | null
  dias_restantes: number | null
  ultima_visita: string | null
  visitas_totales: number
  ya_ingreso_hoy: boolean
}

interface Ingreso {
  ok: boolean
  motivo: string | null
  nombre: string | null
  ya_estaba: boolean
  sin_llave: boolean
}

const HOY = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

const fecha = (iso: string) =>
  iso === HOY()
    ? 'hoy'
    : new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

export default function CoworkPuerta() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ingreso, setIngreso] = useState<Ingreso | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  const frenar = () => {
    if (scannerRef.current) {
      scannerRef.current.stop()
      scannerRef.current.destroy()
      scannerRef.current = null
    }
    setEscaneando(false)
  }

  // La cámara queda prendida si uno se va de la pestaña: hay que apagarla.
  useEffect(() => () => {
    if (scannerRef.current) {
      scannerRef.current.stop()
      scannerRef.current.destroy()
      scannerRef.current = null
    }
  }, [])

  const leido = async (crudo: string) => {
    frenar()
    setIngreso(null)
    setFicha(null)

    if (!crudo.startsWith(PREFIJO)) {
      setError(
        crudo.startsWith('manso-ticket|') || crudo.startsWith('manso|')
          ? 'Eso es una entrada de un show. Los carnets se escanean acá; las entradas, en Entradas.'
          : 'Ese QR no es un carnet del cowork.'
      )
      return
    }

    const tokenLeido = crudo.slice(PREFIJO.length)
    setTrabajando(true)
    const { data, error: err } = await supabase.rpc('cowork_validar_qr', { p_token: tokenLeido })
    setTrabajando(false)

    if (err) { setError(err.message); return }

    const f = ((data as Ficha[] | null) ?? [])[0] ?? null
    if (!f || !f.persona_id) {
      setError('Este QR no es de nadie. Puede ser uno viejo: fijate en Miembros si le rotaron la credencial.')
      return
    }
    setToken(tokenLeido)
    setFicha(f)
  }

  const escanear = async () => {
    if (!videoRef.current) return
    setError('')
    setIngreso(null)
    setFicha(null)
    setEscaneando(true)

    try {
      scannerRef.current = new QrScanner(videoRef.current, r => { void leido(r.data) }, OPCIONES_ESCANER)
      await scannerRef.current.start()
    } catch {
      setError('No se pudo abrir la cámara. Revisá los permisos del navegador.')
      setEscaneando(false)
    }
  }

  // `forzar` es dejar pasar a alguien sin llave vigente —un invitado, una
  // prueba, una cortesía—. La visita queda igual, sin llave asociada: que
  // alguien haya entrado sin pagar también es un dato que conviene tener.
  const registrar = async (forzar: boolean) => {
    if (!token) return
    setTrabajando(true)
    setError('')

    const { data, error: err } = await supabase.rpc('cowork_registrar_ingreso', {
      p_token: token,
      p_origen: 'qr',
      p_forzar: forzar,
    })

    setTrabajando(false)
    if (err) { setError(err.message); return }

    const r = ((data as Ingreso[] | null) ?? [])[0] ?? null
    if (r && !r.ok) { setError(r.motivo ?? 'No se pudo registrar'); return }
    setIngreso(r)
    setFicha(null)
  }

  const vence = ficha?.dias_restantes ?? null

  return (
    <div className="space-y-4">
      <CartelDeEntrada />

      <video
        ref={videoRef}
        className={`w-full rounded-2xl bg-black ${escaneando ? 'block' : 'hidden'}`}
      />

      {escaneando && (
        <button
          onClick={frenar}
          className="w-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-2xl py-3 transition-colors"
        >
          Cancelar
        </button>
      )}

      {!escaneando && !ficha && !ingreso && (
        <div className="bg-neutral-900 border border-white/20 rounded-2xl p-6 text-center">
          <ScanLine className="mx-auto text-gray-400" size={30} strokeWidth={1.25} aria-hidden />
          <p className="text-white font-semibold text-sm mt-3">Escaneá el carnet</p>
          <p className="text-gray-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
            El QR que el miembro tiene en su carnet. Si ya escaneó una sala hoy,
            su visita quedó registrada sola y acá no hace falta hacer nada.
          </p>
          <button
            onClick={escanear}
            className="inline-flex items-center gap-1.5 bg-terra-600 hover:bg-terra-500 text-white text-sm font-medium rounded-xl px-4 py-2.5 mt-4 transition-colors"
          >
            <Camera size={15} aria-hidden /> Abrir cámara
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-500/40 rounded-2xl p-4">
          <p className="text-red-300 text-sm leading-relaxed">{error}</p>
          <button
            onClick={escanear}
            className="text-white text-xs font-medium underline underline-offset-2 mt-2"
          >
            Escanear otro
          </button>
        </div>
      )}

      {ficha && (
        <div className="bg-neutral-900 border border-white/20 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span
              className={`flex-shrink-0 w-3 h-3 rounded-full ${
                !ficha.puede_entrar ? 'bg-red-500'
                : vence !== null && vence <= 5 ? 'bg-amber-400'
                : 'bg-emerald-500'
              }`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-white font-bold text-lg truncate">{ficha.nombre}</p>
              <p className="text-gray-400 text-xs">
                {ficha.motivo
                  ? ficha.motivo
                  : ficha.llave_tipo === 'dia'
                    ? 'Pase de un día'
                    : `${ficha.llave_plan ?? 'Mensual'} · ${
                        vence === null ? 'no vence'
                        : vence === 0 ? 'vence hoy'
                        : `quedan ${vence} ${vence === 1 ? 'día' : 'días'}`}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <p className="text-gray-400 text-xs">Visitas</p>
              <p className="text-white font-bold text-lg">{ficha.visitas_totales}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Última</p>
              <p className="text-white font-bold text-lg">
                {ficha.ultima_visita ? fecha(ficha.ultima_visita) : '—'}
              </p>
            </div>
          </div>

          {ficha.ya_ingreso_hoy && (
            <p className="text-gray-400 text-xs mt-3">
              Ya tiene la visita de hoy registrada. Volver a escanear no la duplica.
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {ficha.puede_entrar ? (
              <button
                onClick={() => registrar(false)}
                disabled={trabajando}
                className="flex-1 min-w-[10rem] bg-terra-600 hover:bg-terra-500 disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition-colors"
              >
                {trabajando ? 'Registrando…' : 'Registrar ingreso'}
              </button>
            ) : (
              <button
                onClick={() => registrar(true)}
                disabled={trabajando}
                className="flex-1 min-w-[10rem] bg-white/10 hover:bg-white/20 disabled:opacity-60 text-white font-medium rounded-xl py-3 text-sm transition-colors"
              >
                {trabajando ? 'Registrando…' : 'Dejarlo pasar igual'}
              </button>
            )}
            <button
              onClick={escanear}
              className="bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium rounded-xl px-4 py-3 transition-colors"
            >
              Escanear otro
            </button>
          </div>
        </div>
      )}

      {ingreso && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-5 text-center">
          {ingreso.ya_estaba
            ? <UserCheck size={26} className="mx-auto text-emerald-400" aria-hidden />
            : <Check size={26} className="mx-auto text-emerald-400" aria-hidden />}
          <p className="text-white font-semibold mt-2">
            {ingreso.ya_estaba
              ? `${ingreso.nombre} ya estaba adentro`
              : `Adelante, ${ingreso.nombre}`}
          </p>
          {ingreso.sin_llave && (
            <p className="text-amber-300 text-xs mt-1">Pasó sin llave vigente</p>
          )}
          <button
            onClick={escanear}
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl px-4 py-2.5 mt-4 transition-colors"
          >
            <Camera size={15} aria-hidden /> Escanear el próximo
          </button>
        </div>
      )}
    </div>
  )
}

function CartelDeEntrada() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [token, setToken] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    let cancelado = false
    supabase.from('cowork_entrada').select('token').limit(1).maybeSingle().then(({ data }) => {
      if (!cancelado) setToken((data?.token as string | undefined) ?? null)
    })
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    if (!abierto || !canvasRef.current || !token) return
    // URL completa: este QR lo lee la cámara del celular del miembro, que sabe
    // abrir links y no sabe de nuestros prefijos.
    QRCode.toCanvas(canvasRef.current, `${window.location.origin}/llegue/${token}`, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [abierto, token])

  const descargar = () => {
    if (!canvasRef.current) return
    const enlace = document.createElement('a')
    enlace.download = 'cartel-entrada-cowork.png'
    enlace.href = canvasRef.current.toDataURL('image/png')
    enlace.click()
  }

  return (
    <div className="bg-neutral-900 border border-white/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <DoorOpen size={18} className="flex-shrink-0 text-terra-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-white font-semibold text-sm">Cartel de la entrada</span>
          <span className="block text-gray-400 text-xs">
            Lo escanea el miembro al llegar. Registra su visita sin ocupar ninguna sala.
          </span>
        </span>
        <QrCode size={18} className="flex-shrink-0 text-gray-400" aria-hidden />
      </button>

      {abierto && (
        <div className="border-t border-white/10 p-4 flex flex-col items-center">
          {token ? (
            <>
              <canvas ref={canvasRef} className="rounded-xl" />
              <p className="text-gray-400 text-xs mt-3 text-center max-w-xs leading-relaxed">
                Imprimilo y pegalo donde se entra. Es el que va a registrar casi
                todas las visitas: no necesita que haya nadie del staff.
              </p>
              <button
                onClick={descargar}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl px-3.5 py-2 mt-3 transition-colors"
              >
                <Download size={14} aria-hidden /> Bajar para imprimir
              </button>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Buscando el cartel…</p>
          )}
        </div>
      )}
    </div>
  )
}
