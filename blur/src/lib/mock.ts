/**
 * DATOS DE MAQUETA de las pantallas que todavía no tienen backend: carta de la
 * barra. El mapa tiene la suya en lib/mapa.ts. Line up, escenarios y home salen de manso-club
 * (lib/festival.ts). Nada de esto es real: precios, posiciones y horarios son
 * relleno.
 */

export type Categoria = 'Los que más salen' | 'De autor' | 'Cervezas' | 'Sin alcohol' | 'Agua y gaseosas'

export interface Producto {
  id: string
  nombre: string
  categoria: Categoria
  /** Qué lleva el trago, como en la carta impresa. */
  descripcion?: string
  /** Sello chico al lado del nombre ("De la casa"). */
  etiqueta?: string
  /** Lugar reservado en la carta (trago de la marca invitada): se dibuja punteado y no se pide. */
  vacante?: boolean
  /** Sin precio, el producto se muestra pero no se puede pedir: la carta borrador todavía no los trae. */
  precio?: number
  /** URL de la foto del producto; si falta, la carta muestra la ilustración de su categoría. */
  foto?: string
}

/** Carta de la barra: BLUR_Carta_de_Barra_Borrador.pdf, con los cambios que pidió Ana. */
export const CARTA: Producto[] = [
  { id: 'vermu', nombre: 'Vermú', categoria: 'Los que más salen', descripcion: 'Vermú rojo, soda, rodaja de naranja' },
  { id: 'fernet', nombre: 'Fernet', categoria: 'Los que más salen', descripcion: 'Fernet, mucho hielo' },
  { id: 'negroni', nombre: 'Negroni', categoria: 'Los que más salen', descripcion: 'Gin, vermú rojo, bitter' },
  { id: 'aperol-spritz', nombre: 'Aperol Spritz', categoria: 'Los que más salen', descripcion: 'Aperol, espumante, soda, naranja' },
  { id: 'gin-tonic', nombre: 'Gin tonic', categoria: 'Los que más salen', descripcion: 'Gin, tónica, cítrico' },
  { id: 'vodka-energizante', nombre: 'Vodka + energizante', categoria: 'Los que más salen', descripcion: 'Vodka, bebida energizante' },
  { id: 'jagger', nombre: 'Jagger', categoria: 'Los que más salen' },
  { id: 'whisky', nombre: 'Whisky', categoria: 'Los que más salen' },
  { id: 'por-tinto', nombre: 'Por-Tinto', categoria: 'Los que más salen', descripcion: 'Tinto de verano' },

  { id: 'hibisco-blur', nombre: 'Hibisco BLUR', etiqueta: 'De la casa', categoria: 'De autor', descripcion: 'Gin, jugo de hibisco, soda, menta o curry' },
  { id: 'marca-1', nombre: 'Trago de marca', categoria: 'De autor', descripcion: 'Vacante · trago con la marca invitada', vacante: true },
  { id: 'marca-2', nombre: 'Trago de marca', categoria: 'De autor', descripcion: 'Vacante · trago con la marca invitada', vacante: true },

  { id: 'cerveza-rubia', nombre: 'Rubia', categoria: 'Cervezas', descripcion: 'Lata o vaso' },
  { id: 'cerveza-roja', nombre: 'Roja', categoria: 'Cervezas', descripcion: 'Lata o vaso' },
  { id: 'cerveza-ipa', nombre: 'IPA', categoria: 'Cervezas', descripcion: 'Lata o vaso' },
  { id: 'cerveza-sin-alcohol', nombre: 'Sin alcohol', categoria: 'Cervezas', descripcion: 'Lata o vaso' },

  { id: 'limonada', nombre: 'Limonada', categoria: 'Sin alcohol', descripcion: 'Limón, menta, jengibre, soda' },
  { id: 'hibisco-frio', nombre: 'Hibisco frío', categoria: 'Sin alcohol', descripcion: 'Jugo de hibisco, cítrico, hielo' },
  { id: 'jugo-soda-hierba', nombre: 'Jugo, soda y hierba', categoria: 'Sin alcohol', descripcion: 'Jugo sin gas, hielo, soda y una hierba fresca · a completar' },

  { id: 'agua', nombre: 'Agua', categoria: 'Agua y gaseosas', descripcion: 'Con o sin gas' },
  { id: 'gaseosa', nombre: 'Gaseosa', categoria: 'Agua y gaseosas', descripcion: 'Cola, tónica, pomelo' },
]

export const FOTOS_POR_PERSONA = 10
