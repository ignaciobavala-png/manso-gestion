/**
 * "Mi cuenta": las entradas de esta persona, sin login. El secreto es el token
 * de cada entrada (el mismo del QR de Gestión). Se guarda en el teléfono y se
 * pregunta a Gestión (get_tickets_por_token, anon) por su estado.
 *
 * iPhone es el caso difícil: Safari, el navegador interno de Instagram/WhatsApp
 * y la app instalada en la pantalla de inicio NO comparten almacenamiento, y
 * Safari borra el de los sitios que no se abren en 7 días. Por eso hay tres
 * salidas además del guardado: link de respaldo, código de 10 caracteres y mail.
 */

const URL_BASE = (import.meta.env.VITE_GESTION_URL ?? import.meta.env.VITE_SUPABASE_URL) as string | undefined
const KEY = (import.meta.env.VITE_GESTION_ANON_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

const LS = 'blur_entradas'
const MAX_TOKENS = 50
const TOKEN = /^[A-Za-z0-9-]{8,80}$/

export type EstadoEntrada = 'valida' | 'usada' | 'anulada' | 'pendiente'

export interface Entrada {
  token: string
  name: string
  event_id: string
  ticket_type_nombre: string | null
  pack_pos: number | null
  pack_size: number | null
  estado: EstadoEntrada
}

/** Los tokens guardados. Todo acceso al almacenamiento va con try/catch: en modo privado de iOS puede tirar. */
export function leerTokens(): string[] {
  try {
    const crudo = JSON.parse(localStorage.getItem(LS) ?? '[]') as unknown
    return Array.isArray(crudo) ? crudo.filter((t): t is string => typeof t === 'string' && TOKEN.test(t)).slice(0, MAX_TOKENS) : []
  } catch {
    return []
  }
}

/** Suma tokens a los ya guardados (sin repetir). Devuelve la lista final. */
export function guardarTokens(nuevos: string[]): string[] {
  const todos = [...new Set([...leerTokens(), ...nuevos.filter((t) => TOKEN.test(t))])].slice(0, MAX_TOKENS)
  try {
    localStorage.setItem(LS, JSON.stringify(todos))
    // Pide al navegador que no lo borre por falta de espacio (si lo soporta; si no, no pasa nada).
    void navigator.storage?.persist?.()
  } catch {
    /* sin almacenamiento: la pantalla sigue funcionando con lo que haya en memoria */
  }
  return todos
}

export function olvidarTokens() {
  try {
    localStorage.removeItem(LS)
  } catch {
    /* nada que borrar */
  }
}

/** Los tokens de `…/cuenta#t=a,b`. Van en el fragmento: no llegan al servidor ni a sus logs. */
export function tokensDelLink(): string[] {
  const t = new URLSearchParams(window.location.hash.slice(1)).get('t')
  if (!t) return []
  return t.split(',').map((s) => s.trim()).filter((s) => TOKEN.test(s)).slice(0, MAX_TOKENS)
}

/** Link para guardarse a uno mismo (notas, WhatsApp): abrirlo en cualquier navegador recupera las entradas. */
export function linkDeRespaldo(tokens: string[]): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}cuenta#t=${tokens.join(',')}`
}

/** Los 10 caracteres que se leen en la puerta, como los dicta blur_activar_rollo. */
export const codigoCorto = (token: string) => token.replace(/-/g, '').slice(0, 10).toUpperCase()

/** Estado de cada token en Gestión. `null` = no se pudo consultar (sin señal). */
export async function consultar(tokens: string[]): Promise<Entrada[] | null> {
  if (tokens.length === 0) return []
  if (!URL_BASE || !KEY) return null
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/get_tickets_por_token`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_tokens: tokens.slice(0, MAX_TOKENS) }),
    })
    if (!res.ok) return null
    return (await res.json()) as Entrada[]
  } catch {
    return null
  }
}

export type ResultadoCodigo = 'ok' | 'codigo_invalido' | 'no_encontrada' | 'ambiguo' | 'demasiados_intentos' | 'error'

/** Recupera una entrada con su código corto, el token entero o el link pegado. */
export async function recuperarPorCodigo(codigo: string): Promise<{ estado: ResultadoCodigo; tokens: string[] }> {
  try {
    const res = await fetch('/api/blur-entrada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    })
    const data = (await res.json().catch(() => ({}))) as { estado?: ResultadoCodigo; tokens?: string[] }
    return { estado: data.estado ?? 'error', tokens: data.tokens ?? [] }
  } catch {
    return { estado: 'error', tokens: [] }
  }
}

/** Pide que Gestión mande las entradas a ese mail (api/reenviar-entradas: respuesta siempre igual, con freno). */
export async function pedirPorMail(email: string): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const res = await fetch('/api/reenviar-entradas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = (await res.json().catch(() => ({}))) as { mensaje?: string; error?: string }
    return res.ok ? { ok: true, mensaje: data.mensaje ?? 'Si hay entradas con ese mail, te llegan en unos minutos.' } : { ok: false, mensaje: data.error ?? 'No pudimos procesar el pedido.' }
  } catch {
    return { ok: false, mensaje: 'Sin conexión. Probá de nuevo.' }
  }
}
