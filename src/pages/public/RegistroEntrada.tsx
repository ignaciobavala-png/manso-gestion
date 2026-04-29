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
  is_paid: boolean
  regular_ticket_price: number
  start_date: string | null
}

interface VenueConfig {
  alias_pago: string | null
  cbu_pago: string | null
}

const LS_KEY = (eventId: string) => `manso_tickets_${eventId}`

// ─── Cartelera (sin ?event=) ────────────────────────────────────────────────

function Cartelera() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyLink = (eventId: string) => {
    const url = `${window.location.origin}/registro?event=${eventId}`
    navigator.clipboard.writeText(url)
    setCopiedId(eventId)
    setTimeout(() => setCopiedId(null), 2000)
  }

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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>

                <div className="p-3 space-y-0.5">
                  <p className="text-white font-semibold text-sm leading-tight line-clamp-2 group-hover:text-emerald-300 transition-colors">
                    {event.name}
                  </p>
                  {event.start_date && (
                    <p className="text-gray-400 text-xs leading-tight capitalize">
                      {formatDate(event.start_date)}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-emerald-400 text-xs font-semibold">
                      Reservar lugar →
                    </p>
                    <span className="text-white/20 mx-0.5">·</span>
                    <button
                      onClick={e => { e.stopPropagation(); copyLink(event.id) }}
                      className="text-gray-400 hover:text-emerald-300 text-xs transition-colors active:scale-90"
                    >
                      {copiedId === event.id ? '✓ Link copiado' : 'Copiar link'}
                    </button>
                  </div>
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
  const [venueConfig, setVenueConfig] = useState<VenueConfig | null>(null)
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [capacityInfo, setCapacityInfo] = useState<{ max: number; current: number } | null>(null)
  const [email, setEmail] = useState('')
  const [attendeeNames, setAttendeeNames] = useState<string[]>([''])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleReceiptUpload = async (file: File) => {
    if (!activeEvent) return
    setReceiptFile(file)
    setUploading(true)
    setUploadError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${activeEvent.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: storageError } = await supabase.storage
        .from('comprobantes')
        .upload(path, file, { upsert: false })
      if (storageError) throw storageError
      const { data: urlData } = supabase.storage
        .from('comprobantes')
        .getPublicUrl(path)
      setReceiptUrl(urlData.publicUrl)
    } catch {
      setUploadError('Error al subir el comprobante. Intentá de nuevo.')
      setReceiptFile(null)
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    async function load() {
      setLoadingEvent(true)
      const { data, error } = await supabase
        .from('events')
        .select('id, name, registrations_open, max_capacity, is_paid, regular_ticket_price, start_date')
        .eq('id', eventParam)
        .eq('is_active', true)
        .single()

      setLoadingEvent(false)
      if (error || !data || !data.registrations_open) return

      setActiveEvent({
        id: data.id,
        name: data.name,
        is_paid: data.is_paid,
        regular_ticket_price: data.regular_ticket_price,
        start_date: data.start_date,
      })

      if (data.max_capacity !== null) {
        const { count } = await supabase
          .from('ticket_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', data.id)

        if (count !== null) {
          setCapacityInfo({ max: data.max_capacity, current: count })
        }
      }
    }

    load()

    supabase
      .from('venue_config')
      .select('alias_pago, cbu_pago')
      .single()
      .then(({ data }) => {
        if (data) setVenueConfig(data)
      })
  }, [eventParam])

  const attendeeCount = attendeeNames.filter(n => n.trim().length > 0).length
  const ticketPrice = activeEvent?.regular_ticket_price ?? 0
  const totalAmount = attendeeCount * ticketPrice

  const setAttendeeName = (index: number, value: string) => {
    setAttendeeNames(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const addAttendee = () => {
    setAttendeeNames(prev => [...prev, ''])
  }

  const removeAttendee = (index: number) => {
    setAttendeeNames(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEvent) return

    if (activeEvent.is_paid && !receiptUrl) {
      setError('Subí el comprobante de pago para continuar')
      return
    }

    setSubmitting(true)
    setError('')

    const validNames = attendeeNames.map(n => n.trim()).filter(n => n.length > 0)

    try {
      const res = await fetch('/api/registro-entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendees: validNames.map(name => ({ name })),
          email: email.trim(),
          event_id: activeEvent.id,
          receipt_url: receiptUrl || undefined
        })
      })

      const data = await res.json()

      if (res.status === 409) {
        setError(data.error || 'Conflicto al registrar. Intentá de nuevo.')
        setSubmitting(false)
        return
      }

      if (!res.ok) {
        setError(data.error || 'Algo salió mal. Intentá de nuevo.')
        setSubmitting(false)
        return
      }

      const tickets = data.tickets.map((t: { name: string; token: string }) => ({
        token: t.token,
        name: t.name,
        event_name: activeEvent.name,
        event_id: activeEvent.id,
      }))

      localStorage.setItem(LS_KEY(activeEvent.id), JSON.stringify(tickets))
      navigate('/mi-entrada')
    } catch {
      setError('Sin conexión. Intentá de nuevo.')
      setSubmitting(false)
    }
  }

  if (loadingEvent) {
    return <FormSkeleton />
  }

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

        <div className="text-center mb-7">
          <p className="text-white/70 text-sm font-semibold uppercase tracking-[0.25em] mb-2">
            {activeEvent.start_date
              ? new Date(activeEvent.start_date).toLocaleString('es-AR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                  hour: '2-digit', minute: '2-digit',
                })
              : 'Esta noche'}
          </p>
          <h2 className="text-3xl font-bold text-white">{activeEvent.name}</h2>
          {activeEvent.is_paid && activeEvent.regular_ticket_price > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-emerald-400 text-sm font-medium">
                Entrada general · ${activeEvent.regular_ticket_price.toLocaleString('es-AR')}
              </p>
              <div className="inline-block bg-white/5 border border-white/10 rounded-xl px-5 py-2.5">
                <span className="text-white font-bold text-sm">Alias: </span>
                <span className="text-white font-mono font-semibold tracking-wide">{venueConfig?.alias_pago || 'MANSO.CLUB'}</span>
              </div>
            </div>
          )}
          {!activeEvent.is_paid && (
            <p className="mt-2 text-emerald-400/70 text-sm font-medium">
              Entrada gratuita
            </p>
          )}
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

        <div className="max-w-sm w-full mx-auto">
          <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-white font-bold text-xl">Reservá tu lugar</h3>
              <p className="text-gray-300 text-sm mt-1.5">
                Ponés tu mail y los nombres de quienes vienen, y te generamos un QR para cada uno.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-white/70 text-xs font-medium mb-1.5 block">Tu email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="email@ejemplo.com"
                  className="w-full bg-white/15 border border-white/25 rounded-2xl px-4 py-3.5 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition-colors text-sm"
                />
              </div>

              <div className="space-y-3">
                <label className="text-white/70 text-xs font-medium block">Nombres de los asistentes</label>

                {attendeeNames.map((nameValue, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={e => setAttendeeName(i, e.target.value)}
                      required
                      autoComplete="name"
                      placeholder={`Asistente ${i + 1}`}
                      className="flex-1 bg-white/15 border border-white/25 rounded-2xl px-4 py-3.5 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition-colors text-sm"
                    />
                    {attendeeNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAttendee(i)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-900/40 hover:bg-red-800/60 text-red-400 transition-colors text-lg flex-shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addAttendee}
                className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-2xl py-3 text-gray-400 hover:text-gray-200 transition-colors text-sm"
              >
                <span className="text-lg">+</span> Agregar otra entrada
              </button>

              {activeEvent.is_paid && (
                <>
                  <div className="border-t border-white/10" />

                  {attendeeCount > 0 && ticketPrice > 0 && (
                    <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Entradas</span>
                        <span className="text-white font-medium">{attendeeCount} × ${ticketPrice.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="border-t border-emerald-800/30 pt-2 flex justify-between">
                        <span className="text-white font-semibold">Total a pagar</span>
                        <span className="text-emerald-300 font-bold text-lg">${totalAmount.toLocaleString('es-AR')}</span>
                      </div>

                      {venueConfig && (venueConfig.alias_pago || venueConfig.cbu_pago) && (
                        <div className="mt-3 pt-3 border-t border-emerald-800/30 text-xs space-y-1">
                          <p className="text-gray-400 font-medium mb-1">Datos para transferencia:</p>
                          {venueConfig.alias_pago && (
                            <p className="text-gray-300 flex justify-between">
                              <span>Alias:</span>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(venueConfig.alias_pago!)}
                                className="text-white font-mono hover:text-emerald-300 transition-colors"
                              >
                                {venueConfig.alias_pago}
                              </button>
                            </p>
                          )}
                          {venueConfig.cbu_pago && (
                            <p className="text-gray-300 flex justify-between">
                              <span>CBU:</span>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(venueConfig.cbu_pago!)}
                                className="text-white font-mono hover:text-emerald-300 transition-colors text-xs"
                              >
                                {venueConfig.cbu_pago}
                              </button>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-white text-sm font-medium">Subí tu comprobante de pago</p>
                    {!receiptUrl ? (
                      <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-white/25 rounded-2xl cursor-pointer hover:border-emerald-400/50 transition-colors">
                        {uploading ? (
                          <div className="flex items-center gap-2 text-gray-400">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-emerald-400" />
                            <span className="text-sm">Subiendo...</span>
                          </div>
                        ) : (
                          <>
                            <span className="text-2xl">📎</span>
                            <span className="text-gray-400 text-sm">Tocá para seleccionar una foto</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={ev => {
                            const file = ev.target.files?.[0]
                            if (file) handleReceiptUpload(file)
                            ev.target.value = ''
                          }}
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-emerald-900/30 border border-emerald-700/40 rounded-2xl">
                        <span className="text-xl">✅</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-emerald-300 text-sm font-medium">Comprobante subido</p>
                          <p className="text-gray-400 text-xs truncate">{receiptFile?.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setReceiptFile(null); setReceiptUrl('') }}
                          className="text-gray-400 hover:text-red-400 text-sm transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {uploadError && <p className="text-red-400 text-sm text-center">{uploadError}</p>}
                  </div>
                </>
              )}

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              {capacityInfo && capacityInfo.current >= capacityInfo.max ? (
                <p className="text-center text-red-400 text-sm font-medium py-3">Evento completo</p>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || !email.trim() || attendeeCount === 0 || (activeEvent.is_paid && !receiptUrl)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-600 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
                >
                  {submitting
                    ? 'Generando entradas...'
                    : attendeeCount > 1
                      ? `Reservar ${attendeeCount} entradas →`
                      : 'Quiero mi entrada →'}
                </button>
              )}
            </form>
          </div>


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
