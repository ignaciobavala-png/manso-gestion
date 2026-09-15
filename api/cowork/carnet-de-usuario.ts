/// <reference types="node" />
import { createClient } from '@supabase/supabase-js'

/**
 * El carnet de un usuario de manso.club, pedido por la pagina.
 *
 * Es la contracara de /api/cowork/llave: el llavero le devuelve el token de
 * la credencial de una persona para que la pagina se lo pueda mostrar en
 * /mi-cuenta sin pedirle login al cowork. El navegador nunca ve el service
 * role; el `pagina_user_id` viaja porque la pagina lo resolvio antes con la
 * sesion del usuario, del lado del servidor.
 */

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

interface CarnetBody {
  /** auth.users.id de manso.club. */
  pagina_user_id?: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-crm-secret',
      }
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo no permitido' }, 405)
  }

  const secret = req.headers.get('x-crm-secret')
  if (!secret || secret !== process.env.CRM_SECRET) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Access-Control-Allow-Origin': CORS_ORIGIN }
    })
  }

  let body: CarnetBody
  try {
    body = await req.json() as CarnetBody
  } catch {
    return json({ error: 'Body invalido' }, 400)
  }

  if (!body.pagina_user_id) {
    return json({ error: 'Falta pagina_user_id' }, 400)
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Sin persona no hay carnet, y no es un error: hay usuarios del club que
  // todavia no compraron nada del cowork. La pagina lo trata como ausencia,
  // no como falla, por eso devuelve 200 con `carnet: null`.
  const { data: persona, error: errorPersona } = await supabase
    .from('cowork_personas')
    .select('id, nombre')
    .eq('pagina_user_id', body.pagina_user_id)
    .limit(1)
    .maybeSingle()

  if (errorPersona) return json({ error: errorPersona.message }, 500)
  if (!persona) return json({ carnet: null })

  // El token es un bearer: con el se abre /c/<token>. Una credencial revocada
  // no tiene que llegar nunca al usuario, asi que se filtra acá y no en la
  // pantalla.
  const { data: credencial, error: errorCredencial } = await supabase
    .from('cowork_credenciales')
    .select('token')
    .eq('persona_id', persona.id)
    .eq('soporte', 'qr')
    .is('revocada_at', null)
    .limit(1)
    .maybeSingle()

  if (errorCredencial) return json({ error: errorCredencial.message }, 500)
  if (!credencial) return json({ carnet: null })

  return json({ carnet: { token: credencial.token, nombre: persona.nombre } })
}
