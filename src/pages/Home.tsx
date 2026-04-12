import { useState } from 'react'
import { useStore } from '../store'
import Ingresos from '../components/Ingresos'
import EventCreator from '../components/EventCreator'

export default function Home() {
  const { balance, products, setStockInicial } = useStore
  const [stockValues, setStockValues] = useState<Record<string, number>>(
    products.reduce((acc, product) => ({ ...acc, [product.id]: product.stock }), {})
  )
  const [isStockExpanded, setIsStockExpanded] = useState(false)
  const [showEventCreator, setShowEventCreator] = useState(false)

  const handleStockChange = (productId: string, value: number) => {
    setStockValues(prev => ({ ...prev, [productId]: value }))
    setStockInicial(productId, value)
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
        {/* Balance Card */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 sm:p-8">
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
        </section>

        {/* Event Creator Section */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-3xl overflow-hidden">
          <button
            onClick={() => setShowEventCreator(!showEventCreator)}
            className="w-full p-6 sm:p-8 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
          >
            <h2 className="text-xl font-semibold text-white">Crear Evento</h2>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showEventCreator ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showEventCreator && (
            <div className="px-6 sm:px-8 pb-6 sm:pb-8">
              <EventCreator />
            </div>
          )}
        </section>

        {/* Stock Inicial Section */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-3xl overflow-hidden">
          <button
            onClick={() => setIsStockExpanded(!isStockExpanded)}
            className="w-full p-6 sm:p-8 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
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
                    className="flex items-center justify-between p-4 bg-gray-700/50 rounded-2xl border border-gray-600"
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
                        className="w-8 h-8 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                        aria-label={`Reducir stock de ${product.name}`}
                      >
                        <span className="text-lg">-</span>
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={stockValues[product.id]}
                        onChange={(e) => handleStockChange(product.id, parseInt(e.target.value) || 0)}
                        className="w-20 text-center bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                      />
                      <button
                        onClick={() => handleStockChange(product.id, stockValues[product.id] + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
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
        </section>

        {/* Ingresos Section */}
        <Ingresos />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Productos</p>
            <p className="text-2xl font-bold mt-1 text-white">{products.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Stock Total</p>
            <p className="text-2xl font-bold mt-1 text-white">
              {products.reduce((sum, product) => sum + stockValues[product.id], 0)}
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-sm text-gray-400">Valor Stock</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">
              {formatCurrency(products.reduce((sum, product) => sum + (stockValues[product.id] * product.price), 0))}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}