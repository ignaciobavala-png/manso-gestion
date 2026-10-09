/// <reference types="node" />
import { adminClient, json } from './_lib/registro'
import { mandar, FILTRO_VENDIDA, type FilaReclamada } from './_lib/mailEntradas'

export const config = {
  runtime: 'edge'
}

// "Buscar por email" de /mi-entrada. Antes la pantalla llamaba a
// get_my_tickets y mostraba los QR de cualquier email que alguien escribiera.
// Ahora los QR se MANDAN a ese email: quien escribe un email no prueba que
// sea suyo; quien abre la casilla sí (brain-data,
// identidad-sin-cuentas-token-y-mail). Ver la migración 041.
//
// La respuesta es siempre la misma y sale antes de mandar nada (waitUntil),
// haya entradas o no: ni el texto ni el tiempo de respuesta dicen si alguien
// compró.

/** Lo que ve la pantalla, haya o no entradas. */
const RESPUESTA = 'Si hay entradas con ese mail, te llegan en unos minutos.'

/** Resend free: 100 mails por día, compartidos con los de las entradas. */
const POR_EMAIL_HORA = 3
const POR_IP_HORA = 10
const MAILS_POR_DIA = 30
/** Un mail por evento; nadie tiene entradas vigentes para más que esto. */
const MAX_EVENTOS = 5
/** Por debajo del límite de 2 por segundo de Resend. */
const PAUSA_MS = 600

/** Mismo margen que finDelEvento (src/lib/entradasStorage.ts) para eventos
 *  sin end_date: un show de la noche termina de madrugada. */
const DURACION_SUPUESTA_MS = 12 * 60 * 60 * 1000

const HORA_MS = 60 * 60 * 1000
const DIA_MS = 24 * HORA_MS

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Contexto {
  waitUntil?: (p: Promise<unknown>) => void
}

interface FilaConEvento extends FilaReclamada {
  events: { start_date: string | null; end_date: string | null; closed_at: string | null }
}

export default async function handler(req: Request, ctx?: Contexto): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // El link del mail lleva los tokens: tiene que apuntar al dominio propio
  // y nunca al Origin del request, que lo elige quien llama. Sin la variable
  // no se manda nada.
  const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '')
  const apiKey = process.env.RESEND_API_KEY
  if (!baseUrl || !apiKey) {
    console.error('[reenviar-entradas] falta PUBLIC_BASE_URL o RESEND_API_KEY')
    return json({ error: 'No pudimos procesar el pedido. Probá más tarde.' }, 500)
  }

  let email = ''
  try {
    const body = await req.json() as { email?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch { /* body inválido: cae en la validación de abajo */ }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: 'Escribí un email válido.' }, 400)
  }

  const supabase = adminClient()
  const ipHash = await hashIp(req)
  const ahora = Date.now()
  const haceUnaHora = new Date(ahora - HORA_MS).toISOString()
  const haceUnDia = new Date(ahora - DIA_MS).toISOString()

  const [porEmail, porIp, delDia] = await Promise.all([
    supabase.from('entradas_reenvios').select('id', { count: 'exact', head: true })
      .eq('email', email).gte('created_at', haceUnaHora),
    ipHash
      ? supabase.from('entradas_reenvios').select('id', { count: 'exact', head: true })
          .eq('ip_hash', ipHash).gte('created_at', haceUnaHora)
      : Promise.resolve({ count: 0, error: null }),
    supabase.from('entradas_reenvios').select('enviados').gte('created_at', haceUnDia),
  ])
  if (porEmail.error || porIp.error || delDia.error) {
    console.error('[reenviar-entradas] freno:', porEmail.error ?? porIp.error ?? delDia.error)
    return json({ error: 'No pudimos procesar el pedido. Probá más tarde.' }, 500)
  }

  // El freno habla de pedidos, no de entradas: decir "esperá" no revela si
  // ese email compró algo.
  if ((porEmail.count ?? 0) >= POR_EMAIL_HORA || (porIp.count ?? 0) >= POR_IP_HORA) {
    return json({ error: 'Ya pediste varias veces. Probá de nuevo en una hora.' }, 429)
  }
  const mailsDelDia = (delDia.data ?? []).reduce((acc, r) => acc + (r.enviados ?? 0), 0)
  if (mailsDelDia >= MAILS_POR_DIA) {
    return json({ error: 'No podemos mandar más mails por hoy. Probá mañana.' }, 429)
  }

  // Se anota antes de responder, así un segundo pedido inmediato ya lo cuenta.
  const { data: pedido, error: errPedido } = await supabase
    .from('entradas_reenvios')
    .insert({ email, ip_hash: ipHash })
    .select('id')
    .single<{ id: number }>()
  if (errPedido || !pedido) {
    console.error('[reenviar-entradas] no se pudo anotar el pedido:', errPedido)
    return json({ error: 'No pudimos procesar el pedido. Probá más tarde.' }, 500)
  }

  const trabajo = reenviar(email, pedido.id, baseUrl, apiKey, MAILS_POR_DIA - mailsDelDia)
    .catch(err => console.error('[reenviar-entradas]', err instanceof Error ? err.message : err))

  // En Vercel edge, waitUntil deja terminar el envío después de responder.
  // Sin él (dev local), se espera: el texto sigue siendo el mismo.
  if (ctx?.waitUntil) ctx.waitUntil(trabajo)
  else await trabajo

  return json({ mensaje: RESPUESTA }, 200)
}

