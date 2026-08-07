import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import { compressImage } from '../lib/compressImage'
import EventCreator from './EventCreator'
import EventEditor from './EventEditor'

export default function GestionEventos() {
  const { events, activeEvent, selectOperatingEvent, updateEventFlyer, updateEventBackground } = useAppStore()
  const [regCounts, setRegCounts] = useState<Record<string, number>>({})
  const [showCreator, setShowCreator] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [uploadingBgFor, setUploadingBgFor] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const bgFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const scrollToArqueo = () => {
    document.getElementById('arqueo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openEvents = events.filter(e => !e.closed_at)
  const closedEvents = events.filter(e => !!e.closed_at)

  // Los conteos salen de event_ticket_counts (migración 020) y no de un
  // count(*) sobre la tabla: contando filas crudas, una entrada rechazada con
  // "Rechazar QR" y un pago de Mercado Pago abandonado seguían sumando acá.
  const loadCounts = useCallback(async () => {
    if (events.length === 0) return
    const ids = events.map(e => e.id)

    const { data } = await supabase
      .from('event_ticket_counts')
      .select('event_id, vendidas')
      .in('event_id', ids)

    const counts: Record<string, number> = {}
    ids.forEach(id => { counts[id] = 0 })
    ;(data ?? []).forEach(row => { counts[row.event_id] = row.vendidas })
    setRegCounts(counts)
  }, [events])

  useEffect(() => { loadCounts() }, [loadCounts])

  useEffect(() => {
    if (events.length === 0) return
    const ids = new Set(events.map(e => e.id))

    // Se recarga en vez de sumar 1: un INSERT de Mercado Pago todavía no es una
    // venta, y lo que convierte una fila en vendida (o la saca) es un UPDATE
    // —acreditación del pago, "Rechazar QR"—. Incrementar a mano volvía a meter
    // la regla de negocio en el componente, que es de donde había que sacarla.
    const channel = supabase
      .channel('gestion-ticket-registrations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ticket_registrations' },
        (payload: { new?: { event_id?: string }; old?: { event_id?: string } }) => {
          const eventId = payload.new?.event_id ?? payload.old?.event_id
          if (!eventId || !ids.has(eventId)) return
          loadCounts()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [events, loadCounts])

  const handleFlyerUpload = async (eventId: string, file: File) => {
    if (uploadingFor) return
    setUploadingFor(eventId)
    setUploadError(null)
    try {
      const compressed = await compressImage(file)
      const path = `${eventId}.jpg`

      const { error: storageError } = await supabase.storage
        .from('event-flyers')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })

      if (storageError) throw storageError

      const { data: urlData } = supabase.storage
        .from('event-flyers')
        .getPublicUrl(path)

      await updateEventFlyer(eventId, `${urlData.publicUrl}?t=${Date.now()}`)
    } catch (err) {
      console.error('Error subiendo flyer:', err)
      setUploadError('Error al subir el flyer. Intentá de nuevo.')
    } finally {
      setUploadingFor(null)
    }
  }

  const handleBackgroundUpload = async (eventId: string, file: File) => {
    if (uploadingBgFor) return
    setUploadingBgFor(eventId)
    setUploadError(null)
    try {
      const compressed = await compressImage(file)
      const path = `bg_${eventId}.jpg`

      const { error: storageError } = await supabase.storage
        .from('event-flyers')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })

      if (storageError) throw storageError

      const { data: urlData } = supabase.storage
        .from('event-flyers')
        .getPublicUrl(path)

      await updateEventBackground(eventId, `${urlData.publicUrl}?t=${Date.now()}`)
    } catch (err) {
      console.error('Error subiendo fondo:', err)
      setUploadError('Error al subir el fondo. Intentá de nuevo.')
    } finally {
      setUploadingBgFor(null)
    }
  }

  const getEventUrl = (e: { slug?: string | null; id: string; is_private: boolean; private_token: string }) => {
    const base = e.slug
      ? `${window.location.origin}/registro/${e.slug}`
      : `${window.location.origin}/registro?event=${e.id}`
    return e.is_private
      ? `${base}${e.slug ? '?' : '&'}token=${e.private_token}`
      : base
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
          const isUploadingBg = uploadingBgFor === e.id

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
                      <button
                        onClick={() => setEditingId(editingId === e.id ? null : e.id)}
                        className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                        title="Editar evento"
                      >
                        ✏️
                      </button>
                      {isCurrent && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-100 uppercase tracking-wide whitespace-nowrap">
                          En operación
                        </span>
                      )}
                      {e.is_private && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 uppercase tracking-wide whitespace-nowrap">
                          Privado
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

                  <div className="flex gap-2 flex-wrap">
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
                        navigator.clipboard.writeText(getEventUrl(e))
                        setCopiedId(e.id)
                        setTimeout(() => setCopiedId(null), 2000)
                      }}
                      className="text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 font-medium rounded-xl transition-colors whitespace-nowrap"
                    >
                      {copiedId === e.id ? '✓ Copiado' : e.is_private ? 'Link privado' : 'Copiar link'}
                    </button>
                    <button
                      onClick={() => bgFileInputRefs.current[e.id]?.click()}
                      disabled={isUploadingBg}
                      className="text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 font-medium rounded-xl transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {isUploadingBg ? 'Subiendo...' : e.background_url ? 'Cambiar fondo' : 'Subir fondo'}
                    </button>
                    <input
                      ref={el => { bgFileInputRefs.current[e.id] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={ev => {
                        const file = ev.target.files?.[0]
                        if (file) handleBackgroundUpload(e.id, file)
                        ev.target.value = ''
                      }}
                    />
                  </div>
                </div>
              </div>
              {editingId === e.id && (
                <div className="px-4 pb-4">
                  <EventEditor
                    event={e}
                    onDone={() => setEditingId(null)}
                  />
                </div>
              )}
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
