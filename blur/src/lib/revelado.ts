/**
 * El revelado abre después del festival. `VITE_REVELADO_DESDE` (fecha ISO, ej.
 * 2026-12-20T12:00:00-03:00) solo alimenta la cuenta regresiva de la pantalla de
 * espera. Sin definir, la pantalla dice "después del festival" y nada más.
 *
 * Esto NO abre la galería: ver más abajo en README ("Revelado"). Mostrar fotos
 * publicadas necesita una lectura pública que hoy no existe (el bucket es privado).
 */
const crudo = import.meta.env.VITE_REVELADO_DESDE as string | undefined
const fecha = crudo ? new Date(crudo) : null

export const reveladoDesde: Date | null = fecha && !Number.isNaN(fecha.getTime()) ? fecha : null

/** Días que faltan (0 si ya pasó); null si no hay fecha configurada. */
export function diasParaRevelado(): number | null {
  if (!reveladoDesde) return null
  return Math.max(0, Math.ceil((reveladoDesde.getTime() - Date.now()) / 86_400_000))
}
