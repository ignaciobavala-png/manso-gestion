import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import { guardarTickets, tieneTickets, LS_EMAIL } from '../../lib/entradasStorage'
import { useCoworkLanding } from '../../hooks/useSeccionPublica'

interface EventCard {
  id: string
  name: string
  start_date: string | null
  flyer_url: string | null
  slug: string | null
}

interface ActiveEvent {
  id: string
  name: string
  is_paid: boolean
  is_private: boolean
  private_token: string
  one_ticket_per_email: boolean
  require_instagram: boolean
  require_phone: boolean
  regular_ticket_price: number
  start_date: string | null
  end_date: string | null
  ticket_alias_pago: string | null
  ticket_cbu_pago: string | null
  background_url: string | null
  payment_mode: PaymentMode
  mp_surcharge_pct: number
  cowork_day: boolean
}

type PaymentMode = 'transferencia' | 'mercadopago' | 'ambos'
type MetodoPago = 'transferencia' | 'mercadopago'

interface VenueConfig {
  alias_pago: string | null
  cbu_pago: string | null
}

// ─── Cartelera (sin ?event=) ────────────────────────────────────────────────

function Cartelera() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const eventUrl = (event: EventCard) =>
    event.slug
      ? `${window.location.origin}/registro/${event.slug}`
      : `${window.location.origin}/registro?event=${event.id}`

  const copyLink = (event: EventCard) => {
    navigator.clipboard.writeText(eventUrl(event))
    setCopiedId(event.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, start_date, flyer_url, slug')
      .eq('registrations_open', true)
      .eq('is_private', false)
      // Los pases de cowork tienen su propia sección: un martes a las 9 de la
      // mañana no es "la próxima fecha" que viene a buscar acá.
      .eq('cowork_day', false)
      .is('closed_at', null)
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
                onClick={() => navigate(event.slug ? `/registro/${event.slug}` : `/registro?event=${event.id}`)}
                className="group flex flex-col rounded-2xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-sm hover:border-emerald-500/50 transition-all active:scale-95 text-left"
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
                      onClick={e => { e.stopPropagation(); copyLink(event) }}
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

// ─── Formulario de registro ─────────────────────────────────────────────────

function EventoForm({ eventParam, isSlug = false, privateToken, permitirOtra = false }: { eventParam: string; isSlug?: boolean; privateToken?: string; permitirOtra?: boolean }) {
  const navigate = useNavigate()
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null)
  const [venueConfig, setVenueConfig] = useState<VenueConfig | null>(null)
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [capacityInfo, setCapacityInfo] = useState<{ max: number; current: number } | null>(null)
  const [email, setEmail] = useState('')
  const [attendeeNames, setAttendeeNames] = useState<string[]>([''])
  const [instagram, setInstagram] = useState('')
  const [phone, setPhone] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('transferencia')
  const submittingRef = useRef(false)
  // Misma nota que la landing del cowork: se edita en un solo lugar.
  const coworkLanding = useCoworkLanding()

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
        .select('id, name, registrations_open, max_capacity, is_paid, regular_ticket_price, start_date, end_date, ticket_alias_pago, ticket_cbu_pago, is_private, private_token, one_ticket_per_email, require_instagram, require_phone, background_url, payment_mode, mp_surcharge_pct, cowork_day')
        .eq(isSlug ? 'slug' : 'id', eventParam)
        .is('closed_at', null)
        .single()

      setLoadingEvent(false)
      if (error || !data || !data.registrations_open) return

      // Evento privado: verificar token en URL
      if (data.is_private && data.private_token !== privateToken) return

      // Ya tiene entradas de este evento en este dispositivo: por defecto se
      // lo manda a su QR, que es lo que busca quien reabre el link compartido.
      // Con ?otra=1 no, porque ahí la intención es explícita: viene del botón
      // "Comprar otra entrada". Nada impide comprar de nuevo — el límite por
      // email es una opción por evento (one_ticket_per_email) y la valida el
      // servidor, no esta pantalla.
      if (!permitirOtra && tieneTickets(data.id)) {
        navigate('/mi-entrada')
        return
      }

      setActiveEvent({
        id: data.id,
        name: data.name,
        is_paid: data.is_paid,
        is_private: data.is_private,
        private_token: data.private_token,
        one_ticket_per_email: data.one_ticket_per_email,
        require_instagram: data.require_instagram,
        require_phone: data.require_phone,
        regular_ticket_price: data.regular_ticket_price,
        start_date: data.start_date,
        end_date: data.end_date,
        ticket_alias_pago: data.ticket_alias_pago,
        ticket_cbu_pago: data.ticket_cbu_pago,
        background_url: data.background_url ?? null,
        payment_mode: (data.payment_mode ?? 'transferencia') as PaymentMode,
        mp_surcharge_pct: Number(data.mp_surcharge_pct ?? 0),
        cowork_day: data.cowork_day === true,
      })

      // Con 'ambos' se arranca en transferencia, que es la primera opcion del
      // selector. Mercado Pago queda a un toque de distancia.
      if (data.payment_mode === 'mercadopago') {
        setMetodoPago('mercadopago')
      }

      if (data.max_capacity !== null) {
        const { data: countData } = await supabase
          .rpc('get_event_registration_count', { p_event_id: data.id })

        if (countData !== null) {
          setCapacityInfo({ max: data.max_capacity, current: countData as number })
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
  }, [eventParam, permitirOtra])

  const attendeeCount = attendeeNames.filter(n => n.trim().length > 0).length
  const basePrice = activeEvent?.regular_ticket_price ?? 0
  const surcharge = activeEvent?.mp_surcharge_pct ?? 0

  // El recargo sólo aplica al pagar con MP. Este cálculo es espejo del que
  // hace api/mp/preferencia.ts, que es el que manda: el precio real se
  // resuelve en el servidor y este número es sólo para mostrar.
  const ticketPrice = metodoPago === 'mercadopago' && surcharge > 0
    ? Math.round(basePrice * (1 + surcharge / 100) * 100) / 100
    : basePrice
  const totalAmount = attendeeCount * ticketPrice

  const aceptaMp = activeEvent?.payment_mode === 'mercadopago' || activeEvent?.payment_mode === 'ambos'
  const aceptaTransferencia = activeEvent?.payment_mode === 'transferencia' || activeEvent?.payment_mode === 'ambos'
  const pagandoConMp = activeEvent?.is_paid === true && metodoPago === 'mercadopago' && aceptaMp
  // El comprobante sólo es obligatorio en el camino de transferencia.
  const requiereComprobante = activeEvent?.is_paid === true && !pagandoConMp

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

  const persistirTickets = (tickets: { name: string; token: string }[]) => {
    if (!activeEvent) return
    guardarTickets({
      eventId: activeEvent.id,
      eventName: activeEvent.name,
      endDate: activeEvent.end_date,
      email,
      tickets,
    })
  }

  const handleMercadoPago = async () => {
    if (!activeEvent) return
    if (submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    setError('')

    const validNames = attendeeNames.map(n => n.trim()).filter(n => n.length > 0)

    try {
      const res = await fetch('/api/mp/preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendees: validNames.map(name => ({ name })),
          email: email.trim(),
          event_id: activeEvent.id,
          private_token: activeEvent.is_private ? activeEvent.private_token : undefined,
          instagram: activeEvent.require_instagram ? instagram.trim() : undefined,
          phone: activeEvent.require_phone ? phone.trim() : undefined,
          // El precio no se manda: lo calcula el servidor desde la DB.
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'No se pudo iniciar el pago. Intentá de nuevo.')
        submittingRef.current = false
        setSubmitting(false)
        return
      }

      // Nada de QR todavía: el servidor ni siquiera devuelve los tokens. Si el
      // pago no se acredita no hay entrada, que es el punto del cambio. Lo único
      // que se guarda es el email, para que /mi-entrada pueda recuperar las
      // entradas solo si el pago entra (aunque la persona vuelva más tarde).
      localStorage.setItem(LS_EMAIL, email.trim().toLowerCase())

      window.location.href = data.init_point
    } catch {
      setError('Sin conexión. Intentá de nuevo.')
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEvent) return
    if (submittingRef.current) return

    if (pagandoConMp) {
      handleMercadoPago()
      return
    }

    if (requiereComprobante && !receiptUrl) {
      setError('Subí el comprobante de pago para continuar')
      return
    }

    submittingRef.current = true
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
          receipt_url: receiptUrl || undefined,
          private_token: activeEvent.is_private ? activeEvent.private_token : undefined,
          instagram: activeEvent.require_instagram ? instagram.trim() : undefined,
          phone: activeEvent.require_phone ? phone.trim() : undefined,
          // El precio no se manda: lo resuelve el servidor desde la DB.
        })
      })

      const data = await res.json()

      if (res.status === 409) {
        setError(data.error || 'Conflicto al registrar. Intentá de nuevo.')
        submittingRef.current = false
        setSubmitting(false)
        return
      }

      if (!res.ok) {
        setError(data.error || 'Algo salió mal. Intentá de nuevo.')
        submittingRef.current = false
        setSubmitting(false)
        return
      }

      persistirTickets(data.tickets)
      setSubmitted(true)
      setTimeout(() => navigate('/mi-entrada'), 1800)
    } catch {
      setError('Sin conexión. Intentá de nuevo.')
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (loadingEvent) {
    return <FormSkeleton />
  }

  const backgroundImage = activeEvent?.background_url ?? undefined

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
    <PublicLayout backgroundImage={backgroundImage}>
      <div className="flex-1 flex flex-col items-center px-5 pb-10">
        <div className="w-full max-w-sm mb-4 pt-2">
          <button
            onClick={() => navigate(activeEvent.cowork_day ? '/cowork' : '/registro')}
            className="text-white/50 hover:text-white/80 transition-colors text-2xl leading-none"
          >
            ←
          </button>
        </div>

        <div className="text-center mb-7">
          <p className="text-white/70 text-sm font-semibold uppercase mb-1">
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
                Entrada general · ${ticketPrice.toLocaleString('es-AR')}
              </p>
              {!pagandoConMp && (
                <div className="inline-block bg-white/5 border border-white/20 rounded-xl px-5 py-2.5">
                  <span className="text-white font-bold text-sm">Alias: </span>
                  <span className="text-white font-mono font-semibold tracking-wide">{activeEvent.ticket_alias_pago || venueConfig?.alias_pago || 'MANSO.CLUB'}</span>
                </div>
              )}
            </div>
          )}
          {!activeEvent.is_paid && (
            <p className="mt-2 text-emerald-400/70 text-sm font-medium">
              Entrada gratuita
            </p>
          )}
          {capacityInfo && (
            <p className={`mt-3 text-xs font-medium ${capacityInfo.current >= capacityInfo.max ? 'text-red-400' : 'text-gray-400'}`}>
              {capacityInfo.current} / {capacityInfo.max} lugares reservados
            </p>
          )}
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="bg-black/60 backdrop-blur-md border border-white/25 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-white font-bold text-xl">Reservá tu lugar</h3>
              <p className="text-gray-300 text-sm mt-1.5">
                Descargá el QR a continuación :)
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

              {!activeEvent.one_ticket_per_email && (
                <button
                  type="button"
                  onClick={addAttendee}
                  className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-2xl py-3 text-gray-400 hover:text-gray-200 transition-colors text-sm"
                >
                  <span className="text-lg">+</span> Agregar otra entrada
                </button>
              )}

              {activeEvent.cowork_day && (activeEvent.require_instagram || activeEvent.require_phone) && (
                <div className="flex items-start gap-3 p-3 bg-white/5 border border-white/25 rounded-2xl">
                  <span className="text-xl leading-none">👋</span>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    {coworkLanding.notaDatos}
                  </p>
                </div>
              )}

              {activeEvent.require_instagram && (
                <div>
                  <label className="text-white/70 text-xs font-medium mb-1.5 block">Instagram <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <input
                      type="text"
                      value={instagram}
                      onChange={e => setInstagram(e.target.value.replace(/^@/, ''))}
                      required
                      placeholder=""
                      className="w-full bg-white/15 border border-white/25 rounded-2xl pl-8 pr-4 py-3.5 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition-colors text-sm"
                    />
                  </div>
                </div>
              )}

              {activeEvent.require_phone && (
                <div>
                  <label className="text-white/70 text-xs font-medium mb-1.5 block">Teléfono <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    placeholder="Ej: 11 2345 6789"
                    className="w-full bg-white/15 border border-white/25 rounded-2xl px-4 py-3.5 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition-colors text-sm"
                  />
                </div>
              )}

              {activeEvent.is_paid && (
                <>
                  <div className="border-t border-white/20" />

                  {/* Selector visible sólo cuando el evento acepta las dos vías */}
                  {aceptaMp && aceptaTransferencia && (
                    <div className="space-y-2">
                      <p className="text-white/70 text-xs font-medium">¿Cómo querés pagar?</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMetodoPago('transferencia')}
                          className={`rounded-2xl py-3 px-3 text-sm font-semibold transition-all active:scale-95 border ${
                            metodoPago === 'transferencia'
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-white/5 border-white/25 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          Transferencia
                        </button>
                        <button
                          type="button"
                          onClick={() => setMetodoPago('mercadopago')}
                          className={`rounded-2xl py-3 px-3 text-sm font-semibold transition-all active:scale-95 border ${
                            metodoPago === 'mercadopago'
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-white/5 border-white/25 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          Mercado Pago
                        </button>
                      </div>
                    </div>
                  )}

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

                      {!pagandoConMp && (activeEvent.ticket_alias_pago || venueConfig?.alias_pago || activeEvent.ticket_cbu_pago || venueConfig?.cbu_pago) && (
                        <div className="mt-3 pt-3 border-t border-emerald-800/30 text-xs space-y-1">
                          <p className="text-gray-400 font-medium mb-1">Datos para transferencia:</p>
                          {(activeEvent.ticket_alias_pago || venueConfig?.alias_pago) && (
                            <p className="text-gray-300 flex justify-between">
                              <span>Alias:</span>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(activeEvent.ticket_alias_pago || venueConfig?.alias_pago || '')}
                                className="text-white font-mono hover:text-emerald-300 transition-colors"
                              >
                                {activeEvent.ticket_alias_pago || venueConfig?.alias_pago}
                              </button>
                            </p>
                          )}
                          {(activeEvent.ticket_cbu_pago || venueConfig?.cbu_pago) && (
                            <p className="text-gray-300 flex justify-between">
                              <span>CBU:</span>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(activeEvent.ticket_cbu_pago || venueConfig?.cbu_pago || '')}
                                className="text-white font-mono hover:text-emerald-300 transition-colors text-xs"
                              >
                                {activeEvent.ticket_cbu_pago || venueConfig?.cbu_pago}
                              </button>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {pagandoConMp && (
                    <div className="flex items-start gap-3 p-3 bg-white/5 border border-white/25 rounded-2xl">
                      <span className="text-xl leading-none">🔒</span>
                      <p className="text-gray-300 text-xs leading-relaxed">
                        Te vamos a llevar a Mercado Pago. Apenas se acredite el
                        pago volvés acá y te aparece tu QR. Si no completás el
                        pago no se genera la entrada.
                      </p>
                    </div>
                  )}

                  {requiereComprobante && (
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
                  )}
                </>
              )}

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              {submitted ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold text-sm">¡Entrada registrada!</p>
                  <p className="text-gray-400 text-xs">Preparando tu QR...</p>
                </div>
              ) : capacityInfo && capacityInfo.current >= capacityInfo.max ? (
                <p className="text-center text-red-400 text-sm font-medium py-3">Evento completo</p>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || !email.trim() || attendeeCount === 0 || (requiereComprobante && !receiptUrl) || (activeEvent.require_instagram && !instagram.trim()) || (activeEvent.require_phone && !phone.trim())}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-400 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
                >
                  {submitting
                    ? (pagandoConMp ? 'Redirigiendo a Mercado Pago...' : 'Generando entradas...')
                    : pagandoConMp
                      ? `Pagar $${totalAmount.toLocaleString('es-AR')} con Mercado Pago →`
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
          <div className="rounded-3xl p-6 space-y-5 border border-white/20 bg-neutral-900">
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
  const { slug } = useParams<{ slug: string }>()
  const eventQueryParam = searchParams.get('event')
  const tokenParam = searchParams.get('token') ?? undefined
  // ?otra=1 lo pone el botón "Comprar otra entrada" de /mi-entrada: es la
  // señal de que el asistente quiere el formulario aunque ya tenga entradas.
  const otraParam = searchParams.get('otra') === '1'

  if (slug) return <EventoForm key={slug} eventParam={slug} isSlug={true} privateToken={tokenParam} permitirOtra={otraParam} />
  if (eventQueryParam) return <EventoForm key={eventQueryParam} eventParam={eventQueryParam} isSlug={false} privateToken={tokenParam} permitirOtra={otraParam} />
  return <Cartelera />
}
