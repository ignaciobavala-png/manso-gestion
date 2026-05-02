# Manso Gestión — Contexto para Agentes de IA

## Stack
- React 19 + TypeScript + Vite + Tailwind CSS
- Supabase (PostgreSQL, Auth, RLS)
- Vercel (Edge Functions vía `/api/*`)
- React Router v6 (SPA)

## Autenticación
- Dos cuentas fijas en Supabase Auth: `control@manso.internal` y `empleado@manso.internal`
- El PIN de 4 dígitos ES la contraseña de Supabase Auth
- Login: intenta con `control@` primero, luego `empleado@`
- `getRoleFromEmail()` mapea email → `'control' | 'empleado'`
- `ProtectedRoute` component: `requiredRole="control"` restringe acceso
- Cambio de PIN: Edge Function `/api/change-pin.ts` usa `SUPABASE_SERVICE_ROLE_KEY`

## Store (`src/store/useAppStore.ts`)
- Store único con Zustand (no usar useReducer ni Context para datos)
- `fetchData()` carga todas las tablas + `active_event` en paralelo, cache 30s
- `refreshData()` fuerza refetch
- Operaciones CRUD sobre: products, guests, sales, ticket_sales, events
- `addSale`, `addTicketSale` agregan automáticamente `activeEvent.id` como event_id
- `addSaleBatch(items, paymentMethod)` llama RPC `add_sale_batch` (bulk insert + stock decrement)
- `closeEvent(eventId)` setea is_active=false, closed_at=now, limpia venue_config.current_event_id

## Rutas (App.tsx)
- `/` — landing pública
- `/login` — teclado PIN
- `/registro`, `/mi-entrada`, `/carta` — públicas
- `/admin/home` — solo Control, incluye sección EntradasRegistradas (comprobantes del evento activo)
- `/admin/barra`, `/admin/entradas` — cualquier rol autenticado
- `/admin/comunidad`, `/admin/publico` — solo Control

## RLS Policies (staff por email en JWT)
- `products`, `guests`, `sales`, `ticket_sales`, `events`: `auth.jwt()->>'email' IN ('control@manso.internal','empleado@manso.internal')` para ALL
- `ticket_registrations`: INSERT público, SELECT público, ALL staff
- `venue_config`: SELECT público, ALL solo `control@manso.internal`
- `drink_orders`: INSERT público, SELECT/UPDATE autenticado (heredado)
- `storage.comprobantes`: INSERT público, SELECT/DELETE solo staff

## Esquema DB relevante
- `events` — is_active, is_paid, registrations_open, max_capacity, flyer_url, ticket_alias_pago, ticket_cbu_pago, closed_at
- `products` — visible_en_carta (bool), stock, price, category
- `ticket_registrations` — event_id, name, email, token, receipt_url, used_at (UNIQUE email+event_id)
- `guests` — event_id, type (invitado|regular)
- `sales`, `ticket_sales` — event_id FK
- `venue_config` — fila única (id=1), current_event_id, alias_pago, cbu_pago, carta_activa
- `active_event` — view: JOIN events + venue_config WHERE current_event_id = events.id

## Storage Buckets
- `event-flyers` — flyers de eventos, SELECT público, INSERT/UPDATE/DELETE staff
- `comprobantes` — comprobantes de pago, INSERT público, SELECT/DELETE solo staff. Las URLs se generan con `createSignedUrl()` para el panel admin (RLS no permite acceso público a las imágenes)

## API Edge Functions (`/api/*`)
- `registro-entrada.ts` — POST, público, usa anon key, valida capacidad + unicidad email, acepta `receipt_url` opcional
- `change-pin.ts` — POST, solo control, usa service_role key
- `keep-alive.ts` — GET, público, evita suspensión Supabase

## RPCs almacenados
- `get_current_balance(p_event_id)` — suma sales.total + ticket_sales.price
- `get_sales_by_payment_method(p_event_id)` — agrega por payment_method
- `add_sale_batch(p_event_id, p_payment_method, p_items)` — bulk insert + stock update

## Bugs conocidos
- #7 Stale activeEvent 30s — RPC server-side debería auto-detectar
- #8 Sin rate limiting en registro público
- #10 deleteEvent no limpia guests del store
- #11 setTimeout sin cleanup en EventoActivo
- #12 Sin manejo de SIGNED_OUT por expiración de token
- #13 setActiveEventStatus redundante en EventCreator

## Convenios de código
- Tailwind CSS, sin CSS modules ni styled-components
- Tipos DB manuales en `src/lib/supabase.ts` (no generar con supabase CLI)
- Store con Zustand, `get()` para acceso fuera de hooks
- Botella de fondo negro sólido, sin glass effect, texto blanco
