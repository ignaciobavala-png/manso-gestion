import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type Product = Database['public']['Tables']['products']['Row']
type Guest = Database['public']['Tables']['guests']['Row']
type Sale = Database['public']['Tables']['sales']['Row']
type TicketSale = Database['public']['Tables']['ticket_sales']['Row']
type Event = Database['public']['Tables']['events']['Row']

interface AppState {
  // Datos
  products: Product[]
  guests: Guest[]
  sales: Sale[]
  ticketSales: TicketSale[]
  events: Event[]
  activeEvent: Event | null
  balance: number
  
  // Estado
  isLoading: boolean
  error: string | null
  lastFetch: Date | null
  isInitialized: boolean
  
  // Acciones
  fetchData: () => Promise<void>
  refreshData: () => Promise<void>
  calculateBalance: (eventId?: string | null) => Promise<void>
  
  // Acciones de productos
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  
  // Acciones de ventas
  addSale: (sale: Omit<Sale, 'id' | 'created_at'>) => Promise<void>
  addSaleBatch: (items: Array<Pick<Sale, 'product_id' | 'product_name' | 'quantity' | 'total'>>, paymentMethod: string) => Promise<void>
  deleteSale: (id: string) => Promise<void>
  flushBalance: () => void
  
  // Acciones de invitados
  addGuest: (guest: Omit<Guest, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  
  // Acciones de tickets
  addTicketSale: (ticket: Omit<TicketSale, 'id' | 'created_at'>) => Promise<void>
  
  // Acciones de eventos
  addEvent: (event: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'closed_at'>) => Promise<Event>
  setActiveEventStatus: (eventId: string, isActive: boolean) => Promise<void>
  selectOperatingEvent: (eventId: string) => Promise<void>
  closeEvent: (eventId: string) => Promise<void>
  deleteEvent: (eventId: string) => Promise<void>
  updateEventFlyer: (eventId: string, flyerUrl: string) => Promise<void>
  
  // Utilidades
  getTicketPrices: () => { regular: number; invitado: number }
}

export const useAppStore = create<AppState>((set, get) => ({
  // Estado inicial
  products: [],
  guests: [],
  sales: [],
  ticketSales: [],
  events: [],
  activeEvent: null,
  balance: 0,
  isLoading: false,
  error: null,
  lastFetch: null,
  isInitialized: false,
  
  // Fetch de datos
  fetchData: async () => {
    const state = get()
    
    // Si ya estamos cargando, no hacer nada
    if (state.isLoading) return
    
    // Si los datos son recientes (< 30 segundos), no refrescar
    const now = new Date()
    if (state.lastFetch && (now.getTime() - state.lastFetch.getTime()) < 30000) {
      return
    }
    
    set({ isLoading: true, error: null })
    
    try {
      const [
        productsResult,
        guestsResult,
        salesResult,
        ticketSalesResult,
        eventsResult,
        activeEventResult
      ] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('guests').select('*').order('created_at', { ascending: false }),
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('ticket_sales').select('*').order('created_at', { ascending: false }),
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('active_event').select('*').single()
      ])
      
      // Verificar errores
      const errors = [
        productsResult.error,
        guestsResult.error,
        salesResult.error,
        ticketSalesResult.error,
        eventsResult.error
      ].filter(Boolean)
      
      if (errors.length > 0) {
        throw errors[0]
      }
      
      const newState = {
        products: productsResult.data || [],
        guests: guestsResult.data || [],
        sales: salesResult.data || [],
        ticketSales: ticketSalesResult.data || [],
        events: eventsResult.data || [],
        activeEvent: activeEventResult.data || null,
        lastFetch: new Date(),
        isInitialized: true
      }
      
      set(newState)

      // Calcular balance para el evento activo
      if (activeEventResult.data?.id) {
        await get().calculateBalance(activeEventResult.data.id)
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar datos'
      console.error('❌ Error fetching data:', errorMessage)
      set({ error: errorMessage })
    } finally {
      set({ isLoading: false })
    }
  },
  
  refreshData: async () => {
    set({ lastFetch: null })
    await get().fetchData()
  },
  
  calculateBalance: async (eventId?: string | null) => {
    if (!eventId) {
      set({ balance: 0 })
      return
    }
    
    try {
      const { data, error } = await supabase.rpc('get_current_balance', { p_event_id: eventId })
      if (error) throw error
      set({ balance: data || 0 })
    } catch (error) {
      console.error('Error calculating balance:', error)
    }
  },
  
  // Acciones de productos
  addProduct: async (productData) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...productData,
          stock: productData.stock || 0
        }])
        .select()
        .single()
      
      if (error) throw error
      
      set(state => ({
        products: [...state.products, data].sort((a, b) => a.name.localeCompare(b.name))
      }))
    } catch (error) {
      console.error('Error adding product:', error)
      throw error
    }
  },
  
  updateProduct: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      set(state => ({
        products: state.products.map(p => p.id === id ? data : p)
      }))
    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  },
  
  deleteProduct: async (id) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      set(state => ({
        products: state.products.filter(p => p.id !== id)
      }))
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  },
  
  // Acciones de ventas
  addSale: async (saleData) => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .insert([{
          ...saleData,
          event_id: get().activeEvent?.id
        }])
        .select()
        .single()
      
      if (error) throw error
      
      set(state => ({
        sales: [data, ...state.sales],
        balance: state.balance + data.total
      }))
    } catch (error) {
      console.error('Error adding sale:', error)
      throw error
    }
  },
  
  addSaleBatch: async (items, paymentMethod) => {
    const eventId = get().activeEvent?.id
    if (!eventId) throw new Error('No hay evento activo')

    const { data, error } = await supabase.rpc('add_sale_batch', {
      p_event_id: eventId,
      p_payment_method: paymentMethod,
      p_items: items.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        total: i.total,
      })),
    })

    if (error) throw error

    const inserted = data as Sale[]
    const totalSum = inserted.reduce((sum, s) => sum + Number(s.total), 0)

    set(state => ({
      sales: [...inserted, ...state.sales],
      balance: state.balance + totalSum,
      // Actualizar stock localmente para reflejar el decremento del trigger
      products: state.products.map(p => {
        const sold = items.find(i => i.product_id === p.id)
        if (!sold) return p
        return { ...p, stock: Math.max(0, p.stock - sold.quantity) }
      }),
    }))
  },

  deleteSale: async (id) => {
    const sale = get().sales.find(s => s.id === id)
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (error) throw error
    set(state => ({
      sales: state.sales.filter(s => s.id !== id),
      balance: sale ? state.balance - Number(sale.total) : state.balance
    }))
  },

  flushBalance: () => {
    set({ balance: 0 })
  },
  
  // Acciones de invitados
  addGuest: async (guestData) => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .insert([{
          ...guestData,
          event_id: get().activeEvent?.id
        }])
        .select()
        .single()
      
      if (error) throw error
      
      set(state => ({
        guests: [data, ...state.guests]
      }))
    } catch (error) {
      console.error('Error adding guest:', error)
      throw error
    }
  },
  
  // Acciones de tickets
  addTicketSale: async (ticketData) => {
    try {
      const { data, error } = await supabase
        .from('ticket_sales')
        .insert([{
          ...ticketData,
          event_id: get().activeEvent?.id
        }])
        .select()
        .single()
      
      if (error) throw error
      
      set(state => ({
        ticketSales: [data, ...state.ticketSales],
        balance: state.balance + data.price
      }))
    } catch (error) {
      console.error('Error adding ticket sale:', error)
      throw error
    }
  },
  
  // Acciones de eventos
  addEvent: async (eventData) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert([{ ...eventData, is_active: true }])
        .select()
        .single()

      if (error) throw error

      // Seleccionar el nuevo evento como evento en operación
      await supabase
        .from('venue_config')
        .update({ current_event_id: data.id })
        .eq('id', 1)

      set(state => ({ events: [...state.events, data] }))

      return data
    } catch (error) {
      console.error('Error adding event:', error)
      throw error
    }
  },

  setActiveEventStatus: async (eventId, isActive) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_active: isActive })
        .eq('id', eventId)

      if (error) throw error

      await get().refreshData()
    } catch (error) {
      console.error('Error setting active event status:', error)
      throw error
    }
  },

  selectOperatingEvent: async (eventId) => {
    try {
      const { error } = await supabase
        .from('venue_config')
        .update({ current_event_id: eventId })
        .eq('id', 1)

      if (error) throw error

      await get().refreshData()
    } catch (error) {
      console.error('Error selecting operating event:', error)
      throw error
    }
  },

  closeEvent: async (eventId) => {
    try {
      // Cerrar el evento
      const { error } = await supabase
        .from('events')
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('id', eventId)

      if (error) throw error

      // Limpiar el evento en operación en venue_config
      await supabase
        .from('venue_config')
        .update({ current_event_id: null })
        .eq('id', 1)

      await get().refreshData()
    } catch (error) {
      console.error('Error closing event:', error)
      throw error
    }
  },

  deleteEvent: async (eventId) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error

      set(state => ({
        events: state.events.filter(e => e.id !== eventId),
        sales: state.sales.filter(s => s.event_id !== eventId),
        ticketSales: state.ticketSales.filter(t => t.event_id !== eventId),
        guests: state.guests.filter(g => g.event_id !== eventId),
      }))
    } catch (error) {
      console.error('Error deleting event:', error)
      throw error
    }
  },

  updateEventFlyer: async (eventId, flyerUrl) => {
    const { error } = await supabase
      .from('events')
      .update({ flyer_url: flyerUrl })
      .eq('id', eventId)

    if (error) throw error

    set(state => ({
      events: state.events.map(e => e.id === eventId ? { ...e, flyer_url: flyerUrl } : e)
    }))
  },
  
  // Utilidades
  getTicketPrices: () => {
    const { activeEvent } = get()
    return {
      regular: activeEvent?.regular_ticket_price || 0,
      invitado: activeEvent?.invited_ticket_price || 0
    }
  }
}))