/// <reference types="node" />
import { json, adminClient } from '../_lib/registro'
import { getPayment, applyPayment, verifyWebhookSignature } from '../_lib/mp'

export const config = {
  runtime: 'edge'
}

// Notificaciones de Mercado Pago (tópico "payment").
//
// Regla central: el body de la notificación NUNCA se usa como fuente de
// verdad, sólo para sacar el payment_id. El estado real se vuelve a pedir a
// la API de MP con nuestro access token. Por eso el webhook es seguro incluso
// sin MP_WEBHOOK_SECRET configurado — la firma es una capa extra, no la que
// sostiene la seguridad.
//
// MP espera 200/201 dentro de 22 segundos; si devolvemos error, reintenta.
// Devolvemos 200 para todo lo que no tiene sentido reintentar, y 5xx sólo
// cuando un reintento podría andar.

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(req.url)

  let body: { type?: string; action?: string; data?: { id?: string } } = {}
  try {
    body = await req.json() as typeof body
  } catch {
    // MP a veces notifica sin body útil; los datos vienen por query string.
  }

  // El id llega por query (?type=payment&data.id=123) o por body, según el caso.
  const dataId =
    url.searchParams.get('data.id') ??
    url.searchParams.get('id') ??
    body.data?.id ??
    ''

  const tipo = body.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''

  // Sólo interesa el tópico de pagos. El resto se acepta y se descarta, para
  // que MP no quede reintentando notificaciones que nunca vamos a procesar.
  if (tipo && tipo !== 'payment') {
    return json({ ignored: tipo }, 200)
  }

  if (!dataId) {
    return json({ error: 'Falta data.id' }, 200)
  }

  const firma = await verifyWebhookSignature(req, dataId)
  if (firma === 'invalid') {
    // Con secret configurado, una firma que no cierra es un rechazo duro.
    return json({ error: 'Firma inválida' }, 401)
  }

  try {
    const payment = await getPayment(dataId)

    if (!payment) {
      return json({ error: 'Pago inexistente', payment_id: dataId }, 200)
    }

    if (!payment.external_reference) {
      // Pago de esta cuenta que no salió de esta app (ej. otro sistema de Ana).
      return json({ ignored: 'sin external_reference', payment_id: dataId }, 200)
    }

    const supabase = adminClient()
    const afectados = await applyPayment(supabase, payment)

    return json({
      ok: true,
      payment_id: String(payment.id),
      status: payment.status,
      tickets_actualizados: afectados,
      firma,
    }, 200)
  } catch (err) {
    // 500 a propósito: le pedimos a MP que reintente. Sirve para caídas
    // transitorias de la API de MP o de Supabase.
    return json({
      error: 'Error procesando la notificación',
      detail: err instanceof Error ? err.message : String(err),
    }, 500)
  }
}
