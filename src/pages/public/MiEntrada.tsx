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

      <div className="border-t border-white/5 px-6 py-3 flex">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-all active:scale-95 text-sm"
        >
          {downloading ? 'Generando...' : 'Descargar entrada'}
        </button>
      </div>

      <div className="h-1 bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700" />
    </div>
  )
}

export default function MiEntrada() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<TicketData[] | null>(null)

  useEffect(() => {
    supabase.from('active_event').select('id').single().then(({ data, error }) => {
      if (error || !data?.id) {
        setTickets([])
        return
      }

      const saved = getTicketsForEvent(data.id)

      setTickets(saved)
    })
  }, [])

  if (tickets === null) {
    return (
      <PublicLayout showHeader={false}>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center px-5 pb-10">
        {tickets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 -mt-12 max-w-sm w-full">
            <span className="text-5xl">📲</span>
            <div>
              <h2 className="text-xl font-bold text-white">No tenés entradas guardadas</h2>
              <p className="text-gray-400 text-sm mt-2 max-w-xs">
                Las entradas se guardan solo en el dispositivo donde las registraste.
              </p>
            </div>
            <button
              onClick={() => navigate('/registro')}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 text-sm"
            >
              Obtener entrada →
            </button>
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