async function reenviar(email: string, pedidoId: number, baseUrl: string, apiKey: string, cupoDelDia: number): Promise<void> {
  const supabase = adminClient()

  // Vendidas (espejo de entrada_vendida, como el resto de los mails), de
  // Gestión y de la web: son de la persona y es el mismo QR.
  const { data, error } = await supabase
    .from('ticket_registrations')
    .select('id, name, token, email, event_id, events!inner(start_date, end_date, closed_at)')
    .eq('email', email)
    .not('is_banned', 'is', true)
    .or(FILTRO_VENDIDA)
    .is('events.closed_at', null)
    .order('registered_at')
  if (error) throw new Error(`buscar: ${error.message}`)

  const ahora = Date.now()
  const porEvento = new Map<string, FilaReclamada[]>()
  for (const f of (data ?? []) as unknown as FilaConEvento[]) {
    if (terminado(f.events, ahora)) continue
    const grupo = porEvento.get(f.event_id) ?? []
    grupo.push({ id: f.id, name: f.name, token: f.token, email: f.email, event_id: f.event_id })
    porEvento.set(f.event_id, grupo)
  }

  const grupos = [...porEvento.values()].slice(0, Math.min(MAX_EVENTOS, cupoDelDia))
  let enviados = 0
  for (const filas of grupos) {
    if (enviados > 0) await esperar(PAUSA_MS)
    try {
      await mandar(supabase, filas, apiKey, baseUrl, 'reenvio')
      enviados++
    } catch (err) {
      console.error('[reenviar-entradas] mandar:', err instanceof Error ? err.message : err)
    }
  }

  if (enviados > 0) {
    await supabase.from('entradas_reenvios').update({ enviados }).eq('id', pedidoId)
  }
}

/** Mismo criterio que finDelEvento: end_date, o el inicio más 12 h. Un
 *  evento sin fecha cuenta como vigente mientras no se cierre. */
function terminado(ev: FilaConEvento['events'], ahora: number): boolean {
  if (ev.end_date) return new Date(ev.end_date).getTime() < ahora
  if (ev.start_date) return new Date(ev.start_date).getTime() + DURACION_SUPUESTA_MS < ahora
  return false
}

/** SHA-256 del IP del cliente. null si no viene (no debería pasar en Vercel). */
async function hashIp(req: Request): Promise<string | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')
  if (!ip) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`manso-reenvio:${ip}`))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
