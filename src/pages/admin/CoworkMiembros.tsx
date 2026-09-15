import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Search, UserPlus, QrCode, RotateCw, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/ConfirmModal'

/**
 * Los miembros del cowork y su credencial.
 *
 * El QR identifica a la persona y no a la llave: se entrega una sola vez y lo
 * que cambia abajo es la llave, que es la que decide si hoy abre. Por eso acá
 * el QR no se "genera" — ya existe, cada persona nace con el suyo (migración
 * 028); esta pantalla lo muestra, lo baja como PNG y lo rota si se filtró.
 *
 * El semáforo sale entero de la base: `puede_entrar` y `motivo` los calcula
 * cowork_validar_qr / la vista, no esta pantalla. Si la regla cambia, cambia
 * en un solo lugar y la puerta y el panel siguen diciendo lo mismo.
 */

interface Miembro {
  id: string
  nombre: string
  email: string
  estado: 'activa' | 'pausada' | 'baja'
  llave_tipo: 'dia' | 'mensual' | null
  llave_plan: string | null
  llave_hasta: string | null
  dias_restantes: number | null
  ultima_visita: string | null
  visitas_totales: number
  token: string | null
}

type Filtro = 'todos' | 'al-dia' | 'sin-llave'

const HOY = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

export default function CoworkMiembros() {
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [rotando, setRotando] = useState<Miembro | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  // No toca estado antes del await a propósito: llamarla desde un efecto con
  // un setState sincrónico encadena renders (react-hooks/set-state-in-effect).
  // La consulta no toca estado: devuelve datos y el efecto decide qué hacer
  // con ellos. Mismo patrón que la lista de fechas —promesa con bandera de
  // cancelado— para no escribir sobre un componente ya desmontado, y para que
  // el setState caiga en un callback y no en el cuerpo del efecto.
  const consultar = useCallback(async (): Promise<
    { miembros: Miembro[]; error?: undefined } | { miembros?: undefined; error: string }
  > => {
    // Dos consultas y no un join: la vista ya resuelve el semáforo (qué llave
    // manda, cuántos días quedan, última visita) y las credenciales vigentes
    // son una lista corta que se cruza en memoria.
    const [estados, credenciales] = await Promise.all([
      supabase
        .from('cowork_estado_personas')
        .select('id, nombre, email, estado, llave_tipo, llave_plan, llave_hasta, dias_restantes, ultima_visita, visitas_totales')
        .order('nombre'),
      supabase
        .from('cowork_credenciales')
        .select('persona_id, token')
        .eq('soporte', 'qr')
        .is('revocada_at', null),
    ])

    if (estados.error) return { error: estados.error.message }
    if (credenciales.error) return { error: credenciales.error.message }

    const tokens = new Map(
      (credenciales.data ?? []).map(c => [c.persona_id as string, c.token as string])
    )

    return {
      miembros: (estados.data ?? []).map(e => ({
        ...(e as Omit<Miembro, 'token'>),
        token: tokens.get(e.id as string) ?? null,
      })),
    }
  }, [])

  useEffect(() => {
    let cancelado = false

    consultar().then(r => {
      if (cancelado) return
      if (r.miembros) {
        setMiembros(r.miembros)
        setError('')
      } else {
        setError(r.error)
      }
      setCargando(false)
    })

    return () => { cancelado = true }
  }, [consultar, recarga])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return miembros.filter(m => {
      if (filtro === 'al-dia'   && !m.llave_hasta) return false
      if (filtro === 'sin-llave' && m.llave_hasta) return false
      if (!q) return true
      return m.nombre.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    })
  }, [miembros, busqueda, filtro])

  const alDia = miembros.filter(m => m.llave_hasta).length

  // Rotar = revocar la vigente y emitir otra. No se pisa el token: el QR
  // impreso que quedó dando vueltas tiene que poder distinguirse del nuevo.
  const rotarCredencial = async () => {
    if (!rotando) return
    setTrabajando(true)

    const { error: errRevocar } = await supabase
      .from('cowork_credenciales')
      .update({ revocada_at: new Date().toISOString(), revocada_por: 'rotada desde el panel' })
      .eq('persona_id', rotando.id)
      .eq('soporte', 'qr')
      .is('revocada_at', null)

    if (errRevocar) {
      setError(errRevocar.message)
      setTrabajando(false)
      setRotando(null)
      return
    }

    const { error: errEmitir } = await supabase
      .from('cowork_credenciales')
      .insert({ persona_id: rotando.id, soporte: 'qr' })

    if (errEmitir) setError(errEmitir.message)

    setTrabajando(false)
    setRotando(null)
    setRecarga(n => n + 1)
  }

  if (cargando) {
    return (
      <div className="bg-neutral-900 border border-white/20 rounded-2xl p-6 text-center">
        <p className="text-gray-400 text-sm">Cargando miembros…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-3">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-neutral-900 border border-white/20 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Miembros</p>
          <p className="text-white font-bold text-2xl">{miembros.length}</p>
        </div>
        <div className="bg-neutral-900 border border-white/20 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Con llave hoy</p>
          <p className="text-white font-bold text-2xl">{alDia}</p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o mail…"
          className="w-full bg-white/5 border border-white/20 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-terra-500 transition-colors"
        />
      </div>

      <div className="flex gap-2">
        {(['todos', 'al-dia', 'sin-llave'] as Filtro[]).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-colors border ${
              filtro === f
                ? 'bg-terra-600 border-terra-500 text-white'
                : 'bg-white/5 border-white/25 text-gray-300 hover:bg-white/10'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'al-dia' ? 'Con llave hoy' : 'Sin llave'}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="bg-neutral-900 border border-white/20 rounded-2xl p-6 text-center">
          <UserPlus className="mx-auto text-gray-400" size={30} strokeWidth={1.25} aria-hidden />
          <p className="text-white font-semibold text-sm mt-3">
            {miembros.length === 0 ? 'Todavía no hay miembros' : 'Ninguno coincide con la búsqueda'}
          </p>
          {miembros.length === 0 && (
            <p className="text-gray-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
              Cada persona entra sola al llavero: al venderse un pase de cowork day
              o al activarse una membresía en manso.club. Su QR se emite con ella.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visibles.map(m => (
            <FilaMiembro
              key={m.id}
              miembro={m}
              abierto={abierto === m.id}
              onToggle={() => setAbierto(prev => (prev === m.id ? null : m.id))}
              onRotar={() => setRotando(m)}
            />
          ))}
        </div>
      )}

      {rotando && (
        <ConfirmModal
          isOpen
          title="Rotar el QR"
          message={`El QR actual de ${rotando.nombre} deja de servir en el acto y se emite uno nuevo. Hay que volver a entregárselo.`}
          confirmText={trabajando ? 'Rotando…' : 'Rotar'}
          type="warning"
          onConfirm={rotarCredencial}
          onClose={() => setRotando(null)}
        />
      )}
    </div>
  )
}

