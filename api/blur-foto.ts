/// <reference types="node" />
import { adminClient } from './_lib/registro'
import { BUCKET, esUuid, reveladoAbierto } from './_lib/blur'

export const config = {
  runtime: 'edge',
}

// GET /api/blur-foto?i=<id de la foto> — entrega UNA imagen de Analógica.
//
// Tres puertas, como api/blur-rollo.ts, y cada pedido se valida por separado:
//   ?i=                 pública: solo fotos publicadas, y solo con el revelado abierto.
//   ?i=&t=<token>       el link personal: una foto de ESE rollo (la org decide cuándo se manda).
//   ?i=&d=<dispositivo> la propia app: una foto de ESTE teléfono, con el revelado abierto.
// Las descartadas no salen por ninguna puerta. Cualquier rechazo responde 404
// igual, sin decir si la foto existe.
function noEncontrada(): Response {
  return new Response('No encontrada', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const params = new URL(req.url).searchParams
  const id = params.get('i')
  const token = params.get('t')
  const disp = params.get('d')
  if (!esUuid(id)) return noEncontrada()

  try {
    const supabase = adminClient()
    const { data: foto, error } = await supabase
      .from('blur_fotos')
      .select('path, dispositivo, publicada, descartada')
      .eq('id', id)
      .maybeSingle<{ path: string; dispositivo: string; publicada: boolean; descartada: boolean }>()
    if (error) throw new Error(error.message)
    if (!foto || foto.descartada) return noEncontrada()

    let permitido = false
    // Con credencial personal la foto es de una sola persona: nada de caché compartida.
    let cache = 'private, max-age=3600'
    if (esUuid(token)) {
      const { data: rollo } = await supabase
        .from('blur_rollos')
        .select('dispositivo')
        .eq('token', token)
        .maybeSingle<{ dispositivo: string }>()
      permitido = rollo?.dispositivo === foto.dispositivo
    } else if (esUuid(disp)) {
      permitido = reveladoAbierto() && disp === foto.dispositivo
    } else {
      permitido = reveladoAbierto() && foto.publicada
      // Pública: puede cachearla la red. Poco tiempo, por si la org la despublica.
      cache = 'public, max-age=300, s-maxage=300'
    }
    if (!permitido) return noEncontrada()

    const { data: firmada, error: eFirma } = await supabase.storage.from(BUCKET).createSignedUrl(foto.path, 60)
    if (eFirma || !firmada) throw new Error(eFirma?.message ?? 'sin URL firmada')
    const origen = await fetch(firmada.signedUrl)
    if (!origen.ok || !origen.body) throw new Error(`storage ${origen.status}`)

    return new Response(origen.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': cache,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('[blur-foto]', err instanceof Error ? err.message : err)
    return new Response('No pudimos cargar la foto', { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
