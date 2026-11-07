/// <reference types="node" />
import { adminClient } from './_lib/registro'
import { conNumeros, leerRevelado, responder } from './_lib/blur'

export const config = {
  runtime: 'edge',
}

/** Tope de fotos por respuesta. */
const MAX = 200

// GET /api/blur-reveladas — las fotos que la organización marcó "para
// publicar" (blur_fotos.publicada). Mientras el revelado esté cerrado
// (blur_config.revelado_desde, que maneja la organización) responde
// `abierto: false` y nada más: el revelado se abre después del festival.
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return responder({ error: 'Method not allowed' }, 405)

  try {
    const supabase = adminClient()
    const revelado = await leerRevelado(supabase)
    if (!revelado.abierto) return responder({ abierto: false, desde: revelado.desde?.toISOString() ?? null })

    const { data, error } = await supabase
      .from('blur_fotos')
      .select('id, filtro')
      .eq('publicada', true)
      .order('created_at', { ascending: false })
      .limit(MAX)
    if (error) throw new Error(error.message)
    // Puerta pública: las URLs llevan solo el id de la foto (api/blur-foto.ts).
    return responder({ abierto: true, desde: revelado.desde?.toISOString() ?? null, fotos: conNumeros(data ?? []) })
  } catch (err) {
    console.error('[blur-reveladas]', err instanceof Error ? err.message : err)
    return responder({ error: 'No pudimos cargar las fotos. Probá más tarde.' }, 500)
  }
}
