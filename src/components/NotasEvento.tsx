import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Estado = 'cargando' | 'guardado' | 'guardando' | 'error'

// Bloc de notas privado del evento (tabla event_notes, solo staff). Se guarda
// solo, un instante después de dejar de escribir.
export default function NotasEvento({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<Estado>('cargando')
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Evita pisar la base con el texto vacío inicial antes de que termine de cargar.
  const cargado = useRef(false)

  useEffect(() => {
    let vivo = true
    cargado.current = false
    setEstado('cargando')
    supabase
      .from('event_notes')
      .select('body')
      .eq('event_id', eventId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) { setEstado('error'); return }
        setTexto(data?.body ?? '')
        cargado.current = true
        setEstado('guardado')
      })
    return () => { vivo = false; if (timer.current) clearTimeout(timer.current) }
  }, [eventId])

  const guardar = async (body: string) => {
    setEstado('guardando')
    const { error } = await supabase
      .from('event_notes')
      .upsert({ event_id: eventId, body }, { onConflict: 'event_id' })
    setEstado(error ? 'error' : 'guardado')
  }

  const onChange = (v: string) => {
    setTexto(v)
    if (!cargado.current) return
    if (timer.current) clearTimeout(timer.current)
    setEstado('guardando')
    timer.current = setTimeout(() => guardar(v), 800)
  }

  const copiar = async () => {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const exportar = () => {
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notas-${eventName.trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'evento'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const etiqueta =
    estado === 'cargando' ? 'Cargando…'
    : estado === 'guardando' ? 'Guardando…'
    : estado === 'error' ? 'No se pudo guardar'
    : 'Guardado'

  return (
    <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="text-xs uppercase tracking-wider text-gray-400">
          Info · notas <span className="normal-case tracking-normal">(privado, solo el equipo de gestión)</span>
        </p>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${estado === 'error' ? 'text-red-400' : 'text-gray-500'}`}>{etiqueta}</span>
          <button
            onClick={copiar}
            disabled={!texto}
            className="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {copiado ? <><Check size={12} aria-hidden /> Copiado</> : <><Copy size={12} aria-hidden /> Copiar</>}
          </button>
          <button
            onClick={exportar}
            disabled={!texto}
            className="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download size={12} aria-hidden /> Exportar
          </button>
        </div>
      </div>
      <textarea
        value={texto}
        onChange={ev => onChange(ev.target.value)}
        disabled={estado === 'cargando'}
        rows={6}
        placeholder="Consumiciones que damos, horarios, proveedores, cosas a tener en cuenta…"
        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-white/30 resize-y"
      />
    </div>
  )
}
