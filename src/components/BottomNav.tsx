import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSecciones } from '../hooks/useSeccionPublica'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, signOut } = useAuth()
  // Las secciones apagadas desde /admin/home → Secciones no se listan acá.
  // La ruta sigue viva: esto saca el tab, no cierra la puerta.
  const { secciones } = useSecciones()

  const tabs = [
    ...(role === 'control' || role === 'owner'
      ? [
          { path: '/admin/home', label: 'Control', icon: '📊' },
          { path: '/admin/publico', label: 'Público', icon: '🌐' },
        ]
      : []),
    ...(secciones.cowork && (role === 'control' || role === 'owner')
      ? [{ path: '/admin/cowork', label: 'Cowork', icon: '💻' }]
      : []),
    ...(role === 'owner'
      ? [
          { path: '/admin/comunidad', label: 'Comunidad', icon: '👥' },
          { path: '/admin/stats', label: 'Stats', icon: '📈' },
        ]
      : []),
    ...(secciones.cineclub && role === 'owner'
      ? [{ path: '/admin/cineclub', label: 'Cineclub', icon: '🎬' }]
      : []),
    ...(secciones.barra ? [{ path: '/admin/barra', label: 'Barra', icon: '🍺' }] : []),
    { path: '/admin/entradas', label: 'Entradas', icon: '🎫' },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-black/95 border-t border-white/10 pb-[env(safe-area-inset-bottom,0px)]">
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
                  ? 'text-emerald-400'
                  : 'text-gray-400 hover:text-gray-300'
                }
              `}
            >
              <span className="text-lg md:text-2xl mb-0.5 md:mb-1">{tab.icon}</span>
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
            <span className="text-lg md:text-2xl mb-0.5 md:mb-1">→</span>
            Salir
          </button>
        </li>
      </ul>
    </nav>
  )
}
