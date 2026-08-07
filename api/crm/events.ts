/// <reference types="node" />
import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge'
}

const CORS_ORIGIN = 'https://manso-club.vercel.app'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': CORS_ORIGIN,
    }
  })
}

export default async function handler(req: Request): Promise<Response> {
  const secret = req.headers.get('x-crm-secret')
  if (!secret || secret !== process.env.CRM_SECRET) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Access-Control-Allow-Origin': CORS_ORIGIN }
    })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [eventsResult, regIdsResult, ticketIdsResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, description, slug, start_date, end_date, is_active, registrations_open, max_capacity, regular_ticket_price, invited_ticket_price, is_paid, is_private, flyer_url, ticket_alias_pago')
      .order('start_date', { ascending: false }),
    supabase
      .from('ticket_registrations')
      .select('event_id, is_banned, payment_provider, payment_verified'),
    supabase
      .from('ticket_sales')
      .select('event_id'),
  ])

  if (eventsResult.error) {
    return json({ error: eventsResult.error.message }, 500)
  }

  // registrations_count son entradas vendidas, no filas: una rechazada con
  // "Rechazar QR" o un pago de Mercado Pago que nunca se acreditó no es una
  // venta y el CRM no puede reportarla como tal (ver migración 020).
  const regCounts = new Map<string, number>()
  for (const row of regIdsResult.data ?? []) {
    const vendida = !row.is_banned &&
      (row.payment_provider !== 'mercadopago' || row.payment_verified)
    if (!vendida) continue
    regCounts.set(row.event_id, (regCounts.get(row.event_id) ?? 0) + 1)
  }

  const ticketCounts = new Map<string, number>()
  for (const row of ticketIdsResult.data ?? []) {
    ticketCounts.set(row.event_id, (ticketCounts.get(row.event_id) ?? 0) + 1)
  }

  const events = (eventsResult.data ?? []).map(event => ({
    ...event,
    registrations_count: regCounts.get(event.id) ?? 0,
    ticket_sales_count: ticketCounts.get(event.id) ?? 0,
  }))

  return json({ events })
}
