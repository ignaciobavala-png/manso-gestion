import { useState } from 'react'
import QRCode from 'qrcode'

interface EventData {
  name: string
  description: string
  date: string
  time: string
}

export default function EventCreator() {
  const [eventData, setEventData] = useState<EventData>({
    name: '',
    description: '',
    date: '',
    time: ''
  })
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEventData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const generateQRCode = async () => {
    if (!eventData.name || !eventData.date || !eventData.time) {
      alert('Por favor complete los campos obligatorios: nombre, fecha y hora')
      return
    }

    setIsGenerating(true)
    try {
      const eventInfo = {
        name: eventData.name,
        description: eventData.description,
        date: eventData.date,
        time: eventData.time,
        timestamp: new Date().toISOString()
      }
      
      const qrData = JSON.stringify(eventInfo)
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      setQrCodeUrl(url)
    } catch (error) {
      console.error('Error generating QR code:', error)
      alert('Error al generar el código QR')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadQRCode = () => {
    if (!qrCodeUrl) return

    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `evento-${eventData.name.replace(/\\s+/g, '-').toLowerCase()}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const resetForm = () => {
    setEventData({
      name: '',
      description: '',
      date: '',
      time: ''
    })
    setQrCodeUrl('')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white text-center mb-6">Crear Evento</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre del evento *
            </label>
            <input
              type="text"
              name="name"
              value={eventData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
              placeholder="Nombre del evento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              name="description"
              value={eventData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white resize-none"
              placeholder="Descripción del evento"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fecha *
              </label>
              <input
                type="date"
                name="date"
                value={eventData.date}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Hora *
              </label>
              <input
                type="time"
                name="time"
                value={eventData.time}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={generateQRCode}
              disabled={isGenerating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {isGenerating ? 'Generando...' : 'Generar QR'}
            </button>
            
            <button
              onClick={resetForm}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              Limpiar
            </button>
          </div>
        </div>

        {qrCodeUrl && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 text-center">
              Código QR del Evento
            </h2>
            
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-4 rounded-lg">
                <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-gray-300">
                  <strong>Evento:</strong> {eventData.name}
                </p>
                {eventData.description && (
                  <p className="text-gray-300">
                    <strong>Descripción:</strong> {eventData.description}
                  </p>
                )}
                <p className="text-gray-300">
                  <strong>Fecha:</strong> {new Date(eventData.date).toLocaleDateString('es-AR')}
                </p>
                <p className="text-gray-300">
                  <strong>Hora:</strong> {eventData.time}
                </p>
              </div>
              
              <button
                onClick={downloadQRCode}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                Descargar QR
              </button>
            </div>
          </div>
        )}
    </div>
  )
}
