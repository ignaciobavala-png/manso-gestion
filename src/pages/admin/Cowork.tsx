import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Background from '../../components/Background'
import EntradasRegistradas from '../../components/EntradasRegistradas'
import EventCreator from '../../components/EventCreator'
import EventEditor from '../../components/EventEditor'
import ConfirmModal from '../../components/ConfirmModal'
import CoworkPresentacion from './CoworkPresentacion'
import { useAppStore } from '../../store/useAppStore'
import { useCoworkActivo } from '../../hooks/useSeccionPublica'

/**
 * Panel del Cowork Day: todo lo del pase en un solo lugar.
 *
 * No maneja pagos ni QR propios, y no duplica el alta de eventos: cada fecha
 * es un evento normal, así que se reusan EventCreator, EventEditor y la lista
 * de reservas de Control con todo lo que ya saben hacer (verificar
 * transferencia, chequear el pago en Mercado Pago, rechazar un QR, buscar).
 *
 * Lo propio de esta pantalla es el recorte —sólo las fechas de cowork— y la
 * presentación de la landing, que antes vivía clavada en el código.
 */

type Pestana = 'fechas' | 'presentacion'

interface Conteo {
  vendidas: number
  reservadas: number
  rechazadas: number
}

export default function Cowork() {
  const navigate = useNavigate()
  const { activo, estado } = useCoworkActivo()
  const { events, closeEvent, deleteEvent, updateEvent, refreshData } = useAppStore()

  const [pestana, setPestana] = useState<Pestana>('fechas')
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [conteos, setConteos] = useState<Record<string, Conteo>>({})
  const [confirmacion, setConfirmacion] = useState<{ tipo: 'cerrar' | 'borrar' } | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  // Las fechas salen del store, que ya trae los eventos con todas sus columnas
  // (select *). Hace falta la fila entera porque EventEditor la recibe tal cual.
  const fechas = useMemo(
    () => events
      .filter(e => e.cowork_day && !e.closed_at)
      .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? '')),
    [events]
  )

  useEffect(() => {
    if (fechas.length === 0) {
      setElegidaId(null)
      return
    }
    setElegidaId(prev => (prev && fechas.some(f => f.id === prev) ? prev : fechas[0].id))
  }, [fechas])

  useEffect(() => {
    if (fechas.length === 0) return
    let cancelado = false

    supabase
      .from('event_ticket_counts')
      .select('event_id, vendidas, reservadas, rechazadas')
      .in('event_id', fechas.map(f => f.id))
      .then(({ data }) => {
        if (cancelado || !data) return
        setConteos(Object.fromEntries(
          data.map(c => [c.event_id, {
            vendidas: c.vendidas,
            reservadas: c.reservadas,
            rechazadas: c.rechazadas,
          }])
        ))
      })

    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechas.map(f => f.id).join(',')])

  const elegida = fechas.find(f => f.id === elegidaId) ?? null

  // Se memoiza para EntradasRegistradas: si cambiara de identidad en cada
  // render volvería a pedir las reservas sin parar.
  const eventoParaLista = useMemo(
    () => (elegida ? { id: elegida.id, name: elegida.name } : undefined),
    [elegida]
  )

  const formatFecha = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString('es-AR', {
          weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        })
      : 'Sin fecha'

  const urlPublica = (f: typeof fechas[number]) => {
    const base = f.slug ? `/registro/${f.slug}` : `/registro?event=${f.id}`
    if (!f.is_private || !f.private_token) return base
    return `${base}${f.slug ? '?' : '&'}token=${f.private_token}`
  }

  const alternarReservas = async () => {
    if (!elegida || trabajando) return
    setTrabajando(true)
    await updateEvent(elegida.id, { registrations_open: !elegida.registrations_open })
    setTrabajando(false)
  }

  const confirmar = async () => {
    if (!elegida || !confirmacion) return
    setTrabajando(true)
    if (confirmacion.tipo === 'cerrar') {
      await closeEvent(elegida.id)
    } else {
      await deleteEvent(elegida.id)
    }
    await refreshData()
    setConfirmacion(null)
    setTrabajando(false)
  }

  const conteo = elegida ? conteos[elegida.id] : undefined

  return (
    <Background>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 w-full">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate('/admin/home')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Cowork Day</h2>
            <p className="text-gray-400 text-sm">Las fechas del pase y cómo se presenta</p>
          </div>
        </div>

        {estado !== 'publico' && (
          <div className="mb-5 bg-amber-950/40 border border-amber-800/40 rounded-2xl px-4 py-3">
            <p className="text-amber-300 text-sm font-medium">
              {estado === 'oculto' ? 'La sección está oculta' : 'Todavía no es pública'}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              {estado === 'oculto'
                ? 'Ni vos ni el público ven /cowork. Se cambia en Control → Secciones.'
                : activo
                  ? 'Vos podés abrir /cowork porque tenés sesión; el público todavía no. Control → Secciones → Público cuando esté lista.'
                  : 'Control → Secciones para cambiarlo.'}
            </p>
          </div>
        )}

        <div className="flex gap-1 mb-6 border-b border-white/20">
          {(['fechas', 'presentacion'] as Pestana[]).map(p => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                pestana === p
                  ? 'text-white border-b-2 border-emerald-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {p === 'fechas' ? 'Fechas' : 'Presentación'}
            </button>
          ))}
        </div>

        {pestana === 'presentacion' ? (
          <CoworkPresentacion />
        ) : creando ? (
          <div className="space-y-4">
            <button
              onClick={() => setCreando(false)}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              ← Volver a las fechas
            </button>
            <div className="bg-neutral-900 border border-white/20 rounded-2xl p-5">
              <EventCreator coworkPorDefecto onCreated={() => setCreando(false)} />
            </div>
          </div>
        ) : fechas.length === 0 ? (
          <div className="bg-neutral-900 border border-white/20 rounded-2xl p-6 text-center">
            <p className="text-3xl">🗓️</p>
            <p className="text-white font-semibold text-sm mt-3">Todavía no hay ninguna fecha</p>
            <p className="text-gray-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
              Creá la primera con su precio, su cupo y su medio de pago. Sale
              en /cowork y no se mezcla con la cartelera de shows.
            </p>
            <button
              onClick={() => setCreando(true)}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Crear la primera fecha →
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {fechas.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setElegidaId(f.id); setEditando(false) }}
                  className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors border ${
                    f.id === elegidaId
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-white/5 border-white/25 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {f.start_date
                    ? new Date(f.start_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                    : f.name}
                </button>
              ))}
              <button
                onClick={() => setCreando(true)}
                className="flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium border border-dashed border-white/20 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                + Nueva fecha
              </button>
            </div>

            {elegida && (
              <>
                <div className="bg-neutral-900 border border-white/20 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold">{elegida.name}</p>
                      <p className="text-gray-400 text-sm capitalize mt-0.5">
                        {formatFecha(elegida.start_date)}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditando(v => !v)}
                      className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors"
                    >
                      {editando ? 'Cerrar' : 'Editar'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div>
                      <p className="text-gray-400 text-xs">Reservados</p>
                      <p className="text-white font-bold text-xl">
                        {conteo?.vendidas ?? 0}
                        {elegida.max_capacity !== null && (
                          <span className="text-gray-400 text-sm font-normal"> / {elegida.max_capacity}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Pagando</p>
                      <p className="text-white font-bold text-xl">{conteo?.reservadas ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Rechazados</p>
                      <p className="text-white font-bold text-xl">{conteo?.rechazadas ?? 0}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/20">
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${
                      elegida.registrations_open
                        ? 'text-emerald-400 border-emerald-700/50 bg-emerald-950/40'
                        : 'text-gray-400 border-white/25 bg-white/5'
                    }`}>
                      {elegida.registrations_open ? 'Reservas abiertas' : 'Reservas cerradas'}
                    </span>
                    {elegida.is_paid && (
                      <span className="text-xs px-2.5 py-1 rounded-full border text-gray-300 border-white/25 bg-white/5">
                        ${Number(elegida.regular_ticket_price).toLocaleString('es-AR')}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full border text-gray-300 border-white/25 bg-white/5">
                      {elegida.payment_mode === 'ambos'
                        ? 'Transferencia y Mercado Pago'
                        : elegida.payment_mode === 'mercadopago'
                          ? 'Mercado Pago'
                          : 'Transferencia'}
                    </span>
                    {elegida.is_private && (
                      <span className="text-xs px-2.5 py-1 rounded-full border text-amber-400 border-amber-700/50 bg-amber-950/40">
                        Privada — sólo con el link
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => window.open(urlPublica(elegida), '_blank', 'noopener,noreferrer')}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors"
                    >
                      Ver el formulario ↗
                    </button>
                    <span className="text-white/15">·</span>
                    <button
                      onClick={alternarReservas}
                      disabled={trabajando}
                      className="text-gray-400 hover:text-white disabled:opacity-50 text-sm transition-colors"
                    >
                      {elegida.registrations_open ? 'Pausar reservas' : 'Reabrir reservas'}
                    </button>
                    <span className="text-white/15">·</span>
                    <button
                      onClick={() => setConfirmacion({ tipo: 'cerrar' })}
                      disabled={trabajando}
                      className="text-gray-400 hover:text-white disabled:opacity-50 text-sm transition-colors"
                    >
                      Cerrar fecha
                    </button>
                    <span className="text-white/15">·</span>
                    <button
                      onClick={() => setConfirmacion({ tipo: 'borrar' })}
                      disabled={trabajando}
                      className="text-red-400/80 hover:text-red-400 disabled:opacity-50 text-sm transition-colors"
                    >
                      Borrar
                    </button>
                  </div>

                  {editando && (
                    <div className="mt-4">
                      <EventEditor event={elegida} onDone={() => setEditando(false)} />
                    </div>
                  )}
                </div>

                <div className="bg-neutral-900 border border-white/20 rounded-2xl p-5">
                  <p className="text-white font-semibold text-sm">El formulario</p>
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                    Lo que se le pide a quien reserva, antes de pagar. Se cambia
                    con "Editar".
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    <li className="text-gray-300">· Email <span className="text-gray-400">— siempre</span></li>
                    <li className="text-gray-300">· Nombre <span className="text-gray-400">— siempre</span></li>
                    <li className={elegida.require_phone ? 'text-gray-300' : 'text-gray-400 line-through'}>
                      · Teléfono
                    </li>
                    <li className={elegida.require_instagram ? 'text-gray-300' : 'text-gray-400 line-through'}>
                      · Instagram
                    </li>
                  </ul>
                  {(!elegida.require_phone || !elegida.require_instagram) && (
                    <p className="text-amber-400/80 text-xs mt-3 leading-relaxed">
                      Ojo: sin teléfono ni Instagram no queda con qué decidir a
                      quién dejar entrar.
                    </p>
                  )}
                </div>

                <EntradasRegistradas event={eventoParaLista} defaultExpanded />
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmacion !== null}
        title={confirmacion?.tipo === 'cerrar' ? 'Cerrar la fecha' : 'Borrar la fecha'}
        message={
          confirmacion?.tipo === 'cerrar'
            ? 'La fecha sale de la landing y no se puede reservar más. Las reservas y sus QR quedan guardados.'
            : 'Se borra la fecha y con ella todas sus reservas. No se puede deshacer.'
        }
        confirmText={confirmacion?.tipo === 'cerrar' ? 'Cerrar fecha' : 'Borrar todo'}
        onConfirm={confirmar}
        onClose={() => setConfirmacion(null)}
        type={confirmacion?.tipo === 'borrar' ? 'danger' : 'warning'}
      />
    </Background>
  )
}
