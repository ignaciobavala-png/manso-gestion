/// <reference types="node" />
import { json, registrarTickets, adminClient, resolverBaseUrl, type RegistroInput } from './_lib/registro'
import { enviarMailEntradas } from './_lib/mailEntradas'

export const config = {
  runtime: 'edge'
}

// Flujo de transferencia + comprobante. La validación y el alta de tickets
// viven en _lib/registro.ts, compartidas con el flujo de Mercado Pago.

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }

  const input = body as RegistroInput
  const result = await registrarTickets({
    ...input,
    payment_provider: 'transferencia',
    // Campos de MP: los pone sólo api/mp/preferencia.ts. Si vinieran del
    // body, una transferencia podía colgarse del external_reference de la
    // orden de otra persona y quedar acreditada cuando esa persona pagara.
    mp_external_reference: undefined,
    mp_expires_at: undefined,
  })

  if (!result.ok) {
    return json({ error: result.error }, result.status)
  }

  // Por transferencia la entrada se emite ya, así que el mail sale ya.
  // Se espera la respuesta (en edge, lo que queda corriendo después de
  // responder se puede cortar), pero un error de mail no cambia la respuesta.
  await enviarMailEntradas(
    adminClient(),
    { eventId: input.event_id, email: input.email },
    resolverBaseUrl(req)
  )

  return json({ tickets: result.tickets }, result.status)
}
