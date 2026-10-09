import { ArrowLeft, CalendarPlus, MapPin, Ticket } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import CarnetMiembro, { type Carnet } from '../../components/CarnetMiembro'
import { guardarCredencial } from '../../lib/credencialCowork'
import { fechaEntrada, infoEventos, urlMaps, descargarCalendario, guardarTickets, type InfoEvento, LS_END, LS_TICKETS } from '../../lib/entradasStorage'

interface TicketData {
  token: string
  name: string
  event_name: string
  event_id: string
  event_start?: string | null
  event_end?: string | null
  event_address?: string | null
  isFinished?: boolean
  /** Último estado conocido (get_tickets_por_token). undefined = nunca se
   *  consultó; se guarda para que el aviso se vea también sin conexión. */
  estado?: EstadoEntrada
}

type EstadoEntrada = 'valida' | 'usada' | 'anulada' | 'pendiente'

interface FilaPorToken {
  token: string
  name: string
  event_id: string
  estado: EstadoEntrada
}

/** Tope de get_tickets_por_token: más que esto lo ignora la función. */
const MAX_TOKENS = 50

/**
 * Las entradas de estos tokens, con su estado. Es la única consulta de
 * entradas que hace esta pantalla: quien pregunta ya tiene el QR, así que no
 * se entera de nada nuevo. Por email no se muestra nada; se manda al mail
 * (api/reenviar-entradas.ts, migración 041).
 */
async function entradasPorToken(tokens: string[]): Promise<FilaPorToken[] | null> {
  if (tokens.length === 0) return []
  const { data, error } = await supabase.rpc('get_tickets_por_token', { p_tokens: tokens.slice(0, MAX_TOKENS) })
  if (error) return null
  return (data as FilaPorToken[] | null) ?? []
}

/** Los tokens de /mi-entrada#t=a,b,c (el botón de los mails). Van en el
 *  fragmento y no en la query para que nunca lleguen al servidor ni a sus
 *  logs (ver urlMisEntradas en api/_lib/mailEntradas.ts). */
function tokensDelLink(): string[] {
  const t = new URLSearchParams(window.location.hash.slice(1)).get('t')
  if (!t) return []
  return t.split(',').map(s => s.trim()).filter(s => /^[A-Za-z0-9-]{8,80}$/.test(s)).slice(0, MAX_TOKENS)
}

/** Guarda en el dispositivo las entradas del link del mail. Sólo las que
 *  valen o ya se usaron: una sin pagar o anulada no tiene nada que mostrar. */
async function cargarDelLink(tokens: string[]): Promise<void> {
  const filas = (await entradasPorToken(tokens))?.filter(f => f.estado === 'valida' || f.estado === 'usada') ?? []
  if (filas.length === 0) return
  const eventos = await infoEventos([...new Set(filas.map(f => f.event_id))])
  const porEvento = new Map<string, FilaPorToken[]>()
  for (const f of filas) porEvento.set(f.event_id, [...(porEvento.get(f.event_id) ?? []), f])
  for (const [eventId, delEvento] of porEvento) {
    const ev = eventos.get(eventId)
    if (!ev) continue
    guardarTickets({
      eventId,
      eventName: ev.name,
      info: ev.info,
      endDate: ev.fin,
      tickets: delEvento.map(f => ({ name: f.name, token: f.token })),
    })
  }
}

/** Las entradas de un mismo evento. Se agrupan para poder ofrecer "Comprar
 *  otra entrada" apuntando al evento correcto cuando hay más de uno guardado. */
interface EventoGuardado {
  eventId: string
  eventName: string
  isFinished: boolean
  sortVal: number
  tickets: TicketData[]
}

