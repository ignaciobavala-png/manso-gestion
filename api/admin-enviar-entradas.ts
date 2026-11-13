/// <reference types="node" />
import { adminClient, anonClient, json, resolverBaseUrl } from './_lib/registro'
import { enviarMailEntradas, FILTRO_VENDIDA } from './_lib/mailEntradas'

export const config = {
  runtime: 'edge'
}

// Botón "Enviar QR por mail" de Invitados (BLUR, Gestión). Lo usa el staff
// logueado para mandar de nuevo el mail con el QR a un comprador, sea porque
// no le llegó o porque lo perdió.
//
// POST { eventId, email } con Authorization: Bearer <sesión de Supabase>
//   → { enviadas } | { error }
//
// Reusa enviarMailEntradas (la única puerta de envío). Antes de llamarla
// limpia qr_mail_enviado_at de las entradas vendidas de ese comprador en ese
// evento, porque el envío reclama sólo las que tienen la marca en NULL.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const accessToken = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!accessToken) return json({ error: 'Sesión vencida. Volvé a entrar.' }, 401)

  // @ts-ignore — getUser(jwt) existe en runtime (mismo motivo que api/change-pin.ts)
  const { data: { user }, error: errUser } = await anonClient().auth.getUser(accessToken)
  if (errUser || !user) return json({ error: 'Sesión vencida. Volvé a entrar.' }, 401)

  let eventId = ''
  let email = ''
  try {
    const body = await req.json() as { eventId?: unknown; email?: unknown }
    eventId = typeof body.eventId === 'string' ? body.eventId : ''
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch { /* cae en la validación */ }
  if (!UUID.test(eventId)) return json({ error: 'Falta el evento.' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Falta el mail del comprador.' }, 400)

  const supabase = adminClient()

  // Sólo las entradas de Gestión que valen (espejo de reclamar): las de la web
  // las manda Club, y las no pagadas no reciben QR.
  const { error: errLimpiar } = await supabase
    .from('ticket_registrations')
    .update({ qr_mail_enviado_at: null })
    .eq('event_id', eventId)
    .eq('email', email)
    .eq('origen', 'gestion')
    .not('is_banned', 'is', true)
    .or(FILTRO_VENDIDA)
  if (errLimpiar) return json({ error: `No se pudo preparar el envío: ${errLimpiar.message}` }, 500)

  const r = await enviarMailEntradas(supabase, { eventId, email }, resolverBaseUrl(req))
  if ('error' in r) return json({ error: `No se pudo mandar el mail: ${r.error}` }, 502)
  if (r.enviadas === 0) return json({ error: 'No hay entradas vendidas de Gestión para ese mail en este evento.' }, 404)
  return json({ enviadas: r.enviadas }, 200)
}
