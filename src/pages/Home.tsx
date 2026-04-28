import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import Ingresos from '../components/Ingresos'
import RegistroEventos from '../components/RegistroEventos'
import EventoActivo from '../components/EventoActivo'
import GestionEventos from '../components/GestionEventos'
import EntradasRegistradas from '../components/EntradasRegistradas'
import AlertModal from '../components/AlertModal'
import Background from '../components/Background'
import Configuracion from './admin/Configuracion'

type Tab = 'operacion' | 'config'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('operacion')
  const {
    products,
    balance,
    updateProduct,
    activeEvent,
    closeEvent,
    sales,
    ticketSales,
    isInitialized
  } = useAppStore()
  const [isStockExpanded, setIsStockExpanded] = useState(false)
  const [stockValues, setStockValues] = useState<Record<string, number>>({})
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closing, setClosing] = useState(false)
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success'
  })

  useEffect(() => {
    const initial: Record<string, number> = {}
    products.forEach(p => { initial[p.id] = p.stock })
    setStockValues(initial)
  }, [products])

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

  // Solo las transacciones del evento activo
  const eventSales = activeEvent ? sales.filter(s => s.event_id === activeEvent.id) : []
  const eventTicketSales = activeEvent ? ticketSales.filter(t => t.event_id === activeEvent.id) : []

  const handleCloseEvent = async () => {
    if (!activeEvent) return
    setClosing(true)
    try {
      await closeEvent(activeEvent.id)
      setShowCloseConfirm(false)
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: 'Error al cerrar el evento: ' + (error as Error).message,
        type: 'error'
      })
    } finally {
      setClosing(false)
    }
  }

  const handleStockChange = async (productId: string, value: number) => {
    setStockValues(prev => ({ ...prev, [productId]: value }))
    try {
      await updateProduct(productId, { stock: value })
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: 'Error al actualizar stock: ' + (error as Error).message,
        type: 'error'
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Background>
      <div className="flex flex-col flex-grow pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 border-b border-zinc-800">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <img
                src="/manso-name-white.png"
                alt="Manso Gestión"
                className="h-8 sm:h-10 w-auto"
              />
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
          <div className="flex gap-1 pb-0">
            <button
              onClick={() => setActiveTab('operacion')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'operacion'
                  ? 'text-white border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Operación
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'config'
                  ? 'text-white border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Configuración
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col flex-grow">
        <div className="flex flex-col flex-grow bg-black">
          {activeTab === 'config' && (
            <div className="p-6 sm:p-8">
              <Configuracion />
            </div>
          )}
          {activeTab === 'operacion' && (
            <div>
              {/* Balance Card */}
              <div className="p-6 sm:p-8 border-b border-white/20 bg-gradient-to-b from-zinc-900/50 to-black">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-medium text-gray-400">Balance Total</h2>
                    <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-emerald-400 mt-2">
                      {formatCurrency(balance)}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    Actualizado en tiempo real
                  </div>
                </div>
              </div>

              {/* Gestión de eventos: crear, seleccionar, cerrar */}
              <GestionEventos />

              {/* Gestión del evento activo — QR, pausa y capacidad */}
              {activeEvent && <EventoActivo />}

              {/* Entradas registradas — listado de registros con comprobantes */}
              {activeEvent && <EntradasRegistradas />}

              {/* Stock Inicial Section */}
              <div className="border-t-2 border-zinc-800">
                <button
                  onClick={() => setIsStockExpanded(!isStockExpanded)}
                  className="w-full p-6 sm:p-8 flex items-center justify-between text-left hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                >
                  <h2 className="text-xl font-semibold text-white">Stock Inicial</h2>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isStockExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isStockExpanded && (
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                    <div className="space-y-4">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-4 bg-neutral-900 rounded-2xl border border-white/10"
                        >
                          <div>
                            <h3 className="font-medium text-white">{product.name}</h3>
                            <p className="text-sm text-gray-400 mt-1">
                              Precio: {formatCurrency(product.price)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleStockChange(product.id, Math.max(0, stockValues[product.id] - 1))}
                              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                              aria-label={`Reducir stock de ${product.name}`}
                            >
                              <span className="text-lg">-</span>
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={stockValues[product.id]}
                              onChange={(e) => handleStockChange(product.id, parseInt(e.target.value) || 0)}
                              className="w-20 text-center bg-neutral-900/80 border border-white/20 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                            />
                            <button
                              onClick={() => handleStockChange(product.id, stockValues[product.id] + 1)}
                              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                              aria-label={`Aumentar stock de ${product.name}`}
                            >
                              <span className="text-lg">+</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ingresos Section */}
              <Ingresos />

              {/* Registro de Eventos */}
              <RegistroEventos />

              {/* Arqueo de Caja */}
              {activeEvent && (
                <div id="arqueo" className="border-t-2 border-zinc-800 p-6 sm:p-8 bg-gradient-to-b from-zinc-900/30 to-black">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-white">Arqueo de Caja</h2>
                      <p className="text-sm text-gray-400 mt-1">Evento activo: <span className="text-emerald-400">{activeEvent.name}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3 text-center">
                      <p className="text-sm text-gray-400">Balance</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(balance)}</p>
                    </div>
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3 text-center">
                      <p className="text-sm text-gray-400">Ventas barra</p>
                      <p className="text-lg font-bold text-white">{eventSales.length}</p>
                    </div>
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3 text-center">
                      <p className="text-sm text-gray-400">Entradas</p>
                      <p className="text-lg font-bold text-white">{eventTicketSales.length}</p>
                    </div>
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3 text-center">
                      <p className="text-sm text-gray-400">Recaudado</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {formatCurrency(
                          eventSales.reduce((s, v) => s + v.total, 0) +
                          eventTicketSales.reduce((s, t) => s + t.price, 0)
                        )}
                      </p>
                    </div>
                  </div>

                  {!showCloseConfirm ? (
                    <button
                      onClick={() => setShowCloseConfirm(true)}
                      className="w-full py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
                    >
                      Cerrar evento y hacer arqueo
                    </button>
                  ) : (
                    <div className="bg-red-950/30 border border-red-700/50 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-red-300 text-center">
                        Esto cerrará el evento, reseteará el stock a 0 y limpiará la vista. Los datos quedan guardados en el historial.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowCloseConfirm(false)}
                          disabled={closing}
                          className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleCloseEvent}
                          disabled={closing}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                        >
                          {closing ? 'Cerrando...' : 'Confirmar cierre'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Stats */}
              <div className="border-t-2 border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 sm:p-8 bg-neutral-950/50">
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
                  <p className="text-sm text-gray-400">Productos</p>
                  <p className="text-2xl font-bold mt-1 text-white">{products.length}</p>
                </div>
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
                  <p className="text-sm text-gray-400">Stock Total</p>
                  <p className="text-2xl font-bold mt-1 text-white">
                    {products.reduce((sum, product) => sum + stockValues[product.id], 0)}
                  </p>
                </div>
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
                  <p className="text-sm text-gray-400">Valor Stock</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-400">
                    {formatCurrency(products.reduce((sum, product) => sum + (stockValues[product.id] * product.price), 0))}
                    </p>
                </div>
              </div>
            </div>
          )}
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