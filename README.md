# Manso Gestión

Sistema de gestión para eventos: barra, entradas y control financiero en tiempo real. Diseñado para operar desde celular durante el evento.

## Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Estilos:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + RLS)
- **QR:** `qrcode` (generación) · `qr-scanner` (lectura por cámara)
- **Navegación:** SPA con estado en `App.tsx`, sin router externo

---

## Lo que está funcionando

### Flujo general
- La app requiere crear un evento antes de poder operar Barra o Entradas
- Si no hay evento activo, ambas secciones muestran una pantalla de bloqueo
- Todas las transacciones (ventas, tickets, guests) quedan vinculadas al `event_id`

### Control (`Home.tsx`)
- Balance total en tiempo real vía RPC `get_current_balance`
- Creación de evento: nombre + descripción → guarda en Supabase → genera QR descargable
- Formato QR propio: `manso|{event_id}|{event_name}`
- Gestión de stock inicial por producto con controles +/−
- Ingresos desglosados por origen (barra / entradas) y método de pago
- Arqueo de caja con resumen de ventas + cierre con confirmación de dos pasos
  - Al cerrar: marca evento inactivo, resetea stock a 0, limpia estado local

### Barra (`Barra.tsx`)
- Sistema de carrito: selección libre de cantidades por producto → método de pago → confirmar todo junto
- Métodos de pago: Efectivo / Tarjeta / Transferencia
- Validación de stock con banner inline (sin `alert` nativo del navegador)
- Banner "Venta registrada" al confirmar exitosamente
- Botones +/− de 44px para uso táctil cómodo
- Agregar y eliminar productos desde la misma pantalla
- Ventas recientes al pie

### Entradas (`Entradas.tsx`)
- Scanner QR por cámara con limpieza correcta al desmontar
- Pantalla de confirmación editable: nombre del asistente + tipo (Regular / Invitado)
- Soporte multi-formato: QR de Manso, Luma (lu.ma), URL con query params, JSON, texto libre
- Entrada manual de invitados sin QR
- Cámara adaptada al ancho del teléfono (`w-full aspect-square`)

---

## Pendiente — próxima sesión

### Alta prioridad
- **Reemplazar `alert()` / `confirm()` nativos restantes**
  - Barra: validación de "Agregar Item" y confirmación de "Eliminar producto"
  - Entradas: errores de invitado manual y error de registro de entrada
- **Store global compartido** (Zustand o Context)
  - Hoy cada tab hace fetch completo al montar (6 queries en paralelo)
  - En venue con conectividad pobre genera lag en cada cambio de pestaña
- **Spinner hardcodeado** (`setTimeout 1000ms` en cada página)
  - Debería usar el `loading` real del store en lugar de un timer arbitrario

### Media prioridad
- **Precios de entradas configurables desde la UI**
  - Hoy viven en la BD pero no hay pantalla para editarlos
- **Historial de eventos cerrados**
  - Ver arqueos anteriores desde Control
- **Página Principal** (`Main.tsx`)
  - Revisar qué muestra y si tiene sentido mantenerla

### Baja prioridad
- Eliminar `test-supabase.js` del root (archivo de prueba temporal)
- Eliminar `console.log` de debug que quedaron en el store y componentes
- Documentar si `active_event` en Supabase es una vista o una tabla real

---

## Modelo de datos (Supabase)

| Tabla | Campos clave |
|---|---|
| `events` | id, name, description, is_active, regular_ticket_price, invited_ticket_price, closed_at |
| `products` | id, name, price, category, stock |
| `sales` | id, product_id, product_name, quantity, total, payment_method, event_id, created_at |
| `ticket_sales` | id, guest_name, type, price, event_id, created_at |
| `guests` | id, name, type, event_id, created_at |
| `active_event` | vista de `events` WHERE is_active = true |

---

## Arrancar en desarrollo

```bash
pnpm install
pnpm dev
```

Requiere `.env` en la raíz:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
