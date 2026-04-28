import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

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
          is_paid: boolean
          registrations_open: boolean
          max_capacity: number | null
          start_date?: string
          end_date?: string
          flyer_url?: string | null
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
          is_paid?: boolean
          registrations_open?: boolean
          max_capacity?: number | null
          start_date?: string
          end_date?: string
          flyer_url?: string | null
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
          is_paid?: boolean
          registrations_open?: boolean
          max_capacity?: number | null
          start_date?: string
          end_date?: string
          flyer_url?: string | null
          closed_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      ticket_registrations: {
        Row: {
          id: string
          event_id: string
          name: string
          email: string
          token: string
          receipt_url?: string | null
          registered_at: string
          used_at?: string | null
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          email: string
          token: string
          receipt_url?: string | null
          registered_at?: string
          used_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          email?: string
          token?: string
          receipt_url?: string | null
          registered_at?: string
          used_at?: string
        }
      }
      venue_config: {
        Row: {
          id: number
          alias_pago: string | null
          cbu_pago: string | null
          carta_activa: boolean | null
          current_event_id: string | null
        }
        Update: {
          alias_pago?: string | null
          cbu_pago?: string | null
          carta_activa?: boolean | null
          current_event_id?: string | null
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
