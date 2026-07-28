/// <reference types="node" />
import { json, adminClient } from '../_lib/registro'
import { searchPaymentsByReference, pickRelevantPayment, applyPayment } from '../_lib/mp'

export const config = {
  runtime: 'edge'
}

// Estado de una orden, consultando MP en vivo.
//
// Este es el camino que NO depende del webhook: lo usa la pantalla de retorno
// después de pagar, y también el botón "Revisar en MP" del admin. Si el
// webhook nunca se configuró o la notificación se perdió, esto igual
// resuelve el estado real y deja los tickets verificados.

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const ref = new URL(req.url).searchParams.get('ref')?.trim()
  if (!ref) {
    return json({ error: 'Falta el parámetro ref' }, 400)
  }

  const supabase = adminClient()

  const { data: registros, error } = await supabase
    .from('ticket_registrations')
    .select('token, name, payment_verified, mp_status, event_id')
    .eq('mp_external_reference', ref)

  if (error) {
    return json({ error: 'Error consultando la orden' }, 500)
  }

  if (!registros || registros.length === 0) {
    return json({ error: 'Orden no encontrada' }, 404)
  }

  // Atajo: si ya está verificada, no hace falta molestar a MP.
  if (registros.every(r => r.payment_verified)) {
    return json({
      status: 'approved',
      verified: true,
      tickets: registros.map(r => ({ token: r.token, name: r.name })),
    }, 200)
  }

  if (!process.env.MP_ACCESS_TOKEN) {
    return json({
      status: registros[0].mp_status ?? 'pending',
      verified: false,
      tickets: registros.map(r => ({ token: r.token, name: r.name })),
    }, 200)
  }

  try {
    const pagos = await searchPaymentsByReference(ref)
    const pago = pickRelevantPayment(pagos)

    if (!pago) {
      return json({
        status: 'pending',
        verified: false,
        tickets: registros.map(r => ({ token: r.token, name: r.name })),
      }, 200)
    }

    await applyPayment(supabase, pago)

    return json({
      status: pago.status,
      status_detail: pago.status_detail ?? null,
      verified: pago.status === 'approved',
      payment_id: String(pago.id),
      tickets: registros.map(r => ({ token: r.token, name: r.name })),
    }, 200)
  } catch (err) {
    // La orden existe; lo que falló fue la consulta a MP. Se devuelve el
    // estado local para que la UI pueda seguir mostrando algo coherente.
    return json({
      status: registros[0].mp_status ?? 'pending',
      verified: false,
      error: 'No se pudo consultar Mercado Pago',
      detail: err instanceof Error ? err.message : String(err),
      tickets: registros.map(r => ({ token: r.token, name: r.name })),
    }, 200)
  }
}
