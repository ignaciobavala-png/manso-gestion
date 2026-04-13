import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import SinEventoActivo from '../components/SinEventoActivo'
import AlertModal from '../components/AlertModal'
import ConfirmModal from '../components/ConfirmModal'

export default function Barra() {
  const { 
    products, 
    balance, 
    addSale, 
    flushBalance, 
    addProduct, 
    deleteProduct, 
    sales, 
    activeEvent,
    isLoading 
  } = useAppStore()
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    console.log('🍺 Componente Barra montado')
    // Usar el loading real del store en lugar de timer hardcodeado
    if (!isLoading) {
      setLoading(false)
    }
  }, [isLoading])

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
      await Promise.all(cartItems.map(({ product, qty }) =>
        addSale({
          product_id: product.id,
          product_name: product.name,
          quantity: qty,
          total: product.price * qty,
          payment_method: paymentMethod
        })
      ))
      await flushBalance()
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
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Barra</h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                </div>
                <span className="text-sm text-emerald-400 font-medium">Vivo</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Balance</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(balance)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Productos</p>
            <p className="text-2xl font-bold mt-1 text-white">{products.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Stock Total</p>
            <p className="text-2xl font-bold mt-1 text-white">
              {products.reduce((sum, product) => sum + product.stock, 0)}
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Ventas</p>
            <p className="text-2xl font-bold mt-1 text-white">{sales.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Ingresos</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{formatCurrency(sales.reduce((sum, s) => sum + s.total, 0))}</p>
          </div>
        </div>

        {/* Add Item Section */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 sm:p-8">
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre del Item
                  </label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Ej: Coca Cola"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Precio (ARS)
                  </label>
                  <input
                    type="number"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="Ej: 1500"
                    min="0"
                    step="100"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Categoría
                  </label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as 'bebida' | 'comida' | 'otro' })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
        </section>

        {/* Product Grid */}
        {categories.map(category => (
          <section key={category} className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-6 capitalize text-white">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products
                .filter(product => product.category === category)
                .map((product) => (
                  <div
                    key={product.id}
                    className="bg-gray-700/50 border border-gray-600 rounded-2xl p-4"
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
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
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
          </section>
        ))}

        {/* Carrito + Método de pago + Confirmar */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 sm:p-8 space-y-6">

          {/* Resumen del carrito */}
          {cartItems.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Pedido</h2>
              {cartItems.map(({ product, qty }) => (
                <div key={product.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{product.name} <span className="text-gray-500">×{qty}</span></span>
                  <span className="text-emerald-400 font-medium">{formatCurrency(product.price * qty)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <span className="font-semibold text-white">Total</span>
                <span className="text-xl font-bold text-emerald-400">{formatCurrency(cartTotal)}</span>
              </div>
            </div>
          )}

          {/* Método de pago */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Método de Pago</h2>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod('efectivo')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'efectivo'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
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
                    : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
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
                    : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">📱</span>
                  <span className="text-sm font-medium">Transferencia</span>
                </div>
              </button>
            </div>
          </div>

          {/* Confirmar compra */}
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
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors"
            >
              {confirming
                ? 'Confirmando...'
                : cartItems.length === 0
                  ? 'Seleccioná items para confirmar'
                  : `Confirmar compra · ${formatCurrency(cartTotal)}`}
            </button>
          )}
        </section>

        {/* Recent Sales */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold mb-6 text-white">Ventas Recientes</h2>
          <div className="space-y-3">
            {sales.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Sin ventas registradas</p>
            ) : (
              sales.slice(0, 10).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-2xl border border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-emerald-900/30 text-emerald-400 rounded-full">
                      <span className="text-lg">🍺</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{sale.product_name} ×{sale.quantity}</h3>
                      <p className="text-sm text-gray-400">{new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-emerald-400">{formatCurrency(sale.total)}</span>
                </div>
              ))
            )}
          </div>
        </section>
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
  )
}