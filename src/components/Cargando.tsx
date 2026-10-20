import { useEffect, useState } from 'react'

const PALABRA = 'MANSO'
const RUIDO = '▓▒░#/\\<>+'
// Cada letra se traba 4 cuadros después de la anterior; al llegar al final se
// mantiene un rato la palabra entera y vuelve a descifrarse.
const CUADROS_POR_LETRA = 4
const CUADROS_TOTALES = PALABRA.length * CUADROS_POR_LETRA + 8

const mezclar = (cuadro: number) => {
  const fijas = Math.min(PALABRA.length, Math.floor(cuadro / CUADROS_POR_LETRA))
  return [...PALABRA]
    .map((letra, i) => (i < fijas ? letra : RUIDO[Math.floor(Math.random() * RUIDO.length)]))
    .join('')
}

const sinMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * El estado de carga de la app: la marca descifrándose. Reemplaza al spinner
 * genérico. El ancho es fijo (monoespaciada) para que al cambiar de glifo el
 * texto no salte, y con "reducir movimiento" se queda la palabra quieta.
 */
export default function Cargando({ className = '' }: { className?: string }) {
  const [texto, setTexto] = useState(PALABRA)

  useEffect(() => {
    if (sinMovimiento()) return
    let cuadro = 0
    const id = setInterval(() => {
      cuadro = (cuadro + 1) % CUADROS_TOTALES
      setTexto(mezclar(cuadro))
    }, 90)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-label="Cargando"
      className={`font-mono font-bold text-xl tracking-[0.3em] text-manso-cream select-none ${className}`}
    >
      <span aria-hidden>{texto}</span>
    </div>
  )
}
