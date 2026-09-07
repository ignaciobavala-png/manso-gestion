import { createElement } from 'react'
import { resolverIcono } from '../lib/iconos'

interface IconoProps {
  /** Nombre del set, o el emoji viejo que quedó guardado en la base. */
  nombre: string | null | undefined
  className?: string
  size?: number
}

/**
 * Pinta un ícono guardado. Si el valor no se reconoce, no dibuja nada.
 *
 * Va por `createElement` y no por JSX a propósito: el ícono sale de una
 * tabla, y `<Componente />` con una variable local hace saltar la regla
 * `react-hooks/static-components` — que cree que se está fabricando un
 * componente nuevo en cada render cuando en realidad solo se lo busca.
 */
export default function Icono({ nombre, className, size = 24 }: IconoProps) {
  const componente = resolverIcono(nombre)
  if (!componente) return null
  return createElement(componente, { className, size, strokeWidth: 1.5, 'aria-hidden': true })
}
