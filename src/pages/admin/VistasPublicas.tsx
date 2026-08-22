import { useNavigate } from 'react-router-dom'
import Background from '../../components/Background'
import { useSecciones, enPanel } from '../../hooks/useSeccionPublica'

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
    icon: '🍻',
  },
  {
    label: 'Cineclub',
    description: 'Votación pública de películas',
    path: '/cineclub',
    icon: '🎬',
  },
  {
    label: 'Cowork Day',
    description: 'Landing del pase por día, con las fechas abiertas',
    path: '/cowork',
    icon: '💻',
  },
]

export default function VistasPublicas() {
  const navigate = useNavigate()
  const { secciones } = useSecciones()

  // Se listan las que no estén ocultas. En "Solo panel" la página se abre
  // igual —hay sesión de staff— y por eso vale mostrarla acá: es justamente
  // la pantalla desde donde se la va a ir a mirar mientras se arma.
  const visibilidadDe = (path: string) =>
    path === '/cineclub' ? secciones.cineclub
    : path === '/cowork' ? secciones.cowork
    : null

  const pages = PAGES.filter(p => {
    const v = visibilidadDe(p.path)
    return v === null || enPanel(v)
  })

  const open = (path: string) => {
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  return (
    <Background>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 w-full">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/admin/home')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Vistas públicas</h2>
            <p className="text-gray-500 text-sm">Lo que ve el público — se abre en nueva pestaña</p>
          </div>
        </div>

        <div className="space-y-3">
          {pages.map((page) => (
            <button
              key={page.path}
              onClick={() => open(page.path)}
              className="w-full bg-black/50 hover:bg-white/10 border border-white/10 hover:border-emerald-600 rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors text-left"
            >
              <span className="text-3xl">{page.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-semibold text-sm">{page.label}</p>
                  {visibilidadDe(page.path) === 'interno' && (
                    <span className="text-[10px] uppercase tracking-widest text-amber-400/90 border border-amber-700/50 bg-amber-950/40 rounded-full px-2 py-0.5">
                      solo vos
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{page.description}</p>
                <p className="text-emerald-600 text-sm mt-1 font-mono">{page.path}</p>
              </div>
              <span className="text-gray-500 text-lg flex-shrink-0">↗</span>
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <p className="text-gray-500 text-sm uppercase tracking-widest">Para el local</p>
          <button
            onClick={() => navigate('/admin/cartel')}
            className="w-full bg-black/50 hover:bg-white/10 border border-white/10 hover:border-emerald-600 rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors text-left"
          >
            <span className="text-3xl">🖨️</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Cartel para imprimir</p>
              <p className="text-gray-400 text-sm mt-0.5">
                QR de la app para pegar en las mesas, la barra y la puerta
              </p>
              <p className="text-emerald-600 text-sm mt-1 font-mono">/admin/cartel</p>
            </div>
            <span className="text-gray-500 text-lg flex-shrink-0">›</span>
          </button>
        </div>
      </div>
    </Background>
  )
}
