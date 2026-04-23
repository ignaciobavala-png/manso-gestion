import { useState, useEffect, useRef } from 'react'
import QrScanner from 'qr-scanner'
import qrWorkerSource from 'qr-scanner/qr-scanner-worker.min.js?raw'

// Crea un blob URL con el contenido del worker para garantizar que funcione
// en producción (Vercel) sin depender de rutas relativas ni CDN
const workerBlob = new Blob([qrWorkerSource], { type: 'application/javascript' })
const workerBlobUrl = URL.createObjectURL(workerBlob)
// @ts-ignore
QrScanner.WORKER_PATH = workerBlobUrl
import { useAppStore } from '../store/useAppStore'
import { supabase } from '../lib/supabase'
import SinEventoActivo from '../components/SinEventoActivo'
import AlertModal from '../components/AlertModal'
import Background from '../components/Background'

export default function Entradas(): React.JSX.Element {
  const {
    guests,
    addGuest,
    addTicketSale,
    getTicketPrices,
    activeEvent,
    isInitialized
  } = useAppStore()
  const ticketPrices = getTicketPrices()
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [pendingQr, setPendingQr] = useState<{ rawData: string; name: string } | null>(null)
  const [pendingType, setPendingType] = useState<'regular' | 'invitado'>('regular')
  const [confirming, setConfirming] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showInvitadoInput, setShowInvitadoInput] = useState(false)
  const [invitadoName, setInvitadoName] = useState('')
  const [submittingInvitado, setSubmittingInvitado] = useState(false)
  const [mansoTicketPending, setMansoTicketPending] = useState<{ token: string; name: string } | null>(null)
  const [validating, setValidating] = useState(false)
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success'
  })
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)

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

  if (!isInitialized) {
    return (
      <Background>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </Background>
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

  // Detecta si el QR es del sistema Manso (evento)
  const isMansQr = (raw: string) => raw.startsWith('manso|')
  const getMansEventName = (raw: string) => raw.split('|')[2] || ''
  // Verifica que el QR pertenezca al evento activo
  const isMansQrFromActiveEvent = (raw: string) => {
    const parts = raw.split('|')
    return parts[1] === activeEvent?.id
  }
  // Nuevo formato: ticket individual de registro público
  const isMansoTicket = (raw: string) => raw.startsWith('manso-ticket|')
  const getMansoTicketToken = (raw: string) => raw.split('|')[1] || ''

  const handleValidateMansoTicket = async (rawData: string) => {
    const token = getMansoTicketToken(rawData)
    if (!token) {
      setAlertModal({ isOpen: true, message: 'QR de ticket inválido.', type: 'error' })
      return
    }
    setValidating(true)

    const { data, error } = await supabase
      .from('ticket_registrations')
      .select('name, event_id, used_at')
      .eq('token', token)
      .single()

    setValidating(false)

    if (error || !data) {
      setAlertModal({ isOpen: true, message: 'Token no encontrado.', type: 'error' })
      return
    }
    if (data.event_id !== activeEvent?.id) {
      setAlertModal({ isOpen: true, message: 'Este QR pertenece a otro evento.', type: 'error' })
      return
    }
    if (data.used_at) {
      setAlertModal({
        isOpen: true,
        message: `Este QR ya fue usado el ${new Date(data.used_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}.`,
        type: 'error'
      })
      return
    }

    setMansoTicketPending({ token, name: data.name })
  }

  const handleConfirmMansoTicket = async () => {
    if (!mansoTicketPending) return
    setConfirming(true)

    const { error } = await supabase
      .from('ticket_registrations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', mansoTicketPending.token)
      .is('used_at', null)

    setConfirming(false)

    if (error) {
      setAlertModal({ isOpen: true, message: 'Error al registrar el ingreso.', type: 'error' })
      return
    }

    setMansoTicketPending(null)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  const handleScanQR = async () => {
    if (!videoRef.current) return
    setIsScanning(true)
    setCameraError(null)

    try {
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          const rawData = result.data
          stopScanning()

          // Nuevo formato: ticket individual de registro público
          if (isMansoTicket(rawData)) {
            handleValidateMansoTicket(rawData)
            return
          }

          // Si es QR de Manso (evento) pero de otro evento → rechazar
          if (isMansQr(rawData) && !isMansQrFromActiveEvent(rawData)) {
            setAlertModal({
              isOpen: true,
              message: `Este QR pertenece a otro evento ("${getMansEventName(rawData)}") y no es válido para el evento actual.`,
              type: 'error'
            })
            return
          }

          // Mostrar pantalla de confirmación con nombre editable
          setPendingQr({ rawData, name: extractName(rawData) })
          setPendingType('regular')
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment',
        }
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
    if (submittingInvitado) return
    if (!invitadoName.trim()) {
      setAlertModal({
        isOpen: true,
        message: 'Por favor ingresa el nombre del invitado',
        type: 'warning'
      })
      return
    }

    setSubmittingInvitado(true)
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
    } finally {
      setTimeout(() => setSubmittingInvitado(false), 2000)
    }
  }

  // Solo los guests del evento activo
  const eventGuests = guests.filter(g => g.event_id === activeEvent.id)

  return (
    <Background>
      <div className="flex flex-col flex-grow pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 border-b border-white/10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/manso-name-white.png" 
                alt="Manso Gestión" 
                className="h-8 sm:h-10 w-auto"
              />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Entradas</h1>
              {activeEvent?.is_active && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <span className="text-sm text-emerald-400 font-medium">Vivo</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-col flex-grow">
        <div className="flex flex-col flex-grow bg-black border-b border-white/10">
          {/* QR Scanner Section */}
          <div className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-6 text-white">Escanear QR</h2>

            {/* Estado: validando ticket */}
            {validating && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
                <p className="text-gray-400 text-sm">Validando ticket...</p>
              </div>
            )}

            {/* Estado: confirmar ticket de registro público */}
            {!validating && !showSuccess && mansoTicketPending && (
              <div className="space-y-4">
                <div className="bg-emerald-900/20 border border-emerald-700 rounded-2xl p-4 text-center">
                  <p className="text-xs text-emerald-500 mb-1 uppercase tracking-wider">Entrada Digital</p>
                  <p className="text-white font-semibold text-lg">{mansoTicketPending.name}</p>
                  <p className="text-emerald-400 text-xs mt-1">Token válido — sin uso previo</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setMansoTicketPending(null)}
                    disabled={confirming}
                    className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmMansoTicket}
                    disabled={confirming}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                  >
                    {confirming ? 'Registrando...' : 'Confirmar ingreso'}
                  </button>
                </div>
              </div>
            )}

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
                  <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
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
                    className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                          : 'bg-neutral-900/60 border-white/10 text-gray-300'
                      }`}
                    >
                      Regular
                    </button>
                    <button
                      onClick={() => setPendingType('invitado')}
                      className={`py-3 rounded-xl border-2 font-medium transition-all ${
                        pendingType === 'invitado'
                          ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                          : 'bg-neutral-900/60 border-white/10 text-gray-300'
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
            {!showSuccess && !pendingQr && !mansoTicketPending && !validating && (
              <div className="flex flex-col items-center space-y-6">
                <div className="w-full aspect-square max-w-xs bg-neutral-900 border-2 border-dashed border-white/10 rounded-2xl overflow-hidden">
                  {/* El video siempre está en el DOM para que videoRef.current esté disponible al iniciar */}
                  <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${isScanning ? 'block' : 'hidden'}`}
                    playsInline
                    muted
                  />
                  {!isScanning && cameraError ? (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                      <svg className="w-10 h-10 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <p className="text-red-400 text-sm">{cameraError}</p>
                    </div>
                  ) : !isScanning ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <svg className="w-12 h-12 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <p className="text-gray-500 text-sm">Listo para escanear</p>
                    </div>
                  ) : null}
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
                        className="w-full px-4 py-3 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleAddInvitado()}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddInvitado}
                          disabled={submittingInvitado}
                          className="flex-1 min-h-10 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => { setShowInvitadoInput(false); setInvitadoName('') }}
                          className="flex-1 min-h-10 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Invitados Section */}
          <div className="p-6 sm:p-8 border-t border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Últimos Invitados</h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  Total: {eventGuests.length}
                </span>
                <span className="text-sm text-amber-400">
                  Invitados: {eventGuests.filter(g => g.type === 'invitado').length}
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              {eventGuests.slice(0, 10).map((guest) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between p-4 bg-neutral-900 rounded-2xl border border-white/10"
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

            {eventGuests.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400">No hay invitados registrados aún</p>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-sm text-gray-400 text-center">
                Mostrando los últimos {Math.min(10, eventGuests.length)} invitados
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 sm:p-8 border-t border-white/10">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
              <p className="text-sm text-gray-400">Entradas Hoy</p>
              <p className="text-2xl font-bold mt-1 text-white">{eventGuests.length}</p>
            </div>
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
              <p className="text-sm text-gray-400">Invitados Activos</p>
              <p className="text-2xl font-bold mt-1 text-amber-400">
                {eventGuests.filter(g => g.type === 'invitado').length}
              </p>
            </div>
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
  </Background>
  )
}