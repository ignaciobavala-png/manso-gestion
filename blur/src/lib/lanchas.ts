import type { Lancha } from './festival'

/**
 * El festival va de las 14 a las 04: una hora de madrugada (00–05) es la
 * continuación de la noche, así que cuenta como más de 24 h. Sin esto, una
 * lancha que vuelve a las 02:30 parecería "ya pasada" a las 23:00.
 */
const minutos = (h: number, m: number) => (h < 6 ? h + 24 : h) * 60 + m
const deHHMM = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return minutos(h, m)
}

const diaNum = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()

/** ¿Estamos en el día del festival (o en la madrugada que le sigue)? `fecha` viene como `2026-12-12`. */
export function esNocheDelFestival(fecha: string | null, ahora = new Date()) {
  if (!fecha) return false
  const [a, m, d] = fecha.split('-').map(Number)
  if (!a || !m || !d) return false
  const base = a * 10000 + m * 100 + d
  if (diaNum(ahora) === base) return true
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  return ahora.getHours() < 6 && diaNum(ayer) === base
}

export type Proxima = { tipo: 'sale' | 'vuelve'; lancha: Lancha }

/** La próxima salida; si ya no queda ninguna, la próxima vuelta; si tampoco, nada. */
export function proximaLancha(lanchas: Lancha[], ahora = new Date()): Proxima | null {
  const ya = minutos(ahora.getHours(), ahora.getMinutes())
  const salida = lanchas
    .filter((l) => l.salida && deHHMM(l.salida) >= ya)
    .sort((a, b) => deHHMM(a.salida!) - deHHMM(b.salida!))[0]
  if (salida) return { tipo: 'sale', lancha: salida }
  const vuelta = lanchas
    .filter((l) => l.regreso && deHHMM(l.regreso) >= ya)
    .sort((a, b) => deHHMM(a.regreso!) - deHHMM(b.regreso!))[0]
  return vuelta ? { tipo: 'vuelve', lancha: vuelta } : null
}
