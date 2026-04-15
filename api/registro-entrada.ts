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

  const { data, error } = await supabase
    .from('ticket_registrations')
    .insert({
      event_id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
    })
    .select('token')
    .single()

  if (error) {
    // Violación de unique(email, event_id)
    if (error.code === '23505') {
      return json({ error: 'ya_registrado' }, 409)
    }
    return json({ error: 'Error al registrar' }, 500)
  }

  return json({ token: data.token }, 201)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
