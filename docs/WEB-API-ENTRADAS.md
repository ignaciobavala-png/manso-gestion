# API de entradas para la web (manso-club)

Contrato de las funciones que la web de Manso Club usa para vender entradas
de eventos de Gestión (primer caso: festival BLUR). Definidas en
`supabase/migrations/039_tipos_de_entrada.sql`.

## Modelo

- **Una sola fuente de verdad.** El evento, sus tipos de entrada y el stock
  viven en la base de Gestión. La web no guarda stock propio: lee
  disponibilidad y reserva contra Gestión.
- **Cada entrada es una fila de `ticket_registrations`** con un `token`. El QR
  es `manso-ticket|<token>`, el mismo formato de las entradas de la app, así el
  lector de la puerta (Gestión → Entradas) las valida igual.
- **Un pack son N filas** (N QR) a nombre de la misma persona, con el mismo
  `order_ref` y `pack_pos` 1..N. Un Pack x3 comprado dos veces son 6 filas.
- **El mail con los QR lo manda la web**, con la identidad del festival.
  Gestión no le manda mail a las filas con `origen = 'web'` (ni el de la
  entrada ni el recordatorio del día).

## Cómo llamar

Desde el **servidor** de la web, con la URL del proyecto de Gestión y su
**service role key** (nunca en el navegador):

```ts
import { createClient } from '@supabase/supabase-js'

const gestion = createClient(process.env.GESTION_SUPABASE_URL!, process.env.GESTION_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await gestion.rpc('web_reservar', { /* … */ })
```

`web_tipos_entrada` es la única que también puede llamar `anon` (son sólo
números); las otras tres tienen `EXECUTE` sólo para `service_role`.

## Errores

Todas las funciones fallan con `RAISE` y `ERRCODE P0001`. El mensaje empieza
con un **código estable** seguido de `: ` y un detalle en castellano que puede
cambiar. Hay que decidir por el código, no por el detalle:

```ts
const codigo = error?.message.split(':')[0]   // 'tipo_agotado', 'capacity_exceeded', …
```

Un error **no deja nada a medias**: cada llamada es una transacción y, si
falla, no se creó ni se cambió ninguna fila.

| Código | Lo tira | Qué significa |
|---|---|---|
| `datos_invalidos` | reservar | Falta `order_ref` o nombre, email inválido, `p_items` vacío o mal formado, `cantidad < 1`, o `p_vence_at` en el pasado. |
| `evento_inexistente` | reservar | No hay evento con ese id. |
| `evento_cerrado` | reservar | El evento ya se cerró en Gestión. |
| `ventas_pausadas` | reservar | Ana pausó el registro de entradas del evento (`registrations_open = false`). Corta la venta en Gestión **y** en la web. |
| `tipo_no_disponible` | reservar | El tipo no es de este evento, está oculto, o su estado no es `en_venta` (`proximamente`, `agotado`, `finalizado`). |
| `max_por_compra` | reservar | Se pidieron más unidades de un tipo que su `max_por_compra`. |
| `tipo_agotado` | reservar | No queda cupo en ese tipo para todo lo pedido. |
| `capacity_exceeded` | reservar | No queda aforo en el evento para todo lo pedido. |
| `orden_de_otro_evento` | reservar | El `order_ref` ya existe para otro evento o es de una compra de Gestión. Usar uno nuevo. |
| `orden_liberada` | reservar | El `order_ref` existe pero su reserva venció o se liberó. No se revive: usar uno nuevo. |
| `orden_inexistente` | confirmar, liberar | No hay filas de la web con ese `order_ref`. |
| `orden_confirmada` | liberar | La orden ya está pagada; no se libera. Para anular una entrada pagada, Ana la rechaza desde Gestión. |
| `tipo_invalido` | (trigger) | Una fila apunta a un tipo de otro evento. No debería verse usando estas funciones. |

## Funciones

### `web_tipos_entrada(p_event_id uuid)`

Tipos activos del evento, ordenados como los ordenó Ana.

