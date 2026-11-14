import { create } from 'zustand'
import { CARTA, type Producto } from './mock'

/**
 * Carta de la Barra desde la base de Gestión (tabla blur_carta_productos,
 * migración 050), que se edita en /admin/blur/barra. Lectura con la anon key,
 * sólo productos activos: el mismo camino que lib/fotos.ts.
 *
 * Con base configurada, la carta es exactamente lo que devuelve la base: no se
 * pinta nada hasta que responde (`cargada`), así que nunca aparece la maqueta
 * de mock.ts antes de la real. La maqueta sólo se usa sin base configurada
 * (desarrollo sin variables de entorno).
 */

const URL_BASE = (import.meta.env.VITE_GESTION_URL ?? import.meta.env.VITE_SUPABASE_URL) as string | undefined
const KEY = (import.meta.env.VITE_GESTION_ANON_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
const SIN_BASE = !URL_BASE || !KEY

interface FilaCarta {
  id: string
  nombre: string
  categoria: string
  descripcion: string | null
  etiqueta: string | null
  vacante: boolean
  precio: number | null
  foto: string | null
  orden: number
}

interface CartaState {
  productos: Producto[]
  /** true cuando la base respondió (o no hay base y se usa la maqueta). */
  cargada: boolean
  /** La base no respondió: la pantalla lo dice en vez de mostrar otra carta. */
  error: boolean
  cargar: () => Promise<void>
}

const SELECCION = 'select=id,nombre,categoria,descripcion,etiqueta,vacante,precio,foto,orden&activo=eq.true&order=categoria,orden,nombre'

export const useCarta = create<CartaState>()((set, get) => ({
  productos: SIN_BASE ? CARTA : [],
  cargada: SIN_BASE,
  error: false,
  cargar: async () => {
    if (get().cargada) return
    try {
      const res = await fetch(`${URL_BASE}/rest/v1/blur_carta_productos?${SELECCION}`, {
        headers: { apikey: KEY as string, Authorization: `Bearer ${KEY}` },
      })
      if (!res.ok) throw new Error(`carta: ${res.status}`)
      const filas = (await res.json()) as FilaCarta[]
      set({
        productos: filas.map((f) => ({
          id: f.id,
          nombre: f.nombre,
          categoria: f.categoria,
          descripcion: f.descripcion ?? undefined,
          etiqueta: f.etiqueta ?? undefined,
          vacante: f.vacante || undefined,
          precio: f.precio ?? undefined,
        })),
        cargada: true,
      })
    } catch {
      set({ productos: [], cargada: true, error: true })
    }
  },
}))
