# Manso Gestión

Sistema de gestión para eventos en vivo: barra, entradas y control financiero en tiempo real. Diseñado para operar desde celular.

## Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Estilos:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth con PINs de 4 dígitos (dos cuentas internas: Control y Empleados)
- **QR:** `qrcode` (generación) · `qr-scanner` (lectura por cámara)
- **Navegación:** React Router v6 (SPA)
- **Deploy:** Vercel (Edge Functions para API routes)

---

## Secciones de la app

### Rutas privadas (`/admin/*`)

| Ruta | Acceso | Descripción |
|---|---|---|
| `/admin/home` | Control | Panel principal: balance, stock, arqueo, historial, configuración |
| `/admin/barra` | Empleados | Carrito táctil + ventas |
| `/admin/entradas` | Empleados | Scanner QR + entrada manual |
| `/admin/comunidad` | Control | Emails de asistentes exportables a Excel |

### Rutas públicas

| Ruta | Descripción |
|---|---|
| `/registro` | Formulario para registrarse y obtener entrada QR digital |
| `/mi-entrada` | Muestra el QR guardado en el dispositivo |
| `/carta` | Carta digital pública: menú con carrito y prepago por transferencia |

---

## Funcionalidad por sección

### Control (`/admin/home`)

Tiene dos pestañas:

**Operación:**
- Balance total en tiempo real vía RPC `get_current_balance`
- Crear evento: solo disponible si no hay uno activo. Genera QR descargable con formato `manso|{event_id}|{event_name}`
- Gestión de stock inicial por producto con controles +/−
- Ingresos desglosados por origen (barra / entradas) y método de pago
- Arqueo de caja: resumen del evento activo + cierre con doble confirmación
- Historial de eventos cerrados con totales

**Configuración:**
- Alias y CBU/CVU para prepago: se muestra en `/carta` al confirmar un pedido
- Cambio de PIN de Control (triple confirmación)
- Cambio de PIN de Empleados (triple confirmación)

### Barra (`/admin/barra`)
- Carrito táctil: selección de cantidades → método de pago → confirmar
- Métodos: Efectivo / Tarjeta / Transferencia
- Validación de stock inline
- Ventas recientes del evento activo

### Entradas (`/admin/entradas`)
- Scanner QR por cámara (soporte multi-formato: Manso, Luma, URL, JSON, texto libre)
- Validación contra evento activo (rechaza QRs de eventos anteriores)
- Pantalla de confirmación editable: nombre + tipo (Regular / Invitado)
- Entrada manual sin QR

### Carta digital (`/carta`)
- Menú público con productos agrupados por categoría (Bebidas / Comidas / Otros)
- Carrito con +/− por ítem
- Al confirmar: genera código único de referencia (6 chars)
- Instrucciones de pago: total + alias configurado desde Control
- El cliente muestra el comprobante de transferencia en la barra para retirar su pedido

### Registro de entrada (`/registro`)
- El cliente ingresa nombre y email
- Genera un QR único vinculado al evento activo
- QR guardado en `localStorage` del dispositivo
- El email queda registrado en la base de datos (Manso Club)

---

## Modelo de datos (Supabase)

| Tabla/Vista | Campos clave |
|---|---|
| `events` | id, name, regular_ticket_price, invited_ticket_price, is_active, closed_at |
| `products` | id, name, price, category (bebida/comida/otro), stock |
| `sales` | id, product_id, product_name, quantity, total, payment_method, event_id |
| `ticket_sales` | id, guest_name, type (regular/invitado), price, event_id |
| `guests` | id, name, type, event_id |
| `ticket_registrations` | id, event_id, name, email, token (UUID) |
| `venue_config` | id, alias_pago, cbu_pago, carta_activa |
| `active_event` | vista de `events` WHERE is_active = true |

### RLS relevante
- `venue_config`: lectura pública, escritura solo rol `control`
- `ticket_registrations`: escritura anónima (para registro público), lectura autenticada

---

## API routes (Vercel Edge Functions)

| Endpoint | Descripción |
|---|---|
| `POST /api/registro-entrada` | Registra asistente y genera token UUID |
| `POST /api/change-pin` | Cambia PIN de Control o Empleados (requiere token de Control) |
| `GET /api/keep-alive` | Ping a Supabase para evitar suspensión (cron cada 10 min) |

`/api/change-pin` requiere la variable de entorno `SUPABASE_SERVICE_ROLE_KEY` en Vercel.

---

