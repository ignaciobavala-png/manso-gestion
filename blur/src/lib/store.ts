import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CARTA, FOTOS_POR_PERSONA } from './mock'

export interface Pedido {
  id: string
  items: Record<string, number>
  total: number
  creado: number
}

/**
 * Un fotograma ya expuesto. No guarda la foto (nadie la ve): solo con qué película
 * se sacó y dos colores promedio (arriba / abajo) para pintar la imagen latente
 * en la tira de negativos.
 */
export interface Frame {
  f: string
  c: [string, string]
}

interface State {
  saldo: number
  carrito: Record<string, number>
  pedidos: Pedido[]
  fotosSacadas: number
  /** Película cargada en el rollo; null = todavía no eligió. */
  pelicula: string | null
  /** El rollo permite cambiar la película una sola vez. */
  cambioUsado: boolean
  tira: Frame[]
  cargarPelicula: (id: string) => void
  cambiarPelicula: (id: string) => void
  cargar: (monto: number) => void
  sumar: (id: string, delta: number) => void
  totalCarrito: () => number
  confirmar: () => Pedido | null
  fotoSacada: (frame: Frame) => void
  rolloLleno: () => void
}

export const useBlur = create<State>()(
  persist(
    (set, get) => ({
      saldo: 0,
      carrito: {},
      pedidos: [],
      fotosSacadas: 0,
      pelicula: null,
      cambioUsado: false,
      tira: [],
      cargarPelicula: (id) => set({ pelicula: id }),
      cambiarPelicula: (id) => set((s) => (s.cambioUsado ? s : { pelicula: id, cambioUsado: true })),
      cargar: (monto) => set((s) => ({ saldo: s.saldo + monto })),
      sumar: (id, delta) =>
        set((s) => {
          const n = Math.max(0, (s.carrito[id] ?? 0) + delta)
          const carrito = { ...s.carrito }
          if (n === 0) delete carrito[id]
          else carrito[id] = n
          return { carrito }
        }),
      totalCarrito: () =>
        Object.entries(get().carrito).reduce(
          (t, [id, n]) => t + (CARTA.find((p) => p.id === id)?.precio ?? 0) * n,
          0,
        ),
      confirmar: () => {
        const { carrito, saldo, totalCarrito } = get()
        const total = totalCarrito()
        if (total === 0 || total > saldo) return null
        const pedido: Pedido = { id: crypto.randomUUID(), items: carrito, total, creado: Date.now() }
        set((s) => ({ saldo: s.saldo - total, carrito: {}, pedidos: [pedido, ...s.pedidos] }))
        return pedido
      },
      fotoSacada: (frame) =>
        set((s) => ({ fotosSacadas: s.fotosSacadas + 1, tira: [...s.tira, frame] })),
      rolloLleno: () => set({ fotosSacadas: FOTOS_POR_PERSONA }),
    }),
    {
      name: 'blur-app',
      // Solo datos de la persona; el carrito en curso no hace falta guardarlo.
      partialize: (s) => ({
        saldo: s.saldo,
        pedidos: s.pedidos,
        fotosSacadas: s.fotosSacadas,
        pelicula: s.pelicula,
        cambioUsado: s.cambioUsado,
        tira: s.tira,
      }),
    },
  ),
)

export const pesos = (n: number) => '$' + n.toLocaleString('es-AR')
