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

  const url = new URL(req.url)
  // pathname: /api/crm/events/[id]/registrations
  const segments = url.pathname.split('/')
  const id = segments[4]

  if (!id) {
    return json({ error: 'Event ID requerido' }, 400)
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase
    .from('ticket_registrations')
    .select('id, event_id, name, email, instagram, phone, registered_at, used_at, payment_verified, is_banned, price_per_ticket')
    .eq('event_id', id)
    .order('registered_at', { ascending: false })

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ registrations: data ?? [] })
}
