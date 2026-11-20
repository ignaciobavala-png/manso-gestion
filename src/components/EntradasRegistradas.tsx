import { X, Image as ImageIcon, User } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import Toast from './Toast'
import { esVendida, esReservada, esMpAbandonada, esWebLiberada, etiquetaEstado, etiquetaTipo } from '../lib/entradas'
import ConteoPorTipo from './ConteoPorTipo'
import { contarPorTanda, claveTanda } from '../lib/conteoPorTipo'
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
  payment_provider: 'transferencia' | 'mercadopago' | 'web' | null
  mp_status: string | null
  mp_external_reference: string | null
  mp_expires_at: string | null
  origen: 'gestion' | 'web'
  ticket_type_id: string | null
  ticket_type_nombre: string | null
  pack_pos: number | null
  pack_size: number | null
  order_ref: string | null
  /** Lo que pagó esta entrada (en packs, ya dividido por entrada). */
  price_per_ticket: number | null
}

interface EnrichedRegistration extends Registration {
  signedReceiptUrl?: string
}

/** Estados de pago de Mercado Pago, en castellano para la vista del staff. */
type Filtro =
  | 'vendidas' | 'ingresaron' | 'pendientes' | 'porVerificar' | 'conComprobante'
  | 'sinPagar' | 'rechazadas' | 'webSinPagar' | 'webLiberadas'
  | 'transferencia' | 'mercadopago' | 'web'

type Medio = 'transferencia' | 'mercadopago' | 'web'

// Sin provider = alta manual / transferencia, igual que en esVendida.
function medioDe(r: { payment_provider: string | null }): Medio {
  return r.payment_provider === 'mercadopago' || r.payment_provider === 'web' ? r.payment_provider : 'transferencia'
}

