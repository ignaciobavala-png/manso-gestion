/**
 * La última foto de fondo conocida, guardada en el dispositivo.
 *
 * El fondo vive en venue_config, y esa consulta tarda un viaje a Supabase:
 * hasta que vuelve no hay nada que pintar salvo el negro de la marca. Al
 * recordar la URL, la segunda visita —y todas las siguientes— arrancan con
 * la foto ya puesta, y la consulta solo sirve para corregirla si cambió.
 *
 * La clave la lee también el script inline de index.html, que la pinta antes
 * de que este bundle exista. Si se cambia acá, cambiarla allá.
 */
export const CLAVE_FONDO = 'manso:fondo'

/** null si nunca se guardó, o si el navegador no deja leer (modo privado). */
export function leerFondoCache(): string | null {
  try {
    return localStorage.getItem(CLAVE_FONDO)
  } catch {
    return null
  }
}

export function guardarFondoCache(url: string | null) {
  try {
    if (url) localStorage.setItem(CLAVE_FONDO, url)
    else localStorage.removeItem(CLAVE_FONDO)
  } catch {
    // Sin storage la app funciona igual: solo vuelve a esperar la consulta.
  }
}
