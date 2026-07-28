/// <reference types="node" />
import { json, registrarTickets, type RegistroInput } from './_lib/registro'

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
  })

  if (!result.ok) {
    return json({ error: result.error }, result.status)
  }

  return json({ tickets: result.tickets }, result.status)
}
