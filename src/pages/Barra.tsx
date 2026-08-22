import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import SinEventoActivo from '../components/SinEventoActivo'
import AlertModal from '../components/AlertModal'
import ConfirmModal from '../components/ConfirmModal'
import Background from '../components/Background'

export default function Barra() {
  const {
    products,
    balance,
    addSaleBatch,
    updateProduct,
    deleteProduct,
    deleteSale,
    sales,
    activeEvent,
    isInitialized
  } = useAppStore()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo')
  const [confirming, setConfirming] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success'
  })
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    message: '',
    productId: '',
    productName: ''
  })
  const [confirmingSaleDelete, setConfirmingSaleDelete] = useState<string | null>(null)
  const [deletingSale, setDeletingSale] = useState(false)
  const [activeCategory, setActiveCategory] = useState<'bebida' | 'comida' | 'otro'>('bebida')
  const [searchQuery, setSearchQuery] = useState('')

  if (!isInitialized) {
    return (
      <Background>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </Background>
    )
  }

  if (!activeEvent) return <SinEventoActivo />

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const setCartQty = (productId: string, qty: number) => {
    setCart(prev => {
      if (qty <= 0) {
        const next = { ...prev }
        delete next[productId]
        return next
      }
      return { ...prev, [productId]: qty }
    })
  }

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find(p => p.id === id)!, qty }))
    .filter(item => item.product)

  const cartTotal = cartItems.reduce((sum, { product, qty }) => sum + product.price * qty, 0)

  // Solo ventas del evento activo
  const activeSales = activeEvent ? sales.filter(s => s.event_id === activeEvent.id) : []

  const showError = (msg: string) => {
    setPurchaseError(msg)
    setTimeout(() => setPurchaseError(null), 3000)
  }

  const handleConfirmPurchase = async () => {
    if (cartItems.length === 0) return
    for (const { product, qty } of cartItems) {
      const available = getDisplayStock(product)
      if (available < qty) {
        showError(`Stock insuficiente para "${product.name}". Disponible: ${available}`)
        return
      }
    }
    setConfirming(true)
    try {
      await addSaleBatch(
        cartItems.map(({ product, qty }) => ({
          product_id: product.id,
          product_name: product.name,
          quantity: qty,
          total: product.price * qty,
        })),
        paymentMethod
      )
      setCart({})
      setPurchaseSuccess(true)
      setTimeout(() => setPurchaseSuccess(false), 2500)
    } catch (error) {
      showError('Error al confirmar la compra: ' + (error as Error).message)
    } finally {
      setConfirming(false)
    }
  }

  const handleConfirmDelete = async (productId: string) => {
    try {
      await deleteProduct(productId)
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: 'Error al eliminar producto: ' + (error as Error).message,
        type: 'error'
      })
    }
  }

  const handleDeleteSale = async (saleId: string) => {
    setDeletingSale(true)
    try {
      await deleteSale(saleId)
      setConfirmingSaleDelete(null)
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: 'Error al eliminar la venta: ' + (error as Error).message,
        type: 'error'
      })
    } finally {
      setDeletingSale(false)
    }
  }

  const moveProduct = async (productId: string, direction: 'up' | 'down') => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const categoryProducts = products
      .filter(p => p.category === product.category)
      .sort((a, b) => a.sort_order - b.sort_order)

    const idx = categoryProducts.findIndex(p => p.id === productId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= categoryProducts.length) return

    const target = categoryProducts[swapIdx]
    try {
      await updateProduct(product.id, { sort_order: target.sort_order })
      await updateProduct(target.id, { sort_order: product.sort_order })
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: 'Error al reordenar: ' + (error as Error).message,
        type: 'error'
      })
    }
  }

  const CATEGORY_ORDER = ['bebida', 'comida', 'otro'] as const

  const containerIds = new Set(
    products.filter(p => p.container_product_id).map(p => p.container_product_id!)
  )
  const barraProducts = products.filter(p => !containerIds.has(p.id))

  const categories = CATEGORY_ORDER.filter(c => barraProducts.some(p => p.category === c))
  const filteredByCategory = barraProducts.filter(p => p.category === activeCategory)
  const filteredProducts = searchQuery
    ? filteredByCategory.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredByCategory

  const getDisplayStock = (product: typeof products[number]): number => {
    if (!product.container_product_id || !product.units_per_container) return product.stock
    const container = products.find(p => p.id === product.container_product_id)
    if (!container) return 0
    const soldInEvent = activeSales
      .filter(s => s.product_id === product.id)
      .reduce((sum, s) => sum + s.quantity, 0)
    return Math.max(0, container.stock * product.units_per_container - soldInEvent)
  }

  return (
    <Background>
      <div className="flex flex-col flex-grow pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 border-b border-zinc-800">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/manso-name-white.png" 
                alt="Manso Gestión" 
                className="h-8 sm:h-10 w-auto"
              />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Barra</h1>
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
            <div className="text-right">
              <p className="text-sm text-gray-400">Balance</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(balance)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-col flex-grow">
        <div className="flex flex-col flex-grow bg-black">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-gradient-to-b from-zinc-900/50 to-black border-b border-zinc-800">
            <div className="bg-neutral-900 border border-white/20 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Productos</p>
              <p className="text-lg font-bold mt-0.5 text-white">{barraProducts.length}</p>
            </div>
            <div className="bg-neutral-900 border border-white/20 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Stock</p>
              <p className="text-lg font-bold mt-0.5 text-white">
                {barraProducts.reduce((sum, p) => sum + getDisplayStock(p), 0)}
              </p>
            </div>
            <div className="bg-neutral-900 border border-white/20 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Ventas</p>
              <p className="text-lg font-bold mt-0.5 text-white">{activeSales.length}</p>
            </div>
            <div className="bg-neutral-900 border border-white/20 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Ingresos</p>
              <p className="text-lg font-bold mt-0.5 text-emerald-400">{formatCurrency(activeSales.reduce((sum, s) => sum + s.total, 0))}</p>
            </div>
          </div>

          {/* Tabs + Search */}
          <div className="sticky top-[73px] z-40 bg-black/95 border-b border-zinc-800 px-4 py-2">
            <div className="flex items-center gap-2 max-w-6xl mx-auto">
              <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${
                      activeCategory === cat
                        ? 'bg-emerald-700 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-9 pr-3 py-1.5 bg-neutral-900/80 border border-white/20 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="px-4 py-4">
            {filteredProducts.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">
                {searchQuery ? 'Sin resultados para esa búsqueda' : 'No hay productos en esta categoría'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filteredProducts
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((product) => {
                    const displayStock = getDisplayStock(product)
                    const isServing = !!product.container_product_id
                    const containerName = isServing
                      ? products.find(p => p.id === product.container_product_id)?.name
                      : null
                    return (
                      <div
                        key={product.id}
                        className="bg-neutral-900 border border-white/20 rounded-xl p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm text-white truncate">{product.name}</h3>
                            {isServing && containerName && (
                              <p className="text-[10px] text-indigo-400 truncate">Porción de {containerName}</p>
                            )}
                            <p className="text-emerald-400 text-sm font-bold mt-1">
                              {formatCurrency(product.price)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => moveProduct(product.id, 'up')}
                                className="w-5 h-4 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                                aria-label="Arriba"
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => moveProduct(product.id, 'down')}
                                className="w-5 h-4 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                                aria-label="Abajo"
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <p className={`text-xs font-bold ${displayStock < 10 ? 'text-amber-400' : 'text-gray-400'}`}>{displayStock}</p>
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  message: `¿Eliminar "${product.name}"?`,
                                  productId: product.id,
                                  productName: product.name
                                })
                              }}
                              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
                              aria-label="Eliminar"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCartQty(product.id, (cart[product.id] || 0) - 1)}
                            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded-lg transition-colors text-white text-sm font-bold"
                          >
                            −
                          </button>
                          <span className={`text-base font-bold w-7 text-center ${cart[product.id] ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {cart[product.id] || 0}
                          </span>
                          <button
                            onClick={() => setCartQty(product.id, (cart[product.id] || 0) + 1)}
                            className="w-8 h-8 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-500 rounded-lg transition-colors text-white text-sm font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

        {/* Resumen del carrito */}
        {cartItems.length > 0 && (
          <div className="p-6 sm:p-8 border-t-2 border-zinc-800 space-y-2 bg-neutral-950/30">
            <h2 className="text-lg font-semibold text-white">Pedido</h2>
            {cartItems.map(({ product, qty }) => (
              <div key={product.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{product.name} <span className="text-gray-400">×{qty}</span></span>
                <span className="text-emerald-400 font-medium">{formatCurrency(product.price * qty)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-white/20">
              <span className="font-semibold text-white">Total</span>
              <span className="text-xl font-bold text-emerald-400">{formatCurrency(cartTotal)}</span>
            </div>
          </div>
        )}

        {/* Método de pago + Confirmar */}
        <div className="p-6 sm:p-8 border-t-2 border-zinc-800 space-y-4 bg-neutral-950/30">
          <h2 className="text-lg font-semibold text-white">Método de Pago</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setPaymentMethod('efectivo')}
              className={`p-4 rounded-xl border-2 transition-all ${
                paymentMethod === 'efectivo'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                  : 'bg-neutral-900/60 border-white/20 text-gray-300 hover:border-white/30'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">💵</span>
                <span className="text-sm font-medium">Efectivo</span>
              </div>
            </button>
            <button
              onClick={() => setPaymentMethod('tarjeta')}
              className={`p-4 rounded-xl border-2 transition-all ${
                paymentMethod === 'tarjeta'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                  : 'bg-neutral-900/60 border-white/20 text-gray-300 hover:border-white/30'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">💳</span>
                <span className="text-sm font-medium">Tarjeta</span>
              </div>
            </button>
            <button
              onClick={() => setPaymentMethod('transferencia')}
              className={`p-4 rounded-xl border-2 transition-all ${
                paymentMethod === 'transferencia'
                  ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                  : 'bg-neutral-900/60 border-white/20 text-gray-300 hover:border-white/30'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">📱</span>
                <span className="text-sm font-medium">Transferencia</span>
              </div>
            </button>
          </div>

          {purchaseSuccess ? (
            <div className="w-full py-4 bg-emerald-700/40 border border-emerald-600 text-emerald-300 font-bold text-lg rounded-xl text-center">
              Venta registrada
            </div>
          ) : purchaseError ? (
            <div className="w-full py-4 bg-red-900/40 border border-red-700 text-red-300 font-medium text-sm rounded-xl text-center px-4">
              {purchaseError}
            </div>
          ) : (
            <button
              onClick={handleConfirmPurchase}
              disabled={cartItems.length === 0 || confirming}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors"
            >
              {confirming
                ? 'Confirmando...'
                : cartItems.length === 0
                  ? 'Seleccioná items para confirmar'
                  : `Confirmar compra · ${formatCurrency(cartTotal)}`}
            </button>
          )}
        </div>

          {/* Recent Sales */}
          <div className="p-6 sm:p-8 border-t-2 border-zinc-800">
            <h2 className="text-xl font-semibold mb-6 text-white">Ventas Recientes</h2>
            <div className="space-y-3">
              {activeSales.length === 0 ? (
                <p className="text-center text-gray-400 py-4">Sin ventas registradas</p>
              ) : (
                activeSales.slice(0, 10).map((sale) => {
                  const isConfirming = confirmingSaleDelete === sale.id
                  return (
                    <div key={sale.id} className="bg-neutral-900 rounded-2xl border border-white/20 overflow-hidden">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-emerald-900 bg-opacity-30 text-emerald-400 rounded-full">
                            <span className="text-lg">🍺</span>
                          </div>
                          <div>
                            <h3 className="font-medium text-white">{sale.product_name} ×{sale.quantity}</h3>
                            <p className="text-sm text-gray-400">{new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-emerald-400">{formatCurrency(sale.total)}</span>
                          <button
                            onClick={() => { setConfirmingSaleDelete(sale.id); }}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                            aria-label="Eliminar venta"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {isConfirming && (
                        <div className="px-4 pb-3 flex gap-2">
                          <button
                            onClick={() => setConfirmingSaleDelete(null)}
                            disabled={deletingSale}
                            className="flex-1 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
                            disabled={deletingSale}
                            className="flex-1 py-1.5 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
                          >
                            {deletingSale ? 'Eliminando...' : 'Confirmar borrar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => handleConfirmDelete(confirmModal.productId)}
        message={confirmModal.message}
        type="danger"
      />
    </div>
  </Background>
  )
}