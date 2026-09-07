import { LayoutDashboard, Globe, Laptop, Users, TrendingUp, Clapperboard, Beer, Ticket, LogOut, type LucideIcon } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSecciones, enPanel } from '../hooks/useSeccionPublica'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, signOut } = useAuth()
  // Las secciones apagadas desde /admin/home → Secciones no se listan acá.
  // La ruta sigue viva: esto saca el tab, no cierra la puerta.
  const { secciones } = useSecciones()

  const tabs: { path: string; label: string; Icon: LucideIcon }[] = [
    ...(role === 'control' || role === 'owner'
      ? [
          { path: '/admin/home', label: 'Control', Icon: LayoutDashboard },
          { path: '/admin/publico', label: 'Público', Icon: Globe },
        ]
      : []),
    ...(enPanel(secciones.cowork) && (role === 'control' || role === 'owner')
      ? [{ path: '/admin/cowork', label: 'Cowork', Icon: Laptop }]
      : []),
    ...(role === 'owner'
      ? [
          { path: '/admin/comunidad', label: 'Comunidad', Icon: Users },
          { path: '/admin/stats', label: 'Stats', Icon: TrendingUp },
        ]
      : []),
    ...(enPanel(secciones.cineclub) && role === 'owner'
      ? [{ path: '/admin/cineclub', label: 'Cineclub', Icon: Clapperboard }]
      : []),
    ...(enPanel(secciones.barra) ? [{ path: '/admin/barra', label: 'Barra', Icon: Beer }] : []),
    { path: '/admin/entradas', label: 'Entradas', Icon: Ticket },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-black/95 border-t border-white/20 pb-[env(safe-area-inset-bottom,0px)]">
      <ul className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-around md:max-w-7xl md:mx-auto md:px-4">
        {tabs.map((tab) => (
          <li key={tab.path} className="flex-shrink-0 md:flex-1">
            <button
              onClick={() => navigate(tab.path)}
              className={`
                flex flex-col items-center
                min-h-12 md:min-h-14 w-16 md:w-full px-1 md:px-3 py-1 md:py-2
                text-[10px] md:text-sm font-medium transition-colors
                ${location.pathname === tab.path
                  ? 'text-terra-400'
                  : 'text-gray-400 hover:text-gray-300'
                }
              `}
            >
              <tab.Icon className="mb-0.5 md:mb-1" size={20} strokeWidth={1.5} aria-hidden />
              {tab.label}
            </button>
          </li>
        ))}

        {/* Cerrar sesión */}
        <li className="flex-shrink-0 md:flex-1">
          <button
            onClick={handleSignOut}
            className="flex flex-col items-center min-h-12 md:min-h-14 w-16 md:w-full px-1 md:px-3 py-1 md:py-2 text-[10px] md:text-sm font-medium text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="mb-0.5 md:mb-1" size={20} strokeWidth={1.5} aria-hidden />
            Salir
          </button>
        </li>
      </ul>
    </nav>
  )
}
