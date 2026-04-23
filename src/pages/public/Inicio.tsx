import { useNavigate } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'

const PAGES = [
  {
    label: 'Registrarme',
    description: 'Obtené tu entrada para el evento',
    path: '/registro',
    icon: '🎟️',
  },
  {
    label: 'Mi entrada',
    description: 'Consultá tu entrada si ya te registraste',
    path: '/mi-entrada',
    icon: '📲',
  },
  {
    label: 'Carta',
    description: 'Mirá el menú y cómo pagar',
    path: '/carta',
    icon: '🍻',
  },
]

export default function Inicio() {
  const navigate = useNavigate()

  return (
    <PublicLayout showHeader>
      <div className="px-5 pt-2 pb-12 flex flex-col gap-3 max-w-sm mx-auto w-full">
        {PAGES.map((page) => (
          <button
            key={page.path}
            onClick={() => navigate(page.path)}
            className="w-full bg-black/50 hover:bg-black/60 border border-white/20 hover:border-white/40 backdrop-blur-md rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors text-left"
          >
            <span className="text-3xl">{page.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-base">{page.label}</p>
              <p className="text-white/90 text-sm mt-0.5">{page.description}</p>
            </div>
            <span className="text-white/60 text-xl flex-shrink-0">›</span>
          </button>
        ))}

        <button
          onClick={() => navigate('/login')}
          className="mt-4 text-white/60 hover:text-white/80 text-xs text-center transition-colors"
        >
          Acceso staff
        </button>
      </div>
    </PublicLayout>
  )
}
