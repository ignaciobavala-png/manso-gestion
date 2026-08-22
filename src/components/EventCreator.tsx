import { useState } from 'react'
import QRCode from 'qrcode'
import { useAppStore } from '../store/useAppStore'
import { previsualizarRecargo, parsearDecimal } from '../lib/mercadopago'
import AlertModal from '../components/AlertModal'

interface Props {
  onCreated?: () => void
}

type PaymentMode = 'transferencia' | 'mercadopago' | 'ambos'

const slugify = (text: string) =>
  text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export default function EventCreator({ onCreated }: Props) {
  const { addEvent } = useAppStore()

  const [form, setForm] = useState({ name: '', slug: '', description: '', ticketPrice: '', startDate: '', aliasPago: '', cbuPago: '', mpSurcharge: '0' })
  const [slugEdited, setSlugEdited] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('transferencia')
  const [isPrivate, setIsPrivate] = useState(false)
  const [oneTicketPerEmail, setOneTicketPerEmail] = useState(false)
  const [coworkDay, setCoworkDay] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [createdEventName, setCreatedEventName] = useState('')
  const [saving, setSaving] = useState(false)
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success'
  })

  // Qué paga el asistente y qué le queda a Manso con el recargo actual.
  const previewRecargo = previsualizarRecargo(
    parsearDecimal(form.ticketPrice),
    parsearDecimal(form.mpSurcharge)
  )

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setAlertModal({ isOpen: true, message: 'El nombre del evento es obligatorio', type: 'warning' })
      return
    }
    if (!form.startDate) {
      setAlertModal({ isOpen: true, message: 'La fecha del evento es obligatoria', type: 'warning' })
      return
    }
    const surcharge = parsearDecimal(form.mpSurcharge)
    if (surcharge < 0 || surcharge > 100) {
      setAlertModal({ isOpen: true, message: 'El recargo debe estar entre 0 y 100%', type: 'warning' })
      return
    }

    setSaving(true)
    try {
      const price = isPaid ? parseFloat(form.ticketPrice) || 0 : 0
      if (isPaid && price <= 0) {
        setAlertModal({ isOpen: true, message: 'El precio debe ser mayor a 0 para una entrada paga', type: 'warning' })
        setSaving(false)
        return
      }
      const finalSlug = form.slug.trim() || slugify(form.name.trim())
      const event = await addEvent({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        regular_ticket_price: price,
        invited_ticket_price: price,
        is_paid: isPaid,
        is_private: isPrivate,
        one_ticket_per_email: oneTicketPerEmail,
        // El Cowork Day siempre pide teléfono e Instagram: es el filtro que
        // pidió Ana para saber quién se sienta a trabajar en el salón.
        require_instagram: coworkDay,
        require_phone: coworkDay,
        accepts_wildcard_qr: false,
        cowork_day: coworkDay,
        // Un evento gratuito no tiene medio de pago que elegir.
        payment_mode: isPaid ? paymentMode : 'transferencia',
        mp_surcharge_pct: isPaid && paymentMode !== 'transferencia' ? surcharge : 0,
        is_active: true,
        registrations_open: true,
        max_capacity: null,
        start_date: new Date(form.startDate).toISOString(),
        ticket_alias_pago: form.aliasPago.trim() || null,
        ticket_cbu_pago: form.cbuPago.trim() || null,
        slug: finalSlug || null,
      })

      const baseUrl = event.slug
        ? `${window.location.origin}/registro/${event.slug}`
        : `${window.location.origin}/registro?event=${event.id}`
      const qrData = event.is_private && event.private_token
        ? `${baseUrl}${event.slug ? '?' : '&'}token=${event.private_token}`
        : baseUrl
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      })

      setQrCodeUrl(url)
      setCreatedEventName(form.name.trim())
      setForm({ name: '', slug: '', description: '', ticketPrice: '', startDate: '', aliasPago: '', cbuPago: '', mpSurcharge: '0' })
      setSlugEdited(false)
      setCoworkDay(false)
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: 'Error al iniciar el evento: ' + (error as Error).message,
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const downloadQR = () => {
    if (!qrCodeUrl) return
    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `manso-${createdEventName.replace(/\s+/g, '-').toLowerCase()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (qrCodeUrl) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-2xl">
            <img src={qrCodeUrl} alt="QR del evento" className="w-56 h-56" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-emerald-400 font-semibold text-lg">{createdEventName}</p>
            <p className="text-sm text-gray-400">Evento en operación — compartí este QR para el registro público</p>
          </div>
        </div>
        <button
          onClick={downloadQR}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
        >
          Descargar QR
        </button>
        <button
          onClick={() => onCreated?.()}
          className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          Listo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del evento *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => {
            const name = e.target.value
            setForm(prev => ({
              ...prev,
              name,
              slug: slugEdited ? prev.slug : slugify(name),
            }))
          }}
          placeholder="Ej: La Nube — Vinilos"
          className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Link del evento</label>
        <div className="flex items-center gap-2 bg-neutral-900/80 border border-white/20 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent">
          <span className="text-gray-500 text-sm whitespace-nowrap">/registro/</span>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true)
              setForm(prev => ({ ...prev, slug: slugify(e.target.value) }))
            }}
            placeholder="la-nube-vinilos"
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none min-w-0"
          />
        </div>
        <p className="text-xs text-gray-600 mt-1">Se genera automáticamente desde el nombre. Podés editarlo.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Tipo de fecha</label>
        <div className="flex rounded-xl overflow-hidden border border-white/20 bg-neutral-900/80">
          <button
            type="button"
            onClick={() => setCoworkDay(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !coworkDay
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Evento
          </button>
          <button
            type="button"
            onClick={() => setCoworkDay(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              coworkDay
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Cowork Day
          </button>
        </div>
        {coworkDay && (
          <p className="text-xs text-gray-500 mt-1">
            Sale en /cowork en vez de la cartelera, y pide teléfono e Instagram al reservar.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Visibilidad</label>
        <div className="flex rounded-xl overflow-hidden border border-white/20 bg-neutral-900/80">
          <button
            type="button"
            onClick={() => setIsPrivate(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !isPrivate
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Público
          </button>
          <button
            type="button"
            onClick={() => setIsPrivate(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              isPrivate
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Privado
          </button>
        </div>
        {isPrivate && (
          <p className="text-xs text-gray-500 mt-1">El evento no aparece en la cartelera pública. Se accede solo con el link privado.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Entradas por persona</label>
        <div className="flex rounded-xl overflow-hidden border border-white/20 bg-neutral-900/80">
          <button
            type="button"
            onClick={() => setOneTicketPerEmail(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !oneTicketPerEmail
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sin límite
          </button>
          <button
            type="button"
            onClick={() => setOneTicketPerEmail(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              oneTicketPerEmail
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            1 por email
          </button>
        </div>
        {oneTicketPerEmail && (
          <p className="text-xs text-gray-500 mt-1">Cada email solo puede registrar una entrada.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Tipo de entrada</label>
        <div className="flex rounded-xl overflow-hidden border border-white/20 bg-neutral-900/80">
          <button
            type="button"
            onClick={() => setIsPaid(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !isPaid
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Gratuita
          </button>
          <button
            type="button"
            onClick={() => setIsPaid(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              isPaid
                ? 'bg-emerald-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Entrada paga
          </button>
        </div>
      </div>
      {isPaid && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Precio de entrada</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
              <input
                type="number"
                min="0"
                value={form.ticketPrice}
                onChange={(e) => setForm(prev => ({ ...prev, ticketPrice: e.target.value }))}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">Se aplica igual para regular e invitado.</p>
          </div>

          {/* Medio de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">¿Cómo se paga la entrada?</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['transferencia', 'Transferencia'],
                ['mercadopago', 'Mercado Pago'],
                ['ambos', 'Ambos'],
              ] as [PaymentMode, string][]).map(([modo, etiqueta]) => (
                <button
                  key={modo}
                  type="button"
                  onClick={() => setPaymentMode(modo)}
                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-colors border ${
                    paymentMode === modo
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-neutral-900/80 border-white/20 text-gray-400 hover:text-white'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {paymentMode === 'transferencia'
                ? 'Hay que verificar cada entrada a mano contra el comprobante.'
                : paymentMode === 'mercadopago'
                  ? 'Las entradas se verifican solas cuando el pago se acredita.'
                  : 'El asistente elige. Las de Mercado Pago se verifican solas.'}
            </p>
          </div>

          {paymentMode !== 'transferencia' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recargo por pagar con Mercado Pago
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.mpSurcharge}
                  onChange={(e) => setForm(prev => ({ ...prev, mpSurcharge: e.target.value }))}
                  placeholder="0"
                  className="w-full pl-4 pr-10 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {previewRecargo
                  ? <>La entrada sale <span className="text-white font-medium">${previewRecargo.conRecargo}</span> y entran <span className="text-white font-medium">${previewRecargo.neto}</span> netos, descontada la comisión de Mercado Pago (~4,3%).</>
                  : <>Mercado Pago descuenta alrededor del 4,3% de cada venta. Dejalo en 0 para absorberlo, o cargá un porcentaje para trasladarlo al precio.</>}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Alias de pago (entradas)</label>
            <input
              type="text"
              value={form.aliasPago}
              onChange={(e) => setForm(prev => ({ ...prev, aliasPago: e.target.value }))}
              placeholder="Ej: PROD.NOCHE.123"
              className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Opcional. Si no se especifica, se usará el alias general del venue.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">CBU de pago (entradas)</label>
            <input
              type="text"
              value={form.cbuPago}
              onChange={(e) => setForm(prev => ({ ...prev, cbuPago: e.target.value }))}
              placeholder="Opcional"
              className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Fecha y hora *</label>
        <input
          type="datetime-local"
          value={form.startDate}
          onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
          className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent [color-scheme:dark]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
          rows={2}
          placeholder="Opcional"
          className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
      </div>
      <button
        onClick={handleCreate}
        disabled={saving}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-lg rounded-xl transition-colors"
      >
        {saving ? 'Iniciando...' : 'Iniciar evento'}
      </button>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  )
}