| Columna | Tipo | |
|---|---|---|
| `id` | uuid | El `tipo_id` para `web_reservar`. |
| `nombre` | text | "Early Bird", "Pack x3"… Se muestra tal cual. |
| `descripcion` | text \| null | |
| `precio` | numeric | Precio de **una unidad** (un pack entero). En pesos. |
| `entradas_por_unidad` | int | 1, o N para un pack. |
| `max_por_compra` | int \| null | Máximo de unidades por compra. `null` = sin tope. |
| `estado` | text | Lo que cargó Ana: `en_venta`, `proximamente`, `agotado`, `finalizado`. |
| `estado_efectivo` | text | Igual que `estado`, salvo que un `en_venta` sin lugar para una unidad entera sale como `agotado`. **Es el que hay que mostrar.** |
| `orden` | int | |
| `disponibles_entradas` | int \| null | Entradas (QR) que todavía entran: el mínimo entre el cupo restante del tipo y el aforo restante del evento. `null` = sin tope en ningún lado. |
| `disponibles_unidades` | int \| null | `disponibles_entradas / entradas_por_unidad`, redondeado para abajo: cuántos packs se pueden vender. |

Las reservas vivas (de la web y de Mercado Pago en Gestión) ocupan lugar, así
que el número es el mismo que va a usar `web_reservar` para aceptar o
rechazar. Igual es una foto: entre leerlo y reservar alguien puede llevarse
el último lugar, y eso lo resuelve `web_reservar` con `tipo_agotado` /
`capacity_exceeded`.

El cupo de un tipo se cuenta en **entradas**, no en packs: si el Pack x3 tiene
cupo 30, entran 10 packs.

### `web_reservar(p_event_id, p_order_ref, p_nombre, p_email, p_items, p_vence_at)`

Crea las entradas **sin pagar** y devuelve una fila por QR.

| Parámetro | Tipo | |
|---|---|---|
| `p_event_id` | uuid | |
| `p_order_ref` | text | Identificador de la compra en la web. **Tiene que ser único** (un UUID por checkout). Es la clave de idempotencia. |
| `p_nombre` | text | A nombre de quién. Va igual en todas las filas, también en las de un pack. |
| `p_email` | text | Se guarda en minúscula. |
| `p_items` | jsonb | `[{"tipo_id": "<uuid>", "cantidad": 2}, …]`. `cantidad` es en **unidades** (2 = dos packs). Un tipo repetido se suma. |
| `p_vence_at` | timestamptz \| null | Hasta cuándo la reserva ocupa cupo. `null` = **no vence sola**: queda reservada hasta `web_confirmar` o `web_liberar` (transferencias que Ana revisa a mano). |

Devuelve `SETOF (token text, tipo_nombre text, pack_pos smallint, pack_size smallint)`,
en el orden en que se crearon:

```json
[
  { "token": "6f1c…", "tipo_nombre": "Early Bird", "pack_pos": null, "pack_size": null },
  { "token": "a2b9…", "tipo_nombre": "Pack x3",    "pack_pos": 1,    "pack_size": 3 },
  { "token": "c41e…", "tipo_nombre": "Pack x3",    "pack_pos": 2,    "pack_size": 3 },
  { "token": "08dd…", "tipo_nombre": "Pack x3",    "pack_pos": 3,    "pack_size": 3 }
]
```

Con `pack_pos`/`pack_size` la web arma "Pack x3 · 2/3" sin otra consulta.

- **Todo o nada.** Si una sola entrada no entra (cupo del tipo o aforo), no
  se crea ninguna y la función tira `tipo_agotado` o `capacity_exceeded`.
- **Idempotente por `order_ref`.** Si la orden ya existe y sigue viva
  (reservada o pagada), devuelve sus filas, en el mismo orden y con los
  mismos tokens, **sin mirar `p_items` de nuevo**. Si venció o se liberó, tira
  `orden_liberada`.
- **Precio:** cada fila guarda en `price_per_ticket` su parte del precio del
  tipo. En un pack se reparte y la última fila absorbe el redondeo ($70.000 =
  23.333,33 + 23.333,33 + 23.333,34), así los reportes de Gestión suman lo
  vendido. Es el precio del tipo **sin** recargos: si la web cobra un cargo
  por servicio, no queda registrado en Gestión.
- **No aplica** el límite "1 entrada por email" de Gestión ni pide Instagram o
  teléfono: eso es del formulario de Gestión.
- Las filas quedan con `origen = 'web'`, `payment_provider = 'web'` y
  `payment_verified = false`. **Mientras no se confirmen, el QR no sirve:** el
  lector las rechaza.

### `web_confirmar(p_order_ref text)`

Marca la orden como pagada. Desde ese momento los QR valen en la puerta y
se pueden recuperar desde "Mis entradas" de Gestión: el pedido por email se
las reenvía al mail (041), con el mismo QR.

