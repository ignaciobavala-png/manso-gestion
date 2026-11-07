/**
 * Revelado: lo que se ve de las fotos después del festival. Todo sale de dos
 * funciones de servidor de Gestión (api/blur-reveladas.ts y api/blur-rollo.ts),
 * que firman URLs temporales del bucket privado. La fecha de apertura la
 * decide el servidor (BLUR_REVELADO_DESDE): la app no la conoce de antemano.
 *
 * En desarrollo local (Vite) esas rutas no existen: cualquier falla de red o
 * respuesta que no sea JSON se trata como "todavía cerrado".
 */
import { idDispositivo } from './fotos'

export interface FotoRollo {
  n: number
  filtro: string | null
  url: string
}

export type Reveladas =
  | { abierto: false; desde: string | null }
  | { abierto: true; fotos: FotoRollo[] }

export type RolloPersonal =
  | { estado: 'cerrado'; desde: string | null }
  | { estado: 'no-existe' }
  | { estado: 'ok'; numero: string | null; fotos: FotoRollo[] }

/** El servidor responde cerrado ante cualquier duda; lo mismo hace la app. */
const CERRADO: Reveladas = { abierto: false, desde: null }

async function pedir(ruta: string): Promise<{ status: number; cuerpo: Record<string, unknown> | null }> {
  try {
    const res = await fetch(ruta, { headers: { Accept: 'application/json' } })
    const cuerpo = (await res.json()) as Record<string, unknown>
    return { status: res.status, cuerpo }
  } catch {
    return { status: 0, cuerpo: null }
  }
}

export async function pedirReveladas(): Promise<Reveladas> {
  const { status, cuerpo } = await pedir('/api/blur-reveladas')
  if (status !== 200 || !cuerpo) return CERRADO
  if (cuerpo.abierto === true && Array.isArray(cuerpo.fotos)) return { abierto: true, fotos: cuerpo.fotos as FotoRollo[] }
  return { abierto: false, desde: typeof cuerpo.desde === 'string' ? cuerpo.desde : null }
}

/** `token` = el link que mandó la organización; sin token, el rollo de este teléfono. */
export async function pedirRollo(token?: string): Promise<RolloPersonal> {
  const credencial = token ? `t=${encodeURIComponent(token)}` : `d=${encodeURIComponent(idDispositivo())}`
  const { status, cuerpo } = await pedir(`/api/blur-rollo?${credencial}`)
  if (status === 404 || status === 400) return { estado: 'no-existe' }
  if (status !== 200 || !cuerpo) return { estado: 'cerrado', desde: null }
  if (cuerpo.abierto === false) return { estado: 'cerrado', desde: typeof cuerpo.desde === 'string' ? cuerpo.desde : null }
  return {
    estado: 'ok',
    numero: typeof cuerpo.numero === 'string' ? cuerpo.numero : null,
    fotos: Array.isArray(cuerpo.fotos) ? (cuerpo.fotos as FotoRollo[]) : [],
  }
}

/** Días que faltan para `desde` (0 si ya pasó); null si no hay fecha. */
export function diasHasta(desde: string | null): number | null {
  if (!desde) return null
  const t = new Date(desde).getTime()
  return Number.isNaN(t) ? null : Math.max(0, Math.ceil((t - Date.now()) / 86_400_000))
}
