/**
 * Guardado de entradas en el dispositivo.
 *
 * Vive acá y no en la pantalla de registro porque desde que el QR de Mercado
 * Pago se entrega recién después de pagar, hay dos lugares que guardan:
 * /registro (transferencia) y /pago (retorno de MP). Con la lógica duplicada,
 * una de las dos iba a quedar con claves distintas de las que lee /mi-entrada.
 */

export interface TicketGuardado {
  token: string
  name: string
  event_name: string
  event_id: string
}

export const LS_TICKETS = (eventId: string) => `manso_tickets_${eventId}`
export const LS_TS = (eventId: string) => `manso_tickets_ts_${eventId}`
export const LS_END = (eventId: string) => `manso_tickets_end_${eventId}`
export const LS_EMAIL = 'manso_email'

/** Margen para eventos sin end_date: un show que arranca a la noche termina
 *  de madrugada, así que se lo da por terminado medio día después. */
const DURACION_SUPUESTA_MS = 12 * 60 * 60 * 1000

/**
 * Cuándo terminó (o termina) el evento, para purgar y ordenar las entradas.
 *
 * La mayoría de los eventos se cargan sin end_date. Sin esto, /mi-entrada
 * caía al momento en que la entrada se guardó en el dispositivo: al buscar
 * por mail se guardan todas las históricas de golpe, y los eventos viejos
 * aparecían arriba de todo, sin marcar como finalizados y sin purgarse.
 */
export function finDelEvento(e: {
  end_date?: string | null
  closed_at?: string | null
  start_date?: string | null
} | null | undefined): string | null {
  if (!e) return null
  if (e.end_date) return e.end_date
  if (e.closed_at) return e.closed_at
  if (e.start_date) return new Date(new Date(e.start_date).getTime() + DURACION_SUPUESTA_MS).toISOString()
  return null
}

export function tieneTickets(eventId: string): boolean {
  return !!localStorage.getItem(LS_TICKETS(eventId))
}

/**
 * Acumula en vez de reemplazar: desde que se puede comprar una segunda vez
 * para el mismo evento, pisar la clave borraría del dispositivo el QR de la
 * compra anterior. Se deduplica por token porque el registro es idempotente
 * y puede devolver entradas que ya estaban guardadas.
 */
export function guardarTickets(params: {
  eventId: string
  eventName: string
  endDate?: string | null
  email?: string
  tickets: { name: string; token: string }[]
}): void {
  const { eventId, eventName, endDate, email, tickets } = params
  if (tickets.length === 0) return

  const nuevos: TicketGuardado[] = tickets.map(t => ({
    token: t.token,
    name: t.name,
    event_name: eventName,
    event_id: eventId,
  }))

  let previos: TicketGuardado[] = []
  try {
    const raw = localStorage.getItem(LS_TICKETS(eventId))
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) previos = parsed
  } catch { /* dato corrupto: se descarta y quedan los nuevos */ }

  const porToken = new Map(previos.map(t => [t.token, t]))
  nuevos.forEach(t => porToken.set(t.token, t))

  localStorage.setItem(LS_TICKETS(eventId), JSON.stringify([...porToken.values()]))
  localStorage.setItem(LS_TS(eventId), Date.now().toString())
  if (endDate) localStorage.setItem(LS_END(eventId), endDate)
  if (email) localStorage.setItem(LS_EMAIL, email.trim().toLowerCase())
}
