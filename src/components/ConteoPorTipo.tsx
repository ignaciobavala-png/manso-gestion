import type { FilaConteoTipo } from '../lib/conteoPorTipo'

/** Desglose por tipo de entrada: vendidas (cuántas por la web) y reservadas. */
export default function ConteoPorTipo({ filas, className = '' }: { filas: FilaConteoTipo[]; className?: string }) {
  if (filas.length === 0) return null
  return (
    <div className={`bg-neutral-900 border border-white/20 rounded-xl divide-y divide-white/10 ${className}`}>
      {filas.map(f => (
        <div key={f.clave} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
          <span className="text-gray-300 text-xs truncate">{f.nombre}</span>
          <span className="text-xs whitespace-nowrap">
            <span className="text-white font-semibold">{f.vendidas}</span>
            {f.vendidasWeb > 0 && <span className="text-gray-400"> ({f.vendidasWeb} web)</span>}
            {f.reservadas > 0 && <span className="text-gray-400"> · {f.reservadas} reservadas</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
