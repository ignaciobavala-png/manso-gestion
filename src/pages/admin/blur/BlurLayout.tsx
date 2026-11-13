import { NavLink, Outlet } from 'react-router-dom'

/**
 * Sección BLUR del panel: todo lo del festival en un solo lugar, aparte del
 * resto de Gestión. Las entradas (venta, tipos, lector de la puerta) siguen
 * en /admin/entradas; acá se mira y se maneja lo demás. Las lanchas, el line
 * up y los textos de la web se cargan en el panel de manso-club.
 * La carta de la Barra (bebidas, precios) sí se carga acá.
 */
const PESTANAS = [
  { to: '/admin/blur/invitados', texto: 'Invitados' },
  { to: '/admin/blur/barra', texto: 'Barra' },
  { to: '/admin/blur/fotos', texto: 'Fotos y revelado' },
]

export default function BlurLayout() {
  return (
    <>
      <div className="px-4 pt-4 max-w-5xl mx-auto w-full">
        <p className="text-terra-400 text-xs uppercase tracking-[0.18em] mb-2">BLUR · festival</p>
        <nav className="flex gap-2 border-b border-white/10 pb-3" aria-label="Secciones de BLUR">
          {PESTANAS.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                  isActive ? 'bg-white text-black border-white' : 'border-white/20 text-white/60 hover:text-white'
                }`
              }
            >
              {p.texto}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </>
  )
}
