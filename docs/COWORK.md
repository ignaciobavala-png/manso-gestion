# Cowork — propuesta de sección con stickers NFC

> Estado: **propuesta, nada implementado.** Documento para discutir con los socios
> antes de escribir código. Fecha: 2026-08-20.

## La idea en una línea

Cada coworker tiene un sticker NFC que, al apoyarlo contra un celular, abre una URL
única. Esa URL **es** la identidad: para el staff resuelve el check-in en la entrada,
para el coworker es su carnet digital. Todo lo demás (planes, promos, seguimiento)
se cuelga de ese identificador.

---

## 1. Cómo funciona el sticker (y qué no puede hacer)

Un NTAG213/215 (centavos por unidad) se graba con **un record NDEF de tipo URL**:

```
https://manso.../c/9f2a7c1e-...   ← token aleatorio, uno por sticker
```

Al apoyarlo contra cualquier celular moderno se abre esa URL en el navegador. **No hace
falta app ni que el coworker instale nada**, y funciona igual en Android y iPhone.

Tres cosas que conviene tener claras desde el principio:

- **iOS no puede *leer* NFC desde una web.** La Web NFC API (`NDEFReader`) es solo
  Chrome/Android. Por eso el diseño pone la URL *dentro del tag*: el sistema operativo
  la lee y abre el navegador. El flujo no depende de Web NFC en ningún punto crítico.
- **El tag es clonable.** El UID del chip no es secreto y cualquiera con un Android y
  NFC Tools puede copiar el contenido. El token de la URL es un *bearer token*: sirve
  para identificar, **no** para autorizar cosas de valor por sí solo. Ver §6.
- **Los tags hay que bloquearlos** (set read-only) después de grabarlos, si no se
  sobrescriben con un tap ajeno.

**Grabado de los stickers**: pantalla admin "Vincular sticker" que genera el token y,
en Android, lo escribe en el tag ahí mismo con Web NFC. Fallback universal: la pantalla
muestra la URL y el QR, y se graba con NFC Tools desde cualquier celular Android.

**Fallback sin NFC**: el mismo token se muestra como QR en el carnet. Si el sticker se
despega, se moja o el celular de la puerta no tiene NFC, se escanea el QR con el mismo
scanner que ya usa `/admin/entradas`. El sistema nunca queda trabado por el hardware.

---

## 2. Modelo de datos propuesto

El punto clave del diseño: **el sticker y la persona son dos cosas distintas.**

```
cowork_members ──1:N── cowork_tags        (un miembro puede tener varios stickers)
       │                                   (sticker perdido → se revoca el tag,
       │                                    el perfil y su historial quedan)
       ├──1:N── cowork_memberships ──N:1── cowork_plans
       ├──1:N── cowork_visits             (log de check-ins)
       └──1:N── cowork_perk_redemptions ──N:1── cowork_perks
```

```sql
cowork_members
  id uuid pk, full_name, email, phone, instagram,
  photo_url,                       -- se ve en la pantalla de puerta
  company text,                    -- para el caso "estudio de 4 personas"
  status  text ('activo','pausado','baja'),
  notes text, created_at

cowork_tags
  id uuid pk, member_id fk,
  token uuid unique,               -- lo que va en la URL del sticker
  label text,                      -- "llavero", "notebook"
  revoked_at timestamptz null,     -- revocar ≠ borrar
  last_used_at, created_at

cowork_plans
  id, name, price,
  kind text ('mensual_ilimitado','pack_dias','day_pass'),
  included_days int null,          -- null = ilimitado
  active bool

cowork_memberships
  id, member_id fk, plan_id fk,
  starts_on date, ends_on date,
  days_used int default 0,
  payment_status ('pagado','pendiente','vencido')

cowork_visits
  id, member_id fk, tag_id fk null, membership_id fk null,
  checked_in_at timestamptz,
  source text ('nfc','qr','manual')

cowork_perks
  id, name, description,
  kind ('visita_n','recurrente','manual'),  -- ej: café gratis, 2x1 martes
  rule jsonb, active bool

cowork_perk_redemptions
  id, perk_id fk, member_id fk, sale_id fk null,  -- enlaza con la venta de barra
  redeemed_at
```

Esto sigue el patrón que ya usa el proyecto con `ticket_registrations.token`: un UUID
opaco que viaja en el QR y se valida contra la DB.

---

## 3. Los tres flujos que importan

### a) Tap en la entrada (staff) → check-in

El celular del panel (o una tablet fija en modo puerta) apoya sobre el sticker →
abre `/c/<token>`. Como hay sesión de staff, la app muestra la **vista puerta**:

```
┌────────────────────────────┐
│  [foto]  Sofía R.          │
│  Mensual ilimitado         │
│  ● Al día — vence 12/09    │
│  Visita #37 · última: ayer │
│  [ Registrar ingreso ]     │
└────────────────────────────┘
```

Semáforo: **verde** membresía vigente · **amarillo** vence en ≤5 días o pack con 1 día
restante · **rojo** vencida/pausada/tag revocado. El botón inserta en `cowork_visits`
y descuenta día si el plan es por pack. Idempotente por día: dos taps seguidos no
cuentan dos visitas.

### b) Tap del propio coworker → carnet

La **misma URL**, sin sesión de staff, muestra el carnet: plan, vencimiento, días
restantes, beneficios activos, historial de visitas y el QR de respaldo. Es el
`/mi-entrada` del cowork. Sirve además como recordatorio de pago ("te vence el 12/09").

### c) Tap en la barra → promo