function FilaMiembro({
  miembro, abierto, onToggle, onRotar,
}: {
  miembro: Miembro
  abierto: boolean
  onToggle: () => void
  onRotar: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!abierto || !canvasRef.current || !miembro.token) return
    // Mismo formato que las entradas (`manso-ticket|<token>`), con su propio
    // prefijo: el scanner de la puerta sabe por el prefijo si lo que leyó es
    // una entrada de un show o una credencial de cowork.
    QRCode.toCanvas(canvasRef.current, `manso-cowork|${miembro.token}`, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }, [abierto, miembro.token])

  const descargar = () => {
    if (!canvasRef.current) return
    const enlace = document.createElement('a')
    enlace.download = `cowork-${miembro.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
    enlace.href = canvasRef.current.toDataURL('image/png')
    enlace.click()
  }

  const vence = miembro.dias_restantes
  const semaforo =
    miembro.estado !== 'activa' || !miembro.llave_hasta ? 'bg-red-500'
    : vence !== null && vence <= 5                      ? 'bg-amber-400'
    : 'bg-emerald-500'

  const leyenda =
    miembro.estado === 'baja'    ? 'Se dio de baja'
    : miembro.estado === 'pausada' ? 'Pausada'
    : !miembro.llave_hasta       ? 'Sin llave vigente'
    : miembro.llave_tipo === 'dia' ? 'Pase de un día'
    : `${miembro.llave_plan ?? 'Mensual'} · ${vence === 0 ? 'vence hoy' : `quedan ${vence} días`}`

  return (
    <div className="bg-neutral-900 border border-white/20 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${semaforo}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-white font-semibold text-sm truncate">{miembro.nombre}</span>
          <span className="block text-gray-400 text-xs truncate">{leyenda}</span>
        </span>
        <QrCode size={18} className="flex-shrink-0 text-gray-400" aria-hidden />
      </button>

      {abierto && (
        <div className="border-t border-white/10 p-4">
          <p className="text-gray-400 text-xs break-all">{miembro.email}</p>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p className="text-gray-400 text-xs">Visitas</p>
              <p className="text-white font-bold text-lg">{miembro.visitas_totales}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Última</p>
              <p className="text-white font-bold text-lg">
                {miembro.ultima_visita
                  ? miembro.ultima_visita === HOY()
                    ? 'Hoy'
                    : new Date(`${miembro.ultima_visita}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                  : '—'}
              </p>
            </div>
          </div>

          {miembro.token ? (
            <div className="mt-4 flex flex-col items-center">
              <canvas ref={canvasRef} className="rounded-xl" />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={descargar}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl px-3.5 py-2 transition-colors"
                >
                  <Download size={14} aria-hidden /> Bajar PNG
                </button>
                <button
                  onClick={onRotar}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium rounded-xl px-3.5 py-2 transition-colors"
                >
                  <RotateCw size={14} aria-hidden /> Rotar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-amber-300 text-xs mt-4">
              No tiene credencial vigente. Rotala para emitirle una.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
