import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

export type Tema = 'verde' | 'gris' | 'naranja'

/**
 * Las 5 pestañas de la barra de abajo. Escenarios vive dentro de Line up y Lanchas
 * dentro de Mapa (selector arriba de cada una): ver `Selector`.
 */
export const PESTANAS: { to: string; nombre: string }[] = [
  { to: '/', nombre: 'Home' },
  { to: '/lineup', nombre: 'Line up' },
  { to: '/barra', nombre: 'Barra' },
  { to: '/mapa', nombre: 'Mapa' },
  { to: '/analogica', nombre: 'Analógica' },
]

/** Bloque de color de cada vista, incluidas las que viven dentro de una pestaña. */
const TEMAS: Record<string, Tema> = {
  '/': 'verde',
  '/lineup': 'verde',
  '/lineup/escenarios': 'gris',
  '/barra': 'naranja',
  '/mapa': 'verde',
  '/mapa/lanchas': 'verde',
  '/analogica': 'verde',
  '/analogica/revelado': 'gris',
}

export const MARCA = `${import.meta.env.BASE_URL}marca/`

/** La barra de arriba y la de abajo son siempre el verde de la marca, como el nav de la web. */
const VERDE = '#003009'

export default function Shell() {
  const { pathname } = useLocation()
  const tema = TEMAS[pathname.replace(/\/$/, '') || '/'] ?? 'verde'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // El fondo detrás del contenido sigue al bloque (rebote de scroll en iOS).
  useEffect(() => {
    document.body.dataset.tema = tema
    return () => {
      delete document.body.dataset.tema
    }
  }, [tema])

  return (
    <>
      <header
        style={{ background: VERDE }}
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[#fffcdc]/15 px-4"
      >
        <Link to="/" aria-label="BLUR, inicio">
          <img src={`${MARCA}logo_1_b.svg`} alt="BLUR" className="h-[18px] w-auto" />
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#fffcdc]/70">Hecho en Argentina</span>
      </header>

      <div className={`tema-${tema} min-h-svh pt-14 pb-[calc(3rem+env(safe-area-inset-bottom,0px))]`}>
        <main key={pathname} className="entra">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Secciones"
        style={{ background: VERDE }}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#fffcdc]/15 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <ul className="mx-auto flex max-w-3xl">
          {PESTANAS.map(({ to, nombre }) => (
            <li key={to} className="min-w-0 flex-1">
              {/* Sin `end` salvo en Home: Line up y Mapa siguen activas en sus vistas internas. */}
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex h-12 items-center justify-center gap-0.5 whitespace-nowrap px-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.01em] min-[380px]:gap-1 min-[380px]:px-1 min-[380px]:text-[11px] min-[380px]:tracking-[0.02em] ${
                    isActive ? 'text-[#f65200]' : 'text-[#fffcdc]/75'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* El chevron ocupa lugar siempre (invisible si no está activa): si no, el texto salta al tocar. */}
                    <span aria-hidden className={`chevron ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                    {nombre}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
