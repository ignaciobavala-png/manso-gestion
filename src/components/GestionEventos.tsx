import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import EventCreator from './EventCreator'

export default function GestionEventos() {
  const { events, activeEvent, selectOperatingEvent } = useAppStore()
  const [regCounts, setRegCounts] = useState<Record<string, number>>({})
  const [showCreator, setShowCreator] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)

  const scrollToArqueo = () => {
    document.getElementById('arqueo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openEvents = events.filter(e => e.is_active && !e.closed_at)
  const closedEvents = events.filter(e => !e.is_active || e.closed_at)

  useEffect(() => {
    if (events.length === 0) return
    const ids = events.map(e => e.id)
    supabase
      .from('ticket_registrations')
      .select('event_id')
      .in('event_id', ids)
      .then(({ data }) => {
        if (!data) return
        const counts: Record<string, number> = {}
        data.forEach(r => {
          counts[r.event_id] = (counts[r.event_id] ?? 0) + 1
        })
        setRegCounts(counts)
      })
  }, [events])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

  return (
    <section className="bg-gray-800/50 border border-gray-700 rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="p-6 sm:p-8 pb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Eventos</h2>
        <button
          onClick={() => setShowCreator(v => !v)}
          className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          {showCreator ? '✕ Cancelar' : '+ Nuevo evento'}
        </button>
      </div>

      {/* Formulario nuevo evento */}
      {showCreator && (
        <div className="px-6 sm:px-8 pb-6 border-b border-gray-700">
          <EventCreator onCreated={() => setShowCreator(false)} />
        </div>
      )}

      {/* Eventos abiertos */}
      <div className="px-6 sm:px-8 py-4 space-y-3">
        {openEvents.length === 0 && !showCreator && (
          <p className="text-gray-500 text-sm text-center py-4">
            No hay eventos abiertos. Creá uno para empezar.
          </p>
        )}

        {openEvents.map(e => {
          const isCurrent = activeEvent?.id === e.id
          const regs = regCounts[e.id] ?? 0

          return (
            <div
              key={e.id}
              className={`rounded-2xl border px-4 py-4 transition-colors ${
                isCurrent
                  ? 'bg-emerald-900/30 border-emerald-700'
                  : 'bg-gray-700/40 border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold text-sm truncate">{e.name}</p>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-100 uppercase tracking-wide whitespace-nowrap">
                        En operación
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {regs} {regs === 1 ? 'entrada registrada' : 'entradas registradas'}
                    {' · '} creado {formatDate(e.created_at)}
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {!isCurrent && (
                    <button
                      onClick={() => selectOperatingEvent(e.id)}
                      className="text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors whitespace-nowrap"
                    >
                      Operar
                    </button>
                  )}
                  {isCurrent && (
                    <button
                      onClick={scrollToArqueo}
                      className="text-xs px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-300 font-medium rounded-xl transition-colors whitespace-nowrap"
                    >
                      Arqueo ↓
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Historial de eventos cerrados */}
      {closedEvents.length > 0 && (
        <div className="border-t border-gray-700">
          <button
            onClick={() => setShowHistorial(v => !v)}
            className="w-full px-6 sm:px-8 py-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
          >
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              Historial ({closedEvents.length})
            </span>
            <span className="text-gray-600 text-sm">{showHistorial ? '▲' : '▼'}</span>
          </button>

          {showHistorial && (
            <div className="px-6 sm:px-8 pb-4 space-y-2">
              {closedEvents.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                  <p className="text-gray-400 text-sm truncate">{e.name}</p>
                  <p className="text-gray-600 text-xs flex-shrink-0 ml-3">
                    {e.closed_at ? `Cerrado ${formatDate(e.closed_at)}` : 'Sin cerrar'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </section>
  )
}
