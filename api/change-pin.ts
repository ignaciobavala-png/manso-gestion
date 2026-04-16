import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge'
}

const CONTROL_EMAIL = 'control@manso.internal'
const EMPLEADO_EMAIL = 'empleado@manso.internal'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Verificar que viene un access token válido
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.replace('Bearer ', '').trim()
  if (!accessToken) {
    return json({ error: 'No autorizado' }, 401)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }

  const { role, newPin } = body as Record<string, string>

  if (!role || !newPin) {
    return json({ error: 'Datos incompletos' }, 400)
  }

  if (!/^\d{4}$/.test(newPin)) {
    return json({ error: 'El PIN debe ser de 4 dígitos' }, 400)
  }

  if (role !== 'control' && role !== 'empleado') {
    return json({ error: 'Rol inválido' }, 400)
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Cliente con anon key para validar el token del caller
  const anonClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data: { user: caller }, error: callerError } = await anonClient.auth.getUser(accessToken)

  if (callerError || !caller) {
    return json({ error: 'Token inválido' }, 401)
  }

  // Solo control puede cambiar PINs
  if (caller.email !== CONTROL_EMAIL) {
    return json({ error: 'Sin permisos' }, 403)
  }

  // Cliente admin para cambiar passwords
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Buscar el usuario target por email
  const targetEmail = role === 'control' ? CONTROL_EMAIL : EMPLEADO_EMAIL
  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 })

  if (listError) {
    return json({ error: 'Error al buscar usuarios' }, 500)
  }

  const target = users.find(u => u.email === targetEmail)
  if (!target) {
    return json({ error: 'Usuario no encontrado' }, 404)
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(target.id, {
    password: newPin
  })

  if (updateError) {
    return json({ error: 'Error al cambiar el PIN' }, 500)
  }

  return json({ ok: true }, 200)
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
