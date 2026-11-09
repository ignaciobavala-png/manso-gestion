import type { Producto } from '../../lib/mock'

/**
 * Ilustración de producto en el trazo de la marca: línea oscura y un toque de naranja.
 * Toda la carta es de bebidas, así que hay un solo vaso para todos. Si un producto trae `foto`, se muestra la foto en su lugar.
 */
const TINTA = '#1a1a1a'
const NARANJA = '#f65200'

const trazo = { stroke: TINTA, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function Vaso() {
  return (
    <>
      <path d="M20.5 26 H43.5 L41.9 53.4 a2.5 2.5 0 0 1 -2.5 2.6 H24.6 a2.5 2.5 0 0 1 -2.5 -2.6 Z" fill={NARANJA} />
      <path d="M18 12 H46 L42 54 a3 3 0 0 1 -3 3 H25 a3 3 0 0 1 -3 -3 Z" fill="none" {...trazo} />
      <path d="M20.5 26 H43.5" {...trazo} />
      <circle cx="28" cy="19" r="2" fill="none" {...trazo} />
      <circle cx="37" cy="18" r="1.6" fill="none" {...trazo} />
    </>
  )
}

export function IconoProducto({ producto, className = '' }: { producto: Producto; className?: string }) {
  if (producto.foto) {
    return <img src={producto.foto} alt="" loading="lazy" className={`object-cover ${className}`} />
  }
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <Vaso />
    </svg>
  )
}
