/**
 * La credencial del coworker, guardada en su propio celular.
 *
 * El QR de una sala está pegado en una puerta y no puede saber quién lo
 * escanea. Lo resuelve esto: la primera vez que el miembro abre su carnet
 * —el link que le entregamos una vez— su token queda guardado acá, y de ahí
 * en más cualquier QR de sala lo reconoce sin login y sin instalar nada.
 *
 * Si borra los datos del navegador o cambia de teléfono, vuelve a abrir su
 * carnet una vez y listo. Por eso la pantalla de sala, cuando no encuentra
 * credencial, no muestra un error: explica que hay que abrir el carnet.
 */

const CLAVE = 'cowork_credencial'

export function guardarCredencial(token: string) {
  try {
    localStorage.setItem(CLAVE, token)
  } catch {
    // Modo incógnito o storage bloqueado: el carnet sigue funcionando, lo
    // único que se pierde es que la sala lo reconozca en el próximo escaneo.
  }
}

export function leerCredencial(): string | null {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

export function olvidarCredencial() {
  try {
    localStorage.removeItem(CLAVE)
  } catch { /* nada que hacer */ }
}

/** Formato del QR del carnet, con prefijo propio para que el scanner de la
 *  puerta lo distinga de una entrada de show (`manso-ticket|…`). */
export function qrDeCredencial(token: string) {
  return `manso-cowork|${token}`
}
