import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'
import Background from '../../components/Background'

interface Registration {
  id: string
  name: string
  email: string
  event_id: string
  registered_at: string
  used_at: string | null
  event_name?: string
}

export default function Comunidad() {
  const navigate = useNavigate()
  const { events } = useAppStore()
  const [rows, setRows] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<string>('todos')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('ticket_registrations')
        .select('id, name, email, event_id, registered_at, used_at')
        .order('registered_at', { ascending: false })

      if (error || !data) {
        setLoading(false)
        return
      }

      // Enriquecer con nombre de evento
      const enriched: Registration[] = data.map(r => ({
        ...r,
        event_name: events.find(e => e.id === r.event_id)?.name ?? r.event_id.slice(0, 8)
      }))

      setRows(enriched)
      setLoading(false)
    }
    load()
  }, [events])

  const filtered = selectedEvent === 'todos'
    ? rows
    : rows.filter(r => r.event_id === selectedEvent)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const { error } = await supabase
      .from('ticket_registrations')
      .delete()
      .eq('id', id)

    if (!error) {
      setRows(prev => prev.filter(r => r.id !== id))
    }
    setDeletingId(null)
  }

  const handleExport = () => {
    const data = filtered.map(r => ({
      Nombre: r.name,
      Email: r.email,
      Evento: r.event_name ?? '',
      Registrado: new Date(r.registered_at).toLocaleString('es-AR'),
      'Ingresó': r.used_at ? new Date(r.used_at).toLocaleString('es-AR') : 'No',
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Comunidad')

    const eventLabel = selectedEvent === 'todos'
      ? 'todos'
      : (events.find(e => e.id === selectedEvent)?.name ?? selectedEvent).replace(/\s+/g, '-')

    XLSX.writeFile(wb, `manso-comunidad-${eventLabel}.xlsx`)
  }

  return (
    <Background>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin/home')} className="text-gray-400 hover:text-white transition-colors">
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Comunidad</h2>
            <p className="text-gray-500 text-sm">{rows.length} registros totales</p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex gap-3 mb-4">
          <select
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
            className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="todos">Todos los eventos ({rows.length})</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>
                {e.name} ({rows.filter(r => r.event_id === e.id).length})
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            Exportar .xlsx
          </button>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-16 text-sm">
            No hay registros{selectedEvent !== 'todos' ? ' para este evento' : ''}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="bg-neutral-900 border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">{r.name}</p>
                    <p className="text-gray-400 text-sm truncate">{r.email}</p>
                    <p className="text-gray-600 text-sm mt-0.5">{r.event_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <span className={`inline-block text-sm px-2 py-0.5 rounded-full ${
                        r.used_at
                          ? 'bg-emerald-900/50 text-emerald-400'
                          : 'bg-white/10 text-gray-400'
                      }`}>
                        {r.used_at ? 'Ingresó' : 'Pendiente'}
                      </span>
                      <p className="text-gray-600 text-sm mt-1">
                        {new Date(r.registered_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40"
                      aria-label="Eliminar registro"
                    >
                      {deletingId === r.id ? (
                        <div className="animate-spin h-4 w-4 border-t-2 border-b-2 border-red-400 rounded-full" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Background>
  )
}