const MEDIOS: Record<Medio, { label: string; badge: string }> = {
  transferencia: { label: 'Transferencia', badge: 'bg-violet-900/40 text-violet-300 border-violet-500/40' },
  mercadopago: { label: 'Mercado Pago', badge: 'bg-sky-900/40 text-sky-300 border-sky-500/40' },
  web: { label: 'Web', badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/40' },
}

// Una sola definición por chip: la usan el contador y la lista, para que el
// número del chip sea siempre la cantidad de filas que se ven al tocarlo.
const PREDICADOS: Record<Filtro, (r: EnrichedRegistration) => boolean> = {
  vendidas: r => esVendida(r),
  ingresaron: r => esVendida(r) && !!r.used_at,
  pendientes: r => esVendida(r) && !r.used_at,
  // Sólo las que están esperando una decisión del staff: comprobante de
  // transferencia sin verificar, o un pago de MP que MP todavía no resolvió.
  // Las reservas de la web no: las confirma la web, no el staff.
  porVerificar: r =>
    !r.is_banned && !r.used_at && !r.payment_verified &&
    (!!r.receipt_url || (r.payment_provider === 'mercadopago' && esReservada(r))),
  conComprobante: r => esVendida(r) && !!r.receipt_url,
  sinPagar: r => esMpAbandonada(r),
  rechazadas: r => !!r.is_banned,
  // Reservas de la web que todavía no se pagaron: ocupan cupo pero no son ventas.
  webSinPagar: r => r.payment_provider === 'web' && esReservada(r),
  webLiberadas: r => esWebLiberada(r),
  // Por medio de pago, sobre las vendidas: las tres suman el total de Vendidas.
  transferencia: r => esVendida(r) && medioDe(r) === 'transferencia',
  mercadopago: r => esVendida(r) && medioDe(r) === 'mercadopago',
  web: r => esVendida(r) && medioDe(r) === 'web',
}

const VACIO: Record<Filtro, string> = {
  vendidas: 'Todavía no hay entradas vendidas.',
  ingresaron: 'Todavía no ingresó nadie.',
  pendientes: 'No quedan pendientes.',
  porVerificar: 'No hay nada por verificar.',
  conComprobante: 'No hay entradas con comprobante.',
  sinPagar: 'No hay pagos de MP sin completar.',
  rechazadas: 'No hay entradas rechazadas.',
  webSinPagar: 'No hay reservas de la web sin pagar.',
  webLiberadas: 'No hay reservas vencidas.',
  transferencia: 'No hay entradas vendidas por transferencia.',
  mercadopago: 'No hay entradas vendidas por Mercado Pago.',
  web: 'No hay entradas vendidas por la web.',
}

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

interface Props {
  /**
   * Evento a listar. Por defecto es el que está en operación, que es lo que
   * necesita el panel de Control; /admin/cowork le pasa la fecha de cowork
   * elegida, que no tiene por qué ser la que está en vivo.
   */
  event?: { id: string; name: string }
  /** Arranca abierto en las pantallas donde la lista ES el contenido. */
  defaultExpanded?: boolean
}

export default function EntradasRegistradas({ event, defaultExpanded = false }: Props = {}) {
  const { activeEvent } = useAppStore()
  const evento = event ?? activeEvent
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
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
  // Tocar "Ingresaron" o "Pendientes" filtra la lista a esas entradas (pedido de Ana).
  const [filtro, setFiltro] = useState<Filtro | null>(null)
  // Tanda elegida en el desglose (nombre + precio pagado); se combina con el chip.
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null)

  const loadRegistrations = useCallback(async () => {
    if (!evento) return
    setLoading(true)
    const { data, error } = await supabase
      .from('ticket_registrations')
      .select('id, name, email, event_id, token, registered_at, used_at, receipt_url, payment_verified, is_banned, instagram, phone, payment_provider, mp_status, mp_external_reference, mp_expires_at, origen, ticket_type_id, ticket_type_nombre, pack_pos, pack_size, order_ref, price_per_ticket')
      .eq('event_id', evento.id)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento?.id])

  // Al cambiar de evento no puede quedar una tanda elegida del anterior.
  useEffect(() => { setTipoFiltro(null) }, [evento?.id])

  useEffect(() => {
    if (!evento) return

    const channel = supabase
      .channel('registrations')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_registrations', filter: `event_id=eq.${evento.id}` },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento?.id, loadRegistrations])

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

  /**
   * "Verificar pago": el staff miró el comprobante y confirma que se pagó.
   * Verifica toda la compra (un pack son varias filas con el mismo order_ref,
   * un solo pago) y manda el mail con los QR de las entradas de Gestión.
   * Si el mail falla el pago queda verificado igual; "Enviar QR por mail" en
   * Invitados lo reintenta.
   */
  const handleVerify = async (id: string) => {
    const fila = rows.find(r => r.id === id)
    setVerifyingId(id)

    let q = supabase.from('ticket_registrations').update({ payment_verified: true })
    q = fila?.order_ref ? q.eq('order_ref', fila.order_ref).eq('payment_verified', false) : q.eq('id', id)
    const { data: hechas, error } = await q.select('id')

    if (error) {
      setToast({ isOpen: true, message: 'No se pudo verificar el pago', type: 'warning', name: '' })
      setVerifyingId(null)
      return
    }

    const ids = new Set((hechas ?? []).map(h => h.id as string))
    ids.add(id)
    setRows(prev => prev.map(r => ids.has(r.id) ? { ...r, payment_verified: true } : r))

    // Las entradas de la web (origen 'web') las manda Club; acá sólo las de Gestión.
    if (fila && fila.origen === 'gestion' && fila.email) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/admin-enviar-entradas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
          body: JSON.stringify({ eventId: fila.event_id, email: fila.email, soloNuevas: true }),
        })
        const data = (await res.json().catch(() => ({}))) as { enviadas?: number; error?: string }
        if (!res.ok) {
          setToast({ isOpen: true, message: `Pago verificado, pero el mail no salió: ${data.error ?? 'error'}. Reenviá desde Invitados.`, type: 'warning', name: '' })
        } else if (data.enviadas) {
          setToast({ isOpen: true, message: `Pago verificado. Se mandó el QR a ${fila.email}`, type: 'success', name: '' })
        } else {
          setToast({ isOpen: true, message: 'Pago verificado. Esas entradas ya habían recibido el mail', type: 'success', name: '' })
        }
      } catch {
        setToast({ isOpen: true, message: 'Pago verificado, pero no hubo conexión para mandar el mail. Reenviá desde Invitados.', type: 'warning', name: '' })
      }
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
  // Mismo criterio que los contadores: si no, el chip dice 3 y la lista muestra otra cosa.
  const base = (filtro ? rows.filter(PREDICADOS[filtro]) : rows)
    // Mismo criterio que el conteo del desglose: vendidas + reservadas.
    .filter(r => !tipoFiltro || (claveTanda(r) === tipoFiltro && (esVendida(r) || esReservada(r))))
  const displayRows = (q
    ? base.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.instagram?.toLowerCase().includes(q) || r.phone?.includes(q))
    : [...base]
  ).sort((a, b) => sortAlpha
    ? a.name.localeCompare(b.name, 'es')
    // Los que ingresaron, del último en entrar al primero.
    : filtro === 'ingresaron'
      ? (b.used_at ?? '').localeCompare(a.used_at ?? '')
      : 0
  )

  // Todos los totales se calculan sobre las entradas que cuentan como vendidas
  // (ver src/lib/entradas.ts y la migración 020). Antes "Total" era rows.length
  // crudo: rechazar un QR no bajaba el número, que es lo que reportó Ana.
  const cuenta = (f: Filtro) => rows.filter(PREDICADOS[f]).length
  const vendidas = rows.filter(PREDICADOS.vendidas)
  const ingresados = cuenta('ingresaron')
  const pendientes = cuenta('pendientes')
  const porVerificar = cuenta('porVerificar')
  const conComprobante = cuenta('conComprobante')
  const rechazadas = cuenta('rechazadas')
  const sinPagar = cuenta('sinPagar')
  const webSinPagar = cuenta('webSinPagar')
  const webLiberadas = cuenta('webLiberadas')
  const porTransferencia = cuenta('transferencia')
  const porMp = cuenta('mercadopago')
  const porWeb = cuenta('web')
  const porTipo = contarPorTanda(rows)

  if (!evento) return null

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
            {evento.name}
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
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-terra-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">
              Sin registros para este evento aún.
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/20 rounded-xl px-3 py-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar nombre o email..."
                    className="flex-1 bg-transparent text-white text-sm placeholder-gray-400 outline-none"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda" className="text-gray-400 hover:text-white transition-colors"><X size={14} strokeWidth={1.5} /></button>
                  )}
                </div>
                <button
                  onClick={() => setSortAlpha(prev => !prev)}
                  title={sortAlpha ? 'Orden cronológico' : 'Orden alfabético'}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                    sortAlpha
                      ? 'bg-terra-700/40 border-terra-600/50 text-terra-300'
                      : 'bg-white/5 border-white/20 text-gray-400 hover:text-white'
                  }`}
                >
                  A–Z
                </button>
              </div>

              <div className="flex gap-3 mb-4 flex-wrap">
                {([
                  { f: 'vendidas', label: 'Vendidas', n: vendidas.length, num: 'text-white', on: 'bg-white/10 border-white/50', off: 'border-white/20 hover:border-white/40', always: true },
                  { f: 'transferencia', label: 'Transferencia', n: porTransferencia, num: 'text-violet-300', on: 'bg-violet-900/30 border-violet-400/60', off: 'border-violet-500/30 hover:border-violet-400/60' },
                  { f: 'mercadopago', label: 'Mercado Pago', n: porMp, num: 'text-sky-300', on: 'bg-sky-900/30 border-sky-400/60', off: 'border-sky-500/30 hover:border-sky-400/60' },
                  { f: 'web', label: 'Web', n: porWeb, num: 'text-emerald-300', on: 'bg-emerald-900/30 border-emerald-400/60', off: 'border-emerald-500/30 hover:border-emerald-400/60' },
                  { f: 'ingresaron', label: 'Ingresaron', n: ingresados, num: 'text-olive-300', on: 'bg-olive-900/40 border-olive-400/60', off: 'border-white/20 hover:border-white/40', always: true },
                  { f: 'pendientes', label: 'Pendientes', n: pendientes, num: 'text-amber-400', on: 'bg-amber-900/30 border-amber-400/60', off: 'border-white/20 hover:border-white/40', always: true },
                  { f: 'porVerificar', label: 'Por verificar', n: porVerificar, num: 'text-orange-400', on: 'bg-orange-900/30 border-orange-400/60', off: 'border-orange-500/40 hover:border-orange-400/70' },
                  { f: 'conComprobante', label: 'Con comprobante', n: conComprobante, num: 'text-white', on: 'bg-white/10 border-white/50', off: 'border-white/20 hover:border-white/40' },
                  // Las que NO cuentan como vendidas, visibles igual para que
                  // el staff sepa por qué el total no coincide con la lista.
                  { f: 'sinPagar', label: 'Sin pagar (MP)', n: sinPagar, num: 'text-red-400', on: 'bg-red-900/30 border-red-400/60', off: 'border-red-500/30 hover:border-red-400/60' },
                  { f: 'rechazadas', label: 'Rechazadas', n: rechazadas, num: 'text-red-400', on: 'bg-red-900/30 border-red-400/60', off: 'border-red-500/30 hover:border-red-400/60' },
                  { f: 'webSinPagar', label: 'Web sin pagar', n: webSinPagar, num: 'text-gray-300', on: 'bg-white/10 border-white/50', off: 'border-white/20 hover:border-white/40' },
                  { f: 'webLiberadas', label: 'Reservas vencidas', n: webLiberadas, num: 'text-red-400', on: 'bg-red-900/30 border-red-400/60', off: 'border-red-500/30 hover:border-red-400/60' },
                ] as { f: Filtro; label: string; n: number; num: string; on: string; off: string; always?: boolean }[])
                  // Un chip activo no se oculta aunque llegue a 0 (si no, el filtro
                  // quedaría puesto sin forma de sacarlo).
                  .filter(c => c.always || c.n > 0 || filtro === c.f)
                  .map(c => (
                    <button
                      key={c.f}
                      onClick={() => setFiltro(f => f === c.f ? null : c.f)}
                      aria-pressed={filtro === c.f}
                      className={`border rounded-xl px-3 py-1.5 transition-colors ${
                        filtro === c.f ? c.on : `bg-neutral-900 ${c.off}`
                      }`}
                    >
                      <span className="text-gray-400 text-xs">{c.label}: </span>
                      <span className={`${c.num} text-xs font-semibold`}>{c.n}</span>
                    </button>
                  ))}
              </div>

              {porTipo.length > 0 && <ConteoPorTipo filas={porTipo} className="mb-4" seleccionada={tipoFiltro} onSeleccionar={c => setTipoFiltro(t => t === c ? null : c)} />}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {displayRows.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-sm">
                    {q ? `Sin resultados para "${search}"` : tipoFiltro && !filtro ? 'No hay entradas de esta tanda.' : filtro ? VACIO[filtro] : 'Todavía no hay entradas registradas.'}
                  </p>
                )}
                {displayRows.map(r => {
                  const isPending = !r.used_at && !r.payment_verified
                  const estado = etiquetaEstado(r)
                  const estadoClass =
                    estado === 'Rechazado' || estado === 'Sin pagar' || estado === 'Reserva vencida'
                      ? 'bg-red-900/50 text-red-400'
                      : estado === 'Ingresó' || estado === 'Verificado'
                        ? 'bg-terra-900/50 text-terra-400'
                        : 'bg-white/10 text-gray-400'

                  return (
                    <div
                      key={r.id}
                      className={`bg-neutral-900 rounded-2xl px-4 py-3 flex flex-col gap-2 border ${r.is_banned ? 'border-red-700/60' : 'border-white/20'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {r.signedReceiptUrl ? (
                          <a
                            href={r.signedReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-white/20 hover:border-terra-400/50 transition-colors"
                          >
                            <img
                              src={r.signedReceiptUrl}
                              alt={`Comprobante de ${r.name}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ) : r.receipt_url ? (
                          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/20 flex items-center justify-center">
                            <ImageIcon className="text-gray-400" size={18} strokeWidth={1.5} aria-hidden />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/20 flex items-center justify-center">
                            <User className="text-gray-400" size={18} strokeWidth={1.5} aria-hidden />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-white font-medium text-sm truncate">{r.name}</p>
                            <span className={`flex-shrink-0 text-[10px] leading-none px-1.5 py-1 rounded-md border ${MEDIOS[medioDe(r)].badge}`}>
                              {MEDIOS[medioDe(r)].label}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs truncate">{r.email}</p>
                          {r.instagram && (
                            <p className="text-indigo-400 text-xs truncate">@{r.instagram}</p>
                          )}
                          {r.phone && (
                            <p className="text-gray-400 text-xs truncate">{r.phone}</p>
                          )}
                          <p className="text-gray-400 text-xs mt-0.5">
                            {new Date(r.registered_at).toLocaleString('es-AR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                          {r.payment_provider === 'mercadopago' && (
                            <p className="text-sky-400 text-xs mt-0.5 truncate">
                              Mercado Pago · {traducirEstadoMp(r.mp_status)}
                            </p>
                          )}
                          {etiquetaTipo(r) && (
                            <p className="text-gray-300 text-xs mt-0.5 truncate">
                              {etiquetaTipo(r)}
                            </p>
                          )}
                        </div>

                        <span
                          className={`sm:hidden text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${estadoClass}`}
                        >
                          {estado}
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

                        {/* Una compra de la web sin pago confirmado (reserva abierta o
                            vencida) no es una entrada: no hay QR que dar ni que rechazar. */}
                        {!r.used_at && !(r.payment_provider === 'web' && !r.payment_verified && !r.is_banned) && (
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

                        {!r.used_at && !r.is_banned && !(r.payment_provider === 'web' && !r.payment_verified) && (
                          <button
                            onClick={() => handleDownloadQr(r.token, r.name)}
                            disabled={downloadingId === r.token}
                            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {downloadingId === r.token ? '...' : 'QR'}
                          </button>
                        )}

                        <span
                          className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${estadoClass}`}
                        >
                          {estado}
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
