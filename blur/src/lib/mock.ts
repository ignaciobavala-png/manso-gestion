/**
 * DATOS DE MAQUETA de las pantallas que todavía no tienen backend: carta de la
 * barra. El mapa tiene la suya en lib/mapa.ts. Line up, escenarios y home salen de manso-club
 * (lib/festival.ts). Nada de esto es real: precios, posiciones y horarios son
 * relleno.
 */

export interface Producto {
  id: string
  nombre: string
  categoria: 'Bebidas' | 'Comida' | 'Otros'
  precio: number
  /** URL de la foto del producto; si falta, la carta muestra la ilustración de su categoría. */
  foto?: string
}

export const CARTA: Producto[] = [
  { id: 'p1', nombre: 'Cerveza', categoria: 'Bebidas', precio: 4500 },
  { id: 'p2', nombre: 'Fernet', categoria: 'Bebidas', precio: 6000 },
  { id: 'p3', nombre: 'Agua', categoria: 'Bebidas', precio: 2000 },
  { id: 'p4', nombre: 'Hamburguesa', categoria: 'Comida', precio: 9000 },
  { id: 'p5', nombre: 'Empanada', categoria: 'Comida', precio: 2500 },
  { id: 'p6', nombre: 'Vaso reutilizable', categoria: 'Otros', precio: 3000 },
]

export const FOTOS_POR_PERSONA = 10
