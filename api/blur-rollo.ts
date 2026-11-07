/// <reference types="node" />
import { adminClient } from './_lib/registro'
import { conNumeros, esUuid, responder, reveladoAbierto, reveladoDesde } from './_lib/blur'

export const config = {
  runtime: 'edge',
}

// GET /api/blur-rollo — las fotos de UN rollo (los 10 disparos de una cámara).
// Salen todas menos las que la organización descartó (blur_fotos.descartada).
//
// Dos puertas, y no valen lo mismo:
//   ?t=<token>        el link personal que la organización le manda a la persona.
//                     Funciona siempre: quién lo recibe y cuándo lo decide la org.
//   ?d=<dispositivo>  la propia app, desde el teléfono que sacó las fotos. Solo
//                     después de BLUR_REVELADO_DESDE, igual que el revelado público.
// Las URLs de las fotos (api/blur-foto.ts) repiten la credencial con la que se
// pidió la lista, y nada más: no se devuelve el dispositivo que corresponde a
// un token, ni el token que corresponde a un dispositivo, ni el contacto.
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return responder({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const token = url.searchParams.get('t')
  const disp = url.searchParams.get('d')
  if (!esUuid(token) && !esUuid(disp)) return responder({ error: 'Falta el rollo.' }, 400)

  try {
    const supabase = adminClient()
    let dispositivo: string
    let credencial: { t: string } | { d: string }
    let numero: string | null = null

    if (esUuid(token)) {
      const { data, error } = await supabase
        .from('blur_rollos')
        .select('dispositivo, numero')
        .eq('token', token)
        .maybeSingle<{ dispositivo: string; numero: string }>()
      if (error) throw new Error(error.message)
      // Mismo mensaje exista o no: el link no revela nada de lo que no sea suyo.
      if (!data) return responder({ error: 'No encontramos este rollo.' }, 404)
      dispositivo = data.dispositivo
      numero = data.numero
      credencial = { t: token }
    } else {
      if (!reveladoAbierto()) {
        return responder({ abierto: false, desde: reveladoDesde()?.toISOString() ?? null })
      }
      dispositivo = disp as string
      credencial = { d: dispositivo }
      const { data } = await supabase
        .from('blur_rollos')
        .select('numero')
        .eq('dispositivo', dispositivo)
        .maybeSingle<{ numero: string }>()
      numero = data?.numero ?? null
    }

    const { data: filas, error: eFotos } = await supabase
      .from('blur_fotos')
      .select('id, filtro')
      .eq('dispositivo', dispositivo)
      .eq('descartada', false)
      .order('created_at', { ascending: true })
    if (eFotos) throw new Error(eFotos.message)

    return responder({ abierto: true, numero, fotos: conNumeros(filas ?? [], credencial) })
  } catch (err) {
    console.error('[blur-rollo]', err instanceof Error ? err.message : err)
    return responder({ error: 'No pudimos cargar el rollo. Probá más tarde.' }, 500)
  }
}
