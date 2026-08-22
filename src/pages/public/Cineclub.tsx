import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'
import { useCineclubActivo } from '../../hooks/useSeccionPublica'

const FINGERPRINT_KEY = 'cineclub_voter_fp'

function getOrCreateFingerprint(): string {
  let fp = localStorage.getItem(FINGERPRINT_KEY)
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem(FINGERPRINT_KEY, fp)
  }
  return fp
}

function getVotedKey(pollId: string) {
  return `cineclub_voted_${pollId}`
}

interface Poll {
  id: string
  status: 'voting' | 'closed'
  closes_at: string | null
}

interface Movie {
  id: string
  title: string
  synopsis: string
  flyer_url: string | null
  sort_order: number
  vote_count: number
}

// ── Header con flecha ────────────────────────────────────────────────────────
// A nivel de módulo a propósito: definido dentro de Cineclub, cada render creaba
// un componente distinto y React desmontaba y volvía a montar todo el header.
function PageHeader({ subtitle }: { subtitle?: string }) {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col items-center px-5 pb-10">
      <div className="w-full max-w-lg mb-6 mt-4">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg"
          >
            ←
          </button>
        </div>
        <h1 className="text-white font-bold text-2xl text-center -mt-10">Cineclub</h1>
        {subtitle && (
          <p className="text-gray-400 text-sm text-center mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

export default function Cineclub() {
  const navigate = useNavigate()
  const { activo: cineclubActivo, loading: cineclubLoading } = useCineclubActivo()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [votedMovieId, setVotedMovieId] = useState<string | null>(null)
  const [voting, setVoting] = useState(false)
  const [totalVotes, setTotalVotes] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sharedId, setSharedId] = useState<string | null>(null)
  const [pendingMovieId, setPendingMovieId] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  const handleShare = async (movieTitle: string, movieId: string) => {
    const url = window.location.href
    const text = `🎬 ¡Votá por "${movieTitle}"! Elegí la próxima película del Cineclub → ${url}`

    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        // usuario canceló el share nativo, no hacer nada
      }
    } else {
      await navigator.clipboard.writeText(text)
      setSharedId(movieId)
      setTimeout(() => setSharedId(null), 2000)
    }
  }

  const loadPoll = useCallback(async () => {
    const { data: polls } = await supabase
      .from('cineclub_polls')
      .select('id, status, closes_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!polls?.length) {
      setLoading(false)
      return
    }

    let currentPoll = polls[0] as Poll

    // Si el plazo venció y todavía figura como abierta, cerrarla automáticamente
    if (currentPoll.status === 'voting' && currentPoll.closes_at && new Date(currentPoll.closes_at) <= new Date()) {
      await supabase.from('cineclub_polls').update({ status: 'closed' }).eq('id', currentPoll.id)
      currentPoll = { ...currentPoll, status: 'closed' }
    }

    setPoll(currentPoll)

    const storedVote = localStorage.getItem(getVotedKey(currentPoll.id))
    if (storedVote) setVotedMovieId(storedVote)

    const [moviesRes, votesRes] = await Promise.all([
      supabase
        .from('cineclub_movies')
        .select('id, title, synopsis, flyer_url, sort_order')
        .eq('poll_id', currentPoll.id)
        .order('sort_order'),
      supabase
        .from('cineclub_votes')
        .select('movie_id')
        .eq('poll_id', currentPoll.id),
    ])

    const votesByMovie: Record<string, number> = {}
    for (const v of votesRes.data ?? []) {
      votesByMovie[v.movie_id] = (votesByMovie[v.movie_id] ?? 0) + 1
    }

    setMovies(
      (moviesRes.data ?? []).map(m => ({ ...m, vote_count: votesByMovie[m.id] ?? 0 }))
    )
    setTotalVotes(votesRes.data?.length ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { loadPoll() }, [loadPoll])

  useEffect(() => {
    if (!poll) return
    const channel = supabase
      .channel('cineclub-votes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cineclub_votes', filter: `poll_id=eq.${poll.id}` },
        (payload) => {
          const movieId = payload.new.movie_id as string
          setMovies(prev => prev.map(m => m.id === movieId ? { ...m, vote_count: m.vote_count + 1 } : m))
          setTotalVotes(prev => prev + 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cineclub_polls', filter: `id=eq.${poll.id}` },
        (payload) => {
          setPoll(prev => prev ? { ...prev, status: payload.new.status } : prev)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [poll])

  const handleVote = (movieId: string) => {
    if (!poll || voting || votedMovieId) return
    setPendingMovieId(movieId)
    setEmailInput('')
    setEmailError('')
  }

  const confirmVote = async () => {
    if (!poll || !pendingMovieId) return
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Ingresá un email válido')
      return
    }
    setVoting(true)
    const fingerprint = getOrCreateFingerprint()
    const [voteRes] = await Promise.all([
      supabase.from('cineclub_votes').insert({
        poll_id: poll.id,
        movie_id: pendingMovieId,
        voter_fingerprint: fingerprint,
      }),
      supabase.from('cineclub_voter_emails').insert({
        poll_id: poll.id,
        voter_fingerprint: fingerprint,
        email: trimmed,
      }),
    ])
    if (!voteRes.error) {
      localStorage.setItem(getVotedKey(poll.id), pendingMovieId)
      setVotedMovieId(pendingMovieId)
      setPendingMovieId(null)
    } else {
      setEmailError('Hubo un error al registrar tu voto. Intentá de nuevo.')
    }
    setVoting(false)
  }

  // Sección apagada desde Configuración: para el público no existe.
  if (!cineclubLoading && !cineclubActivo) {
    return <Navigate to="/" replace />
  }

  if (loading || cineclubLoading) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
        </div>
      </PublicLayout>
    )
  }

  if (!poll) {
    return (
      <PublicLayout>
        <PageHeader />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 -mt-12">
          <p className="text-4xl">🎬</p>
          <p className="text-white/60 text-sm">No hay ninguna votación activa por el momento.</p>
        </div>
      </PublicLayout>
    )
  }

  if (poll.status === 'closed') {
    return (
      <PublicLayout>
        <PageHeader />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 -mt-12">
          <p className="text-4xl">🎬</p>
          <p className="text-white font-bold text-xl">Votación finalizada</p>
          <p className="text-gray-400 text-sm max-w-xs">
            Se confirmará la fecha de proyección próximamente.
          </p>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center px-5 pb-10">
        {/* Header */}
        <div className="w-full max-w-lg mb-6 mt-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-lg"
            >
              ←
            </button>
          </div>
          <h1 className="text-white font-bold text-2xl text-center -mt-10">Cineclub</h1>
          <p className="text-gray-400 text-sm text-center mt-2">
            {votedMovieId ? 'Tu voto fue registrado' : '¿Qué película querés ver?'}
          </p>
        </div>

        {/* Grid 2 columnas — igual que la sección de eventos */}
        <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto w-full">
          {movies.map(movie => {
            const pct = totalVotes > 0 ? Math.round((movie.vote_count / totalVotes) * 100) : 0
            const isVoted = votedMovieId === movie.id

            return (
              <div
                key={movie.id}
                className={`flex flex-col rounded-2xl overflow-hidden border bg-black/40 backdrop-blur-sm transition-all ${
                  isVoted ? 'border-emerald-500/50' : 'border-white/10'
                }`}
              >
                {/* Flyer 3:4 */}
                <div className="w-full relative" style={{ paddingBottom: '133%' }}>
                  {movie.flyer_url ? (
                    <img
                      src={movie.flyer_url}
                      alt={movie.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
                      <span className="text-4xl">🎬</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>

                {/* Info */}
                <div className="p-3 space-y-2">
                  <p className={`font-semibold text-sm leading-tight transition-colors ${isVoted ? 'text-emerald-300' : 'text-white'}`}>
                    {movie.title}
                  </p>

                  {movie.synopsis && (
                    <div>
                      <p className={`text-gray-400 text-xs leading-relaxed ${expandedId === movie.id ? '' : 'line-clamp-3'}`}>
                        {movie.synopsis}
                      </p>
                      <button
                        onClick={() => setExpandedId(expandedId === movie.id ? null : movie.id)}
                        className="text-white font-semibold text-xs mt-1 transition-all drop-shadow-[0_0_6px_rgba(255,255,255,0.6)] hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]"
                      >
                        {expandedId === movie.id ? 'Ver menos ↑' : 'Ver más ↓'}
                      </button>
                    </div>
                  )}

                  {/* Barra de votos — visible solo después de votar */}
                  {votedMovieId && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs text-white/40">
                        <span>{pct}%</span>
                        <span>{movie.vote_count}v</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleVote(movie.id)}
                    disabled={!!votedMovieId || voting}
                    className={`w-full py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                      isVoted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 cursor-default'
                        : votedMovieId
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-white/90'
                    }`}
                  >
                    {isVoted ? '✓ Tu voto' : 'Votar'}
                  </button>

                  <button
                    onClick={() => handleShare(movie.title, movie.id)}
                    className="w-full py-2 rounded-xl text-xs font-semibold border border-white/15 text-white/70 hover:border-white/30 hover:text-white transition-all active:scale-95"
                  >
                    {sharedId === movie.id ? '✓ Link copiado' : '↗ Compartir'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {totalVotes > 0 && (
          <p className="text-center text-white/30 text-xs mt-4">
            {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'} en total
          </p>
        )}
      </div>

      {/* Modal email */}
      {pendingMovieId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-6 sm:pb-0">
          <div className="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-white font-bold text-lg">Confirmá tu voto</p>
              <p className="text-gray-400 text-sm mt-1">
                Ingresá tu email para votar. Te avisaremos qué película ganó.
              </p>
            </div>
            <div className="space-y-1">
              <input
                type="email"
                placeholder="tu@email.com"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setEmailError('') }}
                onKeyDown={e => e.key === 'Enter' && confirmVote()}
                autoFocus
                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              {emailError && <p className="text-red-400 text-xs px-1">{emailError}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingMovieId(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmVote}
                disabled={voting}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {voting ? 'Votando…' : 'Confirmar voto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  )
}
