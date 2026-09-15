-- ============================================================
-- Manso Gestion — Las salas y quien esta adentro
--
-- Cada sala lleva un QR pegado en su puerta. El miembro lo apunta con
-- la camara de su celular, la pagina lo reconoce por la credencial que
-- quedo guardada en su navegador la primera vez que abrio su carnet, y
-- con un toque dice "estoy aca".
--
-- Dos cosas que hacen a este QR distinto del de la credencial:
--
--   1. Va al reves. La credencial la escanea el staff con el celular
--      del panel; la sala la escanea el miembro con el suyo. Por eso
--      el QR de la sala no lleva nuestro formato interno sino una URL
--      —/sala/<token>— que la camara del sistema sabe abrir sola, sin
--      app y sin scanner.
--
--   2. Es publico por definicion: esta pegado en una pared y cualquiera
--      que pase le puede sacar una foto. Por eso el token de sala no
--      autoriza nada, solo dice "esta es OLLEROS". Quien reclama la
--      ocupacion es la credencial del miembro, que es la que tiene que
--      tener llave vigente. Y a quien escanea sin credencial no se le
--      dice quien esta adentro: se le dice ocupada o libre, nada mas.
--      Un QR en la vereda no puede contar donde esta cada persona.
--
-- Sobre la ocupacion: un escaneo dice "entro", no dice "sigue adentro",
-- y nadie escanea al salir. Nunca. Entonces la sala se ocupa por un
-- bloque de tiempo y se libera sola; volver a escanear lo extiende.
-- Asi el tablero puede equivocarse por un bloque, no por seis horas.
-- ============================================================

-- ── Salas ───────────────────────────────────────────────────
-- Los nombres y el orden vienen de espacio_salas en manso.club, que es
-- donde Ana ya los carga para la web publica. Se importan una vez y se
-- guarda el id de alla para poder cruzarlos; el nombre de acá es una
-- copia, porque esta tabla tiene que poder existir aunque la web cambie.
create table if not exists cowork_salas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  -- espacio_salas.id en el proyecto de la pagina.
  pagina_sala_id uuid,
  -- Lo que va adentro del QR de la puerta, como parte de la URL.
  token          uuid not null unique default gen_random_uuid(),
  capacidad      int,
  -- Cuanto dura la ocupacion de un escaneo. Por sala porque no es lo
  -- mismo un escritorio que la sala de eventos.
  minutos_bloque int not null default 90 check (minutos_bloque between 15 and 720),
  -- COCINA, TERRAZA y ANTEBAR son espacios comunes: se muestran en la
  -- web pero no tiene sentido "ocuparlos". Esta perilla los deja fuera
  -- del tablero sin borrarlos.
  ocupable       boolean not null default true,
  activa         boolean not null default true,
  orden          int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists cowork_salas_orden_idx on cowork_salas (orden);

-- ── Sesiones ────────────────────────────────────────────────
-- Una fila por "fulano estuvo en esta sala desde tal hora hasta tal
-- otra". No se borra al vencer: el historial es lo que despues dice
-- que sala se usa y cual esta de adorno.
create table if not exists cowork_sesiones_sala (
  id          uuid primary key default gen_random_uuid(),
  sala_id     uuid not null references cowork_salas(id) on delete cascade,
  persona_id  uuid not null references cowork_personas(id) on delete cascade,
  -- Con que llave entro, para poder mirar el uso por tipo de plan.
  llave_id    uuid references cowork_llaves(id) on delete set null,
  inicio      timestamptz not null default now(),
  -- Cuando se libera sola si nadie vuelve a escanear.
  vence_at    timestamptz not null,
  -- Liberada a mano desde el panel antes de tiempo.
  cerrada_at  timestamptz,
  cerrada_por text,
  origen      text not null default 'qr' check (origen in ('qr', 'manual')),
  created_at  timestamptz not null default now(),

  constraint cowork_sesiones_periodo_valido check (vence_at > inicio)
);

-- La consulta del tablero: que sesiones siguen vivas.
create index if not exists cowork_sesiones_vivas_idx
  on cowork_sesiones_sala (sala_id, vence_at desc)
  where cerrada_at is null;

