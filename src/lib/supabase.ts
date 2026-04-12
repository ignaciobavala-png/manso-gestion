import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔧 Configuración de Supabase:', {
  url: supabaseUrl ? '✅ Cargado' : '❌ Missing',
  key: supabaseAnonKey ? '✅ Cargado' : '❌ Missing',
  urlLength: supabaseUrl?.length,
  keyLength: supabaseAnonKey?.length
})

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables de entorno faltantes:', {
    VITE_SUPABASE_URL: !!supabaseUrl,
    VITE_SUPABASE_ANON_KEY: !!supabaseAnonKey
  })
  // No lanzar error para evitar que la aplicación se rompa
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')
console.log('✅ Cliente de Supabase creado exitosamente')

// Database types based on our schema
export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          stock: number
          price: number
          category: 'bebida' | 'comida' | 'otro'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          stock?: number
          price: number
          category: 'bebida' | 'comida' | 'otro'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          stock?: number
          price?: number
          category?: 'bebida' | 'comida' | 'otro'
          created_at?: string
          updated_at?: string
        }
      }
      guests: {
        Row: {
          id: string
          name: string
          type: 'invitado' | 'regular'
          event_id?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'invitado' | 'regular'
          event_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'invitado' | 'regular'
          event_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          product_id: string
          product_name: string
          quantity: number
          total: number
          payment_method: 'efectivo' | 'tarjeta' | 'transferencia'
          event_id?: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          product_name: string
          quantity: number
          total: number
          payment_method: 'efectivo' | 'tarjeta' | 'transferencia'
          event_id?: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total?: number
          payment_method?: 'efectivo' | 'tarjeta' | 'transferencia'
          event_id?: string
          created_at?: string
        }
      }
      ticket_sales: {
        Row: {
          id: string
          guest_id?: string
          guest_name: string
          type: 'regular' | 'invitado'
          price: number
          event_id?: string
          created_at: string
        }
        Insert: {
          id?: string
          guest_id?: string
          guest_name: string
          type: 'regular' | 'invitado'
          price: number
          event_id?: string
          created_at?: string
        }
        Update: {
          id?: string
          guest_id?: string
          guest_name?: string
          type?: 'regular' | 'invitado'
          price?: number
          event_id?: string
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          name: string
          description?: string
          regular_ticket_price: number
          invited_ticket_price: number
          is_active: boolean
          start_date?: string
          end_date?: string
          closed_at?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          regular_ticket_price?: number
          invited_ticket_price?: number
          is_active?: boolean
          start_date?: string
          end_date?: string
          closed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          regular_ticket_price?: number
          invited_ticket_price?: number
          is_active?: boolean
          start_date?: string
          end_date?: string
          closed_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      active_event: {
        Row: {
          id: string
          name: string
          description?: string
          regular_ticket_price: number
          invited_ticket_price: number
          is_active: boolean
          start_date?: string
          end_date?: string
          created_at: string
          updated_at: string
        }
      }
    }
    Functions: {
      get_current_balance: {
        Args: {
          p_event_id?: string
        }
        Returns: number
      }
      get_sales_by_payment_method: {
        Args: {
          p_event_id?: string
        }
        Returns: Array<{
          payment_method: 'efectivo' | 'tarjeta' | 'transferencia'
          total_amount: number
          transaction_count: number
        }>
      }
    }
  }
}
