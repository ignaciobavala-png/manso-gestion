/// <reference types="node" />

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

/**
 * Cuándo abre el revelado público: env BLUR_REVELADO_DESDE (fecha ISO, ej.
 * 2026-12-20T12:00:00-03:00). Sin definir, o con un valor inválido: cerrado.
 */
export function reveladoDesde(): Date | null {
  const crudo = process.env.BLUR_REVELADO_DESDE
  if (!crudo) return null
  const d = new Date(crudo)
  return Number.isNaN(d.getTime()) ? null : d
}

export function reveladoAbierto(): boolean {
  const d = reveladoDesde()
  return d !== null && Date.now() >= d.getTime()
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
