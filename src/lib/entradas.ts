/**
 * Espejo en TypeScript de los predicados de la migración 020 (generalizados
 * en la 039 para las entradas vendidas por la web).
 *
 * La definición que manda es la de la DB (public.entrada_vendida /
 * public.entrada_reservada): los contadores del panel se calculan sobre filas
 * ya traídas a memoria, y sin esto cada pantalla volvía a inventar su propia
 * regla — que es exactamente el bug que reportó Ana: "Rechazar QR" descontaba
 * en una vista y no en otra.
 *
 * Si cambia la regla, se cambia en la DB (última: 039) y acá. No en cada componente.
 */

export interface EstadoEntrada {
  is_banned: boolean
  payment_provider: string | null
  payment_verified: boolean
  mp_expires_at?: string | null
}

/** Medios donde la entrada sólo vale con el pago confirmado. */
const PAGO_AUTOMATICO = ['mercadopago', 'web']

/**
 * Cuenta como vendida y da derecho a QR.
 *
 * Transferencia cuenta desde que se registra (el comprobante ya está subido y
 * la verificación es a mano). Mercado Pago y la web (039) sólo cuentan con el
 * pago confirmado.
 */
export function esVendida(r: EstadoEntrada): boolean {
  if (r.is_banned) return false
  if (!PAGO_AUTOMATICO.includes(r.payment_provider ?? '')) return true
  return r.payment_verified === true
}

/**
 * Compra en curso que ocupa cupo pero todavía no es una venta: checkout de MP
 * abierto, o reserva de la web (que puede no vencer sola: NULL = hasta que la
 * web la confirme o la libere).
 */
export function esReservada(r: EstadoEntrada): boolean {
  if (r.is_banned || r.payment_verified) return false
  const vence = r.mp_expires_at ? new Date(r.mp_expires_at).getTime() : null
  if (r.payment_provider === 'mercadopago') return vence !== null && vence > Date.now()
  if (r.payment_provider === 'web') return vence === null || vence > Date.now()
  return false
}

/** Pago de MP abandonado: la preference venció y nunca se acreditó. */
export function esMpAbandonada(r: EstadoEntrada): boolean {
  if (r.is_banned) return false
  if (r.payment_provider !== 'mercadopago') return false
  if (r.payment_verified) return false
  return !esReservada(r)
}

/** Reserva de la web que venció o se liberó sin pagarse: no vale para nada. */
export function esWebLiberada(r: EstadoEntrada): boolean {
  if (r.is_banned) return false
  if (r.payment_provider !== 'web') return false
  if (r.payment_verified) return false
  return !esReservada(r)
}

/** Etiqueta de estado para el panel del staff. */
export function etiquetaEstado(r: EstadoEntrada & { used_at?: string | null }): string {
  if (r.is_banned) return 'Rechazado'
  if (r.used_at) return 'Ingresó'
  if (esMpAbandonada(r)) return 'Sin pagar'
  if (esWebLiberada(r)) return 'Web: liberada'
  if (esReservada(r)) return r.payment_provider === 'web' ? 'Web: sin pagar' : 'Pagando...'
  if (r.payment_verified) return 'Verificado'
  return 'Pendiente'
}

/** "Pack x3 · 2/3", "Early Bird", o null si la entrada no tiene tipo. */
export function etiquetaTipo(r: {
  ticket_type_nombre?: string | null
  pack_pos?: number | null
  pack_size?: number | null
}): string | null {
  if (!r.ticket_type_nombre) return null
  if (r.pack_pos && r.pack_size) return `${r.ticket_type_nombre} · ${r.pack_pos}/${r.pack_size}`
  return r.ticket_type_nombre
}
