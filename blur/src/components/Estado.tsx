import { useFestival, type Festival } from '../lib/festival'

/** Resuelve cargando / error una sola vez para las pantallas que leen el festival. */
export function ConFestival({ children }: { children: (f: Festival) => React.ReactNode }) {
  const e = useFestival()
  if (e.cargando) return <p className="pulso py-10 font-mono text-xs uppercase tracking-[0.25em] text-apagado">Cargando…</p>
  if (!('data' in e)) return <p className="py-10 text-sm text-acento">No pudimos leer el festival ({e.error}).</p>
  return <>{children(e.data)}</>
}
