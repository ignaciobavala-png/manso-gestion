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
  /**
   * Vencimiento de la reserva de MP. Se escribe en el mismo INSERT para que la
   * fila ocupe cupo desde que nace: si llegara después, en el medio otra
   * compra podía tomar ese lugar.
   */
  mp_expires_at?: string
  /** Eventos con tipos de entrada (migración 039). Sin esto, el flujo de siempre. */
  ticket_type_id?: string
  /** Unidades del tipo: 2 packs x3 = cantidad 2, 6 QR. */
  cantidad?: number
  /**
   * Clave de idempotencia de la compra con tipo. La genera el navegador por
   * intento: reintentar el mismo pedido (doble click, red caída) devuelve las
   * mismas filas en vez de crear otras.
   */
  order_ref?: string
}

export interface TicketResult {
  name: string
  token: string
  tipo_nombre?: string | null
  pack_pos?: number | null
  pack_size?: number | null
  /** price_per_ticket con el que quedó la fila (antes del recargo de MP). */
  precio?: number | null
}

export interface TipoRow {
  id: string
  event_id: string
  nombre: string
  precio: number
  entradas_por_unidad: number
  max_por_compra: number | null
  estado: string
  activo: boolean
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
  | { ok: true; status: number; tickets: TicketResult[]; event: EventRow; tipo: TipoRow | null }
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

/**
 * URL pública de este deploy, para armar back_urls y notification_url.
 * Se prefiere una env explícita porque en Vercel la URL del request puede
 * ser la interna del deploy y no el dominio que ve el usuario.
 */
export function resolverBaseUrl(req: Request): string {
  const explicita = process.env.PUBLIC_BASE_URL
  if (explicita) return explicita.replace(/\/$/, '')

  const origin = req.headers.get('origin')
  if (origin) return origin.replace(/\/$/, '')

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (host) return `https://${host}`

  return new URL(req.url).origin
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
  // Cliente admin para todo lo que toca ticket_registrations: no tiene SELECT
  // público, y el INSERT público se cierra en la 040.
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

  if (event.require_instagram && !instagram?.trim()) {
    return { ok: false, status: 400, error: 'El Instagram es obligatorio para este evento' }
  }

  if (event.require_phone && !phone?.trim()) {
    return { ok: false, status: 400, error: 'El teléfono es obligatorio para este evento' }
  }

  // Evento con tipos de entrada (039): el precio, el cupo y la idempotencia
  // salen del tipo y del order_ref. Un pedido sin tipo para un evento que sí
  // los tiene se rechaza: se vendería a regular_ticket_price salteando el
  // cupo de cada tipo.
  if (input.ticket_type_id) {
    return registrarConTipo(input, event, names)
  }

  const { count: tiposActivos } = await adminSupabase
    .from('event_ticket_types')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event_id)
    .eq('activo', true)

  if ((tiposActivos ?? 0) > 0) {
    return { ok: false, status: 400, error: 'Elegí un tipo de entrada' }
  }

  // Fast-fail: evita inserts obvios cuando ya está lleno, pero NO es la
  // garantía real de límite — esa la da el trigger enforce_event_capacity
  // en la DB, que usa SELECT ... FOR UPDATE para serializar concurrencia.
  //
  // Se usa el RPC en vez de contar acá para no tener dos definiciones de
  // "ocupado": el RPC y el trigger cuentan lo mismo (vendidas + reservas de
  // MP vivas, ver migración 020). Cuando divergían, la pantalla decía que
  // quedaban lugares y el insert fallaba por capacidad.
  if (event.max_capacity !== null) {
    const { data: ocupados, error: countError } = await adminSupabase
      .rpc('get_event_registration_count', { p_event_id: event_id })

    if (!countError && typeof ocupados === 'number' && ocupados + names.length > event.max_capacity) {
      return { ok: false, status: 409, error: 'No hay suficiente capacidad disponible' }
    }
  }

  const normalizedEmail = email.toLowerCase().trim()
  const receipt = receipt_url?.trim() || null

  // Nombres ya registrados para este email+evento, para no duplicar
  // (también se usa para validar one_ticket_per_email)
  const { data: existing } = await adminSupabase
    .from('ticket_registrations')
    .select('name, token, is_banned, payment_provider, payment_verified, mp_expires_at')
    .eq('event_id', event_id)
    .eq('email', normalizedEmail)

  // Las rechazadas quedan afuera de la idempotencia a propósito: si Ana
  // rechazó ese QR y la persona vuelve a registrarse, tiene que salir una
  // entrada nueva, no el token baneado que no la deja entrar.
  const existingMap = new Map(
    (existing ?? [])
      .filter(r => !r.is_banned)
      .map(r => [r.name.toLowerCase().trim(), r.token])
  )

  const newNames = names.filter(n => !existingMap.has(n.toLowerCase()))
  const tickets: TicketResult[] = names
    .filter(n => existingMap.has(n.toLowerCase()))
    .map(n => ({ name: n, token: existingMap.get(n.toLowerCase()) as string }))

