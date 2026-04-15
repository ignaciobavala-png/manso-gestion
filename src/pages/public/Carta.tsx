import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type Product = {
  id: string
  name: string
  price: number
  category: 'bebida' | 'comida' | 'otro'
}

type CartItem = {
  product: Product
  quantity: number
}

type Screen = 'menu' | 'cart' | 'checkout'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function formatPrice(n: number): string {
  return `$${n.toLocaleString('es-AR')}`
}

const CATEGORY_LABELS: Record<string, string> = {
  bebida: 'Bebidas',
  comida: 'Comidas',
  otro: 'Otros',
}

const CATEGORY_ORDER = ['bebida', 'comida', 'otro']

export default function Carta() {
  const [products, setProducts] = useState<Product[]>([])
  const [alias, setAlias] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [screen, setScreen] = useState<Screen>('menu')
  const [orderCode, setOrderCode] = useState<string>('')

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('id, name, price, category').order('name'),
      supabase.from('venue_config').select('alias_pago, cbu_pago').single(),
    ]).then(([productsRes, configRes]) => {
      if (productsRes.data) setProducts(productsRes.data as Product[])
      if (configRes.data?.alias_pago) setAlias(configRes.data.alias_pago)
      else if (configRes.data?.cbu_pago) setAlias(configRes.data.cbu_pago)
      setLoading(false)
    })
  }, [])

  const grouped = CATEGORY_ORDER.reduce<Record<string, Product[]>>((acc, cat) => {
    const items = products.filter(p => p.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  function setQty(product: Product, qty: number) {
    setCart(prev => {
      if (qty <= 0) return prev.filter(i => i.product.id !== product.id)
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: qty } : i)
      return [...prev, { product, quantity: qty }]
    })
  }

  function getQty(productId: string): number {
    return cart.find(i => i.product.id === productId)?.quantity ?? 0
  }

  function handleCheckout() {
    const code = generateCode()
    setOrderCode(code)
    setScreen('checkout')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  // ── PANTALLA DE CONFIRMACION ──────────────────────────────────────────────
  if (screen === 'checkout') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-[0.3em]">MANSO</h1>
            <p className="text-gray-500 text-xs mt-1 tracking-widest uppercase">carta digital</p>
          </div>

          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl p-6 space-y-3">
            <p className="text-emerald-400 text-xs uppercase tracking-widest">Tu código de pedido</p>
            <p className="text-5xl font-bold text-white tracking-[0.2em]">{orderCode}</p>
            <p className="text-gray-400 text-sm">Mostrá este código en la caja</p>
          </div>

          <div className="bg-gray-800 rounded-2xl p-5 space-y-3 text-left">
            <p className="text-gray-400 text-xs uppercase tracking-widest">Instrucciones de pago</p>
            <div className="space-y-1">
              <p className="text-white text-sm">
                Transferí{' '}
                <span className="font-bold text-emerald-400">{formatPrice(cartTotal)}</span>
              </p>
              {alias ? (
                <p className="text-white text-sm">
                  Alias: <span className="font-bold">{alias}</span>
                </p>
              ) : (
                <p className="text-gray-500 text-sm italic">Consultá el alias en la caja</p>
              )}
              <p className="text-gray-500 text-sm">
                Referencia: <span className="font-semibold text-white">{orderCode}</span>
              </p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 text-left space-y-1">
            {cart.map(item => (
              <div key={item.product.id} className="flex justify-between text-sm text-gray-300">
                <span>{item.quantity}× {item.product.name}</span>
                <span>{formatPrice(item.product.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between font-bold text-white">
              <span>Total</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
          </div>

          <button
            onClick={() => { setCart([]); setScreen('menu') }}
            className="w-full text-gray-500 text-sm py-3"
          >
            Hacer otro pedido
          </button>
        </div>
      </div>
    )
  }

  // ── PANTALLA DE CARRITO ───────────────────────────────────────────────────
  if (screen === 'cart') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="px-5 pt-8 pb-4 flex items-center gap-4">
          <button onClick={() => setScreen('menu')} className="text-gray-400 text-2xl leading-none">←</button>
          <div>
            <h1 className="text-white font-bold tracking-widest">Tu pedido</h1>
            <p className="text-gray-500 text-xs">{cartCount} {cartCount === 1 ? 'item' : 'items'}</p>
          </div>
        </div>

        <div className="flex-1 px-5 space-y-3 pb-32">
          {cart.map(item => (
            <div key={item.product.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{item.product.name}</p>
                <p className="text-gray-400 text-xs">{formatPrice(item.product.price)} c/u</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(item.product, item.quantity - 1)}
                  className="w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center text-lg font-bold"
                >−</button>
                <span className="text-white w-4 text-center font-semibold">{item.quantity}</span>
                <button
                  onClick={() => setQty(item.product, item.quantity + 1)}
                  className="w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center text-lg font-bold"
                >+</button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <p className="text-gray-600 text-center py-16 text-sm">El carrito está vacío</p>
          )}
        </div>

        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-5 py-4 space-y-3">
            <div className="flex justify-between text-white">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">{formatPrice(cartTotal)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95"
            >
              Confirmar pedido
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── MENU PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-8 pb-5 text-center">
        <h1 className="text-3xl font-bold text-white tracking-[0.3em]">MANSO</h1>
        <p className="text-gray-500 text-xs mt-1 tracking-widest uppercase">carta digital</p>
      </div>

      {/* Productos por categoría */}
      <div className="flex-1 px-5 space-y-6 pb-32">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-3 font-semibold">
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <div className="space-y-2">
              {items.map(product => {
                const qty = getQty(product.id)
                return (
                  <div
                    key={product.id}
                    className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{product.name}</p>
                      <p className="text-emerald-400 text-sm font-semibold mt-0.5">
                        {formatPrice(product.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {qty > 0 && (
                        <>
                          <button
                            onClick={() => setQty(product, qty - 1)}
                            className="w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center text-lg font-bold"
                          >−</button>
                          <span className="text-white w-4 text-center font-semibold">{qty}</span>
                        </>
                      )}
                      <button
                        onClick={() => setQty(product, qty + 1)}
                        className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-bold"
                      >+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {products.length === 0 && (
          <div className="text-center py-24">
            <p className="text-gray-600 text-sm">No hay productos disponibles</p>
          </div>
        )}
      </div>

      {/* Botón flotante del carrito */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-5 py-4">
          <button
            onClick={() => setScreen('cart')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-between px-5"
          >
            <span className="bg-emerald-800 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
              {cartCount}
            </span>
            <span>Ver pedido</span>
            <span>{formatPrice(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
