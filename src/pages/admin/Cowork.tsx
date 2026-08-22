import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Background from '../../components/Background'
import EntradasRegistradas from '../../components/EntradasRegistradas'
import { useCoworkActivo } from '../../hooks/useSeccionPublica'

/**
 * Panel del Cowork Day.
 *
 * No maneja pagos ni QR propios: cada fecha es un evento normal, así que la
 * lista de reservas es el mismo componente que usa Control, con todo lo que
 * ya sabe hacer (verificar transferencia, chequear el pago en Mercado Pago,
 * rechazar un QR, buscar, exportar).
 *
 * Lo que agrega esta pantalla es lo propio del cowork: elegir entre fechas,
 * ver de un vistazo quién reservó y con qué datos, y el link al formulario
 * público para revisarlo como lo ve la gente.
 */

interface FechaCowork {
  id: string
  name: string
  slug: string | null
  start_date: string | null
  regular_ticket_price: number
  is_paid: boolean
  max_capacity: number | null
  registrations_open: boolean
  require_instagram: boolean
  require_phone: boolean
  payment_mode: string
}

interface Conteo {
  vendidas: number
  reservadas: number
  rechazadas: number
}

export default function Cowork() {
  const navigate = useNavigate()
  const { activo, loading: perillaLoading } = useCoworkActivo()
  const [fechas, setFechas] = useState<FechaCowork[]>([])
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [conteos, setConteos] = useState<Record<string, Conteo>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      const { data } = await supabase
        .from('events')
        .select('id, name, slug, start_date, regular_ticket_price, is_paid, max_capacity, registrations_open, require_instagram, require_phone, payment_mode')
        .eq('cowork_day', true)
        .is('closed_at', null)
        .order('start_date', { ascending: true })

      if (cancelado) return
      const filas = (data ?? []) as FechaCowork[]
      setFechas(filas)
      setElegidaId(prev => prev ?? filas[0]?.id ?? null)
      setLoading(false)

      if (filas.length === 0) return

      const { data: counts } = await supabase
        .from('event_ticket_counts')
        .select('event_id, vendidas, reservadas, rechazadas')
        .in('event_id', filas.map(f => f.id))

      if (cancelado || !counts) return
      setConteos(
        Object.fromEntries(
          counts.map(c => [c.event_id, {
            vendidas: c.vendidas,
            reservadas: c.reservadas,
            rechazadas: c.rechazadas,
          }])
        )
      )
    }

    cargar()
    return () => { cancelado = true }
  }, [])

  const elegida = useMemo(
    () => fechas.find(f => f.id === elegidaId) ?? null,
    [fechas, elegidaId]
  )

  // El prop de EntradasRegistradas se memoiza: si cambiara de identidad en
  // cada render volvería a pedir las reservas sin parar.
  const eventoParaLista = useMemo(
    () => (elegida ? { id: elegida.id, name: elegida.name } : undefined),
    [elegida]
  )

  const formatFecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString('es-AR', {
          weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        })
      : 'Sin fecha'

  const urlPublica = (f: FechaCowork) =>
    f.slug ? `/registro/${f.slug}` : `/registro?event=${f.id}`

  const conteo = elegida ? conteos[elegida.id] : undefined

  return (
    <Background>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 w-full">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/admin/home')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Cowork Day</h2>
            <p className="text-gray-500 text-sm">Las fechas del pase por día y quién reservó</p>
          </div>
        </div>

        {!perillaLoading && !activo && (
          <div className="mb-6 bg-amber-950/40 border border-amber-800/40 rounded-2xl px-4 py-3">
            <p className="text-amber-300 text-sm font-medium">La sección está apagada</p>
            <p className="text-gray-400 text-xs mt-1">
              El público no ve /cowork ni puede reservar. Se prende en
              Control → Secciones.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
          </div>
        ) : fechas.length === 0 ? (
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-3xl">🗓️</p>
            <p className="text-white font-semibold text-sm mt-3">Todavía no hay ninguna fecha</p>
            <p className="text-gray-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
              Una fecha de cowork se crea como cualquier evento, en Control →
              Operación, eligiendo "Tipo de fecha: Cowork Day". Ahí se le pone
              precio, cupo y medio de pago.
            </p>
            <button
              onClick={() => navigate('/admin/home')}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Ir a crear la fecha →
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selector de fecha */}
            {fechas.length > 1 && (
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {fechas.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setElegidaId(f.id)}
                    className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors border ${
                      f.id === elegidaId
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {f.start_date
                      ? new Date(f.start_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                      : f.name}
                  </button>
                ))}
              </div>
            )}

            {elegida && (
              <>
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5">
                  <p className="text-white font-semibold">{elegida.name}</p>
                  <p className="text-gray-400 text-sm capitalize mt-0.5">
                    {formatFecha(elegida.start_date)}
                  </p>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div>
                      <p className="text-gray-500 text-xs">Reservados</p>
                      <p className="text-white font-bold text-xl">
                        {conteo?.vendidas ?? 0}
                        {elegida.max_capacity !== null && (
                          <span className="text-gray-500 text-sm font-normal"> / {elegida.max_capacity}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Pagando</p>
                      <p className="text-white font-bold text-xl">{conteo?.reservadas ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Rechazados</p>
                      <p className="text-white font-bold text-xl">{conteo?.rechazadas ?? 0}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/10">
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${
                      elegida.registrations_open
                        ? 'text-emerald-400 border-emerald-700/50 bg-emerald-950/40'
                        : 'text-gray-400 border-white/15 bg-white/5'
                    }`}>
                      {elegida.registrations_open ? 'Reservas abiertas' : 'Reservas cerradas'}
                    </span>
                    {elegida.is_paid && (
                      <span className="text-xs px-2.5 py-1 rounded-full border text-gray-300 border-white/15 bg-white/5">
                        ${Number(elegida.regular_ticket_price).toLocaleString('es-AR')}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full border text-gray-300 border-white/15 bg-white/5">
                      {elegida.payment_mode === 'ambos'
                        ? 'Transferencia y Mercado Pago'
                        : elegida.payment_mode === 'mercadopago'
                          ? 'Mercado Pago'
                          : 'Transferencia'}
                    </span>
                  </div>
                </div>

                {/* El formulario que completa quien reserva */}
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5">
                  <p className="text-white font-semibold text-sm">El formulario</p>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                    Lo que se le pide a quien reserva, antes de pagar. Se cambia
                    al editar la fecha, en Control → Operación.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    <li className="text-gray-300">· Email <span className="text-gray-600">— siempre</span></li>
                    <li className="text-gray-300">· Nombre <span className="text-gray-600">— siempre</span></li>
                    <li className={elegida.require_phone ? 'text-gray-300' : 'text-gray-600 line-through'}>
                      · Teléfono
                    </li>
                    <li className={elegida.require_instagram ? 'text-gray-300' : 'text-gray-600 line-through'}>
                      · Instagram
                    </li>
                  </ul>
                  {(!elegida.require_phone || !elegida.require_instagram) && (
                    <p className="text-amber-400/80 text-xs mt-3 leading-relaxed">
                      Ojo: sin teléfono ni Instagram no queda con qué decidir a
                      quién dejar entrar.
                    </p>
                  )}
                  <button
                    onClick={() => window.open(urlPublica(elegida), '_blank', 'noopener,noreferrer')}
                    className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors"
                  >
                    Ver el formulario como lo ve la gente ↗
                  </button>
                </div>

                {/* Reservas: el mismo panel que Control */}
                <EntradasRegistradas event={eventoParaLista} defaultExpanded />
              </>
            )}
          </div>
        )}
      </div>
    </Background>
  )
}
