import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import EventCreator from './EventCreator'

export default function GestionEventos() {
  const { events, activeEvent, selectOperatingEvent, updateEventFlyer } = useAppStore()
  const [regCounts, setRegCounts] = useState<Record<string, number>>({})
  const [showCreator, setShowCreator] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

  const handleFlyerUpload = async (eventId: string, file: File) => {
    if (uploadingFor) return
    setUploadingFor(eventId)
    setUploadError(null)
    try {
      const ext = file.name.split('.').pop()
      const path = `${eventId}.${ext}`

      const { error: storageError } = await supabase.storage
        .from('event-flyers')
        .upload(path, file, { upsert: true })

      if (storageError) throw storageError

      const { data: urlData } = supabase.storage
        .from('event-flyers')
        .getPublicUrl(path)

      await updateEventFlyer(eventId, urlData.publicUrl)
    } catch (err) {
      console.error('Error subiendo flyer:', err)
      setUploadError('Error al subir el flyer. Intentá de nuevo.')
    } finally {
      setUploadingFor(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })

  return (
    <div className="border-t-2 border-zinc-800">
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
        <div className="px-6 sm:px-8 pb-6 border-b-2 border-zinc-800">
          <EventCreator onCreated={() => setShowCreator(false)} />
        </div>
      )}

      {uploadError && (
        <p className="mx-6 sm:mx-8 -mb-2 text-red-400 text-sm">{uploadError}</p>
      )}

      {/* Eventos abiertos */}
      <div className="px-6 sm:px-8 py-4 space-y-4">
        {openEvents.length === 0 && !showCreator && (
          <p className="text-gray-500 text-sm text-center py-4">
            No hay eventos abiertos. Creá uno para empezar.
          </p>
        )}

        {openEvents.map(e => {
          const isCurrent = activeEvent?.id === e.id
          const regs = regCounts[e.id] ?? 0
          const isUploading = uploadingFor === e.id

          return (
            <div
              key={e.id}
              className={`rounded-2xl border overflow-hidden transition-colors ${
                isCurrent
                  ? 'bg-emerald-900/30 border-emerald-700'
                  : 'bg-neutral-900 border border-white/10'
              }`}
            >
              <div className="flex gap-4 p-4">
                {/* Flyer thumbnail */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <div
                    className="w-20 rounded-xl overflow-hidden bg-neutral-900/80 border border-white/20 cursor-pointer relative"
                    style={{ aspectRatio: '4/5' }}
                    onClick={() => fileInputRefs.current[e.id]?.click()}
                  >
                    {e.flyer_url ? (
                      <img
                        src={e.flyer_url}
                        alt="Flyer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl">
                        🖼
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRefs.current[e.id]?.click()}
                    disabled={isUploading}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors disabled:opacity-50"
                  >
                    {isUploading ? 'Subiendo...' : e.flyer_url ? 'Cambiar foto' : 'Subir foto'}
                  </button>
                  <input
                    ref={el => { fileInputRefs.current[e.id] = el }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={ev => {
                      const file = ev.target.files?.[0]
                      if (file) handleFlyerUpload(e.id, file)
                      ev.target.value = ''
                    }}
                  />
                </div>

                {/* Info + botones */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm truncate">{e.name}</p>
                      {isCurrent && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-100 uppercase tracking-wide whitespace-nowrap">
                          En operación
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                      {e.start_date ? formatDateTime(e.start_date) : `Creado ${formatDate(e.created_at)}`}
                    </p>
                    <p className="text-gray-500 text-sm mt-0.5">
                      {regs} {regs === 1 ? 'registro' : 'registros'}
                      {e.max_capacity !== null && ` / ${e.max_capacity}`}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {!isCurrent && (
                      <button
                        onClick={() => selectOperatingEvent(e.id)}
                        className="text-sm px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors whitespace-nowrap"
                      >
                        Operar
                      </button>
                    )}
                    {isCurrent && (
                      <button
                        onClick={scrollToArqueo}
                        className="text-sm px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-300 font-medium rounded-xl transition-colors whitespace-nowrap"
                      >
                        Arqueo ↓
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/registro?event=${e.id}`)
                        setCopiedId(e.id)
                        setTimeout(() => setCopiedId(null), 2000)
                      }}
                      className="text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 font-medium rounded-xl transition-colors whitespace-nowrap"
                    >
                      {copiedId === e.id ? '✓ Link copiado' : 'Copiar link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Historial de eventos cerrados */}
      {closedEvents.length > 0 && (
        <div className="border-t-2 border-zinc-800 bg-neutral-950/50">
          <button
            onClick={() => setShowHistorial(v => !v)}
            className="w-full px-6 sm:px-8 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <span className="text-sm text-gray-500 uppercase tracking-wider">
              Historial ({closedEvents.length})
            </span>
            <span className="text-gray-600 text-sm">{showHistorial ? '▲' : '▼'}</span>
          </button>

          {showHistorial && (
            <div className="px-6 sm:px-8 pb-4 space-y-2">
              {closedEvents.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                  <p className="text-gray-400 text-sm truncate">{e.name}</p>
                  <p className="text-gray-600 text-sm flex-shrink-0 ml-3">
                    {e.closed_at ? `Cerrado ${formatDate(e.closed_at)}` : 'Sin cerrar'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
