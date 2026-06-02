import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'

interface TicketData {
  token: string
  name: string
  event_name: string
  event_id: string
  isFinished?: boolean
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

function getTicketsForEvent(eventId: string): TicketData[] {
  try {
    const raw = localStorage.getItem(`manso_tickets_${eventId}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
    const oldRaw = localStorage.getItem(`manso_ticket_${eventId}`)
    if (oldRaw) {
      const single = JSON.parse(oldRaw) as TicketData
      return [single]
    }
  } catch { /* ignorar entradas corruptas */ }
  return []
}

function saveTicketsToStorage(eventId: string, tickets: TicketData[], eventEndDate?: string) {
  localStorage.setItem(`manso_tickets_${eventId}`, JSON.stringify(tickets))
  localStorage.setItem(`manso_tickets_ts_${eventId}`, Date.now().toString())
  if (eventEndDate) localStorage.setItem(`manso_tickets_end_${eventId}`, eventEndDate)
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

function getAllStoredTickets(): TicketData[] {
  purgeExpiredTickets()
  const META_PREFIXES = ['manso_tickets_ts_', 'manso_tickets_end_']
  const events: { sortVal: number; isFinished: boolean; tickets: TicketData[] }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('manso_tickets_')) continue
    if (META_PREFIXES.some(p => key.startsWith(p))) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) continue
      const eventId = key.slice('manso_tickets_'.length)
      const endDateStr = localStorage.getItem(`manso_tickets_end_${eventId}`)
      const fallbackTs = parseInt(localStorage.getItem(`manso_tickets_ts_${eventId}`) ?? '0')
      const sortVal = endDateStr ? new Date(endDateStr).getTime() : fallbackTs
      const isFinished = endDateStr ? new Date(endDateStr) < new Date() : false
      events.push({ sortVal, isFinished, tickets: parsed })
    } catch { /* ignorar entradas corruptas */ }
  }
  events.sort((a, b) => b.sortVal - a.sortVal)
  return events.flatMap(e => e.tickets.map(t => ({ ...t, isFinished: e.isFinished })))
}

function TicketCard({ ticket, isFinished = false }: { ticket: TicketData; isFinished?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [downloading, setDownloading] = useState(false)

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

      if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, 80, 116)
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
    <div className={`backdrop-blur-md rounded-3xl overflow-hidden border ${isFinished ? 'bg-black/40 border-white/5' : 'bg-black/60 border-white/10'}`}>
      <div className={`h-1 bg-gradient-to-r ${isFinished ? 'from-neutral-700 via-neutral-600 to-neutral-700' : 'from-emerald-700 via-emerald-500 to-emerald-700'}`} />

      <div className="px-6 pt-5 pb-6 flex flex-col items-center">
        <p className={`text-[10px] tracking-[3px] uppercase mb-1 ${isFinished ? 'text-gray-600' : 'text-gray-500'}`}>
          {isFinished ? 'evento finalizado' : 'entrada digital'}
        </p>
        <p className={`text-sm font-medium mb-4 ${isFinished ? 'text-gray-500' : 'text-emerald-400'}`}>{ticket.event_name}</p>

        <div className={`rounded-2xl p-3 shadow-2xl ${isFinished ? 'bg-white/80' : 'bg-white'}`}>
          <canvas ref={canvasRef} className="block opacity-60" style={{ width: 200, height: 200 }} />
        </div>

        <p className="text-white font-bold text-lg mt-4">{ticket.name}</p>
        <p className="text-gray-500 text-xs mt-1">
          {isFinished ? 'Este evento ya finalizó.' : 'Mostrá este QR en la puerta de ingreso.'}
        </p>
      </div>

      <div className="border-t border-white/5 px-6 py-3">
        <GlowBorder>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="relative w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white font-medium py-2.5 rounded-2xl transition-all active:scale-95 text-sm"
          >
            {downloading ? 'Generando...' : 'Descargar entrada'}
          </button>
        </GlowBorder>
      </div>

      <div className="h-1 bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700" />
    </div>
  )
}

export default function MiEntrada() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<TicketData[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEmailSearch, setShowEmailSearch] = useState(false)
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    supabase.from('active_event').select('id, end_date').single().then(async ({ data, error }) => {
      const allStored = getAllStoredTickets()

      if (error || !data?.id) {
        setTickets(allStored.length > 0 ? allStored : [])
        setLoading(false)
        return
      }

      const eventId = data.id
      setTickets(allStored.length > 0 ? allStored : null)
      setLoading(false)

      const storedEmail = localStorage.getItem('manso_email')
      if (!storedEmail) return

      const [{ data: rows, error: fetchError }, { data: eventData }] = await Promise.all([
        supabase
          .from('ticket_registrations')
          .select('token, name, event_id')
          .eq('email', storedEmail)
          .eq('event_id', eventId),
        supabase.from('events').select('name, end_date').eq('id', eventId).single(),
      ])

      if (fetchError || !rows || rows.length === 0) return

      // Nunca reducir tickets: si la DB devuelve menos que localStorage, es dato rancho
      const currentLocal = getTicketsForEvent(eventId)
      if (rows.length < currentLocal.length) return

      const eventName = eventData?.name ?? 'Evento'
      const freshTickets: TicketData[] = rows.map(r => ({
        token: r.token,
        name: r.name,
        event_name: eventName,
        event_id: r.event_id,
      }))

      saveTicketsToStorage(eventId, freshTickets, eventData?.end_date ?? undefined)
      setTickets(getAllStoredTickets())
    })
  }, [])

  const handleEmailSearch = async () => {
    if (!email.trim()) return
    setSearching(true)
    setSearchError('')

    const { data, error } = await supabase
      .from('ticket_registrations')
      .select('token, name, event_id')
      .eq('email', email.trim().toLowerCase())

    if (error) {
      setSearchError('Error al buscar. Intentá de nuevo.')
      setSearching(false)
      return
    }

    if (!data || data.length === 0) {
      setSearchError('No encontramos entradas para ese email.')
      setSearching(false)
      return
    }

    const eventIds = [...new Set(data.map(r => r.event_id))]
    const { data: events } = await supabase
      .from('events')
      .select('id, name, end_date')
      .in('id', eventIds)

    const eventMap = new Map(events?.map(e => [e.id, e.name]) ?? [])
    const eventEndDateMap = new Map(events?.map(e => [e.id, e.end_date ?? undefined]) ?? [])

    const ticketsByEvent = new Map<string, TicketData[]>()
    for (const row of data) {
      const eventName = eventMap.get(row.event_id) ?? 'Evento'
      const ticket: TicketData = { token: row.token, name: row.name, event_name: eventName, event_id: row.event_id }
      const existing = ticketsByEvent.get(row.event_id) ?? []
      existing.push(ticket)
      ticketsByEvent.set(row.event_id, existing)
    }

    for (const [eid, tix] of ticketsByEvent) {
      saveTicketsToStorage(eid, tix, eventEndDateMap.get(eid))
    }
    localStorage.setItem('manso_email', email.trim().toLowerCase())

    setSearching(false)
    setShowEmailSearch(false)
    setTickets(getAllStoredTickets())
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

  if (tickets === null) {
    return (
      <PublicLayout showHeader={false}>
        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10 max-w-sm w-full mx-auto text-center gap-5">
          <div className="w-full flex justify-start -mb-2">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg"
            >
              ←
            </button>
          </div>

          <span className="text-5xl">📲</span>
          <div>
            <h2 className="text-xl font-bold text-white">No tenés entradas guardadas</h2>
            <p className="text-gray-400 text-sm mt-2 max-w-xs">
              Las entradas se guardan solo en el dispositivo donde las registraste.
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
                Ya me registré, buscar por email
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-3">
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setSearchError('') }}
                className="w-full bg-neutral-900 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm placeholder-gray-600 outline-none focus:border-white/30 transition-all"
              />
              <GlowBorder>
                <button
                  onClick={handleEmailSearch}
                  disabled={searching || !email.trim()}
                  className="relative w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
                >
                  {searching ? 'Buscando...' : 'Buscar entradas'}
                </button>
              </GlowBorder>
              {searchError && (
                <p className="text-red-400 text-sm">{searchError}</p>
              )}
              <button
                onClick={() => { setShowEmailSearch(false); setEmail(''); setSearchError('') }}
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
        {tickets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 max-w-sm w-full">
            <div className="w-full flex justify-start -mb-2">
              <button
                onClick={() => navigate('/')}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg"
              >
                ←
              </button>
            </div>
            <span className="text-5xl">📲</span>
            <div>
              <h2 className="text-xl font-bold text-white">No tenés entradas guardadas</h2>
              <p className="text-gray-400 text-sm mt-2 max-w-xs">
                Las entradas se guardan solo en el dispositivo donde las registraste.
              </p>
            </div>
            <GlowBorder className="w-full">
              <button
                onClick={() => navigate('/registro')}
                className="relative w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
              >
                Obtener entrada →
              </button>
            </GlowBorder>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-5">

            <div className="flex items-center justify-between">
              <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg">←</button>
              {tickets.length > 1 && (
                <span className="text-gray-400 text-sm font-medium">{tickets.length} entradas</span>
              )}
            </div>

            {tickets.length > 1 && (
              <div className="bg-amber-950/60 border border-amber-700/40 rounded-2xl px-4 py-3 text-center">
                <p className="text-amber-300 text-sm">
                  Guardá cada entrada por separado. Cada persona necesita mostrar su propio QR en la puerta.
                </p>
              </div>
            )}

            {tickets.map((ticket, i) => (
              <TicketCard key={`${ticket.token}-${i}`} ticket={ticket} isFinished={ticket.isFinished ?? false} />
            ))}

            {tickets.length === 1 && (
              <div className="bg-amber-950/60 border border-amber-700/40 rounded-2xl px-4 py-3 text-center">
                <p className="text-amber-300 text-sm">
                  Guardá esta imagen. No necesitás internet para mostrarla en la puerta.
                </p>
              </div>
            )}

          </div>
        )}
      </div>
    </PublicLayout>
  )
}
