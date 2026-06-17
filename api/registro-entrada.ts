/// <reference types="node" />
import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge'
}

interface Attendee {
  name: string
}

interface RequestBody {
  attendees: Attendee[]
  email: string
  event_id: string
  receipt_url?: string
  private_token?: string
  instagram?: string
  phone?: string
}

interface TicketResult {
  name: string
  token: string
}

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

  const { attendees, email, event_id, receipt_url, private_token, instagram, phone } = body as RequestBody

  if (!email?.trim() || !event_id || !attendees?.length) {
    return json({ error: 'Datos incompletos' }, 400)
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Email inválido' }, 400)
  }

  const names = attendees
    .map(a => a.name?.trim())
    .filter(n => n.length > 0)

  if (names.length === 0) {
    return json({ error: 'Ingresá al menos un nombre' }, 400)
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  )

  // Cliente admin para SELECTs internos — la política pública SELECT fue removida
  const adminSupabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, closed_at, registrations_open, max_capacity, is_private, private_token, one_ticket_per_email, require_instagram, require_phone')
    .eq('id', event_id)
    .single()

  if (eventError || !event) {
    return json({ error: 'Evento no encontrado' }, 404)
  }

  if (event.closed_at) {
    return json({ error: 'El evento ya finalizó' }, 409)
  }

  if (!event.registrations_open) {
    return json({ error: 'El registro de entradas está pausado momentáneamente' }, 503)
  }

  if (event.is_private && event.private_token !== private_token) {
    return json({ error: 'Acceso no autorizado' }, 403)
  }

  if (event.max_capacity !== null) {
    const { count, error: countError } = await adminSupabase
      .from('ticket_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .eq('is_banned', false)

    if (!countError && count !== null && count + names.length > event.max_capacity) {
      return json({ error: 'No hay suficiente capacidad disponible' }, 409)
    }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const receipt = receipt_url?.trim() || null

  // Fetch already-registered names for this email+event to avoid duplicates
  // (also used for one_ticket_per_email validation)
  const { data: existing } = await adminSupabase
    .from('ticket_registrations')
    .select('name, token')
    .eq('event_id', event_id)
    .eq('email', normalizedEmail)

  const existingMap = new Map(
    (existing ?? []).map(r => [r.name.toLowerCase().trim(), r.token])
  )

  const newNames = names.filter(n => !existingMap.has(n.toLowerCase()))
  const tickets: TicketResult[] = names
    .filter(n => existingMap.has(n.toLowerCase()))
    .map(n => ({ name: n, token: existingMap.get(n.toLowerCase())! }))

  if (event.require_instagram && !instagram?.trim()) {
    return json({ error: 'El Instagram es obligatorio para este evento' }, 400)
  }

  if (event.require_phone && !phone?.trim()) {
    return json({ error: 'El teléfono es obligatorio para este evento' }, 400)
  }

  if (event.one_ticket_per_email && (existing ?? []).length > 0) {
    return json({ error: 'Este email ya tiene una entrada registrada para este evento' }, 409)
  }

  // All names already registered → idempotent response, nothing inserted
  if (newNames.length === 0) {
    return json({ tickets }, 200)
  }

  for (const name of newNames) {
    const token = crypto.randomUUID()

    const { error } = await supabase
      .from('ticket_registrations')
      .insert({
        event_id,
        name,
        email: normalizedEmail,
        token,
        receipt_url: receipt,
        instagram: instagram?.trim() || null,
        phone: phone?.trim() || null,
      })

    if (error) {
      return json({ error: 'Error al registrar' }, 500)
    }

    tickets.push({ name, token })
  }

  return json({ tickets }, 201)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
