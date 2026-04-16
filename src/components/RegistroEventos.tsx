import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'

export default function RegistroEventos() {
  const { events, sales, ticketSales, deleteEvent } = useAppStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

  const closedEvents = events
    .filter(e => !e.is_active && e.closed_at)
    .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())

  if (closedEvents.length === 0) return null

  const handleDelete = async (eventId: string) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteEvent(eventId)
      setConfirmingDelete(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el evento.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="bg-gray-800/50 border border-gray-700 rounded-3xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 sm:p-8 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
      >
        <div>
          <h2 className="text-xl font-semibold text-white">Registro de Eventos</h2>
          <p className="text-sm text-gray-400 mt-1">
            {closedEvents.length} evento{closedEvents.length !== 1 ? 's' : ''} cerrado{closedEvents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-4">
          {closedEvents.map(event => {
            const eventSales = sales.filter(s => s.event_id === event.id)
            const eventTickets = ticketSales.filter(t => t.event_id === event.id)
            const barRevenue = eventSales.reduce((sum, s) => sum + s.total, 0)
            const ticketRevenue = eventTickets.reduce((sum, t) => sum + t.price, 0)
            const total = barRevenue + ticketRevenue
            const isConfirming = confirmingDelete === event.id

            return (
              <div key={event.id} className="bg-gray-700/40 border border-gray-600 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{event.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Cerrado: {new Date(event.closed_at!).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Total recaudado</p>
                    <p className="text-xl font-bold text-emerald-400">{formatCurrency(total)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-3">
                    <p className="text-xs text-blue-400 mb-1">Barra</p>
                    <p className="text-base font-bold text-white">{formatCurrency(barRevenue)}</p>
                    <p className="text-xs text-gray-500">{eventSales.length} ventas</p>
                  </div>
                  <div className="bg-amber-900/30 border border-amber-800/50 rounded-xl p-3">
                    <p className="text-xs text-amber-400 mb-1">Entradas</p>
                    <p className="text-base font-bold text-white">{formatCurrency(ticketRevenue)}</p>
                    <p className="text-xs text-gray-500">{eventTickets.length} tickets</p>
                  </div>
                </div>

                {/* Eliminar */}
                {!isConfirming ? (
                  <button
                    onClick={() => { setConfirmingDelete(event.id); setDeleteError(null) }}
                    className="w-full text-xs text-gray-600 hover:text-red-400 transition-colors py-1 text-center"
                  >
                    Eliminar evento
                  </button>
                ) : (
                  <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-red-300 text-center">
                      Esto elimina el evento y todos sus datos. No se puede deshacer.
                    </p>
                    {deleteError && (
                      <p className="text-xs text-red-400 text-center bg-red-900/40 rounded-lg px-2 py-1">
                        {deleteError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirmingDelete(null); setDeleteError(null) }}
                        disabled={deleting}
                        className="flex-1 py-2 text-sm bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={deleting}
                        className="flex-1 py-2 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
                      >
                        {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
