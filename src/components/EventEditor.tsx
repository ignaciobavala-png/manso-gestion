import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import AlertModal from './AlertModal'

interface Event {
  id: string
  name: string
  description?: string
  slug?: string | null
  start_date?: string
  is_paid: boolean
  regular_ticket_price: number
  ticket_alias_pago?: string | null
  ticket_cbu_pago?: string | null
  max_capacity: number | null
  is_private: boolean
  one_ticket_per_email: boolean
  require_instagram: boolean
  require_phone: boolean
  accepts_wildcard_qr: boolean
  payment_mode?: PaymentMode
  mp_surcharge_pct?: number
}

type PaymentMode = 'transferencia' | 'mercadopago' | 'ambos'

interface Props {
  event: Event
  onDone: () => void
}

const slugify = (text: string) =>
  text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const toLocalDatetime = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventEditor({ event, onDone }: Props) {
  const { updateEvent } = useAppStore()

  const [form, setForm] = useState({
    name: event.name,
    slug: event.slug ?? '',
    description: event.description ?? '',
    ticketPrice: event.is_paid ? String(event.regular_ticket_price) : '',
    startDate: event.start_date ? toLocalDatetime(event.start_date) : '',
    aliasPago: event.ticket_alias_pago ?? '',
    cbuPago: event.ticket_cbu_pago ?? '',
    maxCapacity: event.max_capacity !== null ? String(event.max_capacity) : '',
    mpSurcharge: String(event.mp_surcharge_pct ?? 0),
  })
  const [isPaid, setIsPaid] = useState(event.is_paid)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(event.payment_mode ?? 'transferencia')
  const [isPrivate, setIsPrivate] = useState(event.is_private)
  const [oneTicketPerEmail, setOneTicketPerEmail] = useState(event.one_ticket_per_email)
  const [requireInstagram, setRequireInstagram] = useState(event.require_instagram)
  const [requirePhone, setRequirePhone] = useState(event.require_phone)
  const [acceptsWildcardQr, setAcceptsWildcardQr] = useState(event.accepts_wildcard_qr)
  const [slugEdited, setSlugEdited] = useState(!!event.slug)
  const [saving, setSaving] = useState(false)
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success'
  })

  const handleSave = async () => {
    if (!form.name.trim()) {
      setAlertModal({ isOpen: true, message: 'El nombre del evento es obligatorio', type: 'warning' })
      return
    }

    const price = isPaid ? parseFloat(form.ticketPrice) || 0 : 0
    if (isPaid && price <= 0) {
      setAlertModal({ isOpen: true, message: 'El precio debe ser mayor a 0 para una entrada paga', type: 'warning' })
      return
    }

    const maxCap = form.maxCapacity.trim() ? parseInt(form.maxCapacity) : null
    if (maxCap !== null && (isNaN(maxCap) || maxCap <= 0)) {
      setAlertModal({ isOpen: true, message: 'La capacidad máxima debe ser un número positivo', type: 'warning' })
      return
    }

    // Recargo en es-AR: se acepta coma y se normaliza a punto para la DB.
    const surcharge = parseFloat(form.mpSurcharge.replace(',', '.')) || 0
    if (surcharge < 0 || surcharge > 100) {
      setAlertModal({ isOpen: true, message: 'El recargo debe estar entre 0 y 100%', type: 'warning' })
      return
    }

    // Un evento gratuito no tiene medio de pago que elegir.
    const modoPago: PaymentMode = isPaid ? paymentMode : 'transferencia'

    setSaving(true)
    try {
      await updateEvent(event.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        slug: form.slug.trim() || slugify(form.name.trim()) || null,
        is_paid: isPaid,
        regular_ticket_price: price,
        invited_ticket_price: price,
        ticket_alias_pago: form.aliasPago.trim() || null,
        ticket_cbu_pago: form.cbuPago.trim() || null,
        start_date: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        max_capacity: maxCap,
        is_private: isPrivate,
        one_ticket_per_email: oneTicketPerEmail,
        require_instagram: requireInstagram,
        require_phone: requirePhone,
        accepts_wildcard_qr: acceptsWildcardQr,
        payment_mode: modoPago,
        mp_surcharge_pct: surcharge,
      })
      onDone()
    } catch {
      setAlertModal({ isOpen: true, message: 'Error al guardar los cambios', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      {/* Nombre */}
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
          className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Slug */}
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
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none min-w-0"
          />
        </div>
      </div>

      {/* Visibilidad */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Visibilidad</label>
        <div className="flex rounded-xl overflow-hidden border border-white/20 bg-neutral-900/80">
          <button type="button" onClick={() => setIsPrivate(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${!isPrivate ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Público
          </button>
          <button type="button" onClick={() => setIsPrivate(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${isPrivate ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Privado
          </button>
        </div>
        {isPrivate && <p className="text-xs text-gray-500 mt-1">El evento no aparece en la cartelera pública.</p>}
      </div>

      {/* Entradas por persona */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Entradas por persona</label>
        <div className="flex rounded-xl overflow-hidden border border-white/20 bg-neutral-900/80">
          <button type="button" onClick={() => setOneTicketPerEmail(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${!oneTicketPerEmail ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Sin límite
          </button>
          <button type="button" onClick={() => setOneTicketPerEmail(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${oneTicketPerEmail ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            1 por email
          </button>
        </div>
        {oneTicketPerEmail && <p className="text-xs text-gray-500 mt-1">Cada email solo puede registrar una entrada.</p>}
      </div>

      {/* Datos extra en el formulario */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Datos extra al registrarse</label>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-neutral-900/80 border border-white/20 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-300">Pedir Instagram</span>
            <button
              type="button"
              onClick={() => setRequireInstagram(prev => !prev)}
              className={`relative w-10 h-5 rounded-full transition-colors ${requireInstagram ? 'bg-emerald-600' : 'bg-white/20'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${requireInstagram ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between bg-neutral-900/80 border border-white/20 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-300">Pedir teléfono</span>
            <button
              type="button"
              onClick={() => setRequirePhone(prev => !prev)}
              className={`relative w-10 h-5 rounded-full transition-colors ${requirePhone ? 'bg-emerald-600' : 'bg-white/20'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${requirePhone ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* QR comodín */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">QR comodín (Frees para Manso)</label>
        <div className="flex items-center justify-between bg-neutral-900/80 border border-white/20 rounded-xl px-4 py-3">
          <span className="text-sm text-gray-300">Aceptar entrada gratis con QR comodín</span>
          <button
            type="button"
            onClick={() => setAcceptsWildcardQr(prev => !prev)}
            className={`relative w-10 h-5 rounded-full transition-colors ${acceptsWildcardQr ? 'bg-emerald-600' : 'bg-white/20'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${acceptsWildcardQr ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        {acceptsWildcardQr && <p className="text-xs text-gray-500 mt-1">Los QR registrados en el evento "Frees para Manso" van a poder ingresar gratis a este evento.</p>}
      </div>

      {/* Tipo de entrada */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Tipo de entrada</label>
        <div className="flex rounded-xl overflow-hidden border border-white/20 bg-neutral-900/80">
          <button type="button" onClick={() => setIsPaid(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${!isPaid ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Gratuita
          </button>
          <button type="button" onClick={() => setIsPaid(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${isPaid ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
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
                type="number" min="0"
                value={form.ticketPrice}
                onChange={(e) => setForm(prev => ({ ...prev, ticketPrice: e.target.value }))}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
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
                ? 'El asistente transfiere y sube el comprobante. Hay que verificar cada entrada a mano.'
                : paymentMode === 'mercadopago'
                  ? 'El asistente paga con Mercado Pago y la entrada se verifica sola al acreditarse.'
                  : 'El asistente elige. Las de Mercado Pago se verifican solas; las de transferencia, a mano.'}
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
                Mercado Pago cobra una comisión de alrededor del 6,3% + IVA. Dejalo en 0
                para absorberla, o cargá un porcentaje para trasladarla al precio.
              </p>
            </div>
          )}

          {paymentMode !== 'mercadopago' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Alias de pago</label>
                <input type="text" value={form.aliasPago}
                  onChange={(e) => setForm(prev => ({ ...prev, aliasPago: e.target.value }))}
                  placeholder="Ej: PROD.NOCHE.123"
                  className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">CBU de pago</label>
                <input type="text" value={form.cbuPago}
                  onChange={(e) => setForm(prev => ({ ...prev, cbuPago: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Fecha */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Fecha y hora</label>
        <input
          type="datetime-local"
          value={form.startDate}
          onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
          className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent [color-scheme:dark]"
        />
      </div>

      {/* Capacidad máxima */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Capacidad máxima</label>
        <input
          type="number" min="1"
          value={form.maxCapacity}
          onChange={(e) => setForm(prev => ({ ...prev, maxCapacity: e.target.value }))}
          placeholder="Sin límite"
          className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Descripción */}
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

      {/* Acciones */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="px-4 py-3 bg-white/10 hover:bg-white/20 text-gray-300 font-medium rounded-xl transition-colors"
        >
          Cancelar
        </button>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  )
}
