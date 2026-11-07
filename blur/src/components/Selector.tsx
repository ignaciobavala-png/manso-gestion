import { NavLink } from 'react-router-dom'

export const VISTAS_LINEUP = [
  { to: '/lineup', label: 'Artistas' },
  { to: '/lineup/escenarios', label: 'Escenarios' },
]

export const VISTAS_MAPA = [
  { to: '/mapa', label: 'Predio' },
  { to: '/mapa/lanchas', label: 'Lanchas' },
]

/**
 * Selector de vista arriba de una pestaña que agrupa dos pantallas. Son rutas
 * (no estado): se puede compartir el link y el botón "atrás" no se rompe;
 * `replace` evita que cambiar de vista llene el historial.
 */
export function Selector({ items }: { items: { to: string; label: string }[] }) {
  return (
    <nav aria-label="Vista" className="mb-8 flex gap-2">
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end
          replace
          className={({ isActive }) =>
            `btn-borde ${isActive ? 'bg-texto !text-fondo' : ''}`
          }
        >
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}
