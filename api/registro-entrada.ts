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

  const { attendees, email, event_id, receipt_url } = body as RequestBody

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

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, is_active, registrations_open, max_capacity')
    .eq('id', event_id)
    .single()

  if (eventError || !event) {
    return json({ error: 'Evento no encontrado' }, 404)
  }

  if (!event.is_active) {
    return json({ error: 'El evento ya no está activo' }, 409)
  }

  if (!event.registrations_open) {
    return json({ error: 'El registro de entradas está pausado momentáneamente' }, 503)
  }

  if (event.max_capacity !== null) {
    const { count, error: countError } = await supabase
      .from('ticket_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)

    if (!countError && count !== null && count + names.length > event.max_capacity) {
      return json({ error: 'No hay suficiente capacidad disponible' }, 409)
    }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const receipt = receipt_url?.trim() || null

  // Fetch already-registered names for this email+event to avoid duplicates
  const { data: existing } = await supabase
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
