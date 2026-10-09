import { supabase } from './supabase'
import { parsearDecimal } from './mercadopago'

/**
 * ABM de tipos de entrada de un evento (migración 039): Early Bird, General,
 * Pack x3… Sin tipos, el evento se vende como siempre con un solo precio.
 *
 * La UI está en components/TiposEntradaEditor.tsx. Es controlada: EventCreator y EventEditor tienen la lista en su estado y la
 * guardan con guardarTipos() junto con el evento. El creador todavía no tiene
 * event_id cuando se arma la lista, por eso no se guarda fila por fila.
 */

export type EstadoTipo = 'en_venta' | 'proximamente' | 'agotado' | 'finalizado'

export interface TipoDraft {
  /** Clave local para React; las filas nuevas no tienen id hasta guardarse. */
  key: string
  id?: string
  nombre: string
  descripcion: string
  precio: string
  entradasPorUnidad: string
  cupo: string
  maxPorCompra: string
  estado: EstadoTipo
  activo: boolean
  /** Vendidas + reservadas: con ventas no se borra, se desactiva. */
  ocupadas: number
}

export const ESTADOS_TIPO: [EstadoTipo, string][] = [
  ['en_venta', 'En venta'],
  ['proximamente', 'Próximamente'],
  ['agotado', 'Agotado'],
  ['finalizado', 'Finalizado'],
]

const nuevoKey = () => crypto.randomUUID()

export function tipoVacio(): TipoDraft {
  return {
    key: nuevoKey(),
    nombre: '',
    descripcion: '',
    precio: '',
    entradasPorUnidad: '1',
    cupo: '',
    maxPorCompra: '',
    estado: 'en_venta',
    activo: true,
    ocupadas: 0,
  }
}

export async function cargarTipos(eventId: string): Promise<TipoDraft[]> {
  const [{ data: tipos }, { data: conteos }] = await Promise.all([
    supabase
      .from('event_ticket_types')
      .select('id, nombre, descripcion, precio, entradas_por_unidad, cupo, max_por_compra, estado, activo, orden')
      .eq('event_id', eventId)
      .order('orden')
      .order('created_at'),
    supabase
      .from('event_ticket_type_counts')
      .select('ticket_type_id, vendidas, reservadas')
      .eq('event_id', eventId),
  ])

  const ocupadas = new Map((conteos ?? []).map(c => [c.ticket_type_id, c.vendidas + c.reservadas]))
  return (tipos ?? []).map(t => ({
    key: t.id,
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion ?? '',
    precio: String(Number(t.precio)),
    entradasPorUnidad: String(t.entradas_por_unidad),
    cupo: t.cupo === null ? '' : String(t.cupo),
    maxPorCompra: t.max_por_compra === null ? '' : String(t.max_por_compra),
    estado: t.estado as EstadoTipo,
    activo: t.activo,
    ocupadas: ocupadas.get(t.id) ?? 0,
  }))
}

export const entero = (v: string): number | null => {
  if (!v.trim()) return null
  const n = Number(v.trim())
  return Number.isInteger(n) ? n : NaN
}

/** null si está todo bien; si no, el mensaje para el AlertModal. */
export function validarTipos(tipos: TipoDraft[], esPago: boolean): string | null {
  for (const t of tipos) {
    const nombre = t.nombre.trim() || 'Un tipo de entrada'
    if (!t.nombre.trim()) return 'Cada tipo de entrada necesita un nombre'
    const precio = parsearDecimal(t.precio)
    if (isNaN(precio) || precio < 0) return `${nombre}: el precio no es válido`
    if (esPago && t.activo && precio <= 0) return `${nombre}: el precio tiene que ser mayor a 0`
    const porUnidad = entero(t.entradasPorUnidad)
    if (porUnidad === null || isNaN(porUnidad) || porUnidad < 1) return `${nombre}: las entradas por unidad tienen que ser 1 o más`
    const cupo = entero(t.cupo)
    if (cupo !== null && (isNaN(cupo) || cupo < 0)) return `${nombre}: el cupo tiene que ser un número entero`
    const max = entero(t.maxPorCompra)
    if (max !== null && (isNaN(max) || max < 1)) return `${nombre}: el máximo por compra tiene que ser 1 o más`
  }
  return null
}

/** Precio más bajo de los tipos activos: queda como regular_ticket_price de referencia. */
export function precioDesde(tipos: TipoDraft[]): number | null {
  const precios = tipos.filter(t => t.activo).map(t => parsearDecimal(t.precio)).filter(p => p > 0)
  return precios.length ? Math.min(...precios) : null
}

/**
 * Sincroniza la lista con la tabla: inserta las nuevas, actualiza las que ya
 * estaban y borra las que se sacaron (sólo puede sacarse una sin ventas; ver
 * el botón en el editor).
 */
export async function guardarTipos(eventId: string, tipos: TipoDraft[], idsOriginales: string[]): Promise<void> {
  const quedan = new Set(tipos.filter(t => t.id).map(t => t.id))
  const borrar = idsOriginales.filter(id => !quedan.has(id))
  if (borrar.length) {
    const { error } = await supabase.from('event_ticket_types').delete().in('id', borrar)
    if (error) throw error
  }

  const filas = tipos.map((t, i) => ({
    ...(t.id ? { id: t.id } : {}),
    event_id: eventId,
    nombre: t.nombre.trim(),
    descripcion: t.descripcion.trim() || null,
    precio: parsearDecimal(t.precio) || 0,
    entradas_por_unidad: entero(t.entradasPorUnidad) ?? 1,
    cupo: entero(t.cupo),
    max_por_compra: entero(t.maxPorCompra),
    estado: t.estado,
    activo: t.activo,
    orden: i,
  }))

  const existentes = filas.filter(f => 'id' in f)
  const nuevas = filas.filter(f => !('id' in f))
  if (existentes.length) {
    const { error } = await supabase.from('event_ticket_types').upsert(existentes)
    if (error) throw error
  }
  if (nuevas.length) {
    const { error } = await supabase.from('event_ticket_types').insert(nuevas)
    if (error) throw error
  }
}
