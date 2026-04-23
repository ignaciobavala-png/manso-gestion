import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'

interface EventCard {
  id: string
  name: string
  start_date: string | null
  flyer_url: string | null
}

interface ActiveEvent {
  id: string
  name: string
}

const LS_KEY = (eventId: string) => `manso_ticket_${eventId}`

// ─── Cartelera (sin ?event=) ────────────────────────────────────────────────

function Cartelera() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, start_date, flyer_url')
      .eq('is_active', true)
      .eq('registrations_open', true)
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        setEvents(data ?? [])
        setLoading(false)
      })
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit'
    })

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
        <div className="flex-1 flex flex-col items-center px-5 pb-10">
        {/* Header con back button */}
        <div className="w-full max-w-lg mb-8 mt-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg"
            >
              ←
            </button>
          </div>
          <h1 className="text-white font-bold text-2xl text-center -mt-10">Próximas fechas</h1>
        </div>

        {events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 -mt-12">
            <p className="text-4xl">🎵</p>
            <h2 className="text-xl font-bold text-white">No hay eventos próximos</h2>
            <p className="text-gray-400 text-sm max-w-xs">
              Seguinos en redes para enterarte de la próxima fecha.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto w-full">
            {events.map(event => (
              <button
                key={event.id}
                onClick={() => navigate(`/registro?event=${event.id}`)}
                className="group flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm hover:border-emerald-500/50 transition-all active:scale-95 text-left"
              >
                {/* Flyer — portrait 4:5 */}
                <div className="w-full relative" style={{ paddingBottom: '125%' }}>
                  {event.flyer_url ? (
                    <img
                      src={event.flyer_url}
                      alt={event.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/80 gap-2">
                      <span className="text-4xl">🎶</span>
                    </div>
                  )}
                  {/* Gradient overlay for text legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>

                {/* Info */}
                <div className="p-3 space-y-0.5">
                  <p className="text-white font-semibold text-sm leading-tight line-clamp-2 group-hover:text-emerald-300 transition-colors">
                    {event.name}
                  </p>
                  {event.start_date && (
                    <p className="text-gray-400 text-xs leading-tight capitalize">
                      {formatDate(event.start_date)}
                    </p>
                  )}
                  <p className="text-emerald-400 text-xs font-semibold mt-1">
                    Reservar lugar →
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}

// ─── Formulario de registro (con ?event=) ───────────────────────────────────

function EventoForm({ eventParam }: { eventParam: string }) {
  const navigate = useNavigate()
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null)
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [capacityInfo, setCapacityInfo] = useState<{ max: number; current: number } | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoadingEvent(true)
      const { data, error } = await supabase
        .from('events')
        .select('id, name, registrations_open, max_capacity')
        .eq('id', eventParam)
        .eq('is_active', true)
        .single()

      setLoadingEvent(false)
      if (error || !data || !data.registrations_open) return

      setActiveEvent({ id: data.id, name: data.name })

      // Obtener conteo actual si tiene capacidad máxima
      if (data.max_capacity !== null) {
        const { count } = await supabase
          .from('ticket_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', data.id)

        if (count !== null) {
          setCapacityInfo({ max: data.max_capacity, current: count })
        }
      }

      const saved = localStorage.getItem(LS_KEY(data.id))
      if (saved) navigate('/mi-entrada', { replace: true })
    }

    load()
  }, [navigate, eventParam])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEvent) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/registro-entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), event_id: activeEvent.id })
      })

      const data = await res.json()

      if (res.status === 409) {
        setError('Ya tenés una entrada para este evento. Si la perdiste, acercate a la puerta.')
        setSubmitting(false)
        return
      }

      if (!res.ok) {
        setError(data.error || 'Algo salió mal. Intentá de nuevo.')
        setSubmitting(false)
        return
      }

      localStorage.setItem(
        LS_KEY(activeEvent.id),
        JSON.stringify({ token: data.token, name: name.trim(), event_name: activeEvent.name, event_id: activeEvent.id })
      )
      navigate('/mi-entrada')
    } catch {
      setError('Sin conexión. Intentá de nuevo.')
      setSubmitting(false)
    }
  }

  if (loadingEvent) {
    return <FormSkeleton />
  }

  // Ya cargó pero no encontró el evento
  if (!activeEvent) {
    return (
      <PublicLayout>
        <div className="flex-1 flex flex-col items-center px-5 pb-10 pt-2">
          <div className="w-full max-w-lg">
            <button onClick={() => navigate('/registro')} className="text-white/50 hover:text-white/80 transition-colors text-2xl leading-none">←</button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 -mt-12">
          <p className="text-4xl">🎵</p>
          <h2 className="text-2xl font-bold text-white">Este evento no está disponible</h2>
          <p className="text-gray-400 text-sm max-w-xs">El registro puede estar cerrado o el evento ya finalizó.</p>
          <button
            onClick={() => navigate('/registro')}
            className="text-emerald-400 text-sm font-semibold hover:text-emerald-300 transition-colors"
          >
            Ver otros eventos →
          </button>
          </div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center px-5 pb-10">
        <div className="w-full max-w-sm mb-4 pt-2">
          <button onClick={() => navigate('/registro')} className="text-white/50 hover:text-white/80 transition-colors text-2xl leading-none">←</button>
        </div>
        {/* Nombre del evento */}
        <div className="text-center mb-7">
          <p className="text-white/70 text-sm font-semibold uppercase tracking-[0.25em] mb-2">Esta noche</p>
          <h2 className="text-3xl font-bold text-white">{activeEvent.name}</h2>
          <div className="mt-3 inline-flex items-center gap-2 bg-black/50 border border-white/15 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
            <span className="text-white/80 text-xs font-semibold tracking-wide">Entrada disponible</span>
          </div>
          {capacityInfo && (
            <p className={`mt-3 text-xs font-medium ${capacityInfo.current >= capacityInfo.max ? 'text-red-400' : 'text-gray-400'}`}>
              {capacityInfo.current} / {capacityInfo.max} lugares reservados
            </p>
          )}
        </div>

        {/* Card del formulario */}
        <div className="max-w-sm w-full mx-auto">
          <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-white font-bold text-xl">Reservá tu lugar</h3>
              <p className="text-gray-300 text-sm mt-1.5">
                Ponés tu nombre y mail, y te generamos un QR para entrar sin esperar.
              </p>
            </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <label className="sr-only" htmlFor="reg-name">Nombre</label>
                  <input
                    id="reg-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Tu nombre"
                    className="w-full bg-white/15 border border-white/25 rounded-2xl px-4 py-3.5 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition-colors text-sm"
                  />
                  <label className="sr-only" htmlFor="reg-email">Email</label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="Tu email"
                    className="w-full bg-white/15 border border-white/25 rounded-2xl px-4 py-3.5 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition-colors text-sm"
                  />
                </div>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              {capacityInfo && capacityInfo.current >= capacityInfo.max ? (
                <p className="text-center text-red-400 text-sm font-medium py-3">Evento completo</p>
              ) : (
              <button
                type="submit"
                disabled={submitting || !name.trim() || !email.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-600 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
              >
                {submitting ? 'Generando tu entrada...' : 'Quiero mi entrada →'}
              </button>
              )}
            </form>
          </div>

          <p className="text-center text-gray-600 text-xs mt-5">
            El QR queda guardado en este dispositivo
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}

function FormSkeleton() {
  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center px-5 pb-10">
        <div className="w-full max-w-sm mb-4 pt-2">
          <div className="w-10 h-10 rounded-xl bg-white/10" />
        </div>
        <div className="text-center mb-7">
          <div className="h-4 w-24 bg-white/10 rounded-full mx-auto mb-2" />
          <div className="h-8 w-48 bg-white/10 rounded-lg mx-auto" />
        </div>
        <div className="max-w-sm w-full mx-auto">
          <div className="rounded-3xl p-6 space-y-5 border border-white/10 bg-neutral-900">
            <div className="h-6 w-36 bg-white/10 rounded" />
            <div className="h-4 w-56 bg-white/10 rounded" />
            <div className="h-12 w-full bg-white/10 rounded-2xl" />
            <div className="h-12 w-full bg-white/10 rounded-2xl" />
            <div className="h-12 w-full bg-white/10 rounded-2xl" />
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}

export default function RegistroEntrada() {
  const [searchParams] = useSearchParams()
  const eventParam = searchParams.get('event')

  if (!eventParam) return <Cartelera />
  return <EventoForm key={eventParam} eventParam={eventParam} />
}
