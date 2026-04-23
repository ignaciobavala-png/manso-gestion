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
    flushBalance,
    addProduct,
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
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category: 'bebida' as 'bebida' | 'comida' | 'otro'
  })
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
      if (product.stock < qty) {
        showError(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}`)
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
      flushBalance()
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

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) {
      setAlertModal({
        isOpen: true,
        message: 'Por favor completa todos los campos',
        type: 'warning'
      })
      return
    }

    const price = parseFloat(newItem.price)
    if (isNaN(price) || price <= 0) {
      setAlertModal({
        isOpen: true,
        message: 'Por favor ingresa un precio válido',
        type: 'warning'
      })
      return
    }

    try {
      await addProduct({
        name: newItem.name,
        price: price,
        category: newItem.category,
        stock: 0
      })

      setNewItem({ name: '', price: '', category: 'bebida' })
      setShowAddItem(false)
    } catch (error) {
      setAlertModal({
        isOpen: true,
        message: 'Error al agregar producto: ' + (error as Error).message,
        type: 'error'
      })
    }
  }

  const categories = Array.from(new Set(products.map(p => p.category)))

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 sm:p-8 bg-gradient-to-b from-zinc-900/50 to-black border-b-2 border-zinc-800">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
              <p className="text-sm text-gray-400">Productos</p>
              <p className="text-2xl font-bold mt-1 text-white">{products.length}</p>
            </div>
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
              <p className="text-sm text-gray-400">Stock Total</p>
              <p className="text-2xl font-bold mt-1 text-white">
                {products.reduce((sum, product) => sum + product.stock, 0)}
              </p>
            </div>
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
              <p className="text-sm text-gray-400">Ventas</p>
              <p className="text-2xl font-bold mt-1 text-white">{activeSales.length}</p>
            </div>
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4">
              <p className="text-sm text-gray-400">Ingresos</p>
              <p className="text-2xl font-bold mt-1 text-emerald-400">{formatCurrency(activeSales.reduce((sum, s) => sum + s.total, 0))}</p>
            </div>
          </div>

          {/* Add Item Section */}
          <div className="p-6 sm:p-8 border-t-2 border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Agregar Nuevo Item</h2>
              <button
                onClick={() => setShowAddItem(!showAddItem)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
              >
                {showAddItem ? 'Cancelar' : 'Agregar Item'}
              </button>
            </div>

            {showAddItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="barra-item-name">
                      Nombre del Item
                    </label>
                    <input
                      id="barra-item-name"
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder="Ej: Coca Cola"
                      className="w-full px-4 py-2 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="barra-item-price">
                      Precio (ARS)
                    </label>
                    <input
                      id="barra-item-price"
                      type="number"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      placeholder="Ej: 1500"
                      min="0"
                      step="100"
                      className="w-full px-4 py-2 bg-neutral-900/80 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="barra-item-cat">
                      Categoría
                    </label>
                    <select
                      id="barra-item-cat"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value as 'bebida' | 'comida' | 'otro' })}
                      className="w-full px-4 py-2 bg-neutral-900/80 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="bebida">Bebida</option>
                      <option value="comida">Comida</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleAddItem}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Agregar Producto
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Product Grid */}
          <div className="divide-y divide-white/10">
            {categories.map(category => (
              <div key={category} className="p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-6 capitalize text-white">{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products
                    .filter(product => product.category === category)
                    .map((product) => (
                      <div
                        key={product.id}
                        className="bg-neutral-900 border border-white/10 rounded-2xl p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-medium text-lg text-white">{product.name}</h3>
                            <p className="text-emerald-400 text-xl font-bold mt-1">
                              {formatCurrency(product.price)}
                            </p>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="text-right">
                              <p className="text-sm text-gray-400">Stock</p>
                              <p className={`text-lg font-bold ${
                                product.stock < 10 ? 'text-amber-400' : 'text-emerald-400'
                              }`}>
                                {product.stock}
                              </p>
                            </div>
                             <button
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  message: `¿Eliminar "${product.name}"?`,
                                  productId: product.id,
                                  productName: product.name
                                })
                              }}
                              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-900 hover:bg-opacity-20 rounded-lg transition-colors"
                              aria-label={`Eliminar ${product.name}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">Cantidad</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setCartQty(product.id, (cart[product.id] || 0) - 1)}
                                className="w-11 h-11 flex items-center justify-center bg-gray-600 hover:bg-gray-500 active:bg-gray-400 rounded-lg transition-colors"
                              >
                                <span className="text-xl leading-none">−</span>
                              </button>
                              <span className={`text-xl font-bold w-10 text-center ${cart[product.id] ? 'text-emerald-400' : 'text-gray-500'}`}>
                                {cart[product.id] || 0}
                              </span>
                              <button
                                onClick={() => setCartQty(product.id, (cart[product.id] || 0) + 1)}
                                className="w-11 h-11 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-500 rounded-lg transition-colors"
                              >
                                <span className="text-xl leading-none">+</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Recent Sales */}
          <div className="p-6 sm:p-8 border-t-2 border-zinc-800">
            <h2 className="text-xl font-semibold mb-6 text-white">Ventas Recientes</h2>
            <div className="space-y-3">
              {activeSales.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Sin ventas registradas</p>
              ) : (
                activeSales.slice(0, 10).map((sale) => {
                  const isConfirming = confirmingSaleDelete === sale.id
                  return (
                    <div key={sale.id} className="bg-neutral-900 rounded-2xl border border-white/10 overflow-hidden">
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
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
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

        {/* Resumen del carrito */}
        {cartItems.length > 0 && (
          <div className="p-6 sm:p-8 border-t-2 border-zinc-800 space-y-2 bg-neutral-950/30">
            <h2 className="text-lg font-semibold text-white">Pedido</h2>
            {cartItems.map(({ product, qty }) => (
              <div key={product.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{product.name} <span className="text-gray-500">×{qty}</span></span>
                <span className="text-emerald-400 font-medium">{formatCurrency(product.price * qty)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
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
                  : 'bg-neutral-900/60 border-white/10 text-gray-300 hover:border-white/30'
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
                  : 'bg-neutral-900/60 border-white/10 text-gray-300 hover:border-white/30'
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
                  : 'bg-neutral-900/60 border-white/10 text-gray-300 hover:border-white/30'
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
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors"
            >
              {confirming
                ? 'Confirmando...'
                : cartItems.length === 0
                  ? 'Seleccioná items para confirmar'
                  : `Confirmar compra · ${formatCurrency(cartTotal)}`}
            </button>
          )}
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