import { Ticket, Smartphone, Beer, Clapperboard, Laptop, ChevronRight, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'
import { useCineclubActivo, useCoworkActivo } from '../../hooks/useSeccionPublica'

const PAGES: { label: string; description: string; path: string; Icon: LucideIcon }[] = [
  {
    label: 'Eventos',
    description: 'obtené tu entrada',
    path: '/registro',
    Icon: Ticket,
  },
  {
    label: 'Mi entrada',
    description: 'revisá tus entradas',
    path: '/mi-entrada',
    Icon: Smartphone,
  },
  {
    label: 'Carta',
    description: 'conocé nuestro menú',
    path: '/carta',
    Icon: Beer,
  },
  {
    label: 'Cineclub',
    description: 'votá la próxima película',
    path: '/cineclub',
    Icon: Clapperboard,
  },
]

export default function Inicio() {
  const navigate = useNavigate()
  const { activo: cineclubActivo } = useCineclubActivo()
  const { activo: coworkActivo, soloStaff: coworkSoloStaff } = useCoworkActivo()

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
            className="w-full bg-terra-600/90 hover:bg-terra-500/90 border border-terra-400/40 backdrop-blur-md rounded-2xl px-5 py-5 flex items-center gap-4 transition-colors text-left"
          >
            <Laptop className="flex-shrink-0 text-white" size={28} strokeWidth={1.5} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-terra-950 text-[10px] font-bold uppercase tracking-widest">
                {coworkSoloStaff ? 'Solo vos lo ves' : 'Nuevo'}
              </p>
              <p className="text-white font-bold text-lg leading-tight">Cowork Day</p>
              <p className="text-white/90 text-sm mt-0.5">
                un día de trabajo compartido con nuestra comunidad
              </p>
            </div>
            <ChevronRight className="text-white/70 flex-shrink-0" size={20} strokeWidth={1.5} aria-hidden />
          </button>
        )}

        {pages.map((page) => (
          <button
            key={page.path}
            onClick={() => navigate(page.path)}
            className="w-full bg-black/60 hover:bg-black/60 border border-white/20 hover:border-white/40 backdrop-blur-md rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors text-left"
          >
            <page.Icon className="flex-shrink-0 text-manso-cream/80" size={26} strokeWidth={1.5} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-base">{page.label}</p>
              <p className="text-white/90 text-sm mt-0.5">{page.description}</p>
            </div>
            <ChevronRight className="text-white/60 flex-shrink-0" size={20} strokeWidth={1.5} aria-hidden />
          </button>
        ))}

      </div>
    </PublicLayout>
  )
}
