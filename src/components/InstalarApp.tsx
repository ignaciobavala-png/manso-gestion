import { useSyncExternalStore } from 'react'
import { Download, X } from 'lucide-react'
import { descartarInstalar, instalar, puedeInstalar, suscribirInstalar } from '../lib/instalarApp'

/**
 * Invitación a instalar la web como app, para Android. Va después de las
 * entradas y no antes: el QR es lo que la persona vino a buscar. Si el
 * navegador no ofrece instalar (iPhone, ya instalada, la descartó hace poco),
 * no renderiza nada.
 */
export default function InstalarApp() {
  const visible = useSyncExternalStore(suscribirInstalar, puedeInstalar, () => false)
  if (!visible) return null

  return (
    <div className="relative bg-neutral-900/80 border border-white/15 rounded-2xl p-4 pr-10">
      <button
        onClick={descartarInstalar}
        aria-label="No, gracias"
        className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors"
      >
        <X size={16} aria-hidden />
      </button>
      <p className="text-white text-sm font-medium">Tené tus entradas a un toque</p>
      <p className="text-gray-400 text-xs mt-1 leading-relaxed">
        Agregá Manso a tu pantalla de inicio y abrilas sin buscar el mail.
      </p>
      <button
        onClick={instalar}
        className="mt-3 w-full flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 border border-white/15 text-white font-medium py-2.5 rounded-2xl transition-all active:scale-95 text-sm"
      >
        <Download size={15} aria-hidden /> Agregar a inicio
      </button>
    </div>
  )
}
