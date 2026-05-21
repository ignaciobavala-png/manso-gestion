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

function TicketCard({ ticket }: { ticket: TicketData }) {
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
    <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700" />

      <div className="px-6 pt-5 pb-6 flex flex-col items-center">
        <p className="text-gray-500 text-[10px] tracking-[3px] uppercase mb-1">entrada digital</p>
        <p className="text-emerald-400 text-sm font-medium mb-4">{ticket.event_name}</p>

        <div className="bg-white rounded-2xl p-3 shadow-2xl">
          <canvas ref={canvasRef} className="block" style={{ width: 200, height: 200 }} />
        </div>

        <p className="text-white font-bold text-lg mt-4">{ticket.name}</p>
        <p className="text-gray-500 text-xs mt-1">Mostrá este QR en la puerta de ingreso.</p>
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
  const [showEmailSearch, setShowEmailSearch] = useState(false)
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    supabase.from('active_event').select('id').single().then(({ data, error }) => {
      if (error || !data?.id) {
        setTickets([])
        return
      }

      const saved = getTicketsForEvent(data.id)
      setTickets(saved.length > 0 ? saved : null)
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
      .select('id, name')
      .in('id', eventIds)

    const eventMap = new Map(events?.map(e => [e.id, e.name]) ?? [])

    const ticketsByEvent = new Map<string, TicketData[]>()
    for (const row of data) {
      const eventName = eventMap.get(row.event_id) ?? 'Evento'
      const ticket: TicketData = { token: row.token, name: row.name, event_name: eventName, event_id: row.event_id }
      const existing = ticketsByEvent.get(row.event_id) ?? []
      existing.push(ticket)
      ticketsByEvent.set(row.event_id, existing)
    }

    for (const [eid, tix] of ticketsByEvent) {
      localStorage.setItem(`manso_tickets_${eid}`, JSON.stringify(tix))
    }

    setSearching(false)
    setShowEmailSearch(false)

    const allTickets = [...ticketsByEvent.values()].flat()
    setTickets(allTickets)
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
              <TicketCard key={`${ticket.token}-${i}`} ticket={ticket} />
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
