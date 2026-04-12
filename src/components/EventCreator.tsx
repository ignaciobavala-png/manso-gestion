import { useState } from 'react'
import QRCode from 'qrcode'
import { useSupabaseStore } from '../store-supabase'

export default function EventCreator() {
  const { addEvent, setActiveEventStatus } = useSupabaseStore()

  const [form, setForm] = useState({
    name: '',
    description: '',
    date: '',
    time: '',
    regularPrice: '',
    invitadoPrice: '',
  })
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [createdEventName, setCreatedEventName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleCreate = async () => {
    if (!form.name || !form.date) {
      alert('El nombre y la fecha son obligatorios')
      return
    }

    setSaving(true)
    try {
      // 1. Guardar en Supabase
      const event = await addEvent({
        name: form.name,
        description: form.description || undefined,
        regular_ticket_price: parseFloat(form.regularPrice) || 0,
        invited_ticket_price: parseFloat(form.invitadoPrice) || 0,
        start_date: form.date && form.time ? `${form.date}T${form.time}:00` : form.date || undefined,
        is_active: true,
      })

      // 2. Marcarlo como activo
      await setActiveEventStatus(event.id, true)

      // 3. Generar QR con el ID real del evento
      // Formato: manso|{event_id}|{event_name}
      // El scanner de Entradas puede detectar este formato
      const qrData = `manso|${event.id}|${form.name}`
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      })

      setQrCodeUrl(url)
      setCreatedEventName(form.name)
      setForm({ name: '', description: '', date: '', time: '', regularPrice: '', invitadoPrice: '' })
    } catch (error) {
      alert('Error al crear el evento: ' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const downloadQR = () => {
    if (!qrCodeUrl) return
    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `manso-evento-${createdEventName.replace(/\s+/g, '-').toLowerCase()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const reset = () => {
    setQrCodeUrl('')
    setCreatedEventName('')
  }

  if (qrCodeUrl) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-2xl">
            <img src={qrCodeUrl} alt="QR del evento" className="w-56 h-56" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-emerald-400 font-semibold">{createdEventName}</p>
            <p className="text-sm text-gray-400">Evento creado y activo en Manso</p>
          </div>
        </div>

        <div className="bg-gray-700/30 border border-gray-600 rounded-2xl p-4 text-sm text-gray-300 space-y-2">
          <p className="font-medium text-white">¿Cómo usar este QR?</p>
          <ul className="space-y-1 text-gray-400">
            <li>• Imprimilo o mostralo en pantalla en la entrada</li>
            <li>• El escáner de Manso lo reconoce automáticamente</li>
            <li>• Convive con Luma — la clienta elige cuál usar</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={downloadQR}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
          >
            Descargar QR
          </button>
          <button
            onClick={reset}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
          >
            Nuevo evento
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del evento *</label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Ej: Fiesta de verano"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Descripción</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={2}
          placeholder="Descripción opcional"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Fecha *</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Hora</label>
          <input
            type="time"
            name="time"
            value={form.time}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Precio entrada regular (ARS)</label>
          <input
            type="number"
            name="regularPrice"
            value={form.regularPrice}
            onChange={handleChange}
            placeholder="0"
            min="0"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Precio invitado (ARS)</label>
          <input
            type="number"
            name="invitadoPrice"
            value={form.invitadoPrice}
            onChange={handleChange}
            placeholder="0"
            min="0"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={saving}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
      >
        {saving ? 'Creando evento...' : 'Crear evento y generar QR'}
      </button>
    </div>
  )
}
