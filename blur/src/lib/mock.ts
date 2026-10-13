/**
 * DATOS DE MAQUETA de las pantallas que todavía no tienen backend: carta de la
 * barra, mapa y transporte. Line up, escenarios y home salen de manso-club
 * (lib/festival.ts). Nada de esto es real: precios, posiciones y horarios son
 * relleno.
 */

export interface Producto {
  id: string
  nombre: string
  categoria: 'Bebidas' | 'Comida' | 'Otros'
  precio: number
}

export const CARTA: Producto[] = [
  { id: 'p1', nombre: 'Cerveza', categoria: 'Bebidas', precio: 4500 },
  { id: 'p2', nombre: 'Fernet', categoria: 'Bebidas', precio: 6000 },
  { id: 'p3', nombre: 'Agua', categoria: 'Bebidas', precio: 2000 },
  { id: 'p4', nombre: 'Hamburguesa', categoria: 'Comida', precio: 9000 },
  { id: 'p5', nombre: 'Empanada', categoria: 'Comida', precio: 2500 },
  { id: 'p6', nombre: 'Vaso reutilizable', categoria: 'Otros', precio: 3000 },
]

export type TipoPunto =
  | 'escenario' | 'charlas' | 'bano' | 'medico' | 'agua' | 'barra'
  | 'chill' | 'entrada' | 'estacionamiento' | 'salida'

export const TIPOS_PUNTO: { id: TipoPunto; nombre: string; marca: string }[] = [
  { id: 'escenario', nombre: 'Escenarios', marca: 'E' },
  { id: 'charlas', nombre: 'Panel de charlas', marca: 'S' },
  { id: 'bano', nombre: 'Baños', marca: 'WC' },
  { id: 'medico', nombre: 'Médico', marca: '+' },
  { id: 'agua', nombre: 'Hidratación', marca: 'H₂O' },
  { id: 'barra', nombre: 'Barra', marca: 'B' },
  { id: 'chill', nombre: 'Tronco ambiente chill', marca: 'C' },
  { id: 'entrada', nombre: 'Entrada', marca: '→' },
  { id: 'estacionamiento', nombre: 'Estacionamiento', marca: 'P' },
  { id: 'salida', nombre: 'Salida', marca: '←' },
]

/** x/y en % sobre el croquis. Posiciones inventadas. */
export interface Punto { id: string; tipo: TipoPunto; nombre: string; x: number; y: number }

export const PUNTOS: Punto[] = [
  { id: 'm1', tipo: 'entrada', nombre: 'Entrada', x: 12, y: 88 },
  { id: 'm2', tipo: 'estacionamiento', nombre: 'Estacionamiento', x: 12, y: 70 },
  { id: 'm3', tipo: 'salida', nombre: 'Salida', x: 88, y: 88 },
  { id: 'm4', tipo: 'escenario', nombre: 'El Edén', x: 30, y: 38 },
  { id: 'm5', tipo: 'escenario', nombre: 'The Tronk', x: 66, y: 30 },
  { id: 'm6', tipo: 'escenario', nombre: 'El Beso', x: 78, y: 58 },
  { id: 'm7', tipo: 'escenario', nombre: 'Bello Horizonte', x: 46, y: 62 },
  { id: 'm8', tipo: 'charlas', nombre: 'Sinapsis', x: 18, y: 18 },
  { id: 'm9', tipo: 'chill', nombre: 'Tronco chill', x: 50, y: 14 },
  { id: 'm10', tipo: 'barra', nombre: 'Barra central', x: 52, y: 44 },
  { id: 'm11', tipo: 'bano', nombre: 'Baños', x: 36, y: 76 },
  { id: 'm12', tipo: 'bano', nombre: 'Baños', x: 84, y: 40 },
  { id: 'm13', tipo: 'agua', nombre: 'Hidratación', x: 40, y: 52 },
  { id: 'm14', tipo: 'agua', nombre: 'Hidratación', x: 72, y: 46 },
  { id: 'm15', tipo: 'medico', nombre: 'Médico', x: 24, y: 58 },
]

export interface Salida {
  id: string
  destino: string
  /** Minutos desde "ahora" — en la maqueta los horarios corren solos. */
  enMin: number
  cupo: number
}

export const SALIDAS: Salida[] = [
  { id: 's1', destino: 'Terminal · Ida y vuelta', enMin: 22, cupo: 8 },
  { id: 's2', destino: 'Terminal · Ida y vuelta', enMin: 75, cupo: 24 },
  { id: 's3', destino: 'Terminal · Ida y vuelta', enMin: 140, cupo: 40 },
  { id: 's4', destino: 'Terminal · Última vuelta', enMin: 260, cupo: 40 },
]

export const FOTOS_POR_PERSONA = 10
