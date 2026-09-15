/// <reference types="node" />
import { createClient } from '@supabase/supabase-js'

/**
 * Emision de llaves de cowork desde manso.club.
 *
 * Gestion es la duena de la llave y la pagina le avisa: cuando un admin
 * activa o cancela una membresia en el panel de manso.club, esa pantalla
 * pega acá. Es la vuelta del puente que ya existia (la pagina leyendo
 * /api/crm/*), con el mismo mecanismo de secreto compartido.
 *
 * Idempotente por `ref`: reintentar no duplica llaves, y volver a mandar
 * la misma referencia con otras fechas corrige el periodo en vez de
 * emitir una llave nueva.
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

interface EmitirBody {
  accion?: 'emitir' | 'anular'
  email: string
  nombre?: string
  /** Inclusive. ISO 'YYYY-MM-DD'. */
  desde?: string
  /** Inclusive: el ultimo dia que la llave abre la puerta. */
  hasta?: string
  /** Nombre del plan al momento de la compra: "FULL", "LITE", "Flex 1D". */
  plan?: string
  precio?: number
  moneda?: 'ARS' | 'USD'
  /** user_membresias_activas.id — la referencia que hace idempotente el POST. */
  ref: string
  /** auth.users.id de manso.club, para enlazar la persona con su cuenta. */
  pagina_user_id?: string
  telefono?: string
  instagram?: string
}

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/

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

  let body: EmitirBody
  try {
    body = await req.json() as EmitirBody
  } catch {
    return json({ error: 'Body invalido' }, 400)
  }

  const accion = body.accion ?? 'emitir'

  if (!body.ref) {
    return json({ error: 'Falta `ref`: sin referencia no hay idempotencia' }, 400)
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── Baja de membresia ─────────────────────────────────────
  // No borra: apaga. La llave anulada explica por que alguien entro el
  // martes y el miercoles no.
  if (accion === 'anular') {
    const { data, error } = await supabase
      .from('cowork_llaves')
      .update({
        anulada_at: new Date().toISOString(),
        anulada_por: 'pagina: se cancelo la membresia',
      })
      .eq('origen', 'pagina')
      .eq('origen_ref', body.ref)
      .is('anulada_at', null)
      .select('id')

    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, anuladas: data?.length ?? 0 })
  }

  // ── Alta / renovacion ─────────────────────────────────────
  if (!body.email || !body.desde || !body.hasta) {
    return json({ error: 'Faltan email, desde o hasta' }, 400)
  }

  if (!ES_FECHA.test(body.desde) || !ES_FECHA.test(body.hasta)) {
    return json({ error: 'desde y hasta van como YYYY-MM-DD' }, 400)
  }

  if (body.hasta < body.desde) {
    return json({ error: 'hasta no puede ser anterior a desde' }, 400)
  }

  const { data, error } = await supabase.rpc('cowork_emitir_llave', {
    p_email: body.email,
    p_nombre: body.nombre ?? null,
    p_tipo: 'mensual',
    p_desde: body.desde,
    p_hasta: body.hasta,
    p_origen: 'pagina',
    p_origen_ref: body.ref,
    p_plan: body.plan ?? null,
    p_precio: body.precio ?? null,
    p_moneda: body.moneda ?? null,
    p_pagina_user_id: body.pagina_user_id ?? null,
    p_telefono: body.telefono ?? null,
    p_instagram: body.instagram ?? null,
  })

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, llave_id: data })
}
