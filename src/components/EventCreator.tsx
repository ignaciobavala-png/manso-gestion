import { useState } from 'react'
import QRCode from 'qrcode'
import { useAppStore } from '../store/useAppStore'
import AlertModal from '../components/AlertModal'

interface Props {
  onCreated?: () => void
}

export default function EventCreator({ onCreated }: Props) {
  const { addEvent } = useAppStore()

  const [form, setForm] = useState({ name: '', description: '', ticketPrice: '', startDate: '', aliasPago: '', cbuPago: '' })
  const [isPaid, setIsPaid] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [createdEventName, setCreatedEventName] = useState('')
  const [saving, setSaving] = useState(false)
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success'
  })

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setAlertModal({ isOpen: true, message: 'El nombre del evento es obligatorio', type: 'warning' })
      return
    }
    if (!form.startDate) {
      setAlertModal({ isOpen: true, message: 'La fecha del evento es obligatoria', type: 'warning' })
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
      const event = await addEvent({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        regular_ticket_price: price,
        invited_ticket_price: price,
        is_paid: isPaid,
        is_active: true,
        registrations_open: true,
        max_capacity: null,
        start_date: new Date(form.startDate).toISOString(),
        ticket_alias_pago: form.aliasPago.trim() || null,
        ticket_cbu_pago: form.cbuPago.trim() || null,
      })

      const qrData = `${window.location.origin}/registro?event=${event.id}`
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      })

      setQrCodeUrl(url)
      setCreatedEventName(form.name.trim())
      setForm({ name: '', description: '', ticketPrice: '', startDate: '', aliasPago: '', cbuPago: '' })
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
          onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Ej: Fiesta de verano"
          className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
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
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">Se aplica igual para regular e invitado.</p>
          </div>
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
