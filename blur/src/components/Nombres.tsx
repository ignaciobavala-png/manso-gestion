import type { Artista } from '../lib/festival'

const cuando = (a: Artista) => [a.dia, a.horario].filter(Boolean).join(' · ')

/**
 * Los nombres del line up como en la web: uno abajo del otro, enormes, con el país
 * en mono chiquito arriba a la derecha. El nombre va tal cual lo cargó la organización
 * (sin mayúsculas forzadas); si hay día/horario, va en mono al costado.
 */
export function Nombres({ artistas }: { artistas: Artista[] }) {
  return (
    <ul>
      {artistas.map((a, i) => (
        <li key={a.id} className="flex items-baseline justify-between gap-3">
          <p className="nombre min-w-0">
            {a.b2b && i > 0 && <span className="mr-2 font-mono text-xs font-normal tracking-normal text-apagado">B2B</span>}
            {a.nombre}
            {a.pais && (
              <sup className="ml-1 align-super font-mono text-[10px] font-normal tracking-[0.1em] text-apagado">{a.pais}</sup>
            )}
          </p>
          {cuando(a) && <span className="shrink-0 font-mono text-xs text-apagado">{cuando(a)}</span>}
        </li>
      ))}
    </ul>
  )
}
