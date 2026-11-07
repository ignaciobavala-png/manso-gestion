/**
 * Subida de las fotos de Analógica al bucket privado `blur-analogica` de Gestión
 * (supabase/migrations/043_blur_analogica_fotos.sql). Orden: primero la fila en `festival_fotos`
 * (ahí el servidor cuenta el tope de 10 por dispositivo) y después el archivo,
 * porque la policy del bucket solo acepta paths que ya tengan fila.
 *
 * Anon no tiene SELECT: no se pide `return=representation` ni se usa upsert.
 *
 * Dentro del proyecto de Gestión en Vercel se reusan VITE_SUPABASE_URL / _ANON_KEY.
 * Sin `VITE_ANALOGICA_SUBIR=1` no sale nada de la red (modo maqueta).
 */
const URL_BASE = (import.meta.env.VITE_GESTION_URL ?? import.meta.env.VITE_SUPABASE_URL) as string | undefined
const KEY = (import.meta.env.VITE_GESTION_ANON_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

export const SUBIDA_REAL = import.meta.env.VITE_ANALOGICA_SUBIR === '1' && !!URL_BASE && !!KEY

export class RolloCompleto extends Error {}

/** Id anónimo por teléfono. No identifica a nadie; solo agrupa el rollo. */
export function idDispositivo(): string {
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

/**
 * Número de rollo para mostrar (sobre de entrega): los primeros 6 hex del id de
 * dispositivo módulo 10000. Es decorativo y puede repetirse entre dos teléfonos;
 * el identificador real sigue siendo el id de dispositivo. La base calcula el
 * mismo número (columna `numero` de blur_rollos, migración 046): si cambia la
 * fórmula, cambia en los dos lados.
 */
export function numeroRollo(): string {
  const n = parseInt(idDispositivo().replace(/-/g, '').slice(0, 6), 16) % 10000
  return String(n).padStart(4, '0')
}

export async function subirFoto(blob: Blob, filtro: string): Promise<void> {
  if (!SUBIDA_REAL) {
    await new Promise((r) => setTimeout(r, 250))
    return
  }

  const id = crypto.randomUUID()
  const disp = idDispositivo()
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

export class ContactoInvalido extends Error {}

/**
 * La persona deja su mail para que la organización le mande sus fotos. Va por
 * una función de la base (046) que lo guarda y no devuelve nada: ni el token
 * del link personal ni más datos del rollo.
 */
export async function dejarContacto(email: string): Promise<void> {
  if (!SUBIDA_REAL) {
    await new Promise((r) => setTimeout(r, 250))
    return
  }
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/blur_rollo_dejar_contacto`, {
    method: 'POST',
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_dispositivo: idDispositivo(), p_contacto: email }),
  })
  if (res.ok) return
  const texto = await res.text()
  if (texto.includes('contacto_invalido')) throw new ContactoInvalido()
  throw new Error(`No se pudo guardar el contacto (${res.status})`)
}
