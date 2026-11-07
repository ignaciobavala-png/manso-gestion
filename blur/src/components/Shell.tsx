import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

export type Tema = 'verde' | 'gris' | 'naranja'

export const SECCIONES: { to: string; nombre: string; desc: string; tema: Tema }[] = [
  { to: '/', nombre: 'Home', desc: 'El festival', tema: 'verde' },
  { to: '/lineup', nombre: 'Line up', desc: 'Quién toca y dónde', tema: 'verde' },
  { to: '/escenarios', nombre: 'Escenarios', desc: 'Los spots y sus artistas', tema: 'gris' },
  { to: '/barra', nombre: 'Barra', desc: 'Pedí y retirá con QR', tema: 'naranja' },
  { to: '/mapa', nombre: 'Mapa', desc: 'Dónde está todo', tema: 'gris' },
  { to: '/lanchas', nombre: 'Lanchas', desc: 'Salidas y regreso', tema: 'verde' },
  { to: '/analogica', nombre: 'Analógica', desc: 'Tu rollo de 10 fotos', tema: 'verde' },
]

export const MARCA = `${import.meta.env.BASE_URL}marca/`

/** La barra de arriba y la de abajo son siempre el verde de la marca, como el nav de la web. */
const VERDE = '#003009'

export default function Shell() {
  const { pathname } = useLocation()
  const lista = useRef<HTMLUListElement>(null)
  const tema = SECCIONES.find((s) => s.to === pathname)?.tema ?? 'verde'

  useEffect(() => {
    window.scrollTo(0, 0)
    // En pantallas angostas la barra scrollea: que la pestaña activa quede a la vista.
    lista.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
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
        <ul ref={lista} className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center">
          {SECCIONES.map(({ to, nombre }) => (
            <li key={to} className="shrink-0">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex h-12 items-center px-3.5 font-mono text-[12px] font-bold uppercase tracking-[0.04em] whitespace-nowrap ${
                    isActive ? 'chevron gap-1.5 text-[#f65200]' : 'text-[#fffcdc]/75'
                  }`
                }
              >
                {nombre}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
