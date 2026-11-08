/// <reference types="node" />
import { adminClient } from './_lib/registro'
import { esUuid, responder } from './_lib/blur'

export const config = {
  runtime: 'edge',
}

// Activación del rollo de Analógica con el código de una ENTRADA.
//
//   GET  /api/blur-activar?d=<dispositivo>   → { requiere, activado }
//        La app lo pide al abrir la cámara para saber qué pantalla mostrar.
//   POST /api/blur-activar { d, codigo }     → { estado }
//        codigo = los 10 caracteres que se ven junto al QR, o el token entero
//        (link personal). Todo lo que decide vive en la función de la base
//        (migración 048, blur_activar_rollo): la entrada tiene que existir,
//        estar paga, no rechazada y HABER PASADO POR LA PUERTA.
//
// No se usa el mail: con un mail se compran varias entradas y no se sabría de
// quién es cada una. Nunca se devuelve nombre, mail ni token de la entrada.

/** Ventana y tope de intentos que NO activaron, por origen. */
const VENTANA_MIN = 10
const MAX_FALLIDOS = 60

async function hashIp(req: Request): Promise<string | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')
  if (!ip) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`blur-activar:${ip}`))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const supabase = adminClient()

    if (req.method === 'GET') {
      const d = new URL(req.url).searchParams.get('d')
      if (!esUuid(d)) return responder({ error: 'Falta el teléfono.' }, 400)
      const { data, error } = await supabase.rpc('blur_rollo_estado', { p_dispositivo: d })
      if (error) throw new Error(error.message)
      return responder(data)
    }

    if (req.method !== 'POST') return responder({ error: 'Method not allowed' }, 405)

    let body: { d?: unknown; codigo?: unknown }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return responder({ error: 'Body inválido' }, 400)
    }
    if (!esUuid(body.d) || typeof body.codigo !== 'string' || body.codigo.length > 80) {
      return responder({ estado: 'codigo_invalido' }, 400)
    }

    // Freno: cuenta los intentos fallidos del mismo origen en la ventana.
    const ipHash = await hashIp(req)
    if (ipHash) {
      const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString()
      const { count } = await supabase
        .from('blur_activaciones')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .neq('estado', 'activado')
        .gte('created_at', desde)
      if ((count ?? 0) >= MAX_FALLIDOS) {
        return responder({ estado: 'demasiados_intentos' }, 429)
      }
    }

    const { data, error } = await supabase.rpc('blur_activar_rollo', { p_dispositivo: body.d, p_codigo: body.codigo })
    if (error) throw new Error(error.message)
    const estado = (data as { estado?: string } | null)?.estado ?? 'error'

    await supabase.from('blur_activaciones').insert({ ip_hash: ipHash, estado })
    return responder({ estado })
  } catch (err) {
    console.error('[blur-activar]', err instanceof Error ? err.message : err)
    return responder({ error: 'No pudimos activar el rollo. Probá más tarde.' }, 500)
  }
}
