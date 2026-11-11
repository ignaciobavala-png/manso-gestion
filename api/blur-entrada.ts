/// <reference types="node" />
import { adminClient } from './_lib/registro'
import { responder } from './_lib/blur'

export const config = {
  runtime: 'edge',
}

// Recuperar "Mi entrada" en la app de BLUR cuando el teléfono no reconoce el
// token (Safari que borró el almacenamiento, link abierto desde el navegador
// de Instagram/WhatsApp, teléfono nuevo).
//
//   POST /api/blur-entrada { codigo } → { estado, tokens? }
//
// codigo = los 10 caracteres que se ven junto al QR, el token entero, o el
// link personal pegado tal cual (`…#t=<token>`). Mismo criterio que
// blur_activar_rollo (migración 048): el código ES un pedazo del token, o sea
// el secreto; el mail no lo es (identidad-sin-cuentas-token-y-mail).
//
//   ok · codigo_invalido · no_encontrada · ambiguo · demasiados_intentos
//
// Solo devuelve el token de LA entrada que se nombró: nunca las de un mail ni
// las otras de un pack (esas pueden estar regaladas a otras personas).
// Sin migración: se compara en el servidor contra las entradas de los
// eventos BLUR (unos pocos cientos de filas).

const VENTANA_MIN = 10
const MAX_FALLIDOS = 30
const PAGINA = 1000
const MAX_PAGINAS = 5

async function hashIp(req: Request): Promise<string | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')
  if (!ip) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`blur-entrada:${ip}`))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Lo que escribió la persona → solo letras y números en mayúscula, sacando el link si lo pegó entero. */
function normalizar(crudo: string): string {
  const deLink = /[#?&]t=([^&\s]+)/.exec(crudo)?.[1] ?? crudo
  // Un link de varias entradas (`t=a,b,c`) trae más de un token: no se adivina cuál.
  const primero = deLink.split(',')[0] ?? ''
  return primero.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return responder({ error: 'Method not allowed' }, 405)
  try {
    let body: { codigo?: unknown }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return responder({ estado: 'codigo_invalido' }, 400)
    }
    if (typeof body.codigo !== 'string' || body.codigo.length > 200) {
      return responder({ estado: 'codigo_invalido' }, 400)
    }
    const cod = normalizar(body.codigo)
    // 10 caracteres (el código corto) o 32 (el token entero sin guiones).
    if (cod.length !== 10 && cod.length !== 32) return responder({ estado: 'codigo_invalido' }, 400)

    const supabase = adminClient()

    // Freno por origen: cuenta solo los intentos que NO encontraron nada.
    const ipHash = await hashIp(req)
    if (ipHash) {
      const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString()
      const { count } = await supabase
        .from('blur_activaciones')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .eq('estado', 'cuenta_fallo')
        .gte('created_at', desde)
      if ((count ?? 0) >= MAX_FALLIDOS) return responder({ estado: 'demasiados_intentos' }, 429)
    }

    const { data: eventos, error: errEv } = await supabase.from('events').select('id').ilike('name', 'BLUR%')
    if (errEv) throw new Error(errEv.message)
    const ids = (eventos ?? []).map((e) => e.id as string)

    const coincidencias: string[] = []
    for (let p = 0; p < MAX_PAGINAS && ids.length > 0; p++) {
      const { data, error } = await supabase
        .from('ticket_registrations')
        .select('token')
        .in('event_id', ids)
        .not('is_banned', 'is', true)
        .order('id')
        .range(p * PAGINA, (p + 1) * PAGINA - 1)
      if (error) throw new Error(error.message)
      const filas = (data ?? []) as { token: string }[]
      for (const f of filas) {
        const plano = f.token.replace(/-/g, '').toUpperCase()
        if (cod.length === 32 ? plano === cod : plano.slice(0, 10) === cod) coincidencias.push(f.token)
      }
      if (filas.length < PAGINA) break
    }

    const estado = coincidencias.length === 1 ? 'ok' : coincidencias.length === 0 ? 'no_encontrada' : 'ambiguo'
    await supabase.from('blur_activaciones').insert({ ip_hash: ipHash, estado: estado === 'ok' ? 'cuenta_ok' : 'cuenta_fallo' })
    return responder(estado === 'ok' ? { estado, tokens: coincidencias } : { estado })
  } catch (err) {
    console.error('[blur-entrada]', err instanceof Error ? err.message : err)
    return responder({ error: 'No pudimos buscar la entrada. Probá más tarde.' }, 500)
  }
}
