/// <reference types="node" />
import type { SupabaseClient } from '@supabase/supabase-js'

// Lectura de las fotos de Analógica (app de BLUR). El bucket `blur-analogica`
// es privado y `anon` no tiene SELECT en `blur_fotos`: las funciones de api/
// usan la clave de servicio, deciden qué corresponde ver y entregan la imagen
// por api/blur-foto.ts.
//
// Por qué no se devuelven URLs firmadas del bucket: el path del archivo es
// `<dispositivo>/<id>.jpg`, y una URL firmada lo lleva adentro. Ver una sola
// foto publicada alcanzaba para sacar el id del dispositivo y, con él, pedir
// el rollo entero (también lo que la organización no publicó). Con
// /api/blur-foto?i=<id> la URL solo tiene el id de la foto.

export const BUCKET = 'blur-analogica'

export interface FotoRollo {
  /** Posición dentro de la respuesta, desde 1 (también sale en el borde de la foto). */
  n: number
  filtro: string | null
  url: string
}

export interface Revelado {
  /** Cuándo abre (o abrió); null si no hay fecha. */
  desde: Date | null
  abierto: boolean
}

/**
 * Cuándo abre el revelado público: blur_config.revelado_desde (migración 047),
 * que la organización maneja desde /admin/fotos. Sin fecha, con una fecha
 * inválida o si la lectura falla: cerrado. Nunca abre por una duda.
 */
export async function leerRevelado(supabase: SupabaseClient): Promise<Revelado> {
  const cerrado: Revelado = { desde: null, abierto: false }
  try {
    const { data, error } = await supabase
      .from('blur_config')
      .select('revelado_desde')
      .eq('id', true)
      .maybeSingle<{ revelado_desde: string | null }>()
    if (error) throw new Error(error.message)
    if (!data?.revelado_desde) return cerrado
    const desde = new Date(data.revelado_desde)
    if (Number.isNaN(desde.getTime())) return cerrado
    return { desde, abierto: Date.now() >= desde.getTime() }
  } catch (err) {
    console.error('[blur] no se pudo leer blur_config:', err instanceof Error ? err.message : err)
    return cerrado
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const esUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s)

/** Respuesta JSON que nunca se cachea. */
export function responder(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/**
 * URL con la que el navegador pide una foto. `credencial` es la misma que usó
 * quien pidió la lista (su token o su dispositivo); sin ella, es la puerta
 * pública (solo fotos publicadas, y solo con el revelado abierto).
 */
export function urlFoto(id: string, credencial?: { t: string } | { d: string }): string {
  const base = `/api/blur-foto?i=${id}`
  if (!credencial) return base
  return 't' in credencial ? `${base}&t=${credencial.t}` : `${base}&d=${credencial.d}`
}

export function conNumeros(
  filas: { id: string; filtro: string | null }[],
  credencial?: { t: string } | { d: string },
): FotoRollo[] {
  return filas.map((f, i) => ({ n: i + 1, filtro: f.filtro, url: urlFoto(f.id, credencial) }))
}
