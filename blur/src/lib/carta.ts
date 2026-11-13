import { create } from 'zustand'
import { CARTA, type Producto } from './mock'

/**
 * Carta de la Barra desde la base de Gestión (tabla blur_carta_productos,
 * migración 050), que se edita en /admin/blur/barra. Lectura con la anon key,
 * sólo productos activos: el mismo camino que lib/fotos.ts.
 *
 * Arranca con la carta de maqueta (mock.ts) y la reemplaza sólo si la base
 * devuelve productos. Si la base no responde o está vacía, se queda la maqueta:
 * la pantalla nunca se queda sin carta.
 */

const URL_BASE = (import.meta.env.VITE_GESTION_URL ?? import.meta.env.VITE_SUPABASE_URL) as string | undefined
const KEY = (import.meta.env.VITE_GESTION_ANON_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

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
  cargada: boolean
  cargar: () => Promise<void>
}

const SELECCION = 'select=id,nombre,categoria,descripcion,etiqueta,vacante,precio,foto,orden&activo=eq.true&order=categoria,orden,nombre'

export const useCarta = create<CartaState>()((set, get) => ({
  productos: CARTA,
  cargada: false,
  cargar: async () => {
    if (get().cargada) return
    if (!URL_BASE || !KEY) {
      set({ cargada: true })
      return
    }
    try {
      const res = await fetch(`${URL_BASE}/rest/v1/blur_carta_productos?${SELECCION}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      })
      if (!res.ok) throw new Error(`carta: ${res.status}`)
      const filas = (await res.json()) as FilaCarta[]
      if (filas.length > 0) {
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
        })
      }
    } catch {
      // Sin base: se queda la carta de maqueta.
    }
    set({ cargada: true })
  },
}))
