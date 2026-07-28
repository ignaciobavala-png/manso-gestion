# Pago de entradas con Mercado Pago

Integración de Checkout Pro para cobrar entradas online, conviviendo con el flujo
histórico de transferencia + comprobante.

---

## Modelo mental

Cada evento elige su medio de cobro (`events.payment_mode`):

| Modo | Qué ve el asistente | Cómo se verifica el pago |
|---|---|---|
| `transferencia` | Alias/CBU + subir comprobante | A mano, Ana mira el comprobante |
| `mercadopago` | Botón "Pagar con Mercado Pago" | Solo, contra la API de MP |
| `ambos` | Elige entre los dos | Según lo que haya elegido |

Un evento gratuito guarda siempre `transferencia`: no hay medio de pago que elegir.

`events.mp_surcharge_pct` (0–100, default 0) es el recargo que se suma al precio
cuando se paga con MP, para que la comisión de MP no se coma el margen. Lo define
Ana por evento desde el admin.

---

## El QR se emite antes de cobrar

**Decisión deliberada.** Las entradas se crean apenas el asistente inicia el pago,
con `payment_verified = false`. No se espera a la aprobación.

- **A favor:** el asistente nunca queda sin entrada por un webhook perdido, y el
  flujo es idéntico al de transferencia (que ya emitía el QR sin verificar).
