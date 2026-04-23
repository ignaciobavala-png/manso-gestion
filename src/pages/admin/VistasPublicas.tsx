import { useNavigate } from 'react-router-dom'
import Background from '../../components/Background'

const PAGES = [
  {
    label: 'Registro de entrada',
    description: 'El asistente genera su entrada con nombre y email',
    path: '/registro',
    icon: '🎟️',
  },
  {
    label: 'Mi Entrada',
    description: 'El asistente consulta su entrada por UUID o código',
    path: '/mi-entrada',
    icon: '📲',
  },
  {
    label: 'Carta',
    description: 'Menú público con info de transferencia',
    path: '/carta',
    icon: '📄',
  },
]

export default function VistasPublicas() {
  const navigate = useNavigate()

  const open = (path: string) => {
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  return (
    <Background>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/admin/home')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Vistas públicas</h2>
            <p className="text-gray-500 text-xs">Lo que ve el público — se abre en nueva pestaña</p>
          </div>
        </div>

        <div className="space-y-3">
          {PAGES.map((page) => (
            <button
              key={page.path}
              onClick={() => open(page.path)}
              className="w-full bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-emerald-600 rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors text-left"
            >
              <span className="text-3xl">{page.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{page.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{page.description}</p>
                <p className="text-emerald-600 text-xs mt-1 font-mono">{page.path}</p>
              </div>
              <span className="text-gray-500 text-lg flex-shrink-0">↗</span>
            </button>
          ))}
        </div>
      </div>
    </Background>
  )
}
