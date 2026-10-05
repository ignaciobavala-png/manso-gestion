/**
 * Guardado de entradas en el dispositivo.
 *
 * Vive acá y no en la pantalla de registro porque desde que el QR de Mercado
 * Pago se entrega recién después de pagar, hay dos lugares que guardan:
 * /registro (transferencia) y /pago (retorno de MP). Con la lógica duplicada,
 * una de las dos iba a quedar con claves distintas de las que lee /mi-entrada.
 */

import { supabase } from './supabase'

export interface TicketGuardado {
  token: string
  name: string
  event_name: string
  event_id: string
  /** Cuándo empieza el evento. Viaja con la entrada para que el QR diga la
   *  fecha aun sin conexión. Las guardadas antes de este campo no lo tienen
   *  (undefined) y /mi-entrada lo completa; null es un evento sin fecha. */
  event_start?: string | null
  /** end_date tal cual está en el evento (casi siempre null). Para el
   *  calendario; no confundir con finDelEvento, que es para purgar. */
  event_end?: string | null
  /** La dirección ya resuelta (la del evento o la de Manso). Mismo criterio
   *  que event_start: undefined = guardada antes de existir el campo. */
  event_address?: string | null
}

/** Lo del evento que viaja con cada entrada guardada. */
export interface InfoEvento {
  start: string | null
  end: string | null
  direccion: string | null
}

/** La dirección de un evento: la suya si la tiene, si no la de Manso.
 *  Vacía en los dos lados es null y no se muestra nada. El servidor tiene
 *  la misma regla en api/_lib/mailEntradas.ts para los mails. */
export function direccionDelEvento(propia: string | null | undefined, general: string | null | undefined): string | null {
  return propia?.trim() || general?.trim() || null
}

export function urlMaps(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`
}

/**
 * Nombre, datos para la entrada y fin (para purgar) de varios eventos, con
 * la dirección ya resuelta. Una consulta por tabla, no una por evento.
 */
export async function infoEventos(ids: string[]): Promise<Map<string, { name: string; info: InfoEvento; fin: string | null }>> {
  const mapa = new Map<string, { name: string; info: InfoEvento; fin: string | null }>()
  if (ids.length === 0) return mapa
  const [{ data: evs }, { data: venue }] = await Promise.all([
    supabase.from('events').select('id, name, start_date, end_date, closed_at, direccion').in('id', ids),
    supabase.from('venue_config').select('direccion').eq('id', 1).single(),
  ])
  for (const ev of evs ?? []) {
    mapa.set(ev.id, {
      name: ev.name,
      info: {
        start: ev.start_date ?? null,
        end: ev.end_date ?? null,
        direccion: direccionDelEvento(ev.direccion, venue?.direccion),
      },
      fin: finDelEvento(ev),
    })
  }
  return mapa
}

/** La mayoría de los eventos no tiene hora de fin: en el calendario se
 *  agenda de 6 horas, que para una noche (20 a 2) es lo esperable. */
const DURACION_CALENDARIO_MS = 6 * 60 * 60 * 1000

function icsFecha(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsTexto(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

/** Baja un .ics con el evento. El teléfono lo abre en su calendario con todo
 *  cargado: no hace falta cuenta de Google ni permisos. */
export function descargarCalendario(t: TicketGuardado, urlEntrada: string): void {
  if (!t.event_start) return
  const inicio = new Date(t.event_start)
  const fin = t.event_end ? new Date(t.event_end) : new Date(inicio.getTime() + DURACION_CALENDARIO_MS)
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Manso//Entradas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${t.token}@mansoclub.com.ar`,
    `DTSTAMP:${icsFecha(new Date())}`,
    `DTSTART:${icsFecha(inicio)}`,
    `DTEND:${icsFecha(fin)}`,
    `SUMMARY:${icsTexto(t.event_name)}`,
    ...(t.event_address ? [`LOCATION:${icsTexto(t.event_address)}`] : []),
    `DESCRIPTION:${icsTexto(`Tu entrada (QR): ${urlEntrada}\nEntrada a nombre de ${t.name}.`)}`,
    `URL:${urlEntrada}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsTexto(t.event_name)}`,
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lineas.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `manso-${t.event_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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

/** La fecha del evento como la dice el mail de la entrada: "sábado, 10 de
 *  octubre · 20:00 h". Hora de Argentina fija, que es donde está la puerta,
 *  aunque el teléfono esté configurado en otra zona. */
export function fechaEntrada(iso: string): string {
  const f = new Date(iso)
  const dia = f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })
  const hora = f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
  return `${dia} · ${hora} h`
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
  info: InfoEvento
  endDate?: string | null
  email?: string
  tickets: { name: string; token: string }[]
}): void {
  const { eventId, eventName, info, endDate, email, tickets } = params
  if (tickets.length === 0) return

  const nuevos: TicketGuardado[] = tickets.map(t => ({
    token: t.token,
    name: t.name,
    event_name: eventName,
    event_id: eventId,
    event_start: info.start,
    event_end: info.end,
    event_address: info.direccion,
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
