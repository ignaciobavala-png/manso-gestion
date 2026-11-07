import type { Producto } from '../../lib/mock'

/**
 * Ilustración de producto en el trazo de la marca: línea oscura y un toque de naranja.
 * Hay una por categoría, no una por producto: la carta real la carga la organización y no
 * se sabe qué va a tener. Si un producto trae `foto`, se muestra la foto en su lugar.
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

function Hamburguesa() {
  return (
    <>
      <path d="M12 30 C12 18 22 12 32 12 C42 12 52 18 52 30 Z" fill={NARANJA} {...trazo} />
      <path d="M24 20 l2 2 M33 17 l1 3 M40 22 l2 1" {...trazo} />
      <rect x="10" y="34" width="44" height="7" rx="3.5" fill={TINTA} />
      <path d="M12 45 H52 V48 a7 7 0 0 1 -7 7 H19 a7 7 0 0 1 -7 -7 Z" fill={NARANJA} {...trazo} />
    </>
  )
}

function VasoReutilizable() {
  return (
    <>
      <path d="M21 32 H43 L42.2 41 H21.8 Z" fill={NARANJA} />
      <path d="M19 20 H45 L41 54 a3 3 0 0 1 -3 3 H26 a3 3 0 0 1 -3 -3 Z" fill="none" {...trazo} />
      <path d="M17 14 H47 V20 H17 Z" fill="none" {...trazo} />
      <path d="M36 14 L40 4" {...trazo} />
    </>
  )
}

export function IconoProducto({ producto, className = '' }: { producto: Producto; className?: string }) {
  if (producto.foto) {
    return <img src={producto.foto} alt="" loading="lazy" className={`object-cover ${className}`} />
  }
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      {producto.categoria === 'Bebidas' ? <Vaso /> : producto.categoria === 'Comida' ? <Hamburguesa /> : <VasoReutilizable />}
    </svg>
  )
}
