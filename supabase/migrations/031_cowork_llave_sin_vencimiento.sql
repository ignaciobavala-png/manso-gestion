-- ============================================================
-- Manso Gestion — Llaves sin vencimiento
--
-- El panel de manso.club permite marcar una membresia como vitalicia,
-- y en ese caso guarda `vencimiento = null` (UsuarioDrawer.tsx). La
-- 027 habia hecho `hasta` obligatorio, asi que el puente no tendria
-- que mandar para esas y quedarian sin llave.
--
-- `hasta = null` pasa a significar "no vence". No se resuelve con una
-- fecha lejana tipo 2099-12-31 porque eso es una mentira que despues
-- alguien lee en una pantalla: el carnet diria "te quedan 26.780
-- dias" en vez de "no vence".
--
-- El precio es que toda consulta de vigencia deja de ser un BETWEEN.
-- Se concentra en cowork_llave_vigente(persona) para no repetir la
-- condicion en seis lugares y que se escape en el septimo.
-- ============================================================

alter table cowork_llaves alter column hasta drop not null;

-- El CHECK de la 027 comparaba hasta >= desde; con null da null, que
-- un CHECK acepta, asi que sigue valiendo tal cual esta.

-- El indice de vigencia ya no puede incluir `hasta` como segunda
-- columna util para un rango abierto, pero sigue sirviendo para
-- encontrar las llaves de una persona.
drop index if exists cowork_llaves_vigencia_idx;
create index if not exists cowork_llaves_vigencia_idx
  on cowork_llaves (persona_id, desde)
  where anulada_at is null;

