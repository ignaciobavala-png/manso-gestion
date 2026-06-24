import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/compressImage'

interface Poll {
  id: string
  status: 'voting' | 'closed'
  closes_at: string | null
  created_at: string
}

interface Movie {
  id: string
  title: string
  synopsis: string
  flyer_url: string | null
  sort_order: number
  vote_count: number
}

interface EditState {
  title: string
  synopsis: string
  saving: boolean
}

export default function CineclubAdmin() {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [totalVotes, setTotalVotes] = useState(0)

  // Formulario nueva película
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formSynopsis, setFormSynopsis] = useState('')
  const [formFlyerFile, setFormFlyerFile] = useState<File | null>(null)
  const [formFlyerPreview, setFormFlyerPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [closingPoll, setClosingPoll] = useState(false)
  const [closesAt, setClosesAt] = useState('')
  const [savingDeadline, setSavingDeadline] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Edición inline por película
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ title: '', synopsis: '', saving: false })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: polls } = await supabase
      .from('cineclub_polls')
      .select('id, status, closes_at, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!polls?.length) {
      setLoading(false)
      return
    }

    const currentPoll = polls[0] as Poll
    setPoll(currentPoll)
    if (currentPoll.closes_at) {
      // Convertir ISO a formato local para el input datetime-local
      const d = new Date(currentPoll.closes_at)
      const pad = (n: number) => String(n).padStart(2, '0')
      setClosesAt(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
    }

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
      (moviesRes.data ?? []).map(m => ({
        ...m,
        vote_count: votesByMovie[m.id] ?? 0,
      }))
    )
    setTotalVotes(votesRes.data?.length ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Realtime votos
  useEffect(() => {
    if (!poll) return
    const channel = supabase
      .channel('cineclub-admin-votes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cineclub_votes', filter: `poll_id=eq.${poll.id}` },
        (payload) => {
          const movieId = payload.new.movie_id as string
          setMovies(prev => prev.map(m => m.id === movieId ? { ...m, vote_count: m.vote_count + 1 } : m))
          setTotalVotes(prev => prev + 1)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [poll])

  const handleCreatePoll = async () => {
    const { data, error } = await supabase
      .from('cineclub_polls')
      .insert({ status: 'voting' })
      .select()
      .single()
    if (!error && data) {
      setPoll(data as Poll)
      setMovies([])
      setTotalVotes(0)
    }
  }

  const handleFlyerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setFormFlyerFile(compressed)
    setFormFlyerPreview(URL.createObjectURL(compressed))
  }

  const handleAddMovie = async () => {
    if (!poll || !formTitle.trim()) return
    setSaving(true)
    try {
      let flyerUrl: string | null = null
      if (formFlyerFile) {
        const ext = formFlyerFile.name.split('.').pop()
        const path = `${poll.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('cineclub-flyers')
          .upload(path, formFlyerFile)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('cineclub-flyers').getPublicUrl(path)
        flyerUrl = urlData.publicUrl
      }

      const nextOrder = movies.length > 0 ? Math.max(...movies.map(m => m.sort_order)) + 1 : 0
      const { data, error } = await supabase
        .from('cineclub_movies')
        .insert({ poll_id: poll.id, title: formTitle.trim(), synopsis: formSynopsis.trim(), flyer_url: flyerUrl, sort_order: nextOrder })
        .select()
        .single()
      if (error) throw error

      setMovies(prev => [...prev, { ...(data as Movie), vote_count: 0 }])
      setFormTitle('')
      setFormSynopsis('')
      setFormFlyerFile(null)
      setFormFlyerPreview(null)
      setShowForm(false)
    } catch (err) {
      console.error('Error al agregar película:', err)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (movie: Movie) => {
    setEditingId(movie.id)
    setEditState({ title: movie.title, synopsis: movie.synopsis, saving: false })
  }

  const handleSaveEdit = async (movieId: string) => {
    if (!editState.title.trim()) return
    setEditState(prev => ({ ...prev, saving: true }))
    const { error } = await supabase
      .from('cineclub_movies')
      .update({ title: editState.title.trim(), synopsis: editState.synopsis.trim() })
      .eq('id', movieId)
    if (!error) {
      setMovies(prev => prev.map(m => m.id === movieId
        ? { ...m, title: editState.title.trim(), synopsis: editState.synopsis.trim() }
        : m
      ))
      setEditingId(null)
    }
    setEditState(prev => ({ ...prev, saving: false }))
  }

  const handleDeleteMovie = async (movieId: string) => {
    const movie = movies.find(m => m.id === movieId)
    if (!movie) return
    if (movie.flyer_url) {
      const path = movie.flyer_url.split('/cineclub-flyers/')[1]
      if (path) await supabase.storage.from('cineclub-flyers').remove([path])
    }
    await supabase.from('cineclub_movies').delete().eq('id', movieId)
    setMovies(prev => prev.filter(m => m.id !== movieId))
  }

  const handleClosePoll = async () => {
    if (!poll) return
    setClosingPoll(true)
    const { error } = await supabase.from('cineclub_polls').update({ status: 'closed' }).eq('id', poll.id)
    if (!error) setPoll(prev => prev ? { ...prev, status: 'closed' } : prev)
    setClosingPoll(false)
  }

  const handleReopenPoll = async () => {
    if (!poll) return
    const { error } = await supabase.from('cineclub_polls').update({ status: 'voting' }).eq('id', poll.id)
    if (!error) setPoll(prev => prev ? { ...prev, status: 'voting' } : prev)
  }

  const handleSaveDeadline = async () => {
    if (!poll) return
    setSavingDeadline(true)
    const closes_at = closesAt ? new Date(closesAt).toISOString() : null
    const { error } = await supabase.from('cineclub_polls').update({ closes_at }).eq('id', poll.id)
    if (!error) setPoll(prev => prev ? { ...prev, closes_at } : prev)
    setSavingDeadline(false)
  }

  const handleClearDeadline = async () => {
    if (!poll) return
    const { error } = await supabase.from('cineclub_polls').update({ closes_at: null }).eq('id', poll.id)
    if (!error) { setPoll(prev => prev ? { ...prev, closes_at: null } : prev); setClosesAt('') }
  }

  const formatDeadline = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-white/60 pb-20">Cargando...</div>
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto w-full space-y-4">
      <h1 className="text-white font-bold text-xl">Cineclub</h1>

      {!poll && (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 text-center space-y-3">
          <p className="text-white/60 text-sm">No hay ninguna votación creada.</p>
          <button onClick={handleCreatePoll} className="bg-white text-black font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-white/90 transition-colors">
            Crear nueva votación
          </button>
        </div>
      )}

      {poll && (
        <>
          {/* Estado */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-semibold">
                  {poll.status === 'voting' ? 'Votación abierta' : 'Votación cerrada'}
                </p>
                <p className="text-white/40 text-xs mt-0.5">{totalVotes} votos emitidos</p>
              </div>
              <div className="flex gap-2">
                {poll.status === 'voting' ? (
                  <button
                    onClick={handleClosePoll}
                    disabled={closingPoll}
                    className="bg-red-500/20 text-red-400 border border-red-400/40 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-red-500/30 transition-colors"
                  >
                    Cerrar
                  </button>
                ) : (
                  <>
                    <button onClick={handleReopenPoll} className="bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-emerald-500/30 transition-colors">
                      Reabrir
                    </button>
                    <button onClick={handleCreatePoll} className="bg-white/10 text-white/70 border border-white/20 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-white/20 transition-colors">
                      Nueva
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Fecha límite opcional */}
            {poll.status === 'voting' && (
              <div className="border-t border-white/10 pt-3 space-y-2">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide">
                  Cierre automático <span className="normal-case font-normal">(opcional)</span>
                </p>
                {poll.closes_at ? (
                  <div className="flex items-center justify-between">
                    <p className="text-white/70 text-xs capitalize">{formatDeadline(poll.closes_at)}</p>
                    <button onClick={handleClearDeadline} className="text-white/30 hover:text-red-400 text-xs transition-colors">
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      type="datetime-local"
                      value={closesAt}
                      onChange={e => setClosesAt(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/30 [color-scheme:dark]"
                    />
                    <button
                      onClick={handleSaveDeadline}
                      disabled={!closesAt || savingDeadline}
                      className="bg-white/10 text-white/70 border border-white/20 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-white/20 disabled:opacity-40 transition-colors"
                    >
                      {savingDeadline ? '...' : 'Guardar'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grid 2 columnas — correlativo con la vista pública */}
          {movies.length > 0 && (
            <div className="space-y-3">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">Películas</p>
              <div className="grid grid-cols-2 gap-3">
                {[...movies].sort((a, b) => b.vote_count - a.vote_count).map(movie => {
                  const pct = totalVotes > 0 ? Math.round((movie.vote_count / totalVotes) * 100) : 0
                  const isEditing = editingId === movie.id

                  return (
                    <div key={movie.id} className="flex flex-col bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
                      {/* Flyer 3:4 */}
                      <div className="w-full relative" style={{ paddingBottom: '133%' }}>
                        {movie.flyer_url ? (
                          <img src={movie.flyer_url} alt={movie.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
                            <span className="text-3xl">🎬</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        {/* Botones de acción sobre el flyer */}
                        {!isEditing && (
                          <div className="absolute top-2 right-2 flex gap-1.5">
                            <button
                              onClick={() => startEdit(movie)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/60 text-white/60 hover:text-white text-xs transition-colors"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDeleteMovie(movie.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/60 text-white/60 hover:text-red-400 text-xs transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 space-y-2">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <input
                              value={editState.title}
                              onChange={e => setEditState(prev => ({ ...prev, title: e.target.value }))}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/40"
                            />
                            <textarea
                              value={editState.synopsis}
                              onChange={e => setEditState(prev => ({ ...prev, synopsis: e.target.value }))}
                              rows={3}
                              className="w-full bg-white/5 border border-white/20 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/40 resize-none"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setEditingId(null)}
                                className="flex-1 py-1.5 rounded-lg text-xs text-white/50 border border-white/10 hover:bg-white/5 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleSaveEdit(movie.id)}
                                disabled={!editState.title.trim() || editState.saving}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-40 transition-colors"
                              >
                                {editState.saving ? '...' : 'Guardar'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-white font-semibold text-xs leading-tight">{movie.title}</p>
                            {movie.synopsis && (
                              <div>
                                <p className={`text-white/50 text-xs leading-relaxed ${expandedId === movie.id ? '' : 'line-clamp-3'}`}>
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
                            <div className="space-y-1">
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
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Formulario agregar película */}
          {poll.status === 'voting' && (
            <div>
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full bg-black/40 border border-dashed border-white/20 hover:border-white/40 rounded-2xl py-4 text-white/50 hover:text-white/70 text-sm transition-colors"
                >
                  + Agregar película
                </button>
              ) : (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                  <p className="text-white font-semibold text-sm">Nueva película</p>

                  {/* Flyer 3:4 */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="aspect-[3/4] w-full border border-dashed border-white/20 rounded-xl flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors overflow-hidden"
                  >
                    {formFlyerPreview ? (
                      <img src={formFlyerPreview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center space-y-1">
                        <p className="text-white/40 text-sm">Subir flyer</p>
                        <p className="text-white/25 text-xs">Formato póster 3:4</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFlyerChange} />

                  <input
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Título de la película"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
                  />
                  <textarea
                    value={formSynopsis}
                    onChange={e => setFormSynopsis(e.target.value)}
                    placeholder="Sinopsis (opcional)"
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowForm(false); setFormTitle(''); setFormSynopsis(''); setFormFlyerFile(null); setFormFlyerPreview(null) }}
                      className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddMovie}
                      disabled={!formTitle.trim() || saving}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Guardando...' : 'Agregar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
