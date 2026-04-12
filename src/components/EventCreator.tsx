import { useState } from 'react'
import QRCode from 'qrcode'
import { useSupabaseStore } from '../store-supabase'

export default function EventCreator() {
  const { addEvent, setActiveEventStatus } = useSupabaseStore()

  const [form, setForm] = useState({ name: '', description: '' })
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [createdEventName, setCreatedEventName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!form.name.trim()) {
      alert('El nombre del evento es obligatorio')
      return
    }

    setSaving(true)
    try {
      const event = await addEvent({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        is_active: true,
      })

      await setActiveEventStatus(event.id, true)

      const qrData = `manso|${event.id}|${form.name.trim()}`
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      })

      setQrCodeUrl(url)
      setCreatedEventName(form.name.trim())
      setForm({ name: '', description: '' })
    } catch (error) {
      alert('Error al iniciar el evento: ' + (error as Error).message)
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
            <p className="text-sm text-gray-400">Evento activo — barra y entradas habilitadas</p>
          </div>
        </div>
        <button
          onClick={downloadQR}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
        >
          Descargar QR
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
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
          rows={2}
          placeholder="Opcional"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
      </div>
      <button
        onClick={handleCreate}
        disabled={saving}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-lg rounded-xl transition-colors"
      >
        {saving ? 'Iniciando...' : 'Iniciar evento'}
      </button>
    </div>
  )
}
