import { useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'

interface Registration {
  id: string
  name: string
  email: string
  event_id: string
  token: string
  registered_at: string
  used_at: string | null
  receipt_url: string | null
  payment_verified: boolean
}

interface EnrichedRegistration extends Registration {
  signedReceiptUrl?: string
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = '/public/comprobantes/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}

export default function EntradasRegistradas() {
  const { activeEvent } = useAppStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [rows, setRows] = useState<EnrichedRegistration[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const loadRegistrations = async () => {
    if (!activeEvent) return
    setLoading(true)
    const { data, error } = await supabase
      .from('ticket_registrations')
      .select('id, name, email, event_id, token, registered_at, used_at, receipt_url, payment_verified')
      .eq('event_id', activeEvent.id)
      .order('registered_at', { ascending: false })

    if (error || !data) {
      setRows([])
      setLoading(false)
      setLoaded(true)
      return
    }

    const enriched: EnrichedRegistration[] = await Promise.all(
      data.map(async (r) => {
        if (!r.receipt_url) return r
        const path = extractStoragePath(r.receipt_url)
        if (!path) return r
        try {
          const { data: signed } = await supabase.storage
            .from('comprobantes')
            .createSignedUrl(path, 3600)
          return { ...r, signedReceiptUrl: signed?.signedUrl }
        } catch {
          return r
        }
      })
    )

    setRows(enriched)
    setLoading(false)
    setLoaded(true)
  }

  const handleToggle = () => {
    const next = !isExpanded
    setIsExpanded(next)
    if (next && !loaded) {
      loadRegistrations()
    }
  }

  const handleVerify = async (id: string) => {
    setVerifyingId(id)
    const { error } = await supabase
      .from('ticket_registrations')
      .update({ payment_verified: true })
      .eq('id', id)

    if (!error) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, payment_verified: true } : r))
    }
    setVerifyingId(null)
  }

  const handleDownloadQr = useCallback(async (token: string, name: string) => {
    setDownloadingId(token)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 520
      const ctx = canvas.getContext('2d')!

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

      const qrCanvas = document.createElement('canvas')
      await QRCode.toCanvas(qrCanvas, `manso-ticket|${token}`, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      })
      ctx.drawImage(qrCanvas, 100, 96)

      ctx.fillStyle = '#f9fafb'
      ctx.font = 'bold 18px system-ui, sans-serif'
      ctx.fillText(name, 200, 400)

      ctx.fillStyle = '#6b7280'
      ctx.font = '11px system-ui, sans-serif'
      ctx.fillText('Guardá esta imagen. No necesitás internet en la puerta.', 200, 426)

      ctx.fillStyle = '#065f46'
      ctx.fillRect(0, 448, 400, 5)

      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `manso-entrada-${name.toLowerCase().replace(/\s+/g, '-')}.png`
        a.click()
        URL.revokeObjectURL(url)
        setDownloadingId(null)
      }, 'image/png')
    } catch {
      setDownloadingId(null)
    }
  }, [])

  const ingresados = rows.filter(r => r.used_at).length
  const pendientes = rows.filter(r => !r.used_at).length
  const porVerificar = rows.filter(r => r.receipt_url && !r.payment_verified && !r.used_at).length
  const conComprobante = rows.filter(r => r.receipt_url).length

  if (!activeEvent) return null

  return (
    <div className="border-t-2 border-zinc-800">
      <button
        onClick={handleToggle}
        className="w-full p-6 sm:p-8 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <div>
          <h2 className="text-xl font-semibold text-white">Entradas registradas</h2>
          <p className="text-sm text-gray-400 mt-1">
            {activeEvent.name}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">
              Sin registros para este evento aún.
            </div>
          ) : (
            <>
              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5">
                  <span className="text-gray-400 text-xs">Total: </span>
                  <span className="text-white text-xs font-semibold">{rows.length}</span>
                </div>
                <div className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5">
                  <span className="text-gray-400 text-xs">Ingresaron: </span>
                  <span className="text-emerald-400 text-xs font-semibold">{ingresados}</span>
                </div>
                <div className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5">
                  <span className="text-gray-400 text-xs">Pendientes: </span>
                  <span className="text-amber-400 text-xs font-semibold">{pendientes}</span>
                </div>
                {porVerificar > 0 && (
                  <div className="bg-neutral-900 border border-orange-500/40 rounded-xl px-3 py-1.5">
                    <span className="text-gray-400 text-xs">Por verificar: </span>
                    <span className="text-orange-400 text-xs font-semibold">{porVerificar}</span>
                  </div>
                )}
                {conComprobante > 0 && (
                  <div className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5">
                    <span className="text-gray-400 text-xs">Con comprobante: </span>
                    <span className="text-white text-xs font-semibold">{conComprobante}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {rows.map(r => {
                  const isPending = !r.used_at && !r.payment_verified
                  const isVerified = !r.used_at && r.payment_verified

                  return (
                    <div
                      key={r.id}
                      className="bg-neutral-900 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3"
                    >
                      {r.signedReceiptUrl ? (
                        <a
                          href={r.signedReceiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-white/20 hover:border-emerald-400/50 transition-colors"
                        >
                          <img
                            src={r.signedReceiptUrl}
                            alt={`Comprobante de ${r.name}`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ) : r.receipt_url ? (
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <span className="text-gray-600 text-lg">🖼</span>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <span className="text-gray-600 text-lg">👤</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{r.name}</p>
                        <p className="text-gray-400 text-xs truncate">{r.email}</p>
                        <p className="text-gray-600 text-xs mt-0.5">
                          {new Date(r.registered_at).toLocaleString('es-AR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isPending && r.receipt_url && (
                          <button
                            onClick={() => handleVerify(r.id)}
                            disabled={verifyingId === r.id}
                            className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {verifyingId === r.id ? '...' : 'Verificar pago'}
                          </button>
                        )}

                        {!r.used_at && (
                          <button
                            onClick={() => handleDownloadQr(r.token, r.name)}
                            disabled={downloadingId === r.token}
                            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {downloadingId === r.token ? '...' : 'QR'}
                          </button>
                        )}

                        <span
                          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                            r.used_at
                              ? 'bg-emerald-900/50 text-emerald-400'
                              : r.payment_verified
                                ? 'bg-emerald-900/50 text-emerald-400'
                                : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          {r.used_at ? 'Ingresó' : r.payment_verified ? 'Verificado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
