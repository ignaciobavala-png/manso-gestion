/// <reference types="node" />
import { json, registrarTickets, adminClient, type RegistroInput } from '../_lib/registro'
import { createPreference, type PreferenceItem } from '../_lib/mp'

export const config = {
  runtime: 'edge'
}

// Minutos que la preference queda vigente. Pasado ese plazo MP no deja pagar
// y el ticket queda como pendiente hasta que alguien del staff lo resuelva.
const EXPIRA_EN_MINUTOS = 30

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!process.env.MP_ACCESS_TOKEN) {
    return json({ error: 'Mercado Pago no está configurado' }, 503)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }

  const input = body as RegistroInput
  const externalReference = `manso-${crypto.randomUUID()}`

  // Se crean los tickets primero: el QR se entrega igual que en el flujo de
  // transferencia, con payment_verified en false. El escáner ya distingue
  // "Pendiente" de "Verificado", así que un pago abandonado no pasa inadvertido.
  const result = await registrarTickets({
    ...input,
    payment_provider: 'mercadopago',
    mp_external_reference: externalReference,
  })

  if (!result.ok) {
    return json({ error: result.error }, result.status)
  }

  const { event, tickets } = result

  if (event.payment_mode !== 'mercadopago' && event.payment_mode !== 'ambos') {
    return json({ error: 'Este evento no acepta pagos con Mercado Pago' }, 409)
  }

  if (!event.is_paid || event.regular_ticket_price <= 0) {
    return json({ error: 'Este evento no tiene un precio configurado' }, 409)
  }

  // registrarTickets ya guardó el precio base desde la DB. Acá se recalcula
  // con el recargo, que sólo aplica al pagar con MP.
  const surcharge = Number(event.mp_surcharge_pct) || 0
  const unitPrice = redondear(event.regular_ticket_price * (1 + surcharge / 100))

  const admin = adminClient()

  // registrarTickets es idempotente: si estos nombres ya estaban registrados
  // devuelve los tokens existentes SIN tocarles el mp_external_reference. Sin
  // este paso, un segundo intento de pago (volver atrás, reintentar, doble
  // click) creaba una preference con un external_reference que no apuntaba a
  // ningún ticket: MP cobraba, mp_apply_payment no encontraba filas y devolvía
  // 0 sin error. Plata cobrada, entrada sin acreditar, nadie se entera.
  // Por eso la orden se arma acá por token, que sí cubre nuevos y existentes.
  const { data: filas, error: filasError } = await admin
    .from('ticket_registrations')
    .select('token, payment_verified')
    .in('token', tickets.map(t => t.token))

  if (filasError || !filas) {
    return json({ error: 'No se pudo preparar la orden' }, 500)
  }

  const yaPagos = new Set(filas.filter(f => f.payment_verified).map(f => f.token))
  const pendientes = tickets.filter(t => !yaPagos.has(t.token))

  // Cobrar de nuevo una entrada ya acreditada sería un cobro duplicado.
  if (pendientes.length === 0) {
    return json({ error: 'Estas entradas ya están pagadas', tickets }, 409)
  }

  const { error: updateError } = await admin
    .from('ticket_registrations')
    .update({
      mp_external_reference: externalReference,
      payment_provider: 'mercadopago',
      // price_per_ticket guarda el precio realmente cobrado (con recargo), para
      // que los reportes de ingresos cierren contra lo que pasó por MP.
      price_per_ticket: unitPrice,
    })
    .in('token', pendientes.map(t => t.token))

  if (updateError) {
    return json({ error: 'No se pudo preparar la orden' }, 500)
  }

  const items: PreferenceItem[] = pendientes.map(t => ({
    id: t.token,
    title: `${event.name} — ${t.name}`,
    quantity: 1,
    unit_price: unitPrice,
    currency_id: 'ARS',
  }))

  const totalPreference = redondear(items.reduce((acc, i) => acc + i.unit_price * i.quantity, 0))
  const totalEsperado = redondear(unitPrice * pendientes.length)

  // Guardarraíl: lo que MP va a cobrar tiene que ser exactamente lo que
  // queda guardado en la DB. Si esto se desalinea no falla nada visible —
  // simplemente se cobra de más o de menos, y sólo se descubre conciliando.
  if (totalPreference !== totalEsperado) {
    return json({ error: 'Error de consistencia en el monto' }, 500)
  }

  const baseUrl = resolverBaseUrl(req)
  const expiresAt = new Date(Date.now() + EXPIRA_EN_MINUTOS * 60_000)

  let preference
  try {
    preference = await createPreference({
      items,
      externalReference,
      payerEmail: input.email.trim().toLowerCase(),
      baseUrl,
      expiresAt,
      metadata: { event_id: event.id, event_name: event.name },
    })
  } catch (err) {
    return json({
      error: 'No se pudo iniciar el pago. Probá de nuevo.',
      detail: err instanceof Error ? err.message : String(err),
    }, 502)
  }

  await admin
    .from('ticket_registrations')
    .update({ mp_preference_id: preference.id })
    .eq('mp_external_reference', externalReference)

  return json({
    init_point: preference.init_point,
    preference_id: preference.id,
    external_reference: externalReference,
    unit_price: unitPrice,
    total: totalPreference,
    tickets,
  }, 201)
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * URL pública de este deploy, para armar back_urls y notification_url.
 * Se prefiere una env explícita porque en Vercel la URL del request puede
 * ser la interna del deploy y no el dominio que ve el usuario.
 */
function resolverBaseUrl(req: Request): string {
  const explicita = process.env.PUBLIC_BASE_URL
  if (explicita) return explicita.replace(/\/$/, '')

  const origin = req.headers.get('origin')
  if (origin) return origin.replace(/\/$/, '')

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (host) return `https://${host}`

  return new URL(req.url).origin
}