  // Todos los nombres ya estaban registrados → respuesta idempotente.
  //
  // Va antes del límite por email a propósito: reintentar el mismo pago (volver
  // atrás en MP, doble click, la preference que venció) no es pedir una segunda
  // entrada, y con el chequeo primero quedaba rebotado con 409 para siempre.
  if (newNames.length === 0) {
    return { ok: true, status: 200, tickets, event, tipo: null }
  }

  // El límite de una entrada por email mira sólo las que cuentan: si alguien
  // abandonó el checkout de MP, esa fila quedó sin pagar y no puede bloquearlo
  // para siempre. Las reservas vivas sí bloquean — es su propio checkout abierto.
  if (event.one_ticket_per_email && (existing ?? []).some(r => esVendida(r) || esReservada(r))) {
    return { ok: false, status: 409, error: 'Este email ya tiene una entrada registrada para este evento' }
  }

  // El precio sale de la DB, nunca del body: si viniera del cliente,
  // cualquiera podría registrarse declarando que la entrada salía $1 y el
  // reporte de ingresos cerraría contra ese número inventado.
  // El flujo de MP lo pisa después con el precio con recargo.
  const precioUnitario = event.is_paid ? event.regular_ticket_price : null

  // Un solo INSERT para todas: si el trigger de capacidad rechaza una, no
  // queda ninguna (antes se insertaban de a una y un grupo podía quedar por
  // la mitad). Con la service role: el INSERT público por anon se cierra en
  // la migración 040.
  const filas = newNames.map(name => ({
    event_id,
    name,
    email: normalizedEmail,
    token: crypto.randomUUID(),
    receipt_url: receipt,
    instagram: instagram?.trim() || null,
    phone: phone?.trim() || null,
    price_per_ticket: precioUnitario,
    payment_provider: payment_provider ?? null,
    mp_external_reference: mp_external_reference ?? null,
    mp_expires_at: input.mp_expires_at ?? null,
  }))

  const { error } = await adminSupabase.from('ticket_registrations').insert(filas)
  if (error) return errorDeInsert(error)

  tickets.push(...filas.map(f => ({ name: f.name, token: f.token, precio: precioUnitario })))

  return { ok: true, status: 201, tickets, event, tipo: null }
}

interface EstadoFila {
  is_banned: boolean | null
  payment_provider: string | null
  payment_verified: boolean | null
  mp_expires_at: string | null
}

/** Espejo de public.entrada_vendida (039). MP y la web cuentan sólo pagadas. */
function esVendida(r: EstadoFila): boolean {
  if (r.is_banned) return false
  if (r.payment_provider !== 'mercadopago' && r.payment_provider !== 'web') return true
  return r.payment_verified === true
}

/** Espejo de public.entrada_reservada (039): compra en curso que ocupa cupo. */
function esReservada(r: EstadoFila): boolean {
  if (r.is_banned || r.payment_verified) return false
  const vence = r.mp_expires_at ? new Date(r.mp_expires_at).getTime() : null
  if (r.payment_provider === 'mercadopago') return vence !== null && vence > Date.now()
  if (r.payment_provider === 'web') return vence === null || vence > Date.now()
  return false
}

/** Errores del trigger de capacidad (P0001) a un mensaje para la persona. */
function errorDeInsert(error: { code?: string; message?: string }): RegistroResult {
  const msg = error.message ?? ''
  if (msg.includes('tipo_agotado')) {
    return { ok: false, status: 409, error: 'No quedan entradas de ese tipo' }
  }
  if (msg.includes('capacity_exceeded')) {
    return { ok: false, status: 409, error: 'No hay suficiente capacidad disponible' }
  }
  if (msg.includes('tipo_invalido')) {
    return { ok: false, status: 400, error: 'Ese tipo de entrada no es de este evento' }
  }
  return { ok: false, status: 500, error: 'Error al registrar' }
}

/**
 * Reparte el precio de una unidad entre sus filas; la última absorbe el
 * redondeo, así la suma cierra exacta: $70.000 / 3 = 23.333,33 + 23.333,33
 * + 23.333,34. Es la misma cuenta que web_reservar en la 039.
 */
export function prorratear(precioUnidad: number, filas: number): number[] {
  const base = Math.round((precioUnidad / filas) * 100) / 100
  const ultima = Math.round((precioUnidad - base * (filas - 1)) * 100) / 100
  return Array.from({ length: filas }, (_, i) => (i === filas - 1 ? ultima : base))
}

const ORDER_REF_RE = /^[A-Za-z0-9_-]{8,100}$/

/**
 * Alta de una compra con tipo de entrada. Un pack pide un nombre y genera
 * entradas_por_unidad filas por unidad, todas con ese nombre y su pack_pos.
 * Un tipo común pide un nombre por entrada, como el flujo de siempre.
 */
