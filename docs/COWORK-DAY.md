# Manso Cowork Day

> Estado: **en producción.** Cowork Day en *Solo panel*: lo ve el staff, el público todavía no.

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
| `/admin/cowork` | Panel del pase: fechas, presentación y reservas |
| Control → Secciones | Visibilidad de Barra, Cowork Day y Cineclub |
| Configuración | Cambiar el fondo de la app |
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

## Secciones: tres estados, no una perilla

Control → **Secciones**. Cada sección tiene tres estados en escalera:

| Estado | Panel | Público | Staff logueado |
|---|---|---|---|
| Oculto | no | no | no |
| Solo panel | sí | no | **sí** |
| Público | sí | sí | sí |

Es una escalera y no dos perillas sueltas para que no exista el estado inválido
"público pero sin panel". Barra se queda en los dos primeros: no tiene página
pública, y la base lo rechaza con un CHECK.

Lo que hace útil al estado del medio es la última columna: la página pública
sigue viva pero sólo responde a quien tenga sesión. Sin eso no habría forma de
previsualizar lo que se está editando. La landing avisa en pantalla que todavía
no es pública, para que nadie confunda "la veo yo" con "ya salió".

El estado vive en `useVenueConfig`, un store compartido con realtime sobre
`venue_config`. Antes cada componente consultaba por su cuenta y se quedaba con
esa foto: prender una perilla guardaba bien, pero la navegación no se enteraba
hasta recargar y parecía que el toggle no hacía nada.

## La presentación se edita sin deploy

`/admin/cowork` → **Presentación**: título, leyenda, la nota de por qué pedimos
los datos, la portada y las tarjetas de "qué incluye" —agregar, borrar,
reordenar, elegir emoji—. Todo eso estaba clavado en el código.

Se guarda como un JSONB en `venue_config.cowork_landing`, por el mismo canal
de realtime que las perillas: un cambio se ve en la landing al instante.
`null` significa "los textos por defecto", que viven en
`src/lib/coworkLanding.ts` y funcionan como paracaídas si el objeto guardado
queda incompleto.

**Las tarjetas de "qué incluye" arrancan vacías a propósito.** Las cuatro que
hubo un rato (horarios, café de bienvenida, llamadas en el patio) las inventó
el agente y nadie las confirmó. Si no hay datos reales la sección no aparece,
que es mejor que prometer algo que no es cierto.

## La fecha se maneja desde Cowork

`/admin/cowork` → **Fechas**: crear, editar, pausar reservas, cerrar y borrar,
sin pasar por Operación. No hay alta duplicada — están embebidos `EventCreator`
(con el tipo Cowork Day ya elegido) y `EventEditor`, y las fechas salen del
store, que trae la fila entera que el editor necesita.

## Lo que falta para abrirlo al público

1. Cargar en **Presentación** las tarjetas reales de "qué incluye". Hoy no hay
   ninguna, así que esa sección de la landing no se muestra.
2. Crear la fecha en **Fechas**, con precio, cupo y medio de pago.
3. Control → Secciones → Cowork Day → **Público**.
4. Imprimir el cartel desde `/admin/cartel`.

## Deuda anotada

- **Migración de limpieza pendiente.** `barra_activa`, `cineclub_activo` y
  `cowork_activo` quedaron en la tabla y la pantalla de Secciones los sigue
  escribiendo junto a la visibilidad nueva, para que un deploy viejo en
  producción no se quede ciego. Van al tacho —columnas y escritura doble—
  cuando se confirme que el deploy nuevo está estable.
- **El deploy del 22/08 no se disparó solo.** El push llegó a GitHub y Vercel
  no creó nada; hubo que forzarlo con `vercel --prod`. Puede haber sido un
  evento perdido o la integración desconectada. Conviene mirarlo en el próximo
  push, porque falla en silencio.
- **Sin OG tags.** `index.html` no tiene ninguna: el link de
  `app.mansoclub.com.ar` se ve como un rectángulo gris en WhatsApp y en la bio
  de Instagram. Son diez líneas y es por donde va a llegar la mayoría.

**Ojo con crear fechas antes de mergear.** La cartelera de `/registro` filtra
los cowork day, pero ese filtro vive en esta rama: mientras producción siga en
`master`, cualquier fecha de cowork pública aparece ahí como si fuera un show.
Hasta el merge, las fechas de prueba van privadas.
