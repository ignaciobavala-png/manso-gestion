import { useEffect, useRef } from 'react'
import { Camera, CalendarDays, Beer, Bus, House, Layers, Map as MapIcon, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

export const SECCIONES: { to: string; n: string; nombre: string; Icon: LucideIcon }[] = [
  { to: '/', n: '01', nombre: 'Home', Icon: House },
  { to: '/lineup', n: '02', nombre: 'Line up', Icon: CalendarDays },
  { to: '/escenarios', n: '03', nombre: 'Escenarios', Icon: Layers },
  { to: '/barra', n: '04', nombre: 'Barra', Icon: Beer },
  { to: '/mapa', n: '05', nombre: 'Mapa', Icon: MapIcon },
  { to: '/transporte', n: '06', nombre: 'Transporte', Icon: Bus },
  { to: '/analogica', n: '07', nombre: 'Analógica', Icon: Camera },
]

export default function Shell() {
  const { pathname } = useLocation()
  const lista = useRef<HTMLUListElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    // En pantallas angostas la barra scrollea: que la pestaña activa quede a la vista.
    lista.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-linea bg-fondo/95 px-4 backdrop-blur-sm">
        <NavLink to="/" className="titulo text-2xl" aria-label="BLUR, inicio">
          Blur
        </NavLink>
      </header>

      <main className="mx-auto min-h-svh max-w-3xl px-4 pb-32 pt-20 entra">
        <Outlet />
      </main>

      {/* Barra inferior, como la del panel de Gestión. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-texto/20 bg-fondo/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm"
      >
        <ul ref={lista} className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-auto md:max-w-3xl">
          {SECCIONES.map(({ to, nombre, Icon }) => (
            <li key={to} className="min-w-[3.6rem] flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-acento' : 'text-apagado hover:text-texto'
                  }`
                }
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden />
                <span className="whitespace-nowrap">{nombre}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