- **En contra:** quedan entradas sin pagar en la tabla.
- **Mitigación:** al escanear un QR sin `payment_verified` en un evento pago, el
  scanner muestra el aviso naranja "Pago no verificado", con el detalle según el
  medio ("Mercado Pago todavía no acreditó este pago" o "El comprobante aún no fue
  verificado por el staff"). **No bloquea el ingreso** — la decisión final es de
  quien está en la puerta. La preference expira a los **30 minutos**
  (`EXPIRA_EN_MINUTOS` en `api/mp/preferencia.ts`).

---

## Flujo

```
RegistroEntrada.tsx
  └─ POST /api/mp/preferencia
       ├─ registrarTickets()  → tickets con payment_verified=false
       │                        y mp_external_reference compartido
       ├─ precio = regular_ticket_price * (1 + surcharge/100)   ← server-side
       └─ MP POST /checkout/preferences → init_point
  └─ window.location.href = init_point
                                        │
                            ┌───────────┴───────────┐
                            │                       │
              POST /api/mp/webhook          back_url → /pago?ref=...
              (notificación de MP)          PagoRetorno.tsx
                            │                       │
                            │              GET /api/mp/estado?ref=...
                            └──────────┬────────────┘
                                       ▼
                            RPC mp_apply_payment()
                            (única puerta de transición de estado)
```

Los tres caminos —webhook, retorno del usuario y el botón "Revisar en MP" del
admin— terminan en la misma RPC. Es idempotente (`mp_payments.payment_id UNIQUE`),
así que da igual cuál llegue primero o cuántas veces se repita.

### El QR es multievento, el aviso de pago también

Los QR se validan contra cualquier evento a propósito (ver `Entradas.tsx`: en
noches con dos eventos simultáneos, `venue_config` sólo puede apuntar a uno y
filtrar por `event_id` rebotaría entradas válidas del otro).

Por eso el aviso "Pago no verificado" se decide por el evento **del ticket**, no
por `activeEvent`. Con `activeEvent` había un falso negativo silencioso: una
entrada impaga de un evento pago escaneada durante un evento gratuito no mostraba
ningún aviso, porque el evento en operación no era pago. El QR comodín (evento
"FREES PARA MANSO", gratuito) tenía el problema inverso: avisaba de un pago que
nunca existió.

### `external_reference` es la orden, no el ticket

Un registro puede generar varias entradas (varios asistentes) y un solo pago. La
clave que las une es `mp_external_reference`. La RPC prorratea `mp_fee_amount` y
`mp_net_amount` entre todos los tickets de la orden.

`registrarTickets()` es idempotente: si los nombres ya estaban registrados
devuelve los tokens existentes sin tocarles el `mp_external_reference`. Por eso
`preferencia.ts` arma la orden **por token** y no confía en que el insert haya
escrito la referencia. Si no lo hiciera, un segundo intento de pago —volver
atrás, reintentar, doble click— generaría una preference con una referencia
huérfana: MP cobra, `mp_apply_payment` no encuentra filas y devuelve 0 sin error.

Los tickets ya acreditados quedan fuera de la orden nueva. Si todos lo están,
`/api/mp/preferencia` responde 409 en vez de cobrar dos veces.

---

## Reglas que no se rompen

**El precio nunca viene del cliente.** `registrarTickets()` no acepta un monto en
el body: lee `regular_ticket_price` de la base y lo guarda. Vale para los dos
caminos, transferencia incluida. `/api/mp/preferencia` después lo recalcula con
`mp_surcharge_pct`, y antes de crear la preference compara el total contra el
esperado y aborta con 500 si no coinciden.

**El webhook nunca confía en el body.** Toma el `data.id`, vuelve a consultar
`GET /v1/payments/{id}` y actúa sobre esa respuesta.

**`payment_verified` no baja solo.** La RPC lo sube cuando el pago se aprueba, pero
un `refunded` o `charged_back` posterior solo registra el `mp_status`. Bajarlo
automáticamente dejaría a alguien afuera en la puerta por un contracargo que Ana
todavía no revisó — esa es una decisión humana.

**La RPC no es ejecutable por el público.** `REVOKE ALL ... FROM PUBLIC, anon,
authenticated` + `GRANT EXECUTE ... TO service_role`. Solo entra desde las
funciones del backend con la service role key.

---

## Variables de entorno

| Variable | Requerida | Para qué |
|---|---|---|
| `MP_ACCESS_TOKEN` | Sí | Llamar a la API de MP. Sin esto los endpoints devuelven 503 |
| `MP_WEBHOOK_SECRET` | No | Validar la firma `x-signature`. Sin esto la validación se saltea y se loguea |
| `PUBLIC_BASE_URL` | No | Fuerza el dominio de `back_urls` y `notification_url`. Sin esto se deduce del header `origin` o `host` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Ya existía. Es lo único que puede llamar a `mp_apply_payment` |

Las credenciales van en `.env` (local) o `vercel env add` (producción). Nunca al repo.

### Sin `MP_WEBHOOK_SECRET`

El sistema funciona igual. `verifyWebhookSignature()` devuelve `'skipped'`, se
procesa la notificación y queda registrado que no se validó. El respaldo real es
`/api/mp/estado`, que consulta MP directamente: el asistente lo dispara al volver
del checkout y Ana desde "Revisar en MP".

MP solo muestra el secreto **al guardar la configuración del webhook**, y esa
configuración necesita una URL pública — o sea, la rama ya deployada.

---

## Archivos

| Archivo | Qué hace |
|---|---|
| `supabase/migrations/019_mercadopago.sql` | Columnas, tabla `mp_payments`, RPC `mp_apply_payment` |
| `api/_lib/mp.ts` | Cliente HTTP de MP y verificación de firma. Sin SDK: el oficial es Node-only y esto corre en edge |
| `api/_lib/registro.ts` | Validación + creación de tickets, compartida por transferencia y MP |
| `api/mp/preferencia.ts` | Crea tickets y la preference. Calcula el precio |
| `api/mp/webhook.ts` | Recibe notificaciones de MP |
| `api/mp/estado.ts` | Reconciliación bajo demanda por `external_reference` |
| `src/pages/public/PagoRetorno.tsx` | `/pago` — pollea el estado cada 2.5s, hasta ~40s |

La ruta pública es `/pago` y no `/registro/pago`: esta última colisionaría con
`/registro/:slug` si un evento llegara a tener el slug "pago".

---

## Puesta en marcha

1. ✅ Deploy en `https://manso-gestion.vercel.app`.
2. ✅ `MP_ACCESS_TOKEN` y `PUBLIC_BASE_URL` cargadas en Vercel (Production).
   `PUBLIC_BASE_URL` va sólo en Production: si estuviera en Preview, un deploy de
   prueba mandaría a MP las URLs del sitio real.
3. ⬜ En MP: Tus integraciones → la app → Webhooks → Configurar notificaciones.
   URL = `https://manso-gestion.vercel.app/api/mp/webhook`, evento **Pagos**
   (topic `payment`). Guardar.
4. ⬜ Copiar el secreto que aparece recién ahí → `MP_WEBHOOK_SECRET` → redeploy.
5. ⬜ Cuenta de prueba **compradora** para futuros cambios (las credenciales de
   test que da MP por defecto son las del vendedor, no sirven para comprar).

Ana ya activó las credenciales productivas.

### Validación en producción — 28/07/2026

Cobro real de $500 en el evento "prueba" (`payment_mode = 'ambos'`), con
`MP_WEBHOOK_SECRET` **todavía sin configurar**:

```
23:50:53  registro y emisión del QR
23:51:09  MP aprueba → payment_verified = true   (16 s, sin intervención)
23:51:12  segunda pasada del mismo pago → sin duplicar
```

Tres cosas quedaron probadas: el camino sin webhook alcanza para acreditar solo,
la idempotencia aguanta un aviso repetido (un `mp_payments`, un ticket), y el
prorrateo de fee/net funciona.

| | |
|---|---|
| Cobrado | $500,00 |
| Comisión MP | $21,51 (4,3%) |
| Neto | $478,49 |

Con `mp_surcharge_pct = 0` la comisión la absorbe Manso. Para cobrar $500 netos
el recargo tiene que ser ~4,5% ($522,50 al comprador). Lo define Ana por evento.

El webhook sigue siendo deseable aunque no sea bloqueante: sin él, una entrada se
acredita cuando el comprador vuelve a `/pago` o cuando Ana aprieta "Revisar en
MP". Si alguien paga y cierra el navegador, queda pendiente hasta esa revisión.

---

## Operativa para Ana

En **Entradas registradas**, una entrada de MP muestra el proveedor y el estado
traducido. Tiene dos botones:

- **Revisar en MP** — pregunta a MP y actualiza. Es la fuente autoritativa.
- **Verificar pago** — override manual, el mismo de siempre. Sirve si alguien pagó
  por fuera o si MP tarda.

El contador de "por verificar" incluye las de MP sin acreditar. Antes filtraba por
comprobante y, como las de MP no tienen, quedaban invisibles.
