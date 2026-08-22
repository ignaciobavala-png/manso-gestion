import { useState, useEffect, useMemo } from 'react'
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

interface UniqueEmail {
  email: string
  tickets: number
  eventCount: number
  lastEvent: string
  lastDate: string
}

interface CineclubVoter {
  email: string
  movie_title: string
  created_at: string
}

const PAGE_SIZE = 1000

async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

export default function Comunidad() {
  const navigate = useNavigate()
  const { events } = useAppStore()
  const [rows, setRows] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<string>('todos')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'emails' | 'registros' | 'cineclub'>('emails')
  const [copied, setCopied] = useState(false)
  const [cineclubVoters, setCineclubVoters] = useState<CineclubVoter[]>([])
  const [cineclubCopied, setCineclubCopied] = useState(false)

  useEffect(() => {
    async function load() {
      // Sólo entradas que cuentan: la comunidad no incluye a quien nunca
      // terminó de pagar por Mercado Pago ni a quien tiene el QR rechazado.
      const data = await fetchAllRows<Registration>((from, to) =>
        supabase
          .from('ticket_registrations')
          .select('id, name, email, event_id, registered_at, used_at, is_banned, payment_provider, payment_verified')
          .eq('is_banned', false)
          .or('payment_provider.is.null,payment_provider.neq.mercadopago,payment_verified.is.true')
          .order('registered_at', { ascending: false })
          .range(from, to)
      )

      const enriched: Registration[] = data.map(r => ({
        ...r,
        event_name: events.find(e => e.id === r.event_id)?.name ?? r.event_id.slice(0, 8)
      }))

      setRows(enriched)
      setLoading(false)
    }
    load()
  }, [events])

  useEffect(() => {
    async function loadCineclub() {
      type VoterEmailRow = { email: string; poll_id: string; voter_fingerprint: string; created_at: string }
      // PostgREST devuelve la relación embebida como objeto, pero según la
      // versión y la cardinalidad que infiere puede venir como array de uno.
      type PeliculaEmbebida = { title: string | null }
      type VoteRow = {
        poll_id: string
        voter_fingerprint: string
        movie_id: string
        cineclub_movies: PeliculaEmbebida | PeliculaEmbebida[] | null
      }

      const [emails, votesRes] = await Promise.all([
        fetchAllRows<VoterEmailRow>((from, to) =>
          supabase
            .from('cineclub_voter_emails')
            .select('email, poll_id, voter_fingerprint, created_at')
            .order('created_at', { ascending: false })
            .range(from, to)
        ),
        fetchAllRows<VoteRow>((from, to) =>
          supabase
            .from('cineclub_votes')
            .select('poll_id, voter_fingerprint, movie_id, cineclub_movies(title)')
            .range(from, to)
        ),
      ])

      const voteMap = new Map<string, string>()
      for (const v of votesRes) {
        const key = `${v.poll_id}:${v.voter_fingerprint}`
        const pelicula = Array.isArray(v.cineclub_movies)
          ? v.cineclub_movies[0]
          : v.cineclub_movies
        voteMap.set(key, pelicula?.title ?? '—')
      }

      const voters: CineclubVoter[] = emails.map(r => ({
        email: r.email,
        movie_title: voteMap.get(`${r.poll_id}:${r.voter_fingerprint}`) ?? '—',
        created_at: r.created_at,
      }))
      setCineclubVoters(voters)
    }
    loadCineclub()
  }, [])

  const filtered = selectedEvent === 'todos'
    ? rows
    : rows.filter(r => r.event_id === selectedEvent)

  const uniqueEmails = useMemo<UniqueEmail[]>(() => {
    const map = new Map<string, { email: string; tickets: number; eventIds: Set<string>; lastEvent: string; lastDate: string }>()
    for (const r of filtered) {
      if (!map.has(r.email)) {
        map.set(r.email, { email: r.email, tickets: 0, eventIds: new Set(), lastEvent: '', lastDate: '' })
      }
      const entry = map.get(r.email)!
      entry.tickets++
      entry.eventIds.add(r.event_id)
      if (!entry.lastDate || r.registered_at > entry.lastDate) {
        entry.lastDate = r.registered_at
        entry.lastEvent = r.event_name ?? ''
      }
    }
    return Array.from(map.values())
      .map(e => ({ email: e.email, tickets: e.tickets, eventCount: e.eventIds.size, lastEvent: e.lastEvent, lastDate: e.lastDate }))
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [filtered])

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

  const handleCopyEmails = async () => {
    const list = uniqueEmails.map(u => u.email).join('; ')
    await navigator.clipboard.writeText(list)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyCineclubEmails = async () => {
    const list = cineclubVoters.map(v => v.email).join('; ')
    await navigator.clipboard.writeText(list)
    setCineclubCopied(true)
    setTimeout(() => setCineclubCopied(false), 2000)
  }

  const handleExportCineclub = () => {
    const data = cineclubVoters.map(v => ({
      Email: v.email,
      'Película votada': v.movie_title,
      Fecha: new Date(v.created_at).toLocaleString('es-AR'),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cineclub')
    XLSX.writeFile(wb, 'manso-cineclub-voters.xlsx')
  }

  const handleExport = () => {
    const data = uniqueEmails.map(u => ({
      Email: u.email,
      Entradas: u.tickets,
      Eventos: u.eventCount,
      'Último evento': u.lastEvent,
      'Último registro': new Date(u.lastDate).toLocaleString('es-AR'),
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
            <p className="text-gray-400 text-sm">
              {viewMode === 'emails'
                ? `${uniqueEmails.length} personas`
                : viewMode === 'registros'
                ? `${filtered.length} registros`
                : `${cineclubVoters.length} votos`}
            </p>
          </div>
        </div>

        {/* Toggle vista */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setViewMode('emails')}
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${
              viewMode === 'emails' ? 'bg-emerald-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Emails únicos
          </button>
          <button
            onClick={() => setViewMode('registros')}
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${
              viewMode === 'registros' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Registros
          </button>
          <button
            onClick={() => setViewMode('cineclub')}
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${
              viewMode === 'cineclub' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Cineclub
          </button>
        </div>

        {/* Controles — solo para tabs de eventos */}
        {viewMode !== 'cineclub' && (
          <div className="flex gap-3 mb-3">
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
              onClick={handleCopyEmails}
              disabled={uniqueEmails.length === 0}
              className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              {copied ? '¡Copiado!' : 'Copiar mails'}
            </button>
            <button
              onClick={handleExport}
              disabled={uniqueEmails.length === 0}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              Exportar .xlsx
            </button>
          </div>
        )}

        {/* Controles Cineclub */}
        {viewMode === 'cineclub' && (
          <div className="flex gap-3 mb-3 justify-end">
            <button
              onClick={handleCopyCineclubEmails}
              disabled={cineclubVoters.length === 0}
              className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              {cineclubCopied ? '¡Copiado!' : 'Copiar mails'}
            </button>
            <button
              onClick={handleExportCineclub}
              disabled={cineclubVoters.length === 0}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              Exportar .xlsx
            </button>
          </div>
        )}

        {/* Lista Cineclub */}
        {viewMode === 'cineclub' && (
          cineclubVoters.length === 0 ? (
            <div className="text-center text-gray-400 py-16 text-sm">No hay votos registrados aún.</div>
          ) : (
            <div className="space-y-2">
              {cineclubVoters.map((v, i) => (
                <div key={i} className="bg-neutral-900 border border-white/20 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm truncate">{v.email}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{new Date(v.created_at).toLocaleDateString('es-AR')}</p>
                    </div>
                    <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                      🎬 {v.movie_title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Lista eventos */}
        {viewMode !== 'cineclub' && (loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
          </div>
        ) : viewMode === 'emails' ? (
          uniqueEmails.length === 0 ? (
            <div className="text-center text-gray-400 py-16 text-sm">
              No hay registros{selectedEvent !== 'todos' ? ' para este evento' : ''}.
            </div>
          ) : (
            <div className="space-y-2">
              {uniqueEmails.map(u => (
                <div key={u.email} className="bg-neutral-900 border border-white/20 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm truncate">{u.email}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{u.lastEvent} · {new Date(u.lastDate).toLocaleDateString('es-AR')}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {u.tickets} {u.tickets === 1 ? 'entrada' : 'entradas'}
                      </span>
                      {u.eventCount > 1 && (
                        <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {u.eventCount} eventos
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-16 text-sm">
            No hay registros{selectedEvent !== 'todos' ? ' para este evento' : ''}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="bg-neutral-900 border border-white/20 rounded-2xl px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">{r.name}</p>
                    <p className="text-gray-400 text-sm truncate">{r.email}</p>
                    <p className="text-gray-400 text-sm">{r.event_name}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <span className={`inline-block text-sm px-2 py-0.5 rounded-full ${
                      r.used_at
                        ? 'bg-emerald-900/50 text-emerald-400'
                        : 'bg-white/10 text-gray-400'
                    }`}>
                      {r.used_at ? 'Ingresó' : 'Pendiente'}
                    </span>
                    <p className="text-gray-400 text-sm">
                      {new Date(r.registered_at).toLocaleDateString('es-AR')}
                    </p>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40"
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
        ))}
      </div>
    </Background>
  )
}
