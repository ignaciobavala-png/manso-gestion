import { useState, useCallback, useEffect } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import Toast from './Toast'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

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
  is_banned: boolean
  instagram: string | null
  phone: string | null
  payment_provider: 'transferencia' | 'mercadopago' | null
  mp_status: string | null
  mp_external_reference: string | null
}

interface EnrichedRegistration extends Registration {
  signedReceiptUrl?: string
}

/** Estados de pago de Mercado Pago, en castellano para la vista del staff. */
function traducirEstadoMp(status: string | null): string {
  switch (status) {
    case 'approved':     return 'aprobado'
    case 'pending':      return 'pendiente'
    case 'in_process':   return 'en revisión'
    case 'authorized':   return 'autorizado, sin acreditar'
    case 'rejected':     return 'rechazado'
    case 'cancelled':    return 'cancelado'
    case 'refunded':     return 'devuelto'
    case 'charged_back': return 'contracargo'
    default:             return status ?? 'sin datos'
  }
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
  const [checkingRef, setCheckingRef] = useState<string | null>(null)
  const [banningId, setBanningId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' as 'info' | 'success' | 'warning', name: '' })
  const [search, setSearch] = useState('')
  const [sortAlpha, setSortAlpha] = useState(false)

  const loadRegistrations = useCallback(async () => {
    if (!activeEvent) return
    setLoading(true)
    const { data, error } = await supabase
      .from('ticket_registrations')
      .select('id, name, email, event_id, token, registered_at, used_at, receipt_url, payment_verified, is_banned, instagram, phone, payment_provider, mp_status, mp_external_reference')
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
  }, [activeEvent])

  useEffect(() => {
    if (!activeEvent) return

    const channel = supabase
      .channel('registrations')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_registrations', filter: `event_id=eq.${activeEvent.id}` },
        (payload: RealtimePostgresChangesPayload<{ receipt_url: string | null; name: string }>) => {
          const row = payload.new as { receipt_url: string | null; name: string }
          if (!row.receipt_url) return

          setToast({
            isOpen: true,
            message: `Nuevo comprobante de ${row.name}`,
            type: 'success',
            name: row.name
          })

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Manso Club', {
              body: `Nuevo comprobante de ${row.name}`,
              icon: '/icon-192.png',
              tag: 'new-comprobante',
            })
          }

          loadRegistrations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeEvent, loadRegistrations])

  const handleToggle = () => {
    const next = !isExpanded
    setIsExpanded(next)
    if (next && !loaded) {
      loadRegistrations()
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
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

  /**
   * Consulta el estado real del pago en Mercado Pago y aplica el resultado.
   * Es la red de seguridad para cuando la notificación del webhook no llegó
   * (o el webhook nunca se configuró): no depende de él para nada.
   */
  const handleRevisarMp = async (ref: string) => {
    setCheckingRef(ref)
    try {
      const res = await fetch(`/api/mp/estado?ref=${encodeURIComponent(ref)}`)
      const data = await res.json()

      if (!res.ok) {
        setToast({ isOpen: true, message: data.error ?? 'No se pudo consultar Mercado Pago', type: 'warning', name: '' })
        return
      }

      if (data.verified) {
        // El endpoint ya persistió la verificación; se refleja en pantalla.
        setRows(prev => prev.map(r =>
          r.mp_external_reference === ref
            ? { ...r, payment_verified: true, mp_status: 'approved' }
            : r
        ))
        setToast({ isOpen: true, message: 'Pago confirmado en Mercado Pago', type: 'success', name: '' })
      } else {
        setRows(prev => prev.map(r =>
          r.mp_external_reference === ref ? { ...r, mp_status: data.status ?? r.mp_status } : r
        ))
        setToast({
          isOpen: true,
          message: `Mercado Pago informa: ${traducirEstadoMp(data.status)}`,
          type: 'warning',
          name: '',
        })
      }
    } catch {
      setToast({ isOpen: true, message: 'Sin conexión con Mercado Pago', type: 'warning', name: '' })
    } finally {
      setCheckingRef(null)
    }
  }

  const handleBan = async (id: string) => {
    setBanningId(id)
    const { error } = await supabase
      .from('ticket_registrations')
      .update({ is_banned: true })
      .eq('id', id)

    if (!error) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, is_banned: true } : r))
    }
    setBanningId(null)
  }

  const handleUnban = async (id: string) => {
    setBanningId(id)
    const { error } = await supabase
      .from('ticket_registrations')
      .update({ is_banned: false })
      .eq('id', id)

    if (!error) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, is_banned: false } : r))
    }
    setBanningId(null)
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

  const q = search.toLowerCase().trim()
  const displayRows = (q
    ? rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.instagram?.toLowerCase().includes(q) || r.phone?.includes(q))
    : [...rows]
  ).sort((a, b) => sortAlpha
    ? a.name.localeCompare(b.name, 'es')
    : 0
  )

  const ingresados = rows.filter(r => r.used_at).length
  const pendientes = rows.filter(r => !r.used_at).length
  // Cuenta también las de Mercado Pago sin acreditar: no tienen comprobante,
  // así que con el filtro viejo quedaban invisibles para el staff.
  const porVerificar = rows.filter(r =>
    (r.receipt_url || r.mp_external_reference) && !r.payment_verified && !r.used_at
  ).length
  const conComprobante = rows.filter(r => r.receipt_url).length

  if (!activeEvent) return null

  return (
    <>
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
        message={toast.message}
        type={toast.type}
        action={{ label: 'Ver', onClick: () => { setIsExpanded(true); if (!loaded) loadRegistrations() } }}
      />
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
              <div className="flex gap-2 mb-4">
                <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar nombre o email..."
                    className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white transition-colors text-xs">✕</button>
                  )}
                </div>
                <button
                  onClick={() => setSortAlpha(prev => !prev)}
                  title={sortAlpha ? 'Orden cronológico' : 'Orden alfabético'}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                    sortAlpha
                      ? 'bg-emerald-700/40 border-emerald-600/50 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  A–Z
                </button>
              </div>

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
                {displayRows.length === 0 && (
                  <p className="text-center text-gray-500 py-8 text-sm">Sin resultados para "{search}"</p>
                )}
                {displayRows.map(r => {
                  const isPending = !r.used_at && !r.payment_verified

                  return (
                    <div
                      key={r.id}
                      className={`bg-neutral-900 rounded-2xl px-4 py-3 flex flex-col gap-2 border ${r.is_banned ? 'border-red-700/60' : 'border-white/10'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {r.signedReceiptUrl ? (
                          <a
                            href={r.signedReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-white/20 hover:border-emerald-400/50 transition-colors"
                          >
                            <img
                              src={r.signedReceiptUrl}
                              alt={`Comprobante de ${r.name}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ) : r.receipt_url ? (
                          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-gray-600 text-base">🖼</span>
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-gray-600 text-base">👤</span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{r.name}</p>
                          <p className="text-gray-400 text-xs truncate">{r.email}</p>
                          {r.instagram && (
                            <p className="text-indigo-400 text-xs truncate">@{r.instagram}</p>
                          )}
                          {r.phone && (
                            <p className="text-gray-400 text-xs truncate">{r.phone}</p>
                          )}
                          <p className="text-gray-600 text-xs mt-0.5">
                            {new Date(r.registered_at).toLocaleString('es-AR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                          {r.payment_provider === 'mercadopago' && (
                            <p className="text-sky-400 text-xs mt-0.5 truncate">
                              Mercado Pago · {traducirEstadoMp(r.mp_status)}
                            </p>
                          )}
                        </div>

                        <span
                          className={`sm:hidden text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                            r.is_banned
                              ? 'bg-red-900/50 text-red-400'
                              : r.used_at
                                ? 'bg-emerald-900/50 text-emerald-400'
                                : r.payment_verified
                                  ? 'bg-emerald-900/50 text-emerald-400'
                                  : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          {r.is_banned ? 'Rechazado' : r.used_at ? 'Ingresó' : r.payment_verified ? 'Verificado' : 'Pendiente'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pl-[3.25rem] sm:pl-0 flex-wrap">
                        {/* Verificación a mano. También para las de MP: si MP
                            no responde o el pago llegó por otra vía, el staff
                            tiene que poder confirmar igual. */}
                        {isPending && (r.receipt_url || r.mp_external_reference) && !r.is_banned && (
                          <button
                            onClick={() => handleVerify(r.id)}
                            disabled={verifyingId === r.id}
                            className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {verifyingId === r.id ? '...' : 'Verificar pago'}
                          </button>
                        )}

                        {/* Reconciliación contra MP: no depende del webhook */}
                        {isPending && r.mp_external_reference && !r.is_banned && (
                          <button
                            onClick={() => handleRevisarMp(r.mp_external_reference!)}
                            disabled={checkingRef === r.mp_external_reference}
                            className="bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {checkingRef === r.mp_external_reference ? '...' : 'Revisar en MP'}
                          </button>
                        )}

                        {!r.used_at && (
                          r.is_banned ? (
                            <button
                              onClick={() => handleUnban(r.id)}
                              disabled={banningId === r.id}
                              className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-gray-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              {banningId === r.id ? '...' : 'Restaurar QR'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBan(r.id)}
                              disabled={banningId === r.id}
                              className="bg-red-900/60 hover:bg-red-800 disabled:opacity-50 text-red-300 text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              {banningId === r.id ? '...' : 'Rechazar QR'}
                            </button>
                          )
                        )}

                        {!r.used_at && !r.is_banned && (
                          <button
                            onClick={() => handleDownloadQr(r.token, r.name)}
                            disabled={downloadingId === r.token}
                            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {downloadingId === r.token ? '...' : 'QR'}
                          </button>
                        )}

                        <span
                          className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                            r.is_banned
                              ? 'bg-red-900/50 text-red-400'
                              : r.used_at
                                ? 'bg-emerald-900/50 text-emerald-400'
                                : r.payment_verified
                                  ? 'bg-emerald-900/50 text-emerald-400'
                                  : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          {r.is_banned ? 'Rechazado' : r.used_at ? 'Ingresó' : r.payment_verified ? 'Verificado' : 'Pendiente'}
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
    </>
  )
}
