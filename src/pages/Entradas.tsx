import { useState, useEffect, useRef } from 'react'
import QrScanner from 'qr-scanner'
import { useAppStore } from '../store/useAppStore'
import SinEventoActivo from '../components/SinEventoActivo'
import AlertModal from '../components/AlertModal'

export default function Entradas() {
  const { 
    guests, 
    addGuest, 
    addTicketSale, 
    getTicketPrices, 
    activeEvent,
    isLoading 
  } = useAppStore()
  const ticketPrices = getTicketPrices()
  const [loading, setLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [pendingQr, setPendingQr] = useState<{ rawData: string; name: string } | null>(null)
  const [pendingType, setPendingType] = useState<'regular' | 'invitado'>('regular')
  const [confirming, setConfirming] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showInvitadoInput, setShowInvitadoInput] = useState(false)
  const [invitadoName, setInvitadoName] = useState('')
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success'
  })
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)

  useEffect(() => {
    console.log('🎫 Componente Entradas montado')
    // Usar el loading real del store en lugar de timer hardcodeado
    if (!isLoading) {
      setLoading(false)
    }
  }, [isLoading])

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

  if (!activeEvent) return <SinEventoActivo />

  // Intenta extraer un nombre legible del contenido crudo del QR
  const extractName = (raw: string): string => {
    // Formato Manso: "manso|{event_id}|{event_name}" — es el QR del evento, no del asistente
    if (raw.startsWith('manso|')) return ''
    // Formato propio legado: "NOMBRE|ID"
    if (raw.includes('|')) return raw.split('|')[0].trim()
    // URL — analizar antes de hacer otras comprobaciones
    try {
      const url = new URL(raw)
      // Luma (lu.ma) — el nombre no está en el QR
      if (url.hostname.includes('lu.ma')) return ''
      // Query params genéricos con nombre
      const name = url.searchParams.get('name') || url.searchParams.get('nombre') || url.searchParams.get('attendee')
      if (name) return name.trim()
    } catch {
      // Ignorar error de parsing de URL
    }
    // JSON con campo name/nombre
    try {
      const json = JSON.parse(raw)
      if (json.name) return String(json.name).trim()
      if (json.nombre) return String(json.nombre).trim()
      if (json.attendee_name) return String(json.attendee_name).trim()
    } catch {
      // Ignorar error de parsing de JSON
    }
    // Fallback: mostrar el raw para que el operador lo edite
    return raw.length <= 40 ? raw : ''
  }

  // Detecta si el QR es del sistema Manso
  const isMansQr = (raw: string) => raw.startsWith('manso|')
  const getMansEventName = (raw: string) => raw.split('|')[2] || ''

  const handleScanQR = async () => {
    if (!videoRef.current) return
    setIsScanning(true)
    setCameraError(null)

    try {
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          const rawData = result.data
          console.log('QR detectado:', rawData)
          stopScanning()
          // Mostrar pantalla de confirmación con nombre editable
          setPendingQr({ rawData, name: extractName(rawData) })
          setPendingType('regular')
        },
        { returnDetailedScanResult: true, highlightScanRegion: true, highlightCodeOutline: true }
      )
      await qrScannerRef.current.start()
    } catch (error) {
      console.error('Camera error:', error)
      setCameraError('No se pudo acceder a la cámara. Verificá los permisos.')
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

  const handleConfirmQr = async () => {
    if (!pendingQr) return
    const name = pendingQr.name.trim() || pendingQr.rawData.slice(0, 40)
    setConfirming(true)
    try {
      await addGuest({ name, type: pendingType })
      await addTicketSale({
        guest_name: name,
        type: pendingType,
        price: pendingType === 'regular' ? ticketPrices.regular : ticketPrices.invitado
      })
      setPendingQr(null)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: 'Error al registrar entrada: ' + (error as Error).message,
        type: 'error'
      })
    } finally {
      setConfirming(false)
    }
  }

  const handleAddInvitado = async () => {
    if (!invitadoName.trim()) {
      setAlertModal({
        isOpen: true,
        message: 'Por favor ingresa el nombre del invitado',
        type: 'warning'
      })
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
      setAlertModal({
        isOpen: true,
        message: 'Error al agregar invitado: ' + (error as Error).message,
        type: 'error'
      })
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

          {/* Estado: éxito */}
          {showSuccess && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-emerald-400 font-semibold text-lg">Entrada registrada</p>
            </div>
          )}

          {/* Estado: confirmar QR detectado */}
          {!showSuccess && pendingQr && (
            <div className="space-y-4">
              {isMansQr(pendingQr.rawData) ? (
                <div className="bg-emerald-900/20 border border-emerald-700 rounded-2xl p-4">
                  <p className="text-xs text-emerald-500 mb-1">QR de Manso</p>
                  <p className="text-sm text-emerald-300 font-medium">{getMansEventName(pendingQr.rawData)}</p>
                </div>
              ) : (
                <div className="bg-gray-700/50 border border-gray-600 rounded-2xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Datos del QR</p>
                  <p className="text-sm text-gray-400 break-all font-mono">{pendingQr.rawData}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nombre</label>
                <input
                  type="text"
                  value={pendingQr.name}
                  onChange={(e) => setPendingQr({ ...pendingQr, name: e.target.value })}
                  placeholder="Nombre del asistente"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de entrada</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPendingType('regular')}
                    className={`py-3 rounded-xl border-2 font-medium transition-all ${
                      pendingType === 'regular'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-gray-700/50 border-gray-600 text-gray-300'
                    }`}
                  >
                    Regular
                  </button>
                  <button
                    onClick={() => setPendingType('invitado')}
                    className={`py-3 rounded-xl border-2 font-medium transition-all ${
                      pendingType === 'invitado'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                        : 'bg-gray-700/50 border-gray-600 text-gray-300'
                    }`}
                  >
                    Invitado
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPendingQr(null)}
                  disabled={confirming}
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmQr}
                  disabled={confirming}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                >
                  {confirming ? 'Registrando...' : 'Confirmar entrada'}
                </button>
              </div>
            </div>
          )}

          {/* Estado: scanner / idle */}
          {!showSuccess && !pendingQr && (
            <div className="flex flex-col items-center space-y-6">
              <div className="w-full aspect-square max-w-xs bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-2xl overflow-hidden">
                {isScanning ? (
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                ) : cameraError ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <svg className="w-10 h-10 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-red-400 text-sm">{cameraError}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <svg className="w-12 h-12 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <p className="text-gray-500 text-sm">Listo para escanear</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                {!isScanning ? (
                  <button
                    onClick={handleScanQR}
                    className="w-full min-h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Iniciar Escáner
                  </button>
                ) : (
                  <button
                    onClick={stopScanning}
                    className="w-full min-h-12 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Detener Escáner
                  </button>
                )}

                {!showInvitadoInput ? (
                  <button
                    onClick={() => setShowInvitadoInput(true)}
                    className="w-full min-h-12 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Agregar Invitado Manual
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={invitadoName}
                      onChange={(e) => setInvitadoName(e.target.value)}
                      placeholder="Nombre del invitado"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleAddInvitado()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddInvitado}
                        className="flex-1 min-h-10 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => { setShowInvitadoInput(false); setInvitadoName('') }}
                        className="flex-1 min-h-10 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  )
}