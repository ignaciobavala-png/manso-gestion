import { useNavigate } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'
import { useCineclubActivo } from '../../hooks/useCineclubActivo'

const PAGES = [
  {
    label: 'Eventos',
    description: 'obtené tu entrada',
    path: '/registro',
    icon: '🎟️',
  },
  {
    label: 'Mi entrada',
    description: 'revisá tus entradas',
    path: '/mi-entrada',
    icon: '📲',
  },
  {
    label: 'Carta',
    description: 'conocé nuestro menú',
    path: '/carta',
    icon: '🍻',
  },
  {
    label: 'Cineclub',
    description: 'votá la próxima película',
    path: '/cineclub',
    icon: '🎬',
  },
]

export default function Inicio() {
  const navigate = useNavigate()
  const { activo: cineclubActivo } = useCineclubActivo()

  // El Cineclub solo aparece si está encendido en Configuración.
  const pages = PAGES.filter(p => p.path !== '/cineclub' || cineclubActivo)

  return (
    <PublicLayout showHeader>
      <div className="px-5 pt-2 pb-12 flex flex-col gap-3 max-w-sm mx-auto w-full">
        {pages.map((page) => (
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

      </div>
    </PublicLayout>
  )
}
