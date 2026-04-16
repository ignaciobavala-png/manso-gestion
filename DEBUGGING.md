# Bugs pendientes

Auditoría realizada el 2026-04-15. Los bugs críticos e importantes de baja complejidad ya fueron reparados. Los siguientes requieren decisiones de arquitectura o infraestructura.

---

## #7 — Stale `activeEvent` entre dispositivos

**Severidad:** 🟡 Importante  
**Ubicación:** `src/store/useAppStore.ts` — `addSale`, `addTicketSale`

**Descripción:**  
El store usa `get().activeEvent?.id` al momento de insertar una venta o ticket. Si el evento fue cerrado desde otro dispositivo, el store local puede tener hasta 30 segundos de caché desactualizada, y las nuevas ventas se insertarían con el `event_id` incorrecto.

**Fix propuesto:**  
En el RPC `add_sale_batch` (ya existente) o en los inserts individuales, leer el `event_id` directamente desde la vista `active_event` en el servidor en lugar de confiar en el estado local. Alternativa más simple: reducir el TTL de caché de 30 s a 5–10 s.

---

## #8 — Sin rate limiting en `/api/registro-entrada`

**Severidad:** 🟡 Importante  
**Ubicación:** `api/registro-entrada.ts`

**Descripción:**  
El endpoint público no tiene ningún límite de solicitudes por IP ni por email. Un bot puede registrar miles de entradas con emails falsos, saturando la tabla `ticket_registrations` y consumiendo la capacidad del evento.

**Fix propuesto (opciones, de menor a mayor esfuerzo):**
1. Activar Vercel WAF (plan Pro) con reglas de rate limiting por IP.
2. Agregar middleware de Vercel que rechace más de N requests por IP en una ventana de tiempo.
3. Crear una tabla `rate_limit` en Supabase y verificar/insertar en la misma transacción del Edge Function.

---

## #12 — Sin manejo de expiración de token de auth

**Severidad:** 🟢 Menor  
**Ubicación:** `src/context/AuthContext.tsx`

**Descripción:**  
No hay suscripción a `supabase.auth.onAuthStateChange`. Si el token JWT vence durante una sesión larga (por defecto a la hora), las llamadas a Supabase empiezan a devolver 401 sin que el usuario reciba ningún feedback. La app queda en un estado roto hasta que el usuario recarga manualmente.

**Fix propuesto:**  
```ts
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      // redirigir a /login si SIGNED_OUT
    }
  })
  return () => subscription.unsubscribe()
}, [])
```
Supabase refresca el token automáticamente si la sesión sigue activa; este handler solo cubre el caso en que el refresh falla (sin conexión, token revocado, etc.).
