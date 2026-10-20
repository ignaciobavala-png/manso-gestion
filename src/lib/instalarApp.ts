/**
 * Instalación de la web como app (Android / Chrome).
 *
 * Chrome avisa que la web se puede instalar con `beforeinstallprompt`, y lo
 * dispara una sola vez y temprano: si el listener se registra recién cuando
 * monta una pantalla, el evento ya pasó. Por eso se escucha desde que carga
 * el módulo (import en main.tsx) y las pantallas leen el resultado.
 *
 * iPhone no dispara este evento, así que ahí `puedeInstalar()` es siempre
 * false y no se muestra nada.
 */

interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const LS_DESCARTADO = 'manso_instalar_descartado'
/** Si dijo que no, no se vuelve a preguntar por un mes. */
const SILENCIO_MS = 30 * 24 * 60 * 60 * 1000

let evento: EventoInstalar | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach(fn => fn())

const leerDescartado = (): number => {
  try { return Number(localStorage.getItem(LS_DESCARTADO)) || 0 } catch { return 0 }
}

const yaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    // Sin preventDefault Chrome muestra su propia mini-barra; acá la
    // invitación la hace la app, en el momento en que tiene sentido.
    e.preventDefault()
    evento = e as EventoInstalar
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    evento = null
    avisar()
  })
}

export function suscribirInstalar(fn: () => void): () => void {
  oyentes.add(fn)
  return () => { oyentes.delete(fn) }
}

/** Se puede mostrar la invitación: Chrome la ofrece, no está instalada y no la descartó hace poco. */
export function puedeInstalar(): boolean {
  return evento !== null && !yaInstalada() && Date.now() - leerDescartado() > SILENCIO_MS
}

export async function instalar(): Promise<void> {
  if (!evento) return
  const e = evento
  // Chrome entrega el evento una sola vez: se use o no, ya no sirve.
  evento = null
  avisar()
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'dismissed') descartarInstalar()
}

export function descartarInstalar(): void {
  try { localStorage.setItem(LS_DESCARTADO, String(Date.now())) } catch { /* sin storage: vuelve a preguntar */ }
  avisar()
}
