import { Camera, Check, Download, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Fotos de Analógica (app de BLUR, carpeta blur/). Llegan solas al bucket
 * privado `blur-analogica`; acá la organización elige cuáles se publican.
 * El bucket no tiene lectura pública: se ven con URLs firmadas que vencen.
 */
const BUCKET = 'blur-analogica'
const VENCE_SEG = 60 * 60

interface Foto {
  id: string
  path: string
  filtro: string | null
  publicada: boolean
  created_at: string
  dispositivo: string
  url?: string
}

type Filtro = 'todas' | 'sin-revisar' | 'publicadas'

export default function FotosBlur() {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('sin-revisar')
  const [ocupada, setOcupada] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('blur_fotos')
      .select('id, path, filtro, publicada, created_at, dispositivo')
      .order('created_at', { ascending: false })
      .limit(500)
    if (e) {
      setError('No se pudieron leer las fotos.')
      setCargando(false)
      return
    }
    const filas = (data ?? []) as Foto[]
    const { data: firmadas } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(filas.map((f) => f.path), VENCE_SEG)
    const porPath = new Map((firmadas ?? []).map((s) => [s.path, s.signedUrl]))
    setFotos(filas.map((f) => ({ ...f, url: porPath.get(f.path) ?? undefined })))
    setError('')
    setCargando(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar()
  }, [cargar])

  const alternar = async (f: Foto) => {
    setOcupada(f.id)
    const { error: e } = await supabase.from('blur_fotos').update({ publicada: !f.publicada }).eq('id', f.id)
    if (e) setError('No se pudo guardar el cambio.')
    else setFotos((fs) => fs.map((x) => (x.id === f.id ? { ...x, publicada: !f.publicada } : x)))
    setOcupada(null)
  }

  const borrar = async (f: Foto) => {
    if (!window.confirm('¿Borrar esta foto para siempre?')) return
    setOcupada(f.id)
    // Primero el archivo: si falla, la fila sigue y se puede reintentar.
    const { error: eArchivo } = await supabase.storage.from(BUCKET).remove([f.path])
    if (eArchivo) {
      setError('No se pudo borrar el archivo.')
      setOcupada(null)
      return
    }
    const { error: eFila } = await supabase.from('blur_fotos').delete().eq('id', f.id)
    if (eFila) setError('Se borró el archivo pero no la fila. Recargá.')
    else setFotos((fs) => fs.filter((x) => x.id !== f.id))
    setOcupada(null)
  }

  const visibles = fotos.filter((f) =>
    filtro === 'todas' ? true : filtro === 'publicadas' ? f.publicada : !f.publicada,
  )
  const publicadas = fotos.filter((f) => f.publicada).length

  return (
    <div className="px-4 pt-4 pb-24 max-w-5xl mx-auto w-full space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-white font-bold text-xl">Fotos de Analógica</h1>
        <p className="text-white/60 text-sm">
          {fotos.length} recibidas · {publicadas} para publicar
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['sin-revisar', 'Sin revisar'],
            ['publicadas', 'Publicadas'],
            ['todas', 'Todas'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
              filtro === id
                ? 'border-terra-400 text-terra-400'
                : 'border-white/20 text-white/60 hover:text-white'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {cargando ? (
        <p className="text-white/60 text-sm">Cargando…</p>
      ) : visibles.length === 0 ? (
        <div className="bg-black/40 border border-white/20 rounded-2xl p-8 text-center">
          <Camera className="mx-auto text-white/30" size={32} strokeWidth={1.25} aria-hidden />
          <p className="text-white/60 text-sm mt-3">
            {fotos.length === 0 ? 'Todavía no llegó ninguna foto.' : 'No hay fotos en esta vista.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibles.map((f) => (
            <li
              key={f.id}
              className={`bg-black/40 border rounded-2xl overflow-hidden ${
                f.publicada ? 'border-olive-500' : 'border-white/20'
              }`}
            >
              <div className="relative aspect-[3/4] bg-gray-800/80">
                {f.url ? (
                  <img src={f.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-white/40 text-xs">
                    Sin archivo
                  </span>
                )}
                {f.filtro && (
                  <span className="absolute left-2 top-2 bg-black/70 text-white/80 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded">
                    {f.filtro}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 p-2">
                <button
                  onClick={() => alternar(f)}
                  disabled={ocupada === f.id}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 ${
                    f.publicada ? 'bg-olive-600 text-white' : 'bg-white text-black hover:bg-white/90'
                  }`}
                >
                  <Check size={16} strokeWidth={2} aria-hidden />
                  {f.publicada ? 'Publicada' : 'Publicar'}
                </button>
                {f.url && (
                  <a
                    href={f.url}
                    download={`blur-${f.id.slice(0, 8)}.jpg`}
                    aria-label="Descargar"
                    className="p-2 rounded-xl text-white/60 hover:text-white"
                  >
                    <Download size={18} strokeWidth={1.5} aria-hidden />
                  </a>
                )}
                <button
                  onClick={() => borrar(f)}
                  disabled={ocupada === f.id}
                  aria-label="Borrar"
                  className="p-2 rounded-xl text-white/60 hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 size={18} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
