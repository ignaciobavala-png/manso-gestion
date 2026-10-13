import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CARTA, FOTOS_POR_PERSONA } from './mock'

export interface Pedido {
  id: string
  items: Record<string, number>
  total: number
  creado: number
}

interface State {
  saldo: number
  carrito: Record<string, number>
  pedidos: Pedido[]
  reservas: string[]
  avisos: string[]
  fotosSacadas: number
  cargar: (monto: number) => void
  sumar: (id: string, delta: number) => void
  totalCarrito: () => number
  confirmar: () => Pedido | null
  reservar: (id: string) => void
  avisar: (id: string) => void
  fotoSacada: () => void
  rolloLleno: () => void
}

export const useBlur = create<State>()(
  persist(
    (set, get) => ({
      saldo: 0,
      carrito: {},
      pedidos: [],
      reservas: [],
      avisos: [],
      fotosSacadas: 0,
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
      reservar: (id) =>
        set((s) => ({
          reservas: s.reservas.includes(id) ? s.reservas.filter((r) => r !== id) : [...s.reservas, id],
        })),
      avisar: (id) =>
        set((s) => ({
          avisos: s.avisos.includes(id) ? s.avisos.filter((r) => r !== id) : [...s.avisos, id],
        })),
      fotoSacada: () => set((s) => ({ fotosSacadas: s.fotosSacadas + 1 })),
      rolloLleno: () => set({ fotosSacadas: FOTOS_POR_PERSONA }),
    }),
    {
      name: 'blur-app',
      // Solo datos de la persona; el carrito en curso no hace falta guardarlo.
      partialize: (s) => ({
        saldo: s.saldo,
        pedidos: s.pedidos,
        reservas: s.reservas,
        avisos: s.avisos,
        fotosSacadas: s.fotosSacadas,
      }),
    },
  ),
)

export const pesos = (n: number) => '$' + n.toLocaleString('es-AR')