Al cobrar, el empleado tapea el sticker y la app le ofrece los perks disponibles de esa
persona ("café de cortesía — visita del día", "2x1 martes"). Al aplicarlo se registra
la redención enlazada a la venta. Esto es lo que convierte al cowork en algo que
**alimenta la barra**, no en un registro aislado.

---

## 4. Seguimiento y promociones (el porqué del proyecto)

Con `cowork_visits` poblado, el panel puede responder sin trabajo manual:

- **Ocupación**: cuánta gente hay ahora, por hora y por día de la semana. Sirve para
  decidir cuántos escritorios vender y en qué franjas empujar promos.
- **Churn**: quién no viene hace 3+ semanas teniendo plan activo → lista para
  contactar antes de que se dé de baja.
- **Aprovechamiento**: quién paga mensual y viene 2 veces (candidato a bajarlo de plan
  antes de que se enoje) y quién paga pack y viene siempre (candidato a subirlo).
- **Hitos**: visita 50, un año de miembro → perk automático.
- **Cruce con lo que ya existe**: los coworkers son la mejor base para llenar eventos y
  el Cineclub. `Comunidad` ya exporta emails; el cowork suma un segmento con criterio
  ("los que vienen seguido", "los que nunca vinieron a un evento").

Los perks arrancan **manuales** (el staff los aplica desde la barra) y recién después,
con datos reales, se automatizan con reglas. Automatizar antes de saber qué promo
funciona es construir un motor de reglas para nadie.

---

## 5. Sección en la app

Siguiendo la estructura actual (rutas públicas + `/admin/*` con `BottomNav`):

| Ruta | Acceso | Qué es |
|---|---|---|
| `/c/:token` | público | Carnet del coworker / vista puerta si hay sesión staff |
| `/cowork` | público | Info del espacio, planes y formulario de interés (leads) |
| `/admin/cowork` | control/owner | Miembros, alta, vincular sticker, estado de pagos |
| `/admin/cowork/puerta` | control/empleado | Modo puerta a pantalla completa, esperando tap |
| `/admin/cowork/stats` | owner | Ocupación, churn, ranking de visitas |

Y una **perilla `cowork_activo` en `venue_config`**, igual que la que acabamos de hacer
para el Cineclub: la sección se prende cuando esté lista, sin exponer nada a medio hacer.

---

## 6. Seguridad y privacidad

- **El token no es una llave de valor.** Un tap identifica; no paga, no abre la puerta
  física, no cobra. Lo máximo que hace por sí solo es registrar una visita y mostrar
  datos mínimos. Cualquier cosa con plata (aplicar un perk, cobrar) pasa por un staff
  logueado. Así, un tag clonado no es un incidente, es un tag a revocar.
- **RLS**: `anon` no puede hacer SELECT sobre `cowork_members`. El carnet se sirve por
  un RPC `security definer` — `cowork_card(p_token)` — que devuelve solo lo que va en
  pantalla y nada más, mismo patrón que `get_my_tickets`. El resto de las tablas,
  staff-only por email de JWT como el resto del proyecto.
- **Datos personales**: teléfono, email y notas solo para owner/control. Los empleados
  ven nombre, foto y semáforo; no necesitan más para la puerta.
- **En el sticker físico no va ningún dato**, solo la URL. Si se pierde, quien lo
  encuentre ve un carnet ajeno con nombre y plan — por eso conviene revocar rápido y
  por eso el carnet no muestra teléfono ni dirección.
- **Consentimiento**: el coworker tiene que saber que se registran sus visitas. Va en
  el alta, una línea, y se resuelve de una vez.

---

## 7. Por dónde empezar (fases)

1. **MVP — identidad y puerta.** `cowork_members` + `cowork_tags` + `/c/:token` +
   check-in + alta y vinculación de stickers. Con esto el socio ya puede comprar los
   stickers y usarlos. Sin planes, sin promos.
2. **Planes y cobro.** `cowork_plans` + `cowork_memberships` + semáforo real en la
   puerta + aviso de vencimiento en el carnet.
3. **Promos.** `cowork_perks` + redención desde la barra enlazada a `sales`.
4. **Analítica.** Ocupación, churn, hitos. Recién acá hay datos que valgan la pena.

Cada fase es usable sola. Si el proyecto se corta en la 1, el socio igual tiene el
sistema de identificación que quería.

---

## 8. Decisiones que dependen de ustedes

Estas cambian el diseño, no las quiero asumir:

1. **¿Cuántos coworkers?** 15 y 150 son sistemas distintos. Con 15, el alta manual
   desde el panel alcanza y sobra; con 150 hace falta autogestión y cobro online.
2. **¿Hay siempre alguien en la entrada?** Si sí, el modo puerta lo opera el staff
   (más simple y más seguro). Si es autoservicio, el coworker tapea con su propio
   celular y hay que evitar que se marque presente desde casa (validación por IP de la
   red del local o un tag fijo en el mostrador, no el sticker personal).
3. **¿Los planes se cobran hoy por transferencia?** Si se quiere cobro online, ya está
   la integración de Mercado Pago del módulo de entradas para reusar.
4. **¿El ingreso del cowork entra al balance del panel** (junto a barra y entradas) o
   se lleva aparte? Recomiendo aparte al inicio: el balance hoy está pensado por evento
   y una membresía mensual no encaja en esa lógica.
5. **¿El sticker es del cowork o de la persona?** Si el socio quiere darlos también a
   habitués del bar (no coworkers), el modelo aguanta, pero conviene decidirlo antes:
   cambia el nombre de las tablas y el alcance de la sección.
