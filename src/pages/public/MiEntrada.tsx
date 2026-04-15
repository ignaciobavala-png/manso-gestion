import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'

interface TicketData {
  token: string
  name: string
  event_name: string
  event_id: string
}

// Busca en localStorage cualquier entrada guardada
function findSavedTicket(): TicketData | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('manso_ticket_')) {
      try {
        return JSON.parse(localStorage.getItem(key)!) as TicketData
      } catch {
        // ignorar entradas corruptas
      }
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
    const saved = findSavedTicket()
    if (!saved) {
      navigate('/registro', { replace: true })
      return
    }
    setTicket(saved)
  }, [navigate])

  useEffect(() => {
    if (!ticket || !canvasRef.current) return

    QRCode.toCanvas(canvasRef.current, `manso-ticket|${ticket.token}`, {
      width: 260,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    })
  }, [ticket])

  const handleDownload = async () => {
    if (!ticket) return
    setDownloading(true)

    try {
      // Canvas de la tarjeta completa
      const card = document.createElement('canvas')
      card.width = 400
      card.height = 520
      const ctx = card.getContext('2d')!

      // Fondo
      ctx.fillStyle = '#111827'
      ctx.fillRect(0, 0, 400, 520)

      // Franja superior
      ctx.fillStyle = '#065f46'
      ctx.fillRect(0, 0, 400, 6)

      // Logo MANSO
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 32px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.letterSpacing = '8px'
      ctx.fillText('MANSO', 200, 58)

      ctx.fillStyle = '#6b7280'
      ctx.font = '11px system-ui, sans-serif'
      ctx.letterSpacing = '3px'
      ctx.fillText('ENTRADA DIGITAL', 200, 78)

      // Nombre del evento
      ctx.fillStyle = '#34d399'
      ctx.font = '14px system-ui, sans-serif'
      ctx.letterSpacing = '0px'
      ctx.fillText(ticket.event_name, 200, 108)

      // QR (dibujar desde el canvas del DOM)
      if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, 70, 128)
      }

      // Nombre del asistente
      ctx.fillStyle = '#f9fafb'
      ctx.font = 'bold 20px system-ui, sans-serif'
      ctx.fillText(ticket.name, 200, 428)

      ctx.fillStyle = '#9ca3af'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText('Guardá esta imagen. No necesitás internet en la puerta.', 200, 458)

      // Franja inferior
      ctx.fillStyle = '#065f46'
      ctx.fillRect(0, 494, 400, 6)

      // Descargar
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

  if (!ticket) return null

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Tarjeta */}
        <div className="bg-gray-800 rounded-3xl overflow-hidden border border-gray-700">
          {/* Franja top */}
          <div className="h-1.5 bg-emerald-700" />

          <div className="px-6 pt-6 pb-8 flex flex-col items-center">
            {/* Logo */}
            <h1 className="text-2xl font-bold text-white tracking-[0.3em] mb-0.5">MANSO</h1>
            <p className="text-gray-500 text-[10px] tracking-[3px] uppercase mb-2">entrada digital</p>
            <p className="text-emerald-400 text-sm font-medium mb-5">{ticket.event_name}</p>

            {/* QR */}
            <div className="bg-white rounded-2xl p-3">
              <canvas ref={canvasRef} className="block" />
            </div>

            {/* Nombre */}
            <p className="text-white font-semibold text-lg mt-5">{ticket.name}</p>
            <p className="text-gray-500 text-xs mt-1 text-center">
              Mostrá este QR en la puerta de ingreso.
            </p>
          </div>

          {/* Franja bottom */}
          <div className="h-1.5 bg-emerald-700" />
        </div>

        {/* Aviso */}
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-2xl px-4 py-3 mt-4 text-center">
          <p className="text-amber-300 text-sm">
            Guardá esta imagen. No necesitás internet para mostrarla en la puerta.
          </p>
        </div>

        {/* Botón descargar */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95"
        >
          {downloading ? 'Generando imagen...' : 'Descargar imagen'}
        </button>
      </div>
    </div>
  )
}