async function registrarConTipo(
  input: RegistroInput,
  event: EventRow,
  names: string[]
): Promise<RegistroResult> {
  const admin = adminClient()
  const orderRef = input.order_ref?.trim() ?? ''
  const cantidad = Number(input.cantidad)
  const email = input.email.toLowerCase().trim()

  if (!ORDER_REF_RE.test(orderRef)) {
    return { ok: false, status: 400, error: 'Falta la referencia de la compra' }
  }
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return { ok: false, status: 400, error: 'Cantidad inválida' }
  }

  const { data: tipo } = await admin
    .from('event_ticket_types')
    .select('id, event_id, nombre, precio, entradas_por_unidad, max_por_compra, estado, activo')
    .eq('id', input.ticket_type_id!)
    .eq('event_id', event.id)
    .maybeSingle<TipoRow>()

  if (!tipo || !tipo.activo || tipo.estado !== 'en_venta') {
    return { ok: false, status: 409, error: 'Ese tipo de entrada no está a la venta' }
  }
  tipo.precio = Number(tipo.precio)

  // Idempotencia por order_ref: el mismo intento devuelve las mismas filas.
  // Las rechazadas no se devuelven: un QR rechazado no deja entrar.
  const { data: previas } = await admin
    .from('ticket_registrations')
    .select('name, token, event_id, origen, is_banned, ticket_type_nombre, pack_pos, pack_size, price_per_ticket')
    .eq('order_ref', orderRef)
    .order('registered_at')

  if (previas && previas.length > 0) {
    if (previas.some(r => r.event_id !== event.id || r.origen !== 'gestion')) {
      return { ok: false, status: 409, error: 'Referencia de compra inválida' }
    }
    const tickets = previas
      .filter(r => !r.is_banned)
      .map(r => ({
        name: r.name,
        token: r.token,
        tipo_nombre: r.ticket_type_nombre,
        pack_pos: r.pack_pos,
        pack_size: r.pack_size,
        precio: r.price_per_ticket === null ? null : Number(r.price_per_ticket),
      }))
    return { ok: true, status: 200, tickets, event, tipo }
  }

  if (tipo.max_por_compra !== null && cantidad > tipo.max_por_compra) {
    return { ok: false, status: 400, error: `"${tipo.nombre}" permite hasta ${tipo.max_por_compra} por compra` }
  }

  const porUnidad = tipo.entradas_por_unidad
  const esPack = porUnidad > 1
  if (esPack ? names.length < 1 : names.length !== cantidad) {
    return { ok: false, status: 400, error: esPack ? 'Ingresá un nombre' : 'Ingresá un nombre por entrada' }
  }

  if (event.one_ticket_per_email) {
    const { data: existentes } = await admin
      .from('ticket_registrations')
      .select('is_banned, payment_provider, payment_verified, mp_expires_at')
      .eq('event_id', event.id)
      .eq('email', email)
    if (cantidad * porUnidad > 1) {
      return { ok: false, status: 400, error: 'Este evento permite una entrada por email' }
    }
    if ((existentes ?? []).some(r => esVendida(r) || esReservada(r))) {
      return { ok: false, status: 409, error: 'Este email ya tiene una entrada registrada para este evento' }
    }
  }

  // El precio sale del tipo en la DB, nunca del body. MP lo pisa después con
  // el recargo (api/mp/preferencia.ts).
  const precios = event.is_paid ? prorratear(tipo.precio, porUnidad) : null
  const filas = []
  for (let u = 0; u < cantidad; u++) {
    for (let p = 0; p < porUnidad; p++) {
      filas.push({
        event_id: event.id,
        name: esPack ? names[0] : names[u],
        email,
        token: crypto.randomUUID(),
        receipt_url: input.receipt_url?.trim() || null,
        instagram: input.instagram?.trim() || null,
        phone: input.phone?.trim() || null,
        price_per_ticket: precios ? precios[p] : null,
        payment_provider: input.payment_provider ?? null,
        mp_external_reference: input.mp_external_reference ?? null,
        mp_expires_at: input.mp_expires_at ?? null,
        ticket_type_id: tipo.id,
        order_ref: orderRef,
        origen: 'gestion',
        pack_pos: esPack ? p + 1 : null,
        pack_size: esPack ? porUnidad : null,
      })
    }
  }

  // Un solo INSERT: el trigger controla aforo y cupo del tipo fila por fila, y
  // si una no entra no queda ninguna (un pack nunca sale por la mitad).
  const { error } = await admin.from('ticket_registrations').insert(filas)
  if (error) return errorDeInsert(error)

  const tickets = filas.map(f => ({
    name: f.name,
    token: f.token,
    tipo_nombre: tipo.nombre,
    pack_pos: f.pack_pos,
    pack_size: f.pack_size,
    precio: f.price_per_ticket,
  }))
  return { ok: true, status: 201, tickets, event, tipo }
}
