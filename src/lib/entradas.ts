/**
 * Espejo en TypeScript de los predicados de la migración 020.
 *
 * La definición que manda es la de la DB (public.entrada_vendida /
 * public.entrada_reservada): los contadores del panel se calculan sobre filas
 * ya traídas a memoria, y sin esto cada pantalla volvía a inventar su propia
 * regla — que es exactamente el bug que reportó Ana: "Rechazar QR" descontaba
 * en una vista y no en otra.
 *
 * Si cambia la regla, se cambia en 020 y acá. No en cada componente.
 */

export interface EstadoEntrada {
  is_banned: boolean
  payment_provider: string | null
  payment_verified: boolean
  mp_expires_at?: string | null
}

/**
 * Cuenta como vendida y da derecho a QR.
 *
 * Transferencia cuenta desde que se registra (el comprobante ya está subido y
 * la verificación es a mano). Mercado Pago sólo cuenta con el pago acreditado.
 */
export function esVendida(r: EstadoEntrada): boolean {
  if (r.is_banned) return false
  if (r.payment_provider !== 'mercadopago') return true
  return r.payment_verified === true
}

/** Checkout de MP abierto: ocupa cupo pero todavía no es una venta. */
export function esReservada(r: EstadoEntrada): boolean {
  if (r.is_banned) return false
  if (r.payment_provider !== 'mercadopago') return false
  if (r.payment_verified) return false
  if (!r.mp_expires_at) return false
  return new Date(r.mp_expires_at).getTime() > Date.now()
}

/** Pago de MP abandonado: la preference venció y nunca se acreditó. */
export function esMpAbandonada(r: EstadoEntrada): boolean {
  if (r.is_banned) return false
  if (r.payment_provider !== 'mercadopago') return false
  if (r.payment_verified) return false
  return !esReservada(r)
}

/** Etiqueta de estado para el panel del staff. */
export function etiquetaEstado(r: EstadoEntrada & { used_at?: string | null }): string {
  if (r.is_banned) return 'Rechazado'
  if (r.used_at) return 'Ingresó'
  if (esMpAbandonada(r)) return 'Sin pagar'
  if (esReservada(r)) return 'Pagando...'
  if (r.payment_verified) return 'Verificado'
  return 'Pendiente'
}
