/**
 * Subida de las fotos de Analógica al bucket privado `blur-analogica` de Gestión
 * (supabase/migrations/043_blur_analogica_fotos.sql). Orden: primero la fila en `festival_fotos`
 * (ahí el servidor cuenta el tope de 10 por dispositivo) y después el archivo,
 * porque la policy del bucket solo acepta paths que ya tengan fila.
 *
 * Anon no tiene SELECT: no se pide `return=representation` ni se usa upsert.
 *
 * Sin `VITE_ANALOGICA_SUBIR=1` no sale nada de la red (modo maqueta).
 */
const URL_BASE = import.meta.env.VITE_GESTION_URL as string | undefined
const KEY = import.meta.env.VITE_GESTION_ANON_KEY as string | undefined

export const SUBIDA_REAL = import.meta.env.VITE_ANALOGICA_SUBIR === '1' && !!URL_BASE && !!KEY

export class RolloCompleto extends Error {}

/** Id anónimo por teléfono. No identifica a nadie; solo agrupa el rollo. */
function dispositivo(): string {
  try {
    let id = localStorage.getItem('blur-dispositivo')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('blur-dispositivo', id)
    }
    return id
  } catch {
    // Sin localStorage el rollo no se puede acotar por dispositivo: id nuevo cada vez.
    return crypto.randomUUID()
  }
}

export async function subirFoto(blob: Blob, filtro: string): Promise<void> {
  if (!SUBIDA_REAL) {
    await new Promise((r) => setTimeout(r, 250))
    return
  }

  const id = crypto.randomUUID()
  const disp = dispositivo()
  const path = `${disp}/${id}.jpg`
  const auth = { apikey: KEY!, Authorization: `Bearer ${KEY}` }

  const fila = await fetch(`${URL_BASE}/rest/v1/blur_fotos`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ id, dispositivo: disp, path, filtro }),
  })
  if (!fila.ok) {
    const texto = await fila.text()
    if (texto.includes('rollo_completo')) throw new RolloCompleto()
    throw new Error(`No se pudo registrar la foto (${fila.status})`)
  }

  const archivo = await fetch(`${URL_BASE}/storage/v1/object/blur-analogica/${path}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
    body: blob,
  })
  if (!archivo.ok) throw new Error(`No se pudo subir la foto (${archivo.status})`)
}
