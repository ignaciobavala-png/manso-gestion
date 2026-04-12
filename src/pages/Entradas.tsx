import { useState, useEffect, useRef } from 'react'
import QrScanner from 'qr-scanner'
import { useSupabaseStore } from '../store-supabase'

export default function Entradas() {
  const { guests, addGuest, addTicketSale, getTicketPrices } = useSupabaseStore()
  const ticketPrices = getTicketPrices()
  const [loading, setLoading] = useState(true)
  const [qrScanned, setQrScanned] = useState(false)
  const [showInvitadoInput, setShowInvitadoInput] = useState(false)
  const [invitadoName, setInvitadoName] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)

  useEffect(() => {
    console.log('🎫 Componente Entradas montado')
    setTimeout(() => setLoading(false), 1000)
  }, [])

  // Cleanup on unmount — debe estar antes del early return
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop()
        qrScannerRef.current.destroy()
        qrScannerRef.current = null
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-200 font-montserrat flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  const handleScanQR = async () => {
    if (!videoRef.current) return

    setIsScanning(true)
    setCameraError(null)

    try {
      // Create QR Scanner instance
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          // QR Code detected
          console.log('QR Code detected:', result.data)
          
          // Extract guest info from QR (assuming format: "GUEST_NAME|TICKET_ID")
          const qrData = result.data
          const guestName = qrData.includes('|') 
            ? qrData.split('|')[0] 
            : `QR Invitado ${guests.length + 1}`
          
          // Add guest and ticket sale
          ;(async () => {
            try {
              await addGuest({ name: guestName, type: 'regular' })
              await addTicketSale({ 
                guest_name: guestName, 
                type: 'regular', 
                price: ticketPrices.regular 
              })
            } catch (error) {
              alert('Error al procesar QR: ' + (error as Error).message)
            }
          })()
          
          // Stop scanning
          stopScanning()
          
          // Show success state
          setQrScanned(true)
          setTimeout(() => setQrScanned(false), 2000)
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      )

      // Start scanning
      await qrScannerRef.current.start()
    } catch (error) {
      console.error('Camera error:', error)
      setCameraError('No se pudo acceder a la cámara. Por favor, verifica los permisos.')
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current.destroy()
      qrScannerRef.current = null
    }
    setIsScanning(false)
  }

  const handleAddInvitado = async () => {
    if (!invitadoName.trim()) {
      alert('Por favor ingresa el nombre del invitado')
      return
    }
    
    try {
      await addGuest({ name: invitadoName.trim(), type: 'invitado' })
      await addTicketSale({ 
        guest_name: invitadoName.trim(), 
        type: 'invitado', 
        price: ticketPrices.invitado 
      })
      
      setInvitadoName('')
      setShowInvitadoInput(false)
    } catch (error) {
      alert('Error al agregar invitado: ' + (error as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-montserrat pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/manso-name-white.png" 
                alt="Manso Gestión" 
                className="h-8 sm:h-10 w-auto"
              />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Entradas</h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                </div>
                <span className="text-sm text-emerald-400 font-medium">Vivo</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* QR Scanner Section */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold mb-6 text-white">Escanear QR</h2>
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-64 h-64 bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-2xl overflow-hidden">
                {qrScanned ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-emerald-400 font-medium">QR Escaneado</p>
                  </div>
                ) : isScanning ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                  />
                ) : cameraError ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <p className="text-red-400 text-sm">{cameraError}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <p className="text-gray-400">Listo para escanear</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              {!isScanning ? (
                <button
                  onClick={handleScanQR}
                  disabled={qrScanned}
                  className="w-full min-h-12 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
                >
                  {qrScanned ? 'Procesando...' : 'Iniciar Escáner'}
                </button>
              ) : (
                <button
                  onClick={stopScanning}
                  className="w-full min-h-12 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
                >
                  Detener Escáner
                </button>
              )}
            </div>

            {!showInvitadoInput ? (
              <button
                onClick={() => setShowInvitadoInput(true)}
                className="w-full max-w-xs min-h-12 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors"
              >
                Agregar Invitado
              </button>
            ) : (
              <div className="w-full max-w-xs space-y-3">
                <input
                  type="text"
                  value={invitadoName}
                  onChange={(e) => setInvitadoName(e.target.value)}
                  placeholder="Nombre del invitado"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddInvitado}
                    className="flex-1 min-h-10 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      setShowInvitadoInput(false)
                      setInvitadoName('')
                    }}
                    className="flex-1 min-h-10 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Invitados Section */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Últimos Invitados</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                Total: {guests.length}
              </span>
              <span className="text-sm text-amber-400">
                Invitados: {guests.filter(g => g.type === 'invitado').length}
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            {guests.slice(0, 10).map((guest) => (
              <div
                key={guest.id}
                className="flex items-center justify-between p-4 bg-gray-700/50 rounded-2xl border border-gray-600"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-full ${
                    guest.type === 'invitado' ? 'bg-amber-900/30 text-amber-400' : 'bg-emerald-900/30 text-emerald-400'
                  }`}>
                    <span className="text-lg">{guest.type === 'invitado' ? '👥' : '👤'}</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{guest.name}</h3>
                    <p className="text-sm text-gray-400">{new Date(guest.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  guest.type === 'invitado' 
                    ? 'bg-amber-900/30 text-amber-400' 
                    : 'bg-emerald-900/30 text-emerald-400'
                }`}>
                  {guest.type}
                </span>
              </div>
            ))}
          </div>

          {guests.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400">No hay invitados registrados aún</p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400 text-center">
              Mostrando los últimos {Math.min(10, guests.length)} invitados
            </p>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Entradas Hoy</p>
            <p className="text-2xl font-bold mt-1 text-white">{guests.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Invitados Activos</p>
            <p className="text-2xl font-bold mt-1 text-amber-400">
              {guests.filter(g => g.type === 'invitado').length}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}