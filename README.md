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

## Pendientes

- Spinner hardcodeado con `setTimeout` → reemplazar por `isLoading` real del store
- Eliminar `console.log` de debug en store y componentes
- Eliminar `test-supabase.js` del root
- `carta_activa` en `venue_config`: implementar toggle para habilitar/deshabilitar `/carta`