-- ── Una sola definicion de "vigente" ────────────────────────
-- Devuelve la llave que manda hoy para una persona: la que vence mas
-- tarde, y una sin vencimiento antes que cualquiera con fecha.
create or replace function cowork_llave_vigente(p_persona_id uuid)
returns cowork_llaves
language sql
security definer
set search_path = public
stable
as $$
  select l.*
  from cowork_llaves l
  where l.persona_id = p_persona_id
    and l.anulada_at is null
    and l.desde <= (now() at time zone 'America/Argentina/Buenos_Aires')::date
    and (l.hasta is null
         or l.hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
  -- nulls first: una llave sin vencimiento le gana a una que termina.
  order by l.hasta desc nulls first
  limit 1;
$$;

-- La vista cowork_estado_personas es security_invoker, asi que corre con
-- los permisos de quien la mira: sin este grant, el panel de control no
-- podria leer su propia tabla de miembros. `authenticated` en este
-- proyecto son las tres cuentas de staff y nadie mas.
revoke all on function cowork_llave_vigente(uuid) from public, anon;
grant execute on function cowork_llave_vigente(uuid) to authenticated, service_role;

-- ── Las seis que preguntaban por su cuenta ──────────────────

create or replace view cowork_estado_personas
with (security_invoker = true) as
select
  p.id, p.nombre, p.email, p.foto_url, p.estado,
  l.id            as llave_id,
  l.tipo          as llave_tipo,
  l.plan          as llave_plan,
  l.hasta         as llave_hasta,
  (l.id is not null and p.estado = 'activa') as puede_entrar,
  -- null cuando no vence, igual que hasta: la pantalla distingue
  -- "no vence" de "vence en N dias" por este campo.
  case when l.hasta is not null
    then l.hasta - (now() at time zone 'America/Argentina/Buenos_Aires')::date
  end as dias_restantes,
  (select max(v.fecha) from cowork_visitas v where v.persona_id = p.id) as ultima_visita,
  (select count(*)     from cowork_visitas v where v.persona_id = p.id) as visitas_totales
from cowork_personas p
left join lateral (select * from cowork_llave_vigente(p.id) where id is not null) l on true;

create or replace function cowork_validar_qr(p_token uuid)
returns table (
  persona_id uuid, nombre text, foto_url text, estado text,
  puede_entrar boolean, motivo text, llave_tipo text, llave_plan text,
  llave_hasta date, dias_restantes int, ultima_visita date,
  visitas_totales bigint, ya_ingreso_hoy boolean
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_cred cowork_credenciales%rowtype;
  v_per  cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
begin
  select * into v_cred from cowork_credenciales where token = p_token;
  if not found then
    return query select null::uuid, null::text, null::text, null::text, false,
      'Este QR no es de nadie'::text, null::text, null::text, null::date,
      null::int, null::date, null::bigint, false;
    return;
  end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;
  select * into v_llave from cowork_llave_vigente(v_per.id);

  return query select
    v_per.id, v_per.nombre, v_per.foto_url, v_per.estado,
    (v_cred.revocada_at is null and v_per.estado = 'activa' and v_llave.id is not null),
    case
      when v_cred.revocada_at is not null then 'Credencial revocada'
      when v_per.estado = 'baja'          then 'Se dio de baja'
      when v_per.estado = 'pausada'       then 'Membresia pausada'
      when v_llave.id is null             then 'Sin llave vigente'
      else null
    end::text,
    v_llave.tipo, v_llave.plan, v_llave.hasta,
    case when v_llave.hasta is not null then (v_llave.hasta - v_hoy)::int end,
    (select max(v.fecha) from cowork_visitas v where v.persona_id = v_per.id),
    (select count(*)     from cowork_visitas v where v.persona_id = v_per.id),
    exists (select 1 from cowork_visitas v where v.persona_id = v_per.id and v.fecha = v_hoy);
end;
$$;

create or replace function cowork_registrar_ingreso(
  p_token uuid, p_origen text default 'qr', p_forzar boolean default false
)
returns table (ok boolean, motivo text, nombre text, ya_estaba boolean, sin_llave boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_cred cowork_credenciales%rowtype;
  v_per cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
  v_ya boolean;
begin
  select * into v_cred from cowork_credenciales where token = p_token;
  if not found then
    return query select false, 'Este QR no es de nadie'::text, null::text, false, false; return;
  end if;
  if v_cred.revocada_at is not null then
    return query select false, 'Credencial revocada'::text, null::text, false, false; return;
  end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;
  if v_per.estado = 'baja' then
    return query select false, 'Se dio de baja'::text, v_per.nombre, false, false; return;
  end if;

  select * into v_llave from cowork_llave_vigente(v_per.id);

  if v_llave.id is null and not p_forzar then
    return query select false, 'Sin llave vigente'::text, v_per.nombre, false, true; return;
  end if;

  select exists (
    select 1 from cowork_visitas v where v.persona_id = v_per.id and v.fecha = v_hoy
  ) into v_ya;

  insert into cowork_visitas (persona_id, llave_id, fecha, origen, registrada_por)
  values (v_per.id, v_llave.id, v_hoy, p_origen, auth.jwt() ->> 'email')
  on conflict (persona_id, fecha) do nothing;

  update cowork_credenciales set ultima_vez_at = now() where id = v_cred.id;

  return query select true, null::text, v_per.nombre, v_ya, (v_llave.id is null);
end;
$$;

create or replace function cowork_carnet(p_token uuid)
returns table (
  nombre text, foto_url text, puede_entrar boolean, motivo text,
  llave_tipo text, llave_plan text, llave_hasta date, dias_restantes int,
  visitas_totales bigint, sala_actual text, sala_hasta timestamptz
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_cred cowork_credenciales%rowtype;
  v_per cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
begin
  select * into v_cred from cowork_credenciales where token = p_token and revocada_at is null;
  if not found then return; end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;
  select * into v_llave from cowork_llave_vigente(v_per.id);

  return query
  select
    v_per.nombre, v_per.foto_url,
    (v_per.estado = 'activa' and v_llave.id is not null),
    case
      when v_per.estado = 'baja'    then 'Tu membresia esta dada de baja'
      when v_per.estado = 'pausada' then 'Tu membresia esta pausada'
      when v_llave.id is null       then 'No tenes una llave vigente'
      else null
    end::text,
    v_llave.tipo, v_llave.plan, v_llave.hasta,
    case when v_llave.hasta is not null then (v_llave.hasta - v_hoy)::int end,
    (select count(*) from cowork_visitas v where v.persona_id = v_per.id),
    sa.nombre, ses.vence_at
  from (select 1) _
  left join lateral (
    select * from cowork_sesiones_sala v
    where v.persona_id = v_per.id and v.cerrada_at is null and v.vence_at > now()
    order by v.vence_at desc limit 1
  ) ses on true
  left join cowork_salas sa on sa.id = ses.sala_id;
end;
$$;

create or replace function cowork_sala_estado(
  p_sala_token uuid, p_credencial_token uuid default null
)
returns table (
  sala_nombre text, ocupable boolean, libre boolean, ocupada_por text,
  ocupada_hasta timestamptz, minutos_bloque int, soy text,
  puedo_ocupar boolean, motivo text
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_sala cowork_salas%rowtype;
  v_ses cowork_sesiones_sala%rowtype;
  v_cred cowork_credenciales%rowtype;
  v_per cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
  v_soy_yo boolean := false;
begin
  select * into v_sala from cowork_salas where token = p_sala_token and activa;
  if not found then return; end if;

  select * into v_ses from cowork_sesiones_sala v
  where v.sala_id = v_sala.id and v.cerrada_at is null and v.vence_at > now()
  order by v.vence_at desc limit 1;

  if p_credencial_token is not null then
    select * into v_cred from cowork_credenciales
    where token = p_credencial_token and revocada_at is null;
    if found then
      select * into v_per from cowork_personas where id = v_cred.persona_id;
      select * into v_llave from cowork_llave_vigente(v_per.id);
      v_soy_yo := coalesce(v_ses.persona_id = v_per.id, false);
    end if;
  end if;

  return query select
    v_sala.nombre, v_sala.ocupable, (v_ses.id is null),
    case when v_per.id is not null then
      (select p2.nombre from cowork_personas p2 where p2.id = v_ses.persona_id)
    end::text,
    v_ses.vence_at, v_sala.minutos_bloque, v_per.nombre,
    (v_per.id is not null and v_per.estado = 'activa' and v_llave.id is not null
      and v_sala.ocupable and (v_ses.id is null or v_soy_yo)),
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

create or replace function cowork_ocupar_sala(p_sala_token uuid, p_credencial_token uuid)
returns table (ok boolean, motivo text, sala_nombre text, hasta timestamptz, extendida boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_sala cowork_salas%rowtype;
  v_cred cowork_credenciales%rowtype;
  v_per cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
  v_ses cowork_sesiones_sala%rowtype;
  v_mia cowork_sesiones_sala%rowtype;
  v_hasta timestamptz;
begin
  select * into v_sala from cowork_salas where token = p_sala_token and activa;
  if not found then
    return query select false, 'Ese QR no es de ninguna sala'::text, null::text, null::timestamptz, false; return;
  end if;
  if not v_sala.ocupable then
    return query select false, 'Esta sala es de uso comun'::text, v_sala.nombre, null::timestamptz, false; return;
  end if;

  select * into v_cred from cowork_credenciales
  where token = p_credencial_token and revocada_at is null;
  if not found then
    return query select false, 'Credencial no valida'::text, v_sala.nombre, null::timestamptz, false; return;
  end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;
  if v_per.estado <> 'activa' then
    return query select false, 'Tu membresia no esta activa'::text, v_sala.nombre, null::timestamptz, false; return;
  end if;

  select * into v_llave from cowork_llave_vigente(v_per.id);
  if v_llave.id is null then
    return query select false, 'No tenes una llave vigente'::text, v_sala.nombre, null::timestamptz, false; return;
  end if;

  select * into v_ses from cowork_sesiones_sala v
  where v.sala_id = v_sala.id and v.cerrada_at is null and v.vence_at > now()
    and v.persona_id <> v_per.id limit 1;
  if found then
    return query select false, 'La sala esta ocupada'::text, v_sala.nombre, v_ses.vence_at, false; return;
  end if;

  v_hasta := now() + make_interval(mins => v_sala.minutos_bloque);

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

  insert into cowork_visitas (persona_id, llave_id, fecha, origen)
  values (v_per.id, v_llave.id, v_hoy, 'qr')
  on conflict (persona_id, fecha) do nothing;

  update cowork_credenciales set ultima_vez_at = now() where id = v_cred.id;

  return query select true, null::text, v_sala.nombre, v_hasta, (v_mia.id is not null);
end;
$$;
