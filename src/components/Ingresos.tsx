import { useState } from 'react'
import { useStore } from '../store'

export default function Ingresos() {
  const { sales, ticketSales, ticketPrices } = useStore
  const [isExpanded, setIsExpanded] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Calculate totals by payment method
  const barRevenueByPayment = {
    efectivo: sales.filter(s => s.paymentMethod === 'efectivo').reduce((sum, sale) => sum + sale.total, 0),
    tarjeta: sales.filter(s => s.paymentMethod === 'tarjeta').reduce((sum, sale) => sum + sale.total, 0),
    transferencia: sales.filter(s => s.paymentMethod === 'transferencia').reduce((sum, sale) => sum + sale.total, 0)
  }
  
  const barRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const ticketRevenue = ticketSales.reduce((sum, ticket) => sum + ticket.price, 0)
  const totalRevenue = barRevenue + ticketRevenue

  // Get recent transactions
  const recentSales = sales.slice(-3).reverse()
  const recentTickets = ticketSales.slice(-3).reverse()

  return (
    <section className="bg-gray-800/50 border border-gray-700 rounded-3xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 sm:p-8 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
      >
        <h2 className="text-xl font-semibold text-white">Ingresos</h2>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-6">
          {/* Total Revenue */}
          <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-800/30 border border-emerald-700 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-400 text-sm font-medium">Ingresos Totales</p>
                <p className="text-3xl font-bold text-white mt-1">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-900/30 border border-blue-700 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-blue-400 text-sm font-medium">Barra</p>
                  <span className="text-2xl">🍺</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatCurrency(barRevenue)}</p>
                <p className="text-xs text-gray-400 mt-1">{sales.length} ventas</p>
              </div>
              
              <div className="bg-amber-900/30 border border-amber-700 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-amber-400 text-sm font-medium">Entradas</p>
                  <span className="text-2xl">🎫</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatCurrency(ticketRevenue)}</p>
                <p className="text-xs text-gray-400 mt-1">{ticketSales.length} tickets</p>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="bg-gray-700/30 border border-gray-600 rounded-2xl p-4">
              <p className="text-sm font-medium text-gray-300 mb-3">Ventas por Método de Pago</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💵</span>
                    <span className="text-sm text-gray-300">Efectivo</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">{formatCurrency(barRevenueByPayment.efectivo)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💳</span>
                    <span className="text-sm text-gray-300">Tarjeta</span>
                  </div>
                  <span className="text-sm font-bold text-blue-400">{formatCurrency(barRevenueByPayment.tarjeta)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📱</span>
                    <span className="text-sm text-gray-300">Transferencia</span>
                  </div>
                  <span className="text-sm font-bold text-purple-400">{formatCurrency(barRevenueByPayment.transferencia)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Prices Info */}
          <div className="bg-gray-700/30 border border-gray-600 rounded-2xl p-4">
            <p className="text-sm font-medium text-gray-300 mb-3">Precios de Entradas</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Regular</span>
                <span className="text-sm font-bold text-emerald-400">{formatCurrency(ticketPrices.regular)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Invitado</span>
                <span className="text-sm font-bold text-amber-400">{formatCurrency(ticketPrices.invitado)}</span>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Ventas Recientes (Barra)</h3>
              <div className="space-y-2">
                {recentSales.length > 0 ? recentSales.map((sale) => {
                  const paymentIcons = {
                    efectivo: '💵',
                    tarjeta: '💳',
                    transferencia: '📱'
                  }
                  const paymentColors = {
                    efectivo: 'emerald',
                    tarjeta: 'blue',
                    transferencia: 'purple'
                  }
                  const color = paymentColors[sale.paymentMethod]
                  
                  return (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 bg-${color}-900/30 rounded-full flex items-center justify-center`}>
                          <span className="text-sm">🍺</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{sale.productName} ×{sale.quantity}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{sale.timestamp}</span>
                            <span className="text-xs">{paymentIcons[sale.paymentMethod]}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{formatCurrency(sale.total)}</span>
                    </div>
                  )
                }) : (
                  <p className="text-sm text-gray-500 text-center py-2">Sin ventas recientes</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Tickets Recientes (Entradas)</h3>
              <div className="space-y-2">
                {recentTickets.length > 0 ? recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm">🎫</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{ticket.guestName}</p>
                        <p className="text-xs text-gray-400">{ticket.type} • {ticket.timestamp}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">{formatCurrency(ticket.price)}</span>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500 text-center py-2">Sin tickets recientes</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
