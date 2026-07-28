/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lógica compartida de registro de entradas. La usan tanto el flujo de
// transferencia (api/registro-entrada.ts) como el de Mercado Pago
// (api/mp/preferencia.ts), para que las reglas de capacidad, evento privado
// y campos obligatorios no puedan divergir entre un medio de pago y el otro.
//
// Los archivos bajo api/_lib/ no se publican como rutas: Vercel ignora todo
// lo que empieza con guion bajo.

export interface Attendee {
  name: string
}

export interface RegistroInput {
  attendees: Attendee[]
  email: string
  event_id: string
  receipt_url?: string
  private_token?: string
  instagram?: string
  phone?: string
  payment_provider?: 'transferencia' | 'mercadopago'
  mp_external_reference?: string
}

export interface TicketResult {
  name: string
  token: string
}

export interface EventRow {
  id: string
  name: string
  closed_at: string | null
  registrations_open: boolean
  max_capacity: number | null
  is_private: boolean
  private_token: string | null
  one_ticket_per_email: boolean
  require_instagram: boolean
  require_phone: boolean
  is_paid: boolean
  regular_ticket_price: number
  payment_mode: string
  mp_surcharge_pct: number
}

export type RegistroResult =
  | { ok: true; status: number; tickets: TicketResult[]; event: EventRow }
  | { ok: false; status: number; error: string }

const EVENT_COLUMNS =
  'id, name, closed_at, registrations_open, max_capacity, is_private, private_token, ' +
  'one_ticket_per_email, require_instagram, require_phone, is_paid, regular_ticket_price, ' +
  'payment_mode, mp_surcharge_pct'

export function anonClient(): SupabaseClient {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  )
}

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Valida el pedido y crea los tickets. Es idempotente por (event_id, email,
 * name): si el mismo nombre ya está registrado para ese email y evento,
 * devuelve el token existente en vez de duplicarlo.
 */
export async function registrarTickets(input: RegistroInput): Promise<RegistroResult> {
  const {
    attendees, email, event_id, receipt_url, private_token,
    instagram, phone, payment_provider, mp_external_reference,
  } = input

  if (!email?.trim() || !event_id || !attendees?.length) {
    return { ok: false, status: 400, error: 'Datos incompletos' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'Email inválido' }
  }

  const names = attendees
    .map(a => a.name?.trim())
    .filter((n): n is string => !!n && n.length > 0)

  if (names.length === 0) {
    return { ok: false, status: 400, error: 'Ingresá al menos un nombre' }
  }

  const supabase = anonClient()
  // Cliente admin para SELECTs internos — la política pública SELECT fue removida
  const adminSupabase = adminClient()

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('id', event_id)
    .single<EventRow>()

  if (eventError || !event) {
    return { ok: false, status: 404, error: 'Evento no encontrado' }
  }

  if (event.closed_at) {
    return { ok: false, status: 409, error: 'El evento ya finalizó' }
  }

  if (!event.registrations_open) {
    return { ok: false, status: 503, error: 'El registro de entradas está pausado momentáneamente' }
  }

  if (event.is_private && event.private_token !== private_token) {
    return { ok: false, status: 403, error: 'Acceso no autorizado' }
  }

  // Fast-fail: evita inserts obvios cuando ya está lleno, pero NO es la
  // garantía real de límite — esa la da el trigger enforce_event_capacity
  // en la DB, que usa SELECT ... FOR UPDATE para serializar concurrencia.
  if (event.max_capacity !== null) {
    const { count, error: countError } = await adminSupabase
      .from('ticket_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .eq('is_banned', false)

    if (!countError && count !== null && count + names.length > event.max_capacity) {
      return { ok: false, status: 409, error: 'No hay suficiente capacidad disponible' }
    }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const receipt = receipt_url?.trim() || null

  // Nombres ya registrados para este email+evento, para no duplicar
  // (también se usa para validar one_ticket_per_email)
  const { data: existing } = await adminSupabase
    .from('ticket_registrations')
    .select('name, token')
    .eq('event_id', event_id)
    .eq('email', normalizedEmail)

  const existingMap = new Map(
    (existing ?? []).map(r => [r.name.toLowerCase().trim(), r.token])
  )

  const newNames = names.filter(n => !existingMap.has(n.toLowerCase()))
  const tickets: TicketResult[] = names
    .filter(n => existingMap.has(n.toLowerCase()))
    .map(n => ({ name: n, token: existingMap.get(n.toLowerCase()) as string }))

  if (event.require_instagram && !instagram?.trim()) {
    return { ok: false, status: 400, error: 'El Instagram es obligatorio para este evento' }
  }

  if (event.require_phone && !phone?.trim()) {
    return { ok: false, status: 400, error: 'El teléfono es obligatorio para este evento' }
  }

  if (event.one_ticket_per_email && (existing ?? []).length > 0) {
    return { ok: false, status: 409, error: 'Este email ya tiene una entrada registrada para este evento' }
  }

  // Todos los nombres ya estaban registrados → respuesta idempotente
  if (newNames.length === 0) {
    return { ok: true, status: 200, tickets, event }
  }

  // El precio sale de la DB, nunca del body: si viniera del cliente,
  // cualquiera podría registrarse declarando que la entrada salía $1 y el
  // reporte de ingresos cerraría contra ese número inventado.
  // El flujo de MP lo pisa después con el precio con recargo.
  const precioUnitario = event.is_paid ? event.regular_ticket_price : null

  for (const name of newNames) {
    const token = crypto.randomUUID()

    const { error } = await supabase
      .from('ticket_registrations')
      .insert({
        event_id,
        name,
        email: normalizedEmail,
        token,
        receipt_url: receipt,
        instagram: instagram?.trim() || null,
        phone: phone?.trim() || null,
        price_per_ticket: precioUnitario,
        payment_provider: payment_provider ?? null,
        mp_external_reference: mp_external_reference ?? null,
      })

    if (error) {
      // P0001 es el ERRCODE que lanza el trigger enforce_event_capacity
      if (error.code === 'P0001' || error.message?.includes('capacity_exceeded')) {
        return { ok: false, status: 409, error: 'No hay suficiente capacidad disponible' }
      }
      return { ok: false, status: 500, error: 'Error al registrar' }
    }

    tickets.push({ name, token })
  }

  return { ok: true, status: 201, tickets, event }
}