## Variables de entorno

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # solo servidor, para change-pin
```

---

## Arrancar en desarrollo

```bash
pnpm install
pnpm dev
```

---

## Plan de debugging (auditoría 2026-04-15)

### 🔴 Críticos

| # | Ubicación | Descripción | Fix |
|---|---|---|---|
| 1 | `Barra.tsx:101` — `handleConfirmPurchase` | `Promise.all(cartItems.map(addSale))` no es atómico: si falla el ítem 3, los 2 anteriores ya se insertaron y el balance queda corrupto. | Crear RPC `add_sale_batch(items[])` en Supabase que inserte todo en una transacción; llamarla desde un único `addSaleBatch` en el store. |
| 2 | `products.stock` — sin decremento | El stock se valida en Barra antes de vender, pero nunca se descuenta en DB. Si hay dos dispositivos, el stock se puede pasar fácilmente. | Agregar trigger `after insert on sales` que reste `quantity` de `products.stock`; o incluir el UPDATE en la misma transacción del RPC del bug #1. |
| 3 | `RegistroEventos.tsx:29` — `catch {}` vacío | Si el DELETE falla por FK (ej. hay sales con ese `event_id`), el error se traga silenciosamente y la UI muestra éxito mientras el evento sigue en DB. | Relanzar el error en `handleDelete` y mostrar un mensaje de error en la UI. |

### 🟡 Importantes

| # | Ubicación | Descripción | Fix |
|---|---|---|---|
| 4 | `MiEntrada.tsx` — `findSavedTicket()` | Itera todas las keys `manso_ticket_*` en localStorage y devuelve la primera que encuentra. Si el usuario registró entradas a varios eventos, puede mostrar un QR de un evento anterior. | Leer primero el evento activo desde Supabase y cruzar con la key `manso_ticket_{active_event_id}`. |
| 5 | `EventoActivo.tsx:66` — `parseInt` | `parseInt(e.target.value)` retorna `NaN` cuando el input está vacío. Se pasa `NaN` al UPDATE en Supabase y la columna `max_capacity` queda en NULL sin validación. | Usar `parseInt(e.target.value) || null` o validar antes de llamar al update. |
| 6 | `api/change-pin.ts` — `listUsers()` | `supabase.auth.admin.listUsers()` sin parámetro `perPage` devuelve por defecto 50 usuarios. Si hay más de 50, el usuario objetivo puede no estar en la lista y el cambio de PIN fallará silenciosamente. | Pasar `{ perPage: 1000 }` o usar `getUserByEmail()` si está disponible en el SDK. |
| 7 | `useAppStore` — `activeEvent` stale | `addSale` y `addTicketSale` usan `get().activeEvent?.id` capturado al momento de la llamada. Si el evento fue cerrado desde otro dispositivo, la venta se inserta con `event_id` incorrecto hasta que la caché de 30 s expira. | Siempre leer el `event_id` desde la vista `active_event` en el servidor antes de insertar, o reducir el TTL de caché. |
| 8 | `api/registro-entrada.ts` — sin rate limiting | El endpoint público no tiene límite de solicitudes por IP ni por email. Un bot puede saturar `ticket_registrations` con emails falsos. | Agregar un header `X-Forwarded-For` check + tabla de rate-limit en Supabase, o usar Vercel WAF / middleware. |

### 🟢 Menores

| # | Ubicación | Descripción | Fix |
|---|---|---|---|
| 9 | `EventoActivo.tsx` — badge "Vivo" | El badge "En vivo" siempre se renderiza si hay `activeEvent`, sin verificar si el evento está realmente `is_active`. | Condicionar el badge a `activeEvent.is_active === true`. |
| 10 | `deleteEvent` en store | Al eliminar un evento se limpian `sales` y `ticketSales` del estado local, pero no `guests`. Si se abre la sección Entradas después, los invitados del evento borrado siguen en la UI. | Agregar `guests: state.guests.filter(g => g.event_id !== eventId)` al `set()` de `deleteEvent`. |
| 11 | `EventoActivo.tsx` — `setTimeout` sin cleanup | El `setTimeout` para mostrar el toast de capacidad guardada no retorna un cleanup en el `useEffect`. En React Strict Mode (doble render) puede dispararse dos veces. | Retornar `() => clearTimeout(timer)` en el efecto. |
| 12 | `AuthContext` — expiración de token | No hay manejo de `TOKEN_REFRESHED` / `SIGNED_OUT` por expiración. Si el token vence durante una sesión larga, las llamadas a Supabase empezarán a dar 401 sin que el usuario vea feedback. | Suscribirse a `supabase.auth.onAuthStateChange` y redirigir al login en evento `SIGNED_OUT`. |

---

## Pendientes

- Spinner hardcodeado con `setTimeout` → reemplazar por `isLoading` real del store
- Eliminar `console.log` de debug en store y componentes
- Eliminar `test-supabase.js` del root
- `carta_activa` en `venue_config`: implementar toggle para habilitar/deshabilitar `/carta`