create index if not exists cowork_sesiones_persona_idx
  on cowork_sesiones_sala (persona_id, inicio desc);

-- No hay indice unico de "una sesion viva por persona y sala": vivir
-- depende de now(), que no se puede meter en un predicado. Lo resuelve
-- cowork_ocupar_sala(), que busca la sesion viva y la extiende en vez
-- de abrir otra.

-- ── El tablero ──────────────────────────────────────────────
create or replace view cowork_ocupacion_salas
with (security_invoker = true) as
select
  s.id,
  s.nombre,
  s.capacidad,
  s.ocupable,
  s.activa,
  s.orden,
  (select count(*) from cowork_sesiones_sala v
     where v.sala_id = s.id and v.cerrada_at is null and v.vence_at > now()) as adentro,
  ses.persona_id,
  p.nombre   as persona_nombre,
  ses.inicio as desde,
  ses.vence_at as hasta
from cowork_salas s
left join lateral (
  select * from cowork_sesiones_sala v
  where v.sala_id = s.id and v.cerrada_at is null and v.vence_at > now()
  -- Si hay varios, manda el que se queda hasta mas tarde.
  order by v.vence_at desc
  limit 1
) ses on true
left join cowork_personas p on p.id = ses.persona_id;

-- ============================================================
-- El carnet del miembro
-- ============================================================
-- Lo que ve el coworker al abrir el link que le entregamos. Es la
-- pantalla que, de paso, deja su credencial guardada en el navegador
-- para que despues el QR de una sala sepa quien es.
--
-- Callable por anon a proposito: el miembro no tiene cuenta en gestion.
-- Se entra sabiendo el token, igual que /mi-entrada con el de un
-- ticket. Devuelve solo lo que va en pantalla — ni telefono, ni notas,
-- ni cuanto pago.
create or replace function cowork_carnet(p_token uuid)
returns table (
  nombre         text,
  foto_url       text,
  puede_entrar   boolean,
  motivo         text,
  llave_tipo     text,
  llave_plan     text,
  llave_hasta    date,
  dias_restantes int,
  visitas_totales bigint,
  sala_actual    text,
  sala_hasta     timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_cred  cowork_credenciales%rowtype;
  v_per   cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
begin
  select * into v_cred from cowork_credenciales where token = p_token and revocada_at is null;
  if not found then
    return;  -- cero filas: el carnet no existe o fue revocado
  end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;

  select * into v_llave from cowork_llaves l
  where l.persona_id = v_per.id and l.anulada_at is null
    and v_hoy between l.desde and l.hasta
  order by l.hasta desc limit 1;

  return query
  select
    v_per.nombre,
    v_per.foto_url,
    (v_per.estado = 'activa' and v_llave.id is not null),
    case
      when v_per.estado = 'baja'    then 'Tu membresia esta dada de baja'
      when v_per.estado = 'pausada' then 'Tu membresia esta pausada'
      when v_llave.id is null       then 'No tenes una llave vigente'
      else null
    end::text,
    v_llave.tipo,
    v_llave.plan,
    v_llave.hasta,
    (v_llave.hasta - v_hoy)::int,
    (select count(*) from cowork_visitas v where v.persona_id = v_per.id),
    sa.nombre,
    ses.vence_at
  from (select 1) _
  left join lateral (
    select * from cowork_sesiones_sala v
    where v.persona_id = v_per.id and v.cerrada_at is null and v.vence_at > now()
    order by v.vence_at desc limit 1
  ) ses on true
  left join cowork_salas sa on sa.id = ses.sala_id;
end;
$$;

-- ============================================================
-- Escanear el QR de una sala: mirar
-- ============================================================
-- Lo que se muestra al abrir /sala/<token>, antes de tocar nada.
--
-- La credencial es opcional. Sin ella —alguien de afuera que le saco
-- una foto al QR— se devuelve el nombre de la sala y si esta libre u
-- ocupada, pero nunca por quien. Con ella, ademas, quien sos y si tu
-- llave te deja ocuparla.
create or replace function cowork_sala_estado(
  p_sala_token uuid,
  p_credencial_token uuid default null
)
returns table (
  sala_nombre    text,
  ocupable       boolean,
  libre          boolean,
  ocupada_por    text,
  ocupada_hasta  timestamptz,
  minutos_bloque int,
  soy            text,
  puedo_ocupar   boolean,
  motivo         text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_sala  cowork_salas%rowtype;
  v_ses   cowork_sesiones_sala%rowtype;
  v_cred  cowork_credenciales%rowtype;
  v_per   cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
  v_soy_yo boolean := false;
begin
  select * into v_sala from cowork_salas where token = p_sala_token and activa;
  if not found then
    return;  -- cero filas: ese QR no es de ninguna sala
  end if;

  select * into v_ses from cowork_sesiones_sala v
  where v.sala_id = v_sala.id and v.cerrada_at is null and v.vence_at > now()
  order by v.vence_at desc limit 1;

  if p_credencial_token is not null then
    select * into v_cred from cowork_credenciales
    where token = p_credencial_token and revocada_at is null;

    if found then
      select * into v_per from cowork_personas where id = v_cred.persona_id;
      select * into v_llave from cowork_llaves l
      where l.persona_id = v_per.id and l.anulada_at is null
        and v_hoy between l.desde and l.hasta
      order by l.hasta desc limit 1;
      v_soy_yo := coalesce(v_ses.persona_id = v_per.id, false);
    end if;
  end if;

  return query select
    v_sala.nombre,
    v_sala.ocupable,
    (v_ses.id is null),
    -- El nombre de quien esta adentro solo se le muestra a otro miembro
    -- con credencial valida. El QR esta en una pared: no puede contarle
    -- a un desconocido donde esta cada persona.
    case when v_per.id is not null then
      (select p2.nombre from cowork_personas p2 where p2.id = v_ses.persona_id)
    end::text,
    v_ses.vence_at,
    v_sala.minutos_bloque,
    v_per.nombre,
    (v_per.id is not null
      and v_per.estado = 'activa'
      and v_llave.id is not null
      and v_sala.ocupable
      and (v_ses.id is null or v_soy_yo)),
    case
      when v_per.id is null          then 'Abri tu carnet una vez para que este celular te reconozca'
      when v_per.estado = 'baja'     then 'Tu membresia esta dada de baja'
      when v_per.estado = 'pausada'  then 'Tu membresia esta pausada'
      when v_llave.id is null        then 'No tenes una llave vigente'
      when not v_sala.ocupable       then 'Esta sala es de uso comun'
      when v_ses.id is not null and not v_soy_yo then 'La sala esta ocupada'
      else null
    end::text;
end;
$$;

-- ============================================================
-- Escanear el QR de una sala: ocupar
-- ============================================================
-- El boton "estoy aca". Si ya habia una sesion viva de esta misma
-- persona en esta misma sala, la extiende en lugar de abrir otra: el
-- que vuelve a escanear a mitad de la tarde esta diciendo "sigo aca".
--
-- De paso registra la visita del dia si no estaba: entrar a una sala
-- ya prueba que la persona vino, asi que no hace falta que ademas
-- alguien le escanee el carnet en la puerta.
create or replace function cowork_ocupar_sala(
  p_sala_token uuid,
  p_credencial_token uuid
)
returns table (
  ok          boolean,
  motivo      text,
  sala_nombre text,
  hasta       timestamptz,
  extendida   boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_sala  cowork_salas%rowtype;
  v_cred  cowork_credenciales%rowtype;
  v_per   cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
  v_ses   cowork_sesiones_sala%rowtype;
  v_mia   cowork_sesiones_sala%rowtype;
  v_hasta timestamptz;
begin
  select * into v_sala from cowork_salas where token = p_sala_token and activa;
  if not found then
    return query select false, 'Ese QR no es de ninguna sala'::text, null::text, null::timestamptz, false;
    return;
  end if;

  if not v_sala.ocupable then
    return query select false, 'Esta sala es de uso comun'::text, v_sala.nombre, null::timestamptz, false;
    return;
  end if;

  select * into v_cred from cowork_credenciales
  where token = p_credencial_token and revocada_at is null;
  if not found then
    return query select false, 'Credencial no valida'::text, v_sala.nombre, null::timestamptz, false;
    return;
  end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;
  if v_per.estado <> 'activa' then
    return query select false, 'Tu membresia no esta activa'::text, v_sala.nombre, null::timestamptz, false;
    return;
  end if;

  select * into v_llave from cowork_llaves l
  where l.persona_id = v_per.id and l.anulada_at is null
    and v_hoy between l.desde and l.hasta
  order by l.hasta desc limit 1;

  if v_llave.id is null then
    return query select false, 'No tenes una llave vigente'::text, v_sala.nombre, null::timestamptz, false;
    return;
  end if;

  -- ¿La tiene ocupada otro?
  select * into v_ses from cowork_sesiones_sala v
  where v.sala_id = v_sala.id and v.cerrada_at is null and v.vence_at > now()
    and v.persona_id <> v_per.id
  limit 1;

  if found then
    return query select false, 'La sala esta ocupada'::text, v_sala.nombre, v_ses.vence_at, false;
    return;
  end if;

  v_hasta := now() + make_interval(mins => v_sala.minutos_bloque);

  -- ¿Ya estaba yo? Entonces esto es "sigo aca".
  select * into v_mia from cowork_sesiones_sala v
  where v.sala_id = v_sala.id and v.persona_id = v_per.id
    and v.cerrada_at is null and v.vence_at > now()
  order by v.vence_at desc limit 1;

  if found then
    update cowork_sesiones_sala set vence_at = v_hasta where id = v_mia.id;
  else
    insert into cowork_sesiones_sala (sala_id, persona_id, llave_id, vence_at, origen)
    values (v_sala.id, v_per.id, v_llave.id, v_hasta, 'qr');
  end if;

  -- La visita del dia, si no estaba.
  insert into cowork_visitas (persona_id, llave_id, fecha, origen)
  values (v_per.id, v_llave.id, v_hoy, 'qr')
  on conflict (persona_id, fecha) do nothing;

  update cowork_credenciales set ultima_vez_at = now() where id = v_cred.id;

  return query select true, null::text, v_sala.nombre, v_hasta, (v_mia.id is not null);
end;
$$;

-- ============================================================
-- RLS y permisos
-- ============================================================
alter table cowork_salas          enable row level security;
alter table cowork_sesiones_sala  enable row level security;

-- Las salas las administra control; el tablero lo mira tambien el
-- empleado, que necesita saber que hay libre.
drop policy if exists cowork_salas_control_all on cowork_salas;
create policy cowork_salas_control_all on cowork_salas
  for all using (
    auth.jwt() ->> 'email' in ('control@manso.internal', 'owner@manso.internal')
  );

drop policy if exists cowork_salas_staff_read on cowork_salas;
create policy cowork_salas_staff_read on cowork_salas
  for select using (
    auth.jwt() ->> 'email' = 'empleado@manso.internal'
  );

drop policy if exists cowork_sesiones_staff_all on cowork_sesiones_sala;
create policy cowork_sesiones_staff_all on cowork_sesiones_sala
  for all using (
    auth.jwt() ->> 'email' in ('control@manso.internal', 'owner@manso.internal', 'empleado@manso.internal')
  );

-- Las tres del miembro son callable por anon a proposito: el coworker
-- no tiene cuenta en gestion, entra sabiendo su token. Mismo modelo que
-- /mi-entrada con el token de un ticket. Ninguna lee las tablas de
-- frente: todas pasan por estas funciones, que devuelven solo lo que va
-- en pantalla.
revoke all on function cowork_carnet(uuid) from public;
revoke all on function cowork_sala_estado(uuid, uuid) from public;
revoke all on function cowork_ocupar_sala(uuid, uuid) from public;
grant execute on function cowork_carnet(uuid)              to anon, authenticated, service_role;
grant execute on function cowork_sala_estado(uuid, uuid)   to anon, authenticated, service_role;
grant execute on function cowork_ocupar_sala(uuid, uuid)   to anon, authenticated, service_role;
