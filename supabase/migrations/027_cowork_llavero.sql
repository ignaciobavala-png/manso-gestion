-- ============================================================
-- Manso Gestion — El llavero del cowork
--
-- Manso Gestion pasa a ser la duena de la llave: acá se responde
-- "¿esta persona puede entrar hoy?" y en ningun otro lado.
--
-- La llave es una FILA CON PERIODO, no un estado calculado. Asi el
-- pase de un dia y la membresia mensual son la misma cosa con
-- distinta duracion, y renovar es emitir otra llave en vez de pisar
-- la anterior: queda historial de quien pago que y hasta cuando.
--
-- De donde nace cada llave:
--   * dia     — adentro de gestion, por trigger sobre ticket_registrations
--               cuando el evento tiene cowork_day = true.
--   * mensual — la manda manso.club por POST /api/cowork/llave cuando
--               un admin activa la membresia. Gestion escucha, no consulta.
--   * manual  — la carga el staff desde el panel (cortesias, canjes).
--
-- El email es el unico dato que comparten los dos sistemas, asi que
-- es la clave para emparejar personas. Los de la pagina vienen
-- verificados; los del cowork day los tipea la gente en el formulario.
-- Por eso la persona es una entidad propia y no una columna: dos
-- filas duplicadas se unifican sin perder las llaves ni las visitas.
-- ============================================================

-- ── Personas ────────────────────────────────────────────────
create table if not exists cowork_personas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  email           text not null,
  telefono        text,
  instagram       text,
  foto_url        text,
  -- auth.users.id de manso.club. Null mientras la persona solo haya
  -- comprado dias sueltos y nunca se haya hecho cuenta en la pagina.
  pagina_user_id  uuid,
  estado          text not null default 'activa'
                  check (estado in ('activa', 'pausada', 'baja')),
  notas           text,
  created_at      timestamptz not null default now()
);

-- El email se guarda como lo escribieron, pero se compara normalizado:
-- "Sofia@Gmail.com " y "sofia@gmail.com" son la misma persona.
create unique index if not exists cowork_personas_email_key
  on cowork_personas (lower(btrim(email)));

create index if not exists cowork_personas_pagina_idx
  on cowork_personas (pagina_user_id)
  where pagina_user_id is not null;

-- ── Llaves ──────────────────────────────────────────────────
create table if not exists cowork_llaves (
  id           uuid primary key default gen_random_uuid(),
  persona_id   uuid not null references cowork_personas(id) on delete cascade,
  tipo         text not null check (tipo in ('dia', 'mensual')),

  -- Dias calendario, inclusive de los dos lados. Un pase de un dia
  -- tiene desde = hasta. No hay horas: la llave vale el dia entero.
  desde        date not null,
  hasta        date not null,

  origen       text not null check (origen in ('cowork_day', 'pagina', 'manual')),
  -- ticket_registrations.id | user_membresias_activas.id de la pagina |
  -- null si la cargo el staff a mano.
  origen_ref   text,
  -- Nombre del plan al momento de emitir ("FULL", "LITE", "Flex 1D").
  -- Snapshot, igual que cowork_solicitudes.membresia_nombre en la pagina:
  -- si el plan se renombra, la llave vieja sigue diciendo que se vendio.
  plan         text,
  -- Los planes de la pagina estan en USD y el cowork day en pesos,
  -- por eso la moneda viaja al lado del numero.
  precio       numeric(10,2),
  moneda       text check (moneda in ('ARS', 'USD')),

  -- Revocar no es borrar: una llave anulada explica por que alguien
  -- entro el martes y no puede entrar el miercoles.
  anulada_at   timestamptz,
  anulada_por  text,
  created_at   timestamptz not null default now(),

  constraint cowork_llaves_periodo_valido check (hasta >= desde)
);

-- Idempotencia: reintentar el POST de la pagina o correr dos veces el
-- backfill no puede duplicar la llave.
create unique index if not exists cowork_llaves_origen_key
  on cowork_llaves (origen, origen_ref)
  where origen_ref is not null;

-- La consulta de la puerta: llaves de una persona que cubren una fecha.
create index if not exists cowork_llaves_vigencia_idx
  on cowork_llaves (persona_id, desde, hasta)
  where anulada_at is null;