Devuelve `jsonb`:

```json
{ "confirmadas": 3, "total": 3, "ya_confirmada": false, "excede_cupo": false }
```

| Campo | |
|---|---|
| `confirmadas` | Filas que pasaron a pagadas en esta llamada. |
| `total` | Filas de la orden. |
| `ya_confirmada` | `true` si no había nada que confirmar (llamada repetida). |
| `excede_cupo` | `true` si el pago llegó con la reserva **ya vencida o liberada** y, al confirmarla, el evento o algún tipo quedó por encima de su tope. |

- **Idempotente:** llamarla otra vez devuelve `confirmadas: 0, ya_confirmada: true`.
- **Pago tardío:** confirma igual (la plata entró). Si eso pasa el aforo o el
  cupo, `excede_cupo: true`: la web lo muestra como observación para Ana. No
  falla.
- Una fila que Ana rechazó desde Gestión sigue rechazada: confirmar no la revive.

### `web_liberar(p_order_ref text)`

Libera el cupo de una orden que no se va a pagar (venció el checkout, el pago
se rechazó, Ana descartó una transferencia).

Devuelve `jsonb`: `{ "liberadas": 3 }`.

- Vence ahora las filas sin pagar. Quedan en la base (con su token) pero no
  cuentan para nada y el lector las rechaza.
- **Idempotente:** la segunda llamada devuelve `liberadas: 0`.
- Una orden **ya pagada** no se libera: tira `orden_confirmada`.
- Una orden liberada **no se puede volver a reservar** con el mismo
  `order_ref` (`orden_liberada`). Si después llega el pago, `web_confirmar`
  la confirma igual (ver pago tardío).

## Flujos de la web

**Mercado Pago (o cualquier pasarela con vencimiento):**

1. `web_tipos_entrada` → mostrar tipos con `estado_efectivo` y `disponibles_unidades`.
2. `web_reservar(..., p_vence_at = vencimiento del checkout)` → si falla por
   cupo, avisar y no crear la preferencia.
3. Crear el checkout con el `order_ref` como referencia externa.
4. Webhook aprobado → `web_confirmar` → mandar el mail con los QR.
5. Pago rechazado o checkout vencido → `web_liberar`. Si no se llama, la
   reserva igual deja de ocupar cupo sola al pasar `p_vence_at`.

**Transferencia:**

1. `web_reservar(..., p_vence_at = null)` → el cupo queda tomado.
2. Ana revisa el comprobante en el admin de la web → `web_confirmar` (y mail),
   o `web_liberar` si no corresponde.

La confirmación de las entradas de la web la hace **siempre la web**. Gestión
no muestra el botón "Verificar" en esas filas: si se verificaran desde
Gestión, la web nunca se enteraría y no mandaría el mail.

## Qué ve Gestión

- **Panel → Entradas registradas:** las filas de la web aparecen con su tipo
  ("Pack x3 · 2/3") y la marca "Vendida en la web". Contadores aparte para
  "Web sin pagar" y "Web liberadas". Desglose por tipo con cuántas son de la web.
- **Evento activo / Gestión de eventos:** desglose por tipo, con las de la web incluidas.
- **Lector:** al validar muestra el tipo. Una entrada de la web sin pagar o
  liberada se rechaza en el acto (no es como una transferencia sin
  verificar, que decide el staff en la puerta).
- **Cowork:** una entrada de la web emite la llave del cowork day recién al
  confirmarse.

## Pendientes conocidos

- ~~`get_my_tickets(p_email)` es público y devuelve los QR de cualquier email.~~
  Resuelto en la 041/042: "Mis entradas" ya no muestra QR por email; los
  reenvía al mail (`api/reenviar-entradas.ts`) y el dispositivo pregunta por
  sus tokens (`get_tickets_por_token`). Los mails traen "Ver en la app" con
  `/mi-entrada#t=<tokens>`: en el fragmento y no en la query, para que los
  tokens nunca lleguen al servidor ni a los logs de Vercel. La 042 le saca el
  EXECUTE público.
- **El carnet del cowork por email** (`cowork_carnet_por_email`) todavía
  devuelve el token de la credencial a quien escriba el mail. Mismo problema,
  pendiente de decidir (ver docs/COWORK.md).
- **INSERT público por anon en `ticket_registrations`:** lo cierra la
  migración 040, que se aplica después de deployar el código que inserta con
  service role (ver el encabezado de la 040).
