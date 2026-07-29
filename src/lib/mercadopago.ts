// Comisión observada de Mercado Pago sobre una venta real de Checkout Pro:
// $21,51 sobre $500 el 28/07/2026 (ver docs/MERCADOPAGO.md). Se usa sólo para
// mostrarle a Ana cuánto le queda neto al elegir el recargo — el número real de
// cada pago viene de MP y se guarda en mp_fee_amount, no se calcula acá.
export const COMISION_MP_PCT = 4.3

const pesos = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Previsualización del recargo: qué paga el asistente y qué le queda a Manso.
 * Devuelve null si todavía no hay un precio con el que hacer la cuenta.
 */
export function previsualizarRecargo(
  precioBase: number,
  recargoPct: number
): { conRecargo: string; neto: string } | null {
  if (!precioBase || precioBase <= 0) return null

  const conRecargo = Math.round(precioBase * (1 + recargoPct / 100) * 100) / 100
  const neto = Math.round(conRecargo * (1 - COMISION_MP_PCT / 100) * 100) / 100

  return { conRecargo: pesos(conRecargo), neto: pesos(neto) }
}

/** Acepta coma decimal (es-AR) y devuelve un número usable. */
export function parsearDecimal(valor: string): number {
  return parseFloat(valor.replace(',', '.')) || 0
}
