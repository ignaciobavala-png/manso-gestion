import { useRef, useState } from 'react'
import { clic, vibrar } from '../../lib/sonido'

/** Recorrido (px) que hay que arrastrar para armar el obturador. */
const LIM = 150
const PASO = 18

/**
 * Rueda del obturador: hay que arrastrarla hacia la derecha para armar la próxima
 * foto. Es a propósito un poco de trabajo: que cada disparo cueste algo. Con teclado,
 * Enter o Espacio la arman de una.
 */
export function Rueda({
  armado,
  bloqueada,
  onArmar,
}: {
  armado: boolean
  bloqueada: boolean
  onArmar: () => void
}) {
  const [x, setX] = useState(0)
  const origen = useRef<number | null>(null)
  const paso = useRef(0)
  const pos = armado ? LIM : x

  const bajar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (armado || bloqueada) return
    origen.current = e.clientX - x
    paso.current = 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (origen.current === null) return
    const nx = Math.max(0, Math.min(LIM, e.clientX - origen.current))
    setX(nx)
    const p = Math.floor(nx / PASO)
    if (p !== paso.current) {
      paso.current = p
      clic(true)
      vibrar(6)
    }
    if (nx >= LIM) {
      origen.current = null
      setX(0)
      vibrar([20, 30, 20])
      onArmar()
    }
  }

  const soltar = () => {
    origen.current = null
    setX(0)
  }

  return (
    <div
      role="button"
      tabIndex={bloqueada ? -1 : 0}
      aria-disabled={bloqueada}
      aria-label={armado ? 'Obturador armado' : 'Arrastrá para armar el obturador'}
      onPointerDown={bajar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !armado && !bloqueada) {
          e.preventDefault()
          vibrar([20, 30, 20])
          clic(true)
          onArmar()
        }
      }}
      className="relative h-11 w-full cursor-grab select-none overflow-hidden rounded-full bg-[#003009] active:cursor-grabbing"
      style={{ touchAction: 'none', opacity: bloqueada ? 0.5 : 1 }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, #0d5a1a 0 4px, #001d05 4px 9px)',
          backgroundPositionX: pos * 1.3,
        }}
      />
      {/* Curvatura del cilindro: se oscurece hacia los costados. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.65), transparent 25%, transparent 75%, rgba(0,0,0,0.65))' }}
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="bg-[#003009] px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#fffcdc]">
          {armado ? 'Lista' : 'Armar →'}
        </span>
      </span>
    </div>
  )
}
