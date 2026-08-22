# Manso Cowork Day

> Estado: **implementado, migración sin aplicar.** Rama `cowork-day`.

## Qué es

Vender el pase de cowork por día con las mismas herramientas que las entradas
de eventos. Cada fecha es una fila en `events` con `cowork_day = true`: precio,
cupo, Mercado Pago, QR y "Rechazar QR" funcionan igual que en cualquier show,
sin código nuevo.

Esto **no** es la propuesta de membresías con stickers NFC de `COWORK.md`. Eso
es otro sistema (miembros, planes, visitas) y otro momento. Acá se vende un día
suelto y nada más.

## El miedo de Ana, y qué lo resuelve de verdad

El pedido original era "un formulario antes de aceptar el pago". Un formulario
por sí solo no filtra a nadie: si al terminar de escribir se abre Mercado Pago
igual, entra cualquiera que tenga ganas de escribir cuatro renglones. Filtra
sólo si alguien mira la respuesta antes de habilitar el pago.

Se eligió **no frenar la venta**: la persona reserva y paga de una, y el
control es posterior. Concretamente:

1. Al reservar un Cowork Day se piden **nombre, teléfono e Instagram**
   (`require_phone` y `require_instagram`, que ya existían por evento y se
   prenden solas al marcar la fecha como Cowork Day).
2. Ana ve esos datos en el panel de entradas, junto a cada reserva.
3. Si alguien no le cierra, usa **"Rechazar QR"**, que ya existe: invalida el
   QR y devuelve el cupo.

El Instagram es el filtro más barato que hay — una cuenta real con cara y
seguidores dice más que cualquier respuesta escrita.

**Lo que esto no hace:** rechazar no devuelve la plata. El reembolso es a mano
desde Mercado Pago. Si eso empieza a pasar seguido, la conversación cambia y la
opción correcta pasa a ser aprobación previa al pago.

## Cambios

| Dónde | Qué |
|---|---|
| `022_cowork_day.sql` | `venue_config.cowork_activo` (perilla) y `events.cowork_day` |
| `/cowork` | Landing pública: qué incluye, precio y fechas abiertas |
| `/` (Inicio) | Tarjeta destacada arriba de todo, sujeta a la perilla |
| `/registro` | La cartelera esconde los Cowork Day; el formulario explica por qué pide los datos |
| `/admin/cartel` | Cartel imprimible con el QR de `app.mansoclub.com.ar` |
| Configuración | Perilla Cowork Day junto a la del Cineclub |
| Crear/editar evento | "Tipo de fecha: Evento / Cowork Day" |

## Difusión del dominio nuevo

`app.mansoclub.com.ar` no se entera nadie desde adentro de la app: quien ya está
adentro, ya llegó. El único canal que alcanza a la gente que está en el local es
el papel, y para eso está `/admin/cartel`: elegís destino (Inicio, Cowork Day,
Carta, Eventos), imprimís y pegás en las mesas, la barra y la puerta. Desde el
celular, "Imprimir" también guarda un PDF para mandarle a la imprenta.

**Pendiente y barato:** el `index.html` no tiene ninguna meta tag Open Graph.
Hoy, cuando alguien pega el link en WhatsApp o en la bio de Instagram, sale un
rectángulo gris sin título ni imagen. Con OG tags sale el logo y el nombre.

## Para poner en producción

1. Aplicar `supabase/migrations/022_cowork_day.sql`. **Sin esto la app no
   levanta**: varias pantallas piden `cowork_day` y `cowork_activo`.
2. Configuración → prender la perilla **Cowork Day**.
3. Crear la primera fecha con "Tipo de fecha: Cowork Day", precio, cupo y
   Mercado Pago.
4. Imprimir el cartel desde `/admin/cartel`.
