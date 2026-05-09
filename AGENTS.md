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
- `flushBalance()` existe en el store pero NO se usa (eliminado de Barra porque pisaba el balance a 0 tras cada venta)

## Rutas (App.tsx)
- `/` — landing pública
- `/login` — teclado PIN (sin enlaces públicos, solo accesible escribiendo la URL)
- `/registro`, `/mi-entrada`, `/carta` — públicas
- `/admin/home` — solo Control, incluye sección EntradasRegistradas (comprobantes + gestión del evento activo)
- `/admin/barra`, `/admin/entradas` — cualquier rol autenticado
- `/admin/comunidad`, `/admin/publico` — solo Control
- `*` (catch-all) — redirige a `/` (landing), no a `/login`

## RLS Policies (staff por email en JWT)
- `products`, `guests`, `sales`, `ticket_sales`, `events`: `auth.jwt()->>'email' IN ('control@manso.internal','empleado@manso.internal')` para ALL
- `ticket_registrations`: INSERT público, SELECT público, ALL staff
- `venue_config`: SELECT público, ALL solo `control@manso.internal`
- `drink_orders`: INSERT público, SELECT/UPDATE autenticado (heredado)
- `storage.comprobantes`: INSERT público, SELECT/DELETE solo staff

## Esquema DB relevante
- `events` — is_active, is_paid, registrations_open, max_capacity, flyer_url, ticket_alias_pago, ticket_cbu_pago, closed_at
- `products` — visible_en_carta (bool), stock, price, category, sort_order (int, controla orden en carta/barra)
- `ticket_registrations` — event_id, name, email, token, receipt_url, payment_verified (bool), used_at (UNIQUE email+event_id)
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

## Directorio de migraciones
- Migraciones SQL en `supabase/migrations/` (numeradas: 001_schema, 002_rls, etc.)
- `supabase-schema.sql` es la base inicial; las migraciones numeradas son cambios posteriores sobre el schema original

## Docs
- `AGENTS.md` (raíz) — contexto para agentes de IA
- `docs/` — READMEs y documentación del proyecto

## Features implementadas recientemente

### Editar precio en Barra (Barra.tsx)
- Botón lápiz en cada product-card → input inline → Enter/Tick guarda, Escape/Cancel cancela
- Usa `updateProduct(id, { price })` del store

### Orden del menú (Carta.tsx, Barra.tsx, store)
- Columna `sort_order INTEGER NOT NULL DEFAULT 0` en products
- Productos ordenados por `sort_order` en Carta pública y Barra
- Flechas ↑↓ en cada product-card de Barra para reordenar dentro de su categoría
- Categorías con orden fijo: bebida → comida → otro

### Notificación de comprobantes (EntradasRegistradas.tsx, Toast.tsx)
- Realtime subscription a `ticket_registrations` para detectar INSERT con `receipt_url`
- Componente `Toast` — notificación no-bloqueante con auto-dismiss 5s y botón "Ver"
- Animación `slide-down` en index.css
- Al recibir un nuevo comprobante, recarga la lista de registros automáticamente

### Fix security_invoker (active_event view)
- `ALTER VIEW active_event SET (security_invoker = true)` — el view ahora respeta RLS del usuario que consulta
