# Bugs pendientes

Última auditoría: 2026-05-07.

---

## ✔️ Corregidos en sesión 2026-05-07

- **#14 — Catch-all redirigía a `/login`**: ahora redirige a `/` (landing pública). Fix en `src/App.tsx`.
- **#15 — Sin recuperación de QR por email**: MiEntrada ahora permite buscar entradas por email desde la DB. Fix en `src/pages/public/MiEntrada.tsx`.
- **#16 — `flushBalance()` reseteaba balance a 0**: eliminado el llamado en `Barra.tsx`. El balance se acumula correctamente.
- **#17 — QR de descarga con token `undefined` en EntradasRegistradas**: faltaba `token` en la query SELECT y la interfaz. Fix en `src/components/EntradasRegistradas.tsx`.
- **#18 — `payment_verified`**: nueva columna en DB + UI de 3 estados (Pendiente / Verificado / Ingresó) + botón Verificar pago + advertencia en scanner.
- **#19 — Comunidad mostraba comprobantes**: eliminados, solo contactos (nombre, email, evento, fecha).

---

## #7 — Stale `activeEvent` entre dispositivos

**Severidad:** 🟡 Importante
**Ubicación:** `src/store/useAppStore.ts` — `addSale`, `addTicketSale`

El store usa `get().activeEvent?.id` al insertar una venta. Si el evento fue cerrado desde otro dispositivo, el store local puede tener hasta 30 s de caché desactualizada y las nuevas ventas se insertarían con `event_id` incorrecto.

**Fix propuesto:** En el RPC `add_sale_batch` leer el `event_id` directamente desde la vista `active_event` en el servidor, en lugar de confiar en el estado local.

---

## #8 — Sin rate limiting en `/api/registro-entrada`

**Severidad:** 🟡 Importante
**Ubicación:** `api/registro-entrada.ts`

El endpoint público no tiene límite de solicitudes por IP ni por email. Un bot puede saturar `ticket_registrations` con emails falsos.

**Fix propuesto:** Agregar middleware de rate limiting en Vercel (Edge Config o WAF), o una tabla de control en Supabase con ventana deslizante por IP.

---

## #10 — `deleteEvent` no limpia `guests` del estado local

**Severidad:** 🟢 Menor
**Ubicación:** `src/store/useAppStore.ts` — `deleteEvent`

Al eliminar un evento se limpian `sales` y `ticketSales` del estado local, pero no `guests`. Si se navega a Entradas después, los invitados del evento borrado siguen visibles en la UI hasta el próximo fetch.

**Fix:** Agregar `guests: state.guests.filter(g => g.event_id !== eventId)` al `set()` de `deleteEvent`.

---

## #11 — `setTimeout` sin cleanup en `EventoActivo`

**Severidad:** 🟢 Menor
**Ubicación:** `src/components/EventoActivo.tsx`

Hay dos timers que comparten `capacityTimerRef`: el de "capacidad guardada" y el de "alias guardado". Ambos se limpian mutuamente al guardar el otro. No causa error funcional pero es desprolijo.

**Fix:** Crear un ref separado para el timer de alias, o un ref genérico para el último timer activo.

---

## #12 — Sin manejo de expiración de token de auth

**Severidad:** 🟢 Menor
**Ubicación:** `src/context/AuthContext.tsx`

No hay manejo de `SIGNED_OUT` por expiración de token. Si el token vence durante una sesión larga, las llamadas a Supabase dan 401 sin que el usuario vea feedback ni sea redirigido al login.

**Fix:** Suscribirse a `supabase.auth.onAuthStateChange` y redirigir a `/login` en el evento `SIGNED_OUT`.

---

## #13 — `setActiveEventStatus` redundante en `EventCreator`

**Severidad:** 🟢 Menor
**Ubicación:** `src/components/EventCreator.tsx`

Después de `addEvent()` (que ya inserta con `is_active: true` y setea `current_event_id`), `EventCreator` llama `setActiveEventStatus(event.id, true)` que vuelve a escribir `is_active: true` en la DB. La llamada es redundante, pero el `refreshData()` interno sí es necesario para sincronizar `activeEvent` en el store.

**Fix limpio:** Hacer que `addEvent` en el store llame a `refreshData()` después de insertar, y eliminar la llamada a `setActiveEventStatus` desde `EventCreator`.
