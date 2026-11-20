import type { FilaConteoTipo } from '../lib/conteoPorTipo'

const plata = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

interface Props {
  filas: FilaConteoTipo[]
  className?: string
  /** Con onSeleccionar, cada fila es un botón que filtra por ese tipo. */
  seleccionada?: string | null
  onSeleccionar?: (clave: string) => void
}

/** Desglose por tipo de entrada: precio, vendidas (cuántas por la web) y reservadas. */
export default function ConteoPorTipo({ filas, className = '', seleccionada = null, onSeleccionar }: Props) {
  if (filas.length === 0) return null
  return (
    <div className={`bg-neutral-900 border border-white/20 rounded-xl divide-y divide-white/10 overflow-hidden ${className}`}>
      {filas.map(f => {
        const contenido = (
          <>
            <span className="text-gray-300 text-xs truncate">
              {f.nombre}
              {f.precio !== undefined && (
                <span className="text-gray-400"> · {plata(f.precio)}{f.esPack ? ' c/u' : ''}</span>
              )}
            </span>
            <span className="text-xs whitespace-nowrap">
              <span className="text-white font-semibold">{f.vendidas}</span>
              {f.vendidasWeb > 0 && <span className="text-gray-400"> ({f.vendidasWeb} web)</span>}
              {f.reservadas > 0 && <span className="text-gray-400"> · {f.reservadas} reservadas</span>}
            </span>
          </>
        )
        const base = 'flex items-baseline justify-between gap-3 px-3 py-1.5 w-full text-left'
        return onSeleccionar ? (
          <button
            key={f.clave}
            onClick={() => onSeleccionar(f.clave)}
            aria-pressed={seleccionada === f.clave}
            className={`${base} transition-colors ${seleccionada === f.clave ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            {contenido}
          </button>
        ) : (
          <div key={f.clave} className={base}>{contenido}</div>
        )
      })}
    </div>
  )
}