-- ── Visitas ─────────────────────────────────────────────────
create table if not exists cowork_visitas (
  id            uuid primary key default gen_random_uuid(),
  persona_id    uuid not null references cowork_personas(id) on delete cascade,
  -- Con que llave entro. Null si el staff la dejo pasar sin llave
  -- vigente (invitado, prueba, cortesia) — eso tambien es un dato.
  llave_id      uuid references cowork_llaves(id) on delete set null,
  fecha         date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  checked_in_at timestamptz not null default now(),
  origen        text not null default 'manual' check (origen in ('qr', 'nfc', 'manual')),
  registrada_por text
);

-- Dos taps seguidos en la puerta son una visita, no dos.
create unique index if not exists cowork_visitas_dia_key
  on cowork_visitas (persona_id, fecha);

create index if not exists cowork_visitas_fecha_idx
  on cowork_visitas (fecha desc);

-- ============================================================
-- Emision de llaves
-- ============================================================
-- Una sola puerta de entrada para los tres origenes: encuentra o crea
-- la persona por email y emite. Si la llave ya existe (mismo origen y
-- referencia) devuelve la que habia, no una nueva.
create or replace function cowork_emitir_llave(
  p_email      text,
  p_nombre     text,
  p_tipo       text,
  p_desde      date,
  p_hasta      date,
  p_origen     text,
  p_origen_ref text default null,
  p_plan       text default null,
  p_precio     numeric default null,
  p_moneda     text default null,
  p_pagina_user_id uuid default null,
  p_telefono   text default null,
  p_instagram  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona_id uuid;
  v_llave_id   uuid;
  v_email      text := lower(btrim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'cowork_emitir_llave: el email es obligatorio';
  end if;

  select id into v_persona_id
  from cowork_personas
  where lower(btrim(email)) = v_email;

  if v_persona_id is null then
    insert into cowork_personas (nombre, email, pagina_user_id, telefono, instagram)
    values (
      coalesce(nullif(btrim(p_nombre), ''), v_email), v_email, p_pagina_user_id,
      nullif(btrim(p_telefono), ''), nullif(btrim(p_instagram), '')
    )
    returning id into v_persona_id;
  else
    -- La persona ya existia. Se completan los huecos y nada mas: un dato
    -- cargado a mano en el panel no lo pisa un formulario posterior.
    update cowork_personas
      set pagina_user_id = coalesce(p_pagina_user_id, pagina_user_id),
          telefono       = coalesce(telefono, nullif(btrim(p_telefono), '')),
          instagram      = coalesce(instagram, nullif(btrim(p_instagram), ''))
      where id = v_persona_id;
  end if;

  insert into cowork_llaves (
    persona_id, tipo, desde, hasta, origen, origen_ref, plan, precio, moneda
  )
  values (
    v_persona_id, p_tipo, p_desde, p_hasta, p_origen, p_origen_ref, p_plan, p_precio, p_moneda
  )
  on conflict (origen, origen_ref) where origen_ref is not null
  do update set
    -- Reenviar la misma referencia con otras fechas es una correccion
    -- (se extendio la membresia, se corrigio la fecha), no una llave nueva.
    desde  = excluded.desde,
    hasta  = excluded.hasta,
    plan   = excluded.plan,
    precio = excluded.precio,
    moneda = excluded.moneda,
    anulada_at = null,
    anulada_por = null
  returning id into v_llave_id;

  return v_llave_id;
end;
$$;

-- ============================================================
-- Cowork day: de entrada vendida a llave
-- ============================================================
-- El pase de un dia se vende como un evento con cowork_day = true y la
-- compra queda en ticket_registrations. Este trigger convierte esa
-- compra en llave, con la misma definicion de "vendida" que usa el CRM
-- (api/crm/events.ts): no baneada, y si pago por Mercado Pago, acreditada.
--
-- Va como trigger y no como webhook de Mercado Pago a proposito: asi
-- tambien emite cuando el staff carga una entrada a mano o verifica un
-- comprobante de transferencia desde el panel.
create or replace function cowork_llave_desde_registracion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  events%rowtype;
  v_fecha  date;
  v_vendida boolean;
begin
  select * into v_event from events where id = new.event_id;
  if not found or not v_event.cowork_day then
    return new;
  end if;

  v_vendida := not coalesce(new.is_banned, false)
    and (new.payment_provider is distinct from 'mercadopago' or coalesce(new.payment_verified, false));

  -- La fecha del pase es el dia del evento en hora de Buenos Aires:
  -- start_date es timestamptz y un evento de la manana no puede caer
  -- en el dia anterior por leer el UTC crudo.
  v_fecha := (v_event.start_date at time zone 'America/Argentina/Buenos_Aires')::date;

  if v_vendida then
    perform cowork_emitir_llave(
      p_email      => new.email,
      p_nombre     => new.name,
      p_tipo       => 'dia',
      p_desde      => v_fecha,
      p_hasta      => v_fecha,
      p_origen     => 'cowork_day',
      p_origen_ref => new.id::text,
      p_plan       => v_event.name,
      p_precio     => new.price_per_ticket,
      p_moneda     => 'ARS',
      p_telefono   => new.phone,
      p_instagram  => new.instagram
    );
  else
    -- Rechazar el QR o desverificar el pago apaga la llave, no la borra.
    update cowork_llaves
      set anulada_at = coalesce(anulada_at, now()),
          anulada_por = coalesce(anulada_por, 'cowork_day: la entrada dejo de estar vendida')
      where origen = 'cowork_day' and origen_ref = new.id::text;
  end if;

  return new;
end;
$$;

drop trigger if exists cowork_llave_registracion on ticket_registrations;
create trigger cowork_llave_registracion
  after insert or update of is_banned, payment_verified, payment_provider, email, name
  on ticket_registrations
  for each row execute function cowork_llave_desde_registracion();

-- ============================================================
-- La pregunta de la puerta
-- ============================================================
-- Todo el semaforo sale de acá: verde si hay llave hoy, y cuantos dias
-- le quedan para avisar antes de que venza.
-- security_invoker: sin esto la vista corre con permisos del owner y se
-- saltea el RLS de las tablas de abajo. La pantalla de puerta para el
-- empleado va a necesitar un RPC aparte que devuelva solo nombre, foto
-- y semaforo — esta vista es para el panel de control/owner.
create or replace view cowork_estado_personas
with (security_invoker = true) as
select
  p.id,
  p.nombre,
  p.email,
  p.foto_url,
  p.estado,
  l.id            as llave_id,
  l.tipo          as llave_tipo,
  l.plan          as llave_plan,
  l.hasta         as llave_hasta,
  (l.id is not null and p.estado = 'activa') as puede_entrar,
  l.hasta - (now() at time zone 'America/Argentina/Buenos_Aires')::date as dias_restantes,
  (select max(v.fecha) from cowork_visitas v where v.persona_id = p.id) as ultima_visita,
  (select count(*)     from cowork_visitas v where v.persona_id = p.id) as visitas_totales
from cowork_personas p
left join lateral (
  select * from cowork_llaves l2
  where l2.persona_id = p.id
    and l2.anulada_at is null
    and (now() at time zone 'America/Argentina/Buenos_Aires')::date between l2.desde and l2.hasta
  -- Si tiene mensual y ademas compro un dia, manda el que vence mas tarde.
  order by l2.hasta desc
  limit 1
) l on true;

-- ============================================================
-- RLS — mismo criterio que el resto del proyecto
-- ============================================================
-- Acá hay email, telefono y notas de gente real: nada de esto se lee
-- sin sesion de staff. La emision desde la pagina entra por la API con
-- service role, que no pasa por RLS.
alter table cowork_personas enable row level security;
alter table cowork_llaves   enable row level security;
alter table cowork_visitas  enable row level security;

-- Personas y llaves: solo control/owner. El empleado de la puerta no
-- necesita ver el telefono ni cuanto pago cada uno.
drop policy if exists cowork_personas_control_all on cowork_personas;
create policy cowork_personas_control_all on cowork_personas
  for all using (
    auth.jwt() ->> 'email' in ('control@manso.internal', 'owner@manso.internal')
  );

drop policy if exists cowork_llaves_control_all on cowork_llaves;
create policy cowork_llaves_control_all on cowork_llaves
  for all using (
    auth.jwt() ->> 'email' in ('control@manso.internal', 'owner@manso.internal')
  );

-- Visitas: el empleado tiene que poder registrar el ingreso.
drop policy if exists cowork_visitas_staff_all on cowork_visitas;
create policy cowork_visitas_staff_all on cowork_visitas
  for all using (
    auth.jwt() ->> 'email' in ('control@manso.internal', 'owner@manso.internal', 'empleado@manso.internal')
  );

revoke all on function cowork_emitir_llave from anon;
