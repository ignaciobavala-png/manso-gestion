import { useNavigate } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'
import { useCineclubActivo, useCoworkActivo } from '../../hooks/useSeccionPublica'

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
  const { activo: coworkActivo } = useCoworkActivo()

  // El Cineclub solo aparece si está encendido en Configuración.
  const pages = PAGES.filter(p => p.path !== '/cineclub' || cineclubActivo)

  return (
    <PublicLayout showHeader>
      <div className="px-5 pt-2 pb-12 flex flex-col gap-3 max-w-sm mx-auto w-full">
        {/* El Cowork Day va destacado y arriba de todo: es lo que hoy hay que
            empujar, y adentro de la lista de siempre pasaba desapercibido. */}
        {coworkActivo && (
          <button
            onClick={() => navigate('/cowork')}
            className="w-full bg-emerald-600/90 hover:bg-emerald-500/90 border border-emerald-400/40 backdrop-blur-md rounded-2xl px-5 py-5 flex items-center gap-4 transition-colors text-left"
          >
            <span className="text-3xl">💻</span>
            <div className="flex-1 min-w-0">
              <p className="text-emerald-950 text-[10px] font-bold uppercase tracking-widest">Nuevo</p>
              <p className="text-white font-bold text-lg leading-tight">Cowork Day</p>
              <p className="text-white/90 text-sm mt-0.5">
                trabajá un día en Manso — escritorio, café y wifi
              </p>
            </div>
            <span className="text-white/70 text-xl flex-shrink-0">›</span>
          </button>
        )}

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
