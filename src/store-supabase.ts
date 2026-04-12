import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import type { Database } from './lib/supabase'

// Types matching the database schema
export type Product = Database['public']['Tables']['products']['Row']
export type Guest = Database['public']['Tables']['guests']['Row']
export type Sale = Database['public']['Tables']['sales']['Row']
export type TicketSale = Database['public']['Tables']['ticket_sales']['Row']
export type Event = Database['public']['Tables']['events']['Row']

// Insert types
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type GuestInsert = Database['public']['Tables']['guests']['Insert']
export type SaleInsert = Database['public']['Tables']['sales']['Insert']
export type TicketSaleInsert = Database['public']['Tables']['ticket_sales']['Insert']
export type EventInsert = Database['public']['Tables']['events']['Insert']

// Store hook for Supabase integration
export function useSupabaseStore() {
  const [products, setProducts] = useState<Product[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [ticketSales, setTicketSales] = useState<TicketSale[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [activeEvent, setActiveEvent] = useState<Event | null>(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial data
  useEffect(() => {
    fetchData().catch(err => {
      console.error('Error crítico en inicialización:', err)
      setError('Error al cargar datos de Supabase')
      setLoading(false)
    })
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      console.log('🔄 Iniciando fetch de datos desde Supabase...')
      
      // Fetch all data in parallel
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

      console.log('📊 Resultados de fetch:', {
        products: productsResult.data?.length || 0,
        productsError: productsResult.error?.message,
        guests: guestsResult.data?.length || 0,
        sales: salesResult.data?.length || 0,
        tickets: ticketSalesResult.data?.length || 0
      })

      if (productsResult.error) throw productsResult.error
      if (guestsResult.error) throw guestsResult.error
      if (salesResult.error) throw salesResult.error
      if (ticketSalesResult.error) throw ticketSalesResult.error
      if (eventsResult.error) throw eventsResult.error
      // Active event might not exist, so we handle that case

      setProducts(productsResult.data || [])
      setGuests(guestsResult.data || [])
      setSales(salesResult.data || [])
      setTicketSales(ticketSalesResult.data || [])
      setEvents(eventsResult.data || [])
      setActiveEvent(activeEventResult.data)

      console.log('✅ Datos cargados exitosamente')

      // Calculate balance
      await calculateBalance()

    } catch (error) {
      console.error('❌ Error fetching data:', error)
      setError('Error al cargar datos: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const calculateBalance = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_balance')
      if (error) throw error
      setBalance(data || 0)
    } catch (error) {
      console.error('Error calculating balance:', error)
    }
  }

  // Product operations
  const addProduct = async (product: ProductInsert) => {
    try {
      console.log('🔄 Intentando agregar producto:', product)
      
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single()

      if (error) {
        console.error('❌ Error de Supabase al agregar producto:', error)
        throw error
      }
      
      console.log('✅ Producto agregado exitosamente:', data)
      setProducts(prev => [...prev, data])
      return data
    } catch (error) {
      console.error('❌ Error adding product:', error)
      throw error
    }
  }

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setProducts(prev => prev.map(p => p.id === id ? data : p))
      return data
    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  }

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  }

  // Guest operations
  const addGuest = async (guest: GuestInsert) => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .insert({ ...guest, event_id: guest.event_id ?? activeEvent?.id })
        .select()
        .single()

      if (error) throw error
      setGuests(prev => [...prev, data])
      return data
    } catch (error) {
      console.error('Error adding guest:', error)
      throw error
    }
  }

  // Sale operations
  const addSale = async (sale: SaleInsert) => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .insert({ ...sale, event_id: sale.event_id ?? activeEvent?.id })
        .select()
        .single()

      if (error) throw error
      setSales(prev => [data, ...prev])
      
      // Update product stock
      if (sale.product_id) {
        const product = products.find(p => p.id === sale.product_id)
        if (product) {
          await updateProduct(sale.product_id, {
            stock: product.stock - sale.quantity
          })
        }
      }
      
      // Recalculate balance
      await calculateBalance()
      
      return data
    } catch (error) {
      console.error('Error adding sale:', error)
      throw error
    }
  }

  // Ticket sale operations
  const addTicketSale = async (ticketSale: TicketSaleInsert) => {
    try {
      const { data, error } = await supabase
        .from('ticket_sales')
        .insert({ ...ticketSale, event_id: ticketSale.event_id ?? activeEvent?.id })
        .select()
        .single()

      if (error) throw error
      setTicketSales(prev => [data, ...prev])
      
      // Recalculate balance
      await calculateBalance()
      
      return data
    } catch (error) {
      console.error('Error adding ticket sale:', error)
      throw error
    }
  }

  // Event operations
  const addEvent = async (event: EventInsert) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single()

      if (error) throw error
      setEvents(prev => [...prev, data])
      return data
    } catch (error) {
      console.error('Error adding event:', error)
      throw error
    }
  }

  const setActiveEventStatus = async (eventId: string, isActive: boolean) => {
    try {
      // First, deactivate all events
      await supabase
        .from('events')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000')

      // Then activate the selected event
      const { data, error } = await supabase
        .from('events')
        .update({ is_active: isActive })
        .eq('id', eventId)
        .select()
        .single()

      if (error) throw error
      
      setEvents(prev => prev.map(e => ({ ...e, is_active: e.id === eventId ? isActive : false })))
      setActiveEvent(isActive ? data : null)
      
      return data
    } catch (error) {
      console.error('Error setting active event:', error)
      throw error
    }
  }

  // Close event (arqueo de caja)
  const closeEvent = async (eventId: string) => {
    try {
      // 1. Marcar evento como cerrado
      const { error: closeError } = await supabase
        .from('events')
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('id', eventId)

      if (closeError) throw closeError

      // 2. Resetear stock de todos los productos a 0
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (stockError) throw stockError

      // 3. Actualizar estado local
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, is_active: false, closed_at: new Date().toISOString() } : e
      ))
      setActiveEvent(null)
      setProducts(prev => prev.map(p => ({ ...p, stock: 0 })))
      setSales([])
      setTicketSales([])
      setGuests([])
      setBalance(0)
    } catch (error) {
      console.error('Error closing event:', error)
      throw error
    }
  }

  // Get sales by payment method
  const getSalesByPaymentMethod = async (eventId?: string) => {
    try {
      const { data, error } = await supabase.rpc('get_sales_by_payment_method', {
        p_event_id: eventId || null
      })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting sales by payment method:', error)
      throw error
    }
  }

  // Get ticket prices from active event
  const getTicketPrices = () => {
    if (!activeEvent) {
      return { regular: 0, invitado: 0 }
    }
    return {
      regular: activeEvent.regular_ticket_price,
      invitado: activeEvent.invited_ticket_price
    }
  }

  return {
    // Data
    products,
    guests,
    sales,
    ticketSales,
    events,
    activeEvent,
    balance,
    loading,
    error,
    
    // Product operations
    addProduct,
    updateProduct,
    deleteProduct,
    
    // Guest operations
    addGuest,
    
    // Sale operations
    addSale,
    addTicketSale,
    
    // Event operations
    addEvent,
    setActiveEventStatus,
    closeEvent,
    
    // Utility functions
    getSalesByPaymentMethod,
    getTicketPrices,
    refreshData: fetchData
  }
}
