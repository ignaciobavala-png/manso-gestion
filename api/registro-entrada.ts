import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge'
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

  const { name, email, event_id } = body as Record<string, string>

  if (!name?.trim() || !email?.trim() || !event_id) {
    return json({ error: 'Datos incompletos' }, 400)
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Email inválido' }, 400)
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  )

  // Verificar que el evento existe, está activo y tiene registros abiertos
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

  // Verificar capacidad máxima si está configurada
  if (event.max_capacity !== null) {
    const { count, error: countError } = await supabase
      .from('ticket_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)

    if (!countError && count !== null && count >= event.max_capacity) {
      return json({ error: 'El evento alcanzó su capacidad máxima' }, 409)
    }
  }

  const token = crypto.randomUUID()

  const { error } = await supabase
    .from('ticket_registrations')
    .insert({
      event_id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      token,
    })

  if (error) {
    if (error.code === '23505') {
      return json({ error: 'ya_registrado' }, 409)
    }
    return json({ error: 'Error al registrar' }, 500)
  }

  return json({ token }, 201)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