function GlowBorder({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl p-[1.5px] overflow-hidden ${className}`}>
      <div
        className="absolute animate-spin pointer-events-none"
        style={{
          inset: '-50%',
          background: 'conic-gradient(from 0deg, transparent 0%, transparent 88%, rgba(16,185,129,0.5) 94%, rgba(110,231,183,0.7) 97%, transparent 100%)',
          animationDuration: '4s',
          animationTimingFunction: 'linear',
        }}
      />
      {children}
    </div>
  )
}

/** La entrada con la fecha y el lugar del evento puestos. Sin info (el
 *  evento no se pudo leer) quedan undefined, para completarse más adelante. */
function conInfo(t: TicketData, info: InfoEvento | undefined): TicketData {
  if (!info) return t
  return { ...t, event_start: info.start, event_end: info.end, event_address: info.direccion }
}

/** El carnet de cowork de esa persona, si es miembro.
 *
 *  Acá la identidad sigue siendo el mail. Las entradas dejaron de funcionar
 *  así (041: por email se reenvían al mail, no se muestran); el carnet
 *  todavía no, pendiente de decidir (docs/COWORK.md). Encontrarlo deja además
 *  la credencial guardada en este navegador, que es lo que hace que los QR de
 *  las salas lo reconozcan: el que perdió su link lo recupera solo. */
type CarnetConToken = Carnet & { token: string }

async function buscarCarnet(mail: string): Promise<CarnetConToken | null> {
  const { data } = await supabase.rpc('cowork_carnet_por_email', { p_email: mail })
  const c = ((data as CarnetConToken[] | null) ?? [])[0] ?? null
  if (c) guardarCredencial(c.token)
  return c
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function purgeExpiredTickets() {
  const keysToDelete: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('manso_tickets_')) continue
    if (key.startsWith('manso_tickets_ts_') || key.startsWith('manso_tickets_end_')) continue
    const eventId = key.slice('manso_tickets_'.length)
    const endDateStr = localStorage.getItem(`manso_tickets_end_${eventId}`)
    if (endDateStr) {
      if (Date.now() - new Date(endDateStr).getTime() > TWO_DAYS_MS) {
        keysToDelete.push(key, `manso_tickets_ts_${eventId}`, `manso_tickets_end_${eventId}`)
      }
    } else {
      // fallback para tickets sin end_date guardado (registrados antes del feature)
      const ts = parseInt(localStorage.getItem(`manso_tickets_ts_${eventId}`) ?? '0')
      if (ts > 0 && Date.now() - ts > SEVEN_DAYS_MS) {
        keysToDelete.push(key, `manso_tickets_ts_${eventId}`, `manso_tickets_end_${eventId}`)
      }
    }
  }
  keysToDelete.forEach(k => localStorage.removeItem(k))
}

/** Las entradas guardadas, agrupadas por evento: primero las que vienen, de
 *  la más próxima a la más lejana (la de esta noche tiene que quedar arriba),
 *  y abajo las que ya pasaron, de la más reciente a la más vieja. */
function getAllStoredGroups(): EventoGuardado[] {
  purgeExpiredTickets()
  const META_PREFIXES = ['manso_tickets_ts_', 'manso_tickets_end_']
  const events: EventoGuardado[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('manso_tickets_')) continue
    if (META_PREFIXES.some(p => key.startsWith(p))) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as TicketData[]
      if (!Array.isArray(parsed) || parsed.length === 0) continue
      const eventId = key.slice('manso_tickets_'.length)
      const endDateStr = localStorage.getItem(`manso_tickets_end_${eventId}`)
      const fallbackTs = parseInt(localStorage.getItem(`manso_tickets_ts_${eventId}`) ?? '0')
      events.push({
        eventId,
        eventName: parsed[0].event_name ?? 'Evento',
        sortVal: endDateStr ? new Date(endDateStr).getTime() : fallbackTs,
        isFinished: endDateStr ? new Date(endDateStr) < new Date() : false,
        tickets: parsed,
      })
    } catch { /* ignorar entradas corruptas */ }
  }
  events.sort((a, b) => {
    if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1
    return a.isFinished ? b.sortVal - a.sortVal : a.sortVal - b.sortVal
  })
  return events
}

function TicketCard({ ticket, isFinished = false }: { ticket: TicketData; isFinished?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [downloading, setDownloading] = useState(false)
  // Anulada (Rechazar QR) o sin pago: el lector la rechaza, que no parezca válida.
  const noVale = ticket.estado === 'anulada' || ticket.estado === 'pendiente'

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, `manso-ticket|${ticket.token}`, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    })
  }, [ticket])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 50)) // esperar render del canvas

      const card = document.createElement('canvas')
      card.width = 400
      card.height = 520
      const ctx = card.getContext('2d')!

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, 400, 520)
      ctx.fillStyle = '#065f46'
      ctx.fillRect(0, 0, 400, 5)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 28px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('MANSO', 200, 52)

      ctx.fillStyle = '#6b7280'
      ctx.font = '10px system-ui, sans-serif'
      ctx.fillText('ENTRADA DIGITAL', 200, 70)

      ctx.fillStyle = '#34d399'
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillText(ticket.event_name, 200, 98)

      if (ticket.event_start) {
        ctx.fillStyle = '#d1d5db'
        ctx.font = '12px system-ui, sans-serif'
        ctx.fillText(fechaEntrada(ticket.event_start), 200, 118)
      }

      if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, 80, 134)
      }

      ctx.fillStyle = '#f9fafb'
      ctx.font = 'bold 18px system-ui, sans-serif'
      ctx.fillText(ticket.name, 200, 400)

      ctx.fillStyle = '#6b7280'
      ctx.font = '11px system-ui, sans-serif'
      ctx.fillText('Guardá esta imagen. No necesitás internet en la puerta.', 200, 426)

      ctx.fillStyle = '#065f46'
      ctx.fillRect(0, 448, 400, 5)

      card.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `manso-entrada-${ticket.name.toLowerCase().replace(/\s+/g, '-')}.png`
        a.click()
        URL.revokeObjectURL(url)
        setDownloading(false)
      }, 'image/png')
    } catch {
      setDownloading(false)
    }
  }

  return (
    <div className={`backdrop-blur-md rounded-3xl overflow-hidden border ${isFinished ? 'bg-black/40 border-white/5' : 'bg-black/60 border-white/20'}`}>
      <div className={`h-1 bg-gradient-to-r ${isFinished ? 'from-neutral-700 via-neutral-600 to-neutral-700' : 'from-terra-700 via-terra-500 to-terra-700'}`} />

      <div className="px-6 pt-5 pb-6 flex flex-col items-center">
        <p className={`text-[10px] tracking-[3px] uppercase mb-1 ${isFinished ? 'text-gray-400' : 'text-gray-400'}`}>
          {isFinished ? 'evento finalizado' : 'entrada digital'}
        </p>
        <p className={`text-sm font-medium ${ticket.event_start ? 'mb-0.5' : 'mb-4'} ${isFinished ? 'text-gray-400' : 'text-terra-400'}`}>{ticket.event_name}</p>
        {ticket.event_start && (
          <p className={`text-xs ${ticket.event_address ? 'mb-1' : 'mb-4'} ${isFinished ? 'text-gray-500' : 'text-white/70'}`}>{fechaEntrada(ticket.event_start)}</p>
        )}
        {ticket.event_address && (
          <a
            href={urlMaps(ticket.event_address)}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs mb-4 flex items-center gap-1 underline decoration-white/30 underline-offset-2 hover:decoration-white/70 ${isFinished ? 'text-gray-500' : 'text-white/70'}`}
          >
            <MapPin size={12} aria-hidden />
            {ticket.event_address}
          </a>
        )}

        <div className={`rounded-2xl p-3 shadow-2xl ${isFinished || noVale ? 'bg-white/80' : 'bg-white'}`}>
          <canvas ref={canvasRef} className={`block ${isFinished || noVale ? 'opacity-60' : ''}`} style={{ width: 200, height: 200 }} />
        </div>

        <p className="text-white font-bold text-lg mt-4">{ticket.name}</p>
        {ticket.estado === 'anulada' ? (
          <p className="text-red-400 text-xs mt-1">Esta entrada fue anulada: no sirve para entrar.</p>
        ) : ticket.estado === 'pendiente' ? (
          <p className="text-amber-300 text-xs mt-1">El pago de esta entrada todavía no se confirmó.</p>
        ) : (
          <p className="text-gray-400 text-xs mt-1">
            {isFinished ? 'Este evento ya finalizó.' : 'Mostrá este QR en la puerta de ingreso.'}
          </p>
        )}
      </div>

      <div className="border-t border-white/5 px-6 py-3 flex gap-2">
        <GlowBorder className="flex-1">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="relative w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white font-medium py-2.5 rounded-2xl transition-all active:scale-95 text-sm"
          >
            {downloading ? 'Generando...' : 'Descargar entrada'}
          </button>
        </GlowBorder>
        {ticket.event_start && !isFinished && (
          <button
            onClick={() => descargarCalendario(ticket, `${window.location.origin}/mi-entrada`)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white/80 font-medium py-2.5 rounded-2xl transition-all active:scale-95 text-sm"
          >
            <CalendarPlus size={15} aria-hidden />
            Agendar
          </button>
        )}
      </div>

      <div className="h-1 bg-gradient-to-r from-terra-700 via-terra-500 to-terra-700" />
    </div>
  )
}

