import { useEffect, useState } from 'react'

/**
 * Lectura del festival desde la base de manso-club (solo lectura, rol anon).
 * Las mismas tablas que usa manso-club.com.ar/blur; el RLS esconde todo si el
 * festival no está publicado, así que sin publicar esto vuelve vacío.
 */
const URL_BASE = import.meta.env.VITE_MANSOCLUB_URL as string | undefined
const KEY = import.meta.env.VITE_MANSOCLUB_ANON_KEY as string | undefined

export interface Config {
  bajada: string | null
  fecha: string | null
  horario: string | null
  lugar: string | null
  lema: string | null
  vision: string | null
  banner_url: string | null
  lineup_visible: boolean
}
export interface Escenario { id: string; nombre: string; orden: number }
export interface Artista {
  id: string
  slug: string
  nombre: string
  escenario_id: string | null
  b2b: boolean
  pais: string | null
  origen: string | null
  foto_url: string | null
  dia: string | null
  horario: string | null
  orden: number
}
export interface Spot { id: string; titulo: string; descripcion: string | null; fotos: string[]; orden: number }

export interface Festival {
  config: Config | null
  escenarios: Escenario[]
  artistas: Artista[]
  spots: Spot[]
}

async function leer<T>(tabla: string, query: string): Promise<T[]> {
  if (!URL_BASE || !KEY) throw new Error('Falta VITE_MANSOCLUB_URL / VITE_MANSOCLUB_ANON_KEY')
  const res = await fetch(`${URL_BASE}/rest/v1/${tabla}?${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) throw new Error(`${tabla}: ${res.status}`)
  return res.json()
}

let cache: Promise<Festival> | null = null

export function cargarFestival(): Promise<Festival> {
  cache ??= Promise.all([
    leer<Config>('festival_config', 'select=bajada,fecha,horario,lugar,lema,vision,banner_url,lineup_visible&id=eq.1'),
    leer<Escenario>('festival_escenarios', 'select=id,nombre,orden&activo=eq.true&order=orden'),
    leer<Artista>('festival_artistas', 'select=id,slug,nombre,escenario_id,b2b,pais,origen,foto_url,dia,horario,orden&activo=eq.true&order=orden'),
    leer<Spot>('festival_spots', 'select=id,titulo,descripcion,fotos,orden&activo=eq.true&order=orden'),
  ])
    .then(([c, escenarios, artistas, spots]) => {
      const config = c[0] ?? null
      // Con el line-up apagado en el panel no se muestra, igual que en manso-club.
      const verLineup = config?.lineup_visible ?? false
      return {
        config,
        escenarios,
        artistas: verLineup ? artistas : [],
        spots,
      }
    })
    .catch((e) => {
      cache = null // que el próximo montaje reintente
      throw e
    })
  return cache
}

type Estado = { cargando: true } | { cargando: false; error: string } | { cargando: false; error: null; data: Festival }

export function useFestival(): Estado {
  const [estado, setEstado] = useState<Estado>({ cargando: true })
  useEffect(() => {
    let vivo = true
    cargarFestival().then(
      (data) => vivo && setEstado({ cargando: false, error: null, data }),
      (e: Error) => vivo && setEstado({ cargando: false, error: e.message }),
    )
    return () => { vivo = false }
  }, [])
  return estado
}

/** `2026-12-12` → `12.12.2026`, sin pasar por Date para no correr el día por zona horaria. */
export const fechaCorta = (iso: string | null) => {
  if (!iso) return null
  const [a, m, d] = iso.split('-')
  return a && m && d ? `${d}.${m}.${a}` : null
}

/** Escenarios con sus artistas; sin artistas, el escenario no aparece (como en manso-club). */
export function lineupPorEscenario(f: Festival) {
  return f.escenarios
    .map((e) => ({ ...e, artistas: f.artistas.filter((a) => a.escenario_id === e.id) }))
    .filter((e) => e.artistas.length > 0)
}
