import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

export const SECCIONES = [
  { to: '/', n: '01', nombre: 'Home' },
  { to: '/lineup', n: '02', nombre: 'Line up' },
  { to: '/escenarios', n: '03', nombre: 'Escenarios' },
  { to: '/barra', n: '04', nombre: 'Barra' },
  { to: '/mapa', n: '05', nombre: 'Mapa' },
  { to: '/transporte', n: '06', nombre: 'Transporte' },
  { to: '/analogica', n: '07', nombre: 'Analógica' },
]

export default function Shell() {
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setAbierto(false)
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [abierto])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-linea bg-fondo/95 px-4 backdrop-blur-sm">
        <NavLink to="/" className="titulo text-2xl" aria-label="BLUR, inicio">
          Blur
        </NavLink>
        <button
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-controls="menu"
          className="font-mono text-xs uppercase tracking-[0.28em] text-texto hover:text-acento"
        >
          {abierto ? 'Cerrar ✕' : 'Menú ＋'}
        </button>
      </header>

      <nav
        id="menu"
        hidden={!abierto}
        className="fixed inset-0 z-30 overflow-y-auto bg-fondo px-4 pb-10 pt-20"
      >
        <ul>
          {SECCIONES.map((s) => (
            <li key={s.to} className="border-b border-linea">
              <NavLink
                to={s.to}
                end={s.to === '/'}
                className={({ isActive }) =>
                  `flex items-baseline gap-4 py-4 titulo text-4xl ${isActive ? 'text-acento' : 'hover:text-acento'}`
                }
              >
                <span className="font-mono text-xs font-normal tracking-[0.2em] text-apagado">{s.n}</span>
                {s.nombre}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="rotulo mt-8">Manso Club · Festival</p>
      </nav>

      <main className="mx-auto min-h-svh max-w-3xl px-4 pb-24 pt-20 entra">
        <Outlet />
      </main>
    </>
  )
}
