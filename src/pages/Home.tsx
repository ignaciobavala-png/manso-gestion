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
    addProduct,
    deleteProduct,
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
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'bebida' as 'bebida' | 'comida' | 'otro' })
  const [portionsExpanded, setPortionsExpanded] = useState<string | null>(null)
  const [newPortion, setNewPortion] = useState({ name: '', price: '', units: '5' })
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [editPriceValue, setEditPriceValue] = useState('')

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

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      setAlertModal({ isOpen: true, message: 'Completá nombre y precio del producto', type: 'warning' })
      return
    }
    const price = parseFloat(newProduct.price)
    if (isNaN(price) || price <= 0) {
      setAlertModal({ isOpen: true, message: 'Precio inválido', type: 'warning' })
      return
    }
    try {
      await addProduct({
        name: newProduct.name,
        price,
        category: newProduct.category,
        stock: 0,
      })
      setNewProduct({ name: '', price: '', category: 'bebida' })
      setShowNewProduct(false)
    } catch (error) {
      setAlertModal({ isOpen: true, message: 'Error al agregar producto: ' + (error as Error).message, type: 'error' })
    }
  }

  const handleAddPortion = async (containerId: string) => {
    if (!newPortion.name || !newPortion.price) {
      setAlertModal({ isOpen: true, message: 'Completá nombre y precio de la porción', type: 'warning' })
      return
    }
    const price = parseFloat(newPortion.price)
    if (isNaN(price) || price <= 0) {
      setAlertModal({ isOpen: true, message: 'Precio inválido', type: 'warning' })
      return
    }
    const units = parseInt(newPortion.units) || 1
    try {
      await addProduct({
        name: newPortion.name,
        price,
        category: 'bebida',
        stock: 0,
        container_product_id: containerId,
        units_per_container: units,
      })
      setNewPortion({ name: '', price: '', units: '5' })
    } catch (error) {
      setAlertModal({ isOpen: true, message: 'Error al agregar porción: ' + (error as Error).message, type: 'error' })
    }
  }

  const handleDeletePortion = async (portionId: string) => {
    try {
      await deleteProduct(portionId)
    } catch (error) {
      setAlertModal({ isOpen: true, message: 'Error al eliminar porción: ' + (error as Error).message, type: 'error' })
    }
  }

  const startEditPrice = (productId: string, currentPrice: number) => {
    setEditingPrice(productId)
    setEditPriceValue(currentPrice.toString())
  }

  const cancelEditPrice = () => {
    setEditingPrice(null)
    setEditPriceValue('')
  }

  const saveEditPrice = async (productId: string) => {
    const price = parseFloat(editPriceValue)
    if (isNaN(price) || price < 0) {
      setAlertModal({ isOpen: true, message: 'Precio inválido', type: 'warning' })
      cancelEditPrice()
      return
    }
    try {
      await updateProduct(productId, { price })
      cancelEditPrice()
    } catch (error) {
      setAlertModal({ isOpen: true, message: 'Error al actualizar precio: ' + (error as Error).message, type: 'error' })
      cancelEditPrice()
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
                    <div className="mb-4 p-3 bg-indigo-950/30 border border-indigo-700/40 rounded-xl text-sm text-indigo-300 leading-relaxed">
                      💡 <strong className="text-indigo-200">Stock Inicial</strong> — Acá se carga el stock de los
                      <strong className="text-indigo-200"> contenedores</strong> (botellas, packs, etc.).
                      Las <strong className="text-indigo-200">porciones</strong> (copas, vasos, platos) no tienen stock propio:
                      su disponibilidad se calcula automáticamente desde el contenedor en la sección <strong className="text-indigo-200">Barra</strong>.
                    </div>
                    <div className="space-y-4">
                      {products.map((product) => {
                        const isContainer = products.some(p => p.container_product_id === product.id)
                        const isServing = !!product.container_product_id
                        const containerName = isServing
                          ? products.find(p => p.id === product.container_product_id)?.name
                          : null
                        const portions = products.filter(p => p.container_product_id === product.id)
                        const isPortionOpen = portionsExpanded === product.id
                        return (
                        <div
                          key={product.id}
                          className="p-4 bg-neutral-900 rounded-2xl border border-white/10"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-white">{product.name}</h3>
                                {isServing && (
                                  <span className="px-2 py-0.5 bg-indigo-900/50 text-indigo-300 text-xs rounded-full">
                                    Porción de {containerName}
                                  </span>
                                )}
                                {isContainer && !isServing && (
                                  <span className="px-2 py-0.5 bg-amber-900/50 text-amber-300 text-xs rounded-full">
                                    Contenedor
                                  </span>
                                )}
                                {!isContainer && !isServing && (
                                  <span className="px-2 py-0.5 bg-gray-700/50 text-gray-400 text-xs rounded-full">
                                    Independiente
                                  </span>
                                )}
                                {isContainer && !isServing && (
                                  <button
                                    onClick={() => setPortionsExpanded(isPortionOpen ? null : product.id)}
                                    className="ml-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                                    aria-label="Configurar porciones"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              {editingPrice === product.id ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <input
                                    type="number"
                                    value={editPriceValue}
                                    onChange={e => setEditPriceValue(e.target.value)}
                                    className="w-24 px-2 py-1 bg-neutral-900 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveEditPrice(product.id)
                                      if (e.key === 'Escape') cancelEditPrice()
                                    }}
                                  />
                                  <button
                                    onClick={() => saveEditPrice(product.id)}
                                    className="w-6 h-6 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={cancelEditPrice}
                                    className="w-6 h-6 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 mt-1">
                                  Precio: {formatCurrency(product.price)}
                                  <button
                                    onClick={() => startEditPrice(product.id, product.price)}
                                    className="ml-1.5 inline-flex items-center text-gray-500 hover:text-emerald-400 transition-colors align-middle"
                                    aria-label="Editar precio"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                </p>
                              )}
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
                          {!isServing && isPortionOpen && (
                            <div className="mt-2 ml-4 p-3 bg-indigo-950/20 border border-indigo-800/30 rounded-xl space-y-3">
                              <p className="text-xs text-indigo-300 font-medium">Porciones que rinde este producto</p>
                              {portions.length === 0 && (
                                <p className="text-xs text-gray-500">Sin porciones configuradas.</p>
                              )}
                              {portions.map(portion => (
                                <div key={portion.id} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 border border-white/5">
                                  <div>
                                    <span className="text-sm text-white">{portion.name}</span>
                                    <span className="text-xs text-gray-400 ml-2">{formatCurrency(portion.price)}</span>
                                    <span className="text-xs text-indigo-400 ml-2">{portion.units_per_container} uds / cont.</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeletePortion(portion.id)}
                                    className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                              <div className="flex items-end gap-2 pt-1 border-t border-indigo-900/30">
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                                  <input
                                    type="text"
                                    value={newPortion.name}
                                    onChange={e => setNewPortion(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Ej: Copa de Vino"
                                    className="w-full px-2 py-1.5 bg-neutral-900 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
                                  />
                                </div>
                                <div className="w-24">
                                  <label className="block text-xs text-gray-400 mb-1">Precio</label>
                                  <input
                                    type="number"
                                    value={newPortion.price}
                                    onChange={e => setNewPortion(p => ({ ...p, price: e.target.value }))}
                                    placeholder="ARS"
                                    min="0"
                                    className="w-full px-2 py-1.5 bg-neutral-900 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
                                  />
                                </div>
                                <div className="w-16">
                                  <label className="block text-xs text-gray-400 mb-1">Unidades</label>
                                  <input
                                    type="number"
                                    value={newPortion.units}
                                    onChange={e => setNewPortion(p => ({ ...p, units: e.target.value }))}
                                    min="1"
                                    className="w-full px-2 py-1.5 bg-neutral-900 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <button
                                  onClick={() => handleAddPortion(product.id)}
                                  className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                                >
                                  Agregar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )})}
                    </div>

                    <div className="mt-6 border-t border-white/10 pt-4">
                      <button
                        onClick={() => setShowNewProduct(!showNewProduct)}
                        className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Agregar producto independiente
                      </button>
                      {showNewProduct && (
                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={newProduct.name}
                            onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                            placeholder="Nombre del producto"
                            className="flex-1 px-3 py-2 bg-neutral-900 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                          />
                          <input
                            type="number"
                            value={newProduct.price}
                            onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))}
                            placeholder="Precio"
                            min="0"
                            className="w-full sm:w-28 px-3 py-2 bg-neutral-900 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                          />
                          <select
                            value={newProduct.category}
                            onChange={e => setNewProduct(p => ({ ...p, category: e.target.value as 'bebida' | 'comida' | 'otro' }))}
                            className="w-full sm:w-28 px-3 py-2 bg-neutral-900 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                          >
                            <option value="bebida">Bebida</option>
                            <option value="comida">Comida</option>
                            <option value="otro">Otro</option>
                          </select>
                          <button
                            onClick={handleAddProduct}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
                          >
                            Agregar
                          </button>
                        </div>
                      )}
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