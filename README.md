# Manso Gestión

Sistema de gestión para eventos en vivo: barra, entradas y control financiero en tiempo real. Diseñado para operar desde celular con conectividad limitada.

---

## Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Estilos:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth con PINs de 4 dígitos (dos cuentas internas: Control y Empleados)
- **QR:** `qrcode` (generación) · `qr-scanner` (lectura por cámara)
- **Navegación:** React Router v6 (SPA)
- **Deploy:** Vercel (Edge Functions para API routes)

---

## Rutas

### Públicas (sin autenticación)

| Ruta | Descripción |
|---|---|
| `/` | Landing pública: acceso a Registro, Mi Entrada y Carta |
| `/registro` | Formulario para registrarse y obtener entrada QR digital. Acepta `?event=<id>` para un evento específico |
| `/mi-entrada` | Muestra el QR guardado en el dispositivo |
| `/carta` | Carta digital: menú de productos con precios (solo lectura) |

### Privadas (`/admin/*`)

| Ruta | Acceso | Descripción |
|---|---|---|
| `/admin/home` | Control | Panel principal: gestión de eventos, balance, stock, arqueo, entradas registradas |
| `/admin/barra` | Empleados | Carrito táctil + ventas |
| `/admin/entradas` | Empleados | Scanner QR + entrada manual |
| `/admin/comunidad` | Control | Emails de asistentes exportables a Excel con comprobantes de pago |
| `/admin/publico` | Control | Links a las páginas públicas (se abren en pestaña nueva) |

---

## Sistema de eventos (multievento)

La app soporta múltiples eventos en paralelo. Hay dos conceptos distintos:

| Concepto | Significado | Dónde vive |
|---|---|---|
| **Evento abierto** | Creado, no cerrado todavía | `events.is_active = true` — puede haber varios |
| **Evento en operación** | El que corre ahora (barra, entradas y balance apuntan a este) | `venue_config.current_event_id` — solo uno |

La vista `active_event` lee desde `venue_config.current_event_id` via JOIN. Todo el sistema apunta a esa vista.

### Flujo típico

1. Ana crea los eventos de la semana desde antemano (todos quedan como "abiertos")
2. Antes de cada evento, toca **Operar** en `GestionEventos` para poner ese evento en operación
3. Opera con barra y entradas; al terminar toca **Arqueo ↓** → va a la sección de arqueo → confirma el cierre
4. El evento queda en el historial; el siguiente evento se puede poner en operación

---

## Funcionalidad por sección

### Control (`/admin/home`)

Tiene dos pestañas:

**Operación:**
- **GestionEventos**: lista de eventos abiertos con conteo de entradas y capacidad; botón "Operar" para cambiar el evento en operación; botón "Arqueo ↓" que hace scroll al arqueo; historial colapsable de eventos cerrados; formulario inline con subida de flyer para crear nuevo evento. Al crear, toggle **Gratuita / Entrada paga** que condiciona si se muestra el campo de precio y si el registro público pedirá comprobante.
- **EntradasRegistradas**: sección colapsable que muestra los registros del evento en operación con thumbnail del comprobante de pago (si aplica), nombre, email, fecha y estado (Pendiente/Ingresó). Usa signed URLs temporales para acceder al bucket `comprobantes` con RLS.
- Balance total en tiempo real vía RPC `get_current_balance`
- Gestión de stock inicial por producto con controles +/−
- Ingresos desglosados por origen (barra / entradas) y método de pago
- Arqueo de caja: resumen del evento activo (balance, ventas, entradas, recaudado) + cierre con confirmación
- Historial de eventos cerrados

**Configuración:**
- Alias y CBU/CVU del local (se muestra en `/carta`)
- Cambio de PIN de Control (triple confirmación)
- Cambio de PIN de Empleados (triple confirmación)

### Barra (`/admin/barra`)
- Carrito táctil: selección de cantidades → método de pago → confirmar
- Métodos: Efectivo / Tarjeta / Transferencia
- Validación de stock inline
- Ventas recientes del evento en operación

### Entradas (`/admin/entradas`)
- Scanner QR por cámara (soporte multi-formato: Manso, Luma, URL, JSON, texto libre)
- Validación contra el evento en operación (rechaza QRs de otros eventos)
- Pantalla de confirmación editable: nombre + tipo (Regular / Invitado)
- Entrada manual sin QR

### Vistas públicas (`/admin/publico`)
- Solo Control
- Tres tarjetas con links a `/registro`, `/mi-entrada` y `/carta`
- Se abren en pestaña nueva para no perder el contexto del panel

### Registro de entrada (`/registro`)
- Si llega con `?event=<id>`: registra para ese evento específico (vía QR del evento)
- Si llega sin param: muestra carrete de eventos activos con registro abierto
- El cliente ingresa nombre y email
- Si el evento es **pago** (`is_paid = true`): debe subir una foto del comprobante de pago al bucket `comprobantes` antes de poder continuar
- Si el evento es **gratuito**: continúa directamente sin pedir comprobante
- Se genera un token UUID vinculado al evento
- QR guardado en `localStorage` del dispositivo
- El email y la URL del comprobante quedan en `ticket_registrations`

### Mi Entrada (`/mi-entrada`)
- Muestra el QR del token guardado en localStorage
- Botón para descargar la entrada como imagen PNG
- Si no hay ticket, redirige a `/registro`

### Carta digital (`/carta`)
- Menú público de solo lectura: productos agrupados por categoría (Bebidas / Comidas / Otros)
- Muestra nombre y precio de cada ítem
- Sin carrito ni proceso de pago (la integración de pagos está pendiente)

### Comprobantes de pago

Cuando un evento se crea con el toggle **Entrada paga**, el flujo público de registro pide al asistente que suba una foto o screenshot del comprobante antes de entregar el QR.

- Las imágenes se almacenan en el bucket `comprobantes` de Supabase Storage (público para INSERT)
- La URL del comprobante se guarda en `ticket_registrations.receipt_url`
- En el panel Control, la sección **Entradas registradas** muestra thumbnails de los comprobantes usando signed URLs (1h de validez) generadas con la sesión autenticada del staff
- La vista **Comunidad** (`/admin/comunidad`) también incluye un ícono 📷 para abrir el comprobante en pestaña nueva
- Las políticas RLS del bucket restringen: SELECT y DELETE solo para staff (`control@` / `empleado@`), INSERT público para que los asistentes puedan subir

Los archivos de migración están en:
- `supabase-schema.sql` — esquema base
- `supabase-rls-migration.sql` — políticas RLS granulares
- `supabase-payments-migration.sql` — columnas `is_paid` + `receipt_url` y bucket `comprobantes`

---

## QR — formatos

| Tipo | Formato | Generado en | Leído en |
|---|---|---|---|
| QR del evento (para registro) | `https://dominio/registro?event=<event_id>` | `EventCreator`, `EventoActivo` | Navegador del asistente |
| QR de ticket (entrada) | `manso-ticket\|<token>` | `MiEntrada` (canvas) | Scanner en `Entradas` |

---

## Modelo de datos (Supabase)

| Tabla / Vista | Campos clave |
|---|---|
| `events` | id, name, is_active, registrations_open, max_capacity, is_paid, flyer_url, closed_at |
| `products` | id, name, price, category, stock, visible_en_carta |
| `sales` | id, product_id, product_name, quantity, total, payment_method, event_id |
| `ticket_sales` | id, guest_name, type (regular/invitado), price, event_id |
| `guests` | id, name, type, event_id |
| `ticket_registrations` | id, event_id, name, email, token (UUID), receipt_url, used_at |
| `drink_orders` | id, event_id, items (jsonb), total, status, comprobante_token |
| `venue_config` | id, alias_pago, cbu_pago, carta_activa, current_event_id |
| `user_profiles` | id (→ auth.users), role (control / empleado) |
| `active_event` | Vista: JOIN events + venue_config WHERE venue_config.current_event_id = events.id |

### RLS vigente

Las políticas reemplazan las antiguas `FOR ALL USING (true)` por reglas granulares basadas en email del JWT:

| Tabla | Políticas |
|---|---|
| `products` | SELECT público + ALL para staff (control@, empleado@) |
| `guests` | ALL solo para staff |
| `sales` | ALL solo para staff |
| `ticket_sales` | ALL solo para staff |
| `events` | SELECT público + ALL para staff |
| `ticket_registrations` | INSERT público + SELECT público + ALL para staff |
| `venue_config` | SELECT público + ALL solo para control@ |
| `drink_orders` | INSERT público + SELECT/UPDATE autenticado (heredadas de v2.0) |
| `storage.buckets.comprobantes` | INSERT público + SELECT/DELETE solo para staff |

Los usuarios staff se identifican via `auth.jwt() ->> 'email'` contra los emails fijos `control@manso.internal` y `empleado@manso.internal`.

---

## API routes (Vercel Edge Functions)

| Endpoint | Descripción |
|---|---|
| `POST /api/registro-entrada` | Registra asistente y genera token UUID |
| `POST /api/change-pin` | Cambia PIN de Control o Empleados (requiere sesión de Control + service_role) |
| `GET /api/keep-alive` | Ping a Supabase para evitar suspensión (cron cada 10 min) |

---

## Variables de entorno

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # solo servidor, para /api/change-pin
```

---

## Arrancar en desarrollo

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:5173/` para la landing pública o `http://localhost:5173/login` para el panel de gestión.

---

## Bugs conocidos pendientes

Ver `DEBUGGING.md` para el detalle completo.

| # | Severidad | Descripción |
|---|---|---|
| 7 | 🟡 Importante | `activeEvent` stale hasta 30 s entre dispositivos — ventas pueden insertarse con event_id incorrecto |
| 8 | 🟡 Importante | Sin rate limiting en `/api/registro-entrada` — riesgo de spam de registros |
| 10 | 🟢 Menor | `deleteEvent` no limpia `guests` del estado local |
| 11 | 🟢 Menor | `setTimeout` sin cleanup en `EventoActivo` |
| 12 | 🟢 Menor | Auth: no hay manejo de expiración de token (sin redirect a login) |
| 13 | 🟢 Menor | `setActiveEventStatus` redundante en `EventCreator` |

---

## Changelog resumido

| Versión | Descripción |
|---|---|
| v1.0 | Sistema base: barra, entradas, balance monoevento |
| v2.0 | Roles (Control / Empleados), páginas públicas (registro, carta, mi entrada), auth con PIN |
| v2.1 | Multievento, landing pública `/`, vistas públicas para admin, carta simplificada a solo lectura, gestión de eventos |
| v2.2 | RLS policies granulares por email, migración de seguridad, flyers de eventos |
| v2.3 | Eventos pagos con subida de comprobante, bucket `comprobantes`, verificación de pagos en panel Control y Comunidad |
