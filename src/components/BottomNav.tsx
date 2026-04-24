import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, signOut } = useAuth()

  const tabs = [
    ...(role === 'control'
      ? [
          { path: '/admin/home', label: 'Control', icon: '📊' },
          { path: '/admin/comunidad', label: 'Comunidad', icon: '👥' },
          { path: '/admin/publico', label: 'Público', icon: '🌐' },
        ]
      : []),
    { path: '/admin/barra', label: 'Barra', icon: '🍺' },
    { path: '/admin/entradas', label: 'Entradas', icon: '🎫' },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-black/95 border-t border-white/10 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="max-w-7xl mx-auto px-1 md:px-4">
        <ul className="flex justify-around">
          {tabs.map((tab) => (
            <li key={tab.path} className="flex-1">
              <button
                onClick={() => navigate(tab.path)}
                className={`
                  w-full flex flex-col items-center
                  min-h-12 md:min-h-14 px-1 md:px-3 py-1 md:py-2
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
          <li className="flex-1">
            <button
              onClick={handleSignOut}
              className="w-full flex flex-col items-center min-h-12 md:min-h-14 px-1 md:px-3 py-1 md:py-2 text-[10px] md:text-sm font-medium text-gray-400 hover:text-red-400 transition-colors"
            >
              <span className="text-lg md:text-2xl mb-0.5 md:mb-1">→</span>
              Salir
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}
