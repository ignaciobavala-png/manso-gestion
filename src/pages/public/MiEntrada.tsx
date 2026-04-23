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

function getTicketForEvent(eventId: string): TicketData | null {
  try {
    const raw = localStorage.getItem(`manso_ticket_${eventId}`)
    if (raw) return JSON.parse(raw) as TicketData
  } catch { /* ignorar entradas corruptas */ }
  return null
}

function findAnyTicket(): TicketData | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('manso_ticket_')) {
      try {
        return JSON.parse(localStorage.getItem(key)!) as TicketData
      } catch { /* ignorar */ }
    }
  }
  return null
}

export default function MiEntrada() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    // Intentar encontrar el ticket del evento activo primero
    supabase.from('active_event').select('id').single().then(({ data, error }) => {
      if (error) {
        // Si no hay fila en active_event, buscar cualquier ticket guardado
        const saved = findAnyTicket()
        if (!saved) {
          navigate('/registro', { replace: true })
          return
        }
        setTicket(saved)
        return
      }

      let saved: TicketData | null = null

      if (data?.id) {
        saved = getTicketForEvent(data.id)
      }

      // Si no hay evento activo o no hay ticket para ese evento, buscar cualquier ticket guardado
      if (!saved) {
        saved = findAnyTicket()
      }

      if (!saved) {
        navigate('/registro', { replace: true })
        return
      }
      setTicket(saved)
    })
  }, [navigate])

  useEffect(() => {
    if (!ticket || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, `manso-ticket|${ticket.token}`, {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    })
  }, [ticket])

  const handleDownload = async () => {
    if (!ticket) return
    setDownloading(true)
    try {
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

  if (!ticket) {
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
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10 -mt-4">
        <div className="w-full max-w-sm space-y-4">

          {/* Back button */}
          <div className="flex">
            <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg">←</button>
          </div>

          {/* Tarjeta de entrada */}
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden">
            {/* Franja top */}
            <div className="h-1 bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700" />

            <div className="px-6 pt-6 pb-7 flex flex-col items-center">
              <p className="text-gray-500 text-[10px] tracking-[3px] uppercase mb-1">entrada digital</p>
              <p className="text-emerald-400 text-sm font-medium mb-5">{ticket.event_name}</p>

              {/* QR */}
              <div className="bg-white rounded-2xl p-3 shadow-2xl">
                <canvas ref={canvasRef} className="block" />
              </div>

              <p className="text-white font-bold text-xl mt-5">{ticket.name}</p>
              <p className="text-gray-500 text-xs mt-1">Mostrá este QR en la puerta de ingreso.</p>
            </div>

            <div className="h-1 bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700" />
          </div>

          {/* Aviso */}
          <div className="bg-amber-950/60 border border-amber-700/40 rounded-2xl px-4 py-3 text-center">
            <p className="text-amber-300 text-sm">
              Guardá esta imagen. No necesitás internet para mostrarla en la puerta.
            </p>
          </div>

          {/* Botón */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95"
          >
            {downloading ? 'Generando imagen...' : 'Descargar imagen'}
          </button>
        </div>
      </div>
    </PublicLayout>
  )
}