export default function MiEntrada() {
  const navigate = useNavigate()
  const [grupos, setGrupos] = useState<EventoGuardado[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEmailSearch, setShowEmailSearch] = useState(false)
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  /** Lo que respondió el reenvío por mail; se ve en las dos pantallas. */
  const [avisoMail, setAvisoMail] = useState('')
  const [carnet, setCarnet] = useState<CarnetConToken | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      // Link del mail: se guardan esas entradas antes de pintar, y después
      // se saca el #t= de la barra para que los tokens no queden en el
      // historial. Guardar es idempotente (dedupe por token), así que una
      // segunda corrida del efecto no duplica nada.
      const delLink = tokensDelLink()
      if (delLink.length > 0) {
        await cargarDelLink(delLink)
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
        if (cancelado) return
      }

      // Primero se pinta lo que hay en el dispositivo, sin esperar a la red:
      // el QR tiene que aparecer aunque la conexión en la puerta sea mala.
      const guardados = getAllStoredGroups()
      setGrupos(guardados.length > 0 ? guardados : null)
      setLoading(false)

      // Entradas guardadas antes de finDelEvento quedaron sin fecha de fin y
      // se ordenaban por cuándo se guardaron; las de antes de event_start o
      // event_address, sin la fecha y el lugar que muestra el QR. Se
      // completan y se vuelve a armar la lista, que de paso purga las que ya
      // vencieron.
      const faltaInfo = (g: EventoGuardado) =>
        g.tickets.some(t => t.event_start === undefined || t.event_address === undefined)
      const incompletos = guardados
        .filter(g => !localStorage.getItem(LS_END(g.eventId)) || faltaInfo(g))
        .map(g => g.eventId)
      if (incompletos.length > 0) {
        const evs = await infoEventos(incompletos)
        if (cancelado) return
        let completadas = 0
        for (const [id, ev] of evs) {
          if (ev.fin && !localStorage.getItem(LS_END(id))) { localStorage.setItem(LS_END(id), ev.fin); completadas++ }
          const grupo = guardados.find(g => g.eventId === id)
          if (grupo && faltaInfo(grupo)) {
            const completos = grupo.tickets.map(t => conInfo(t, ev.info))
            localStorage.setItem(`manso_tickets_${id}`, JSON.stringify(completos))
            completadas++
          }
        }
        if (completadas > 0) {
          const corregidos = getAllStoredGroups()
          setGrupos(corregidos.length > 0 ? corregidos : null)
        }
      }

      // El carnet no depende del evento activo —un coworker viene un martes a
      // la mañana, sin que haya ningún show— así que se pide antes y aparte.
      const mailGuardado = localStorage.getItem('manso_email')
      if (mailGuardado) {
        const c = await buscarCarnet(mailGuardado)
        if (cancelado) return
        if (c) setCarnet(c)
      }

      // Estado al día de las entradas que este dispositivo ya tiene, por sus
      // tokens: si Ana rechazó una, que el QR no se muestre como válido.
      // Antes esto traía todo lo del manso_email guardado; ya no se pregunta
      // por email. Sólo se actualiza: nunca se borra ni se agrega nada.
      const vigentes = getAllStoredGroups().filter(g => !g.isFinished)
      const filas = await entradasPorToken(vigentes.flatMap(g => g.tickets.map(t => t.token)))
      if (cancelado || !filas) return
      const estados = new Map(filas.map(f => [f.token, f.estado]))
      let cambios = 0
      for (const g of vigentes) {
        const tickets = g.tickets.map(t => {
          const estado = estados.get(t.token)
          if (!estado || estado === t.estado) return t
          cambios++
          return { ...t, estado }
        })
        if (tickets.some((t, i) => t !== g.tickets[i])) {
          localStorage.setItem(LS_TICKETS(g.eventId), JSON.stringify(tickets))
        }
      }
      if (cambios > 0) {
        const actualizados = getAllStoredGroups()
        setGrupos(actualizados.length > 0 ? actualizados : null)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [])

  const handleEmailSearch = async () => {
    if (!email.trim()) return
    setSearching(true)
    setSearchError('')
    setAvisoMail('')

    // Las entradas no se muestran: se mandan al mail. La respuesta es la
    // misma haya o no, así esto no sirve para averiguar si alguien compró.
    const mail = email.trim().toLowerCase()
    const [res, suCarnet] = await Promise.all([
      fetch('/api/reenviar-entradas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail }),
      }).catch(() => null),
      buscarCarnet(mail),
    ])
    let respuesta: { mensaje?: string; error?: string } = {}
    try { respuesta = res ? await res.json() : {} } catch { /* respuesta vacía */ }
    setSearching(false)

    if (!res?.ok) {
      setSearchError(respuesta.error ?? 'No pudimos procesar el pedido. Probá de nuevo.')
      return
    }

    if (suCarnet) {
      localStorage.setItem('manso_email', mail)
      setCarnet(suCarnet)
    }
    setAvisoMail(respuesta.mensaje ?? 'Si hay entradas con ese mail, te llegan en unos minutos.')
  }

  if (loading) {
    return (
      <PublicLayout showHeader={false}>
        <div className="flex-1 flex flex-col items-center px-5 pb-10 max-w-sm w-full mx-auto">
          <div className="w-full flex justify-start mb-4 mt-1">
            <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
          </div>
          <div className="w-full space-y-5">
            {[0, 1].map(i => (
              <div key={i} className="bg-white/5 rounded-3xl overflow-hidden animate-pulse">
                <div className="h-1 bg-white/10" />
                <div className="px-6 pt-5 pb-6 flex flex-col items-center gap-4">
                  <div className="h-3 w-24 bg-white/10 rounded-full" />
                  <div className="h-4 w-36 bg-white/10 rounded-full" />
                  <div className="w-[200px] h-[200px] bg-white/10 rounded-2xl" />
                  <div className="h-5 w-32 bg-white/10 rounded-full mt-1" />
                  <div className="h-3 w-48 bg-white/10 rounded-full" />
                </div>
                <div className="border-t border-white/5 px-6 py-3">
                  <div className="h-10 bg-white/10 rounded-2xl" />
                </div>
                <div className="h-1 bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </PublicLayout>
    )
  }

  const totalTickets = grupos?.reduce((acc, g) => acc + g.tickets.length, 0) ?? 0

  if (grupos === null && !carnet) {
    return (
      <PublicLayout showHeader={false}>
        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10 max-w-sm w-full mx-auto text-center gap-5">
          <div className="w-full flex justify-start -mb-2">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
              aria-label="Volver"
            >
              <ArrowLeft size={20} strokeWidth={1.5} />
            </button>
          </div>

          <Ticket className="text-manso-cream/40" size={48} strokeWidth={1.25} aria-hidden />
          <div>
            <h2 className="text-xl font-bold text-white">No hay nada guardado acá</h2>
            <p className="text-gray-400 text-sm mt-2 max-w-xs">
              Las entradas se guardan solo en el dispositivo donde las
              registraste. Con tu email te las volvemos a mandar por mail y, si
              sos del cowork, te mostramos tu carnet.
            </p>
          </div>

          {!showEmailSearch ? (
            <div className="w-full flex flex-col gap-3">
              <GlowBorder>
                <button
                  onClick={() => navigate('/registro')}
                  className="relative w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
                >
                  Obtener entrada →
                </button>
              </GlowBorder>
              <button
                onClick={() => setShowEmailSearch(true)}
                className="w-full bg-neutral-900/80 hover:bg-neutral-800 text-white/55 hover:text-white/80 font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Recuperar por email
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-3">
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setSearchError(''); setAvisoMail('') }}
                className="w-full bg-neutral-900 border border-white/20 rounded-2xl px-4 py-4 text-white text-sm placeholder-gray-600 outline-none focus:border-white/30 transition-all"
              />
              <GlowBorder>
                <button
                  onClick={handleEmailSearch}
                  disabled={searching || !email.trim()}
                  className="relative w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
                >
                  {searching ? 'Enviando...' : 'Mandármelas por mail'}
                </button>
              </GlowBorder>
              {searchError && (
                <p className="text-red-400 text-sm">{searchError}</p>
              )}
              {avisoMail && (
                <p className="text-emerald-300 text-sm">{avisoMail} Revisá también la carpeta de spam.</p>
              )}
              <button
                onClick={() => { setShowEmailSearch(false); setEmail(''); setSearchError(''); setAvisoMail('') }}
                className="text-white/40 hover:text-white/70 text-sm transition-all"
              >
                ← Volver
              </button>
            </div>
          )}
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center px-5 pb-10">
        <div className="w-full max-w-sm space-y-5">

          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/')} aria-label="Volver" className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"><ArrowLeft size={20} strokeWidth={1.5} /></button>
            {totalTickets > 1 && (
              <span className="text-gray-400 text-sm font-medium">{totalTickets} entradas</span>
            )}
          </div>

          {/* Si el mail era de alguien del cowork, la pantalla salta al
              carnet: el aviso del reenvío tiene que seguir a la vista. */}
          {avisoMail && (
            <p className="bg-emerald-950/60 border border-emerald-700/40 rounded-2xl px-4 py-3 text-center text-emerald-300 text-sm">
              {avisoMail} Revisá también la carpeta de spam.
            </p>
          )}

          {carnet && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-[0.2em] mb-3">Tu cowork</p>
              <CarnetMiembro carnet={carnet} token={carnet.token} />
            </div>
          )}

          {carnet && totalTickets > 0 && (
            <p className="text-gray-400 text-xs uppercase tracking-[0.2em] pt-2">
              {totalTickets === 1 ? 'Tu entrada' : 'Tus entradas'}
            </p>
          )}

          {totalTickets > 1 && (
            <div className="bg-amber-950/60 border border-amber-700/40 rounded-2xl px-4 py-3 text-center">
              <p className="text-amber-300 text-sm">
                Guardá cada entrada por separado. Cada persona necesita mostrar su propio QR en la puerta.
              </p>
            </div>
          )}

          {(grupos ?? []).map(grupo => (
            <div key={grupo.eventId} className="space-y-5">
              {grupo.tickets.map((ticket, i) => (
                <TicketCard key={`${ticket.token}-${i}`} ticket={ticket} isFinished={grupo.isFinished} />
              ))}

              {/* ?otra=1 es lo que evita que /registro rebote de vuelta acá al
                  ver que este dispositivo ya tiene entradas del evento. */}
              {!grupo.isFinished && (
                <button
                  onClick={() => navigate(`/registro?event=${grupo.eventId}&otra=1`)}
                  className="w-full bg-neutral-900/80 hover:bg-neutral-800 text-white/55 hover:text-white/80 font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
                >
                  {(grupos?.length ?? 0) > 1
                    ? `Comprar otra para ${grupo.eventName} →`
                    : 'Comprar otra entrada →'}
                </button>
              )}
            </div>
          ))}

          {totalTickets === 1 && (
            <div className="bg-amber-950/60 border border-amber-700/40 rounded-2xl px-4 py-3 text-center">
              <p className="text-amber-300 text-sm">
                Guardá esta imagen. No necesitás internet para mostrarla en la puerta.
              </p>
            </div>
          )}

          {totalTickets === 0 && (
            <button
              onClick={() => navigate('/registro')}
              className="w-full bg-neutral-900/80 hover:bg-neutral-800 text-white/55 hover:text-white/80 font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
            >
              Ver las próximas fechas →
            </button>
          )}

        </div>
      </div>
    </PublicLayout>
  )
}
