-- ============================================================
-- Manso Gestion — El cartel de "llegué"
--
-- Hasta ahora una visita se registraba de dos maneras: ocupando una
-- sala, o con alguien del staff escaneando el carnet en la puerta. La
-- segunda casi no pasa —no hay nadie parado en la puerta del cowork— y
-- la primera deja afuera al que viene, se sienta en la mesa grande,
-- trabaja seis horas y se va. Para el sistema, esa persona no vino.
--
-- Eso vacia justo lo que hace valioso al proyecto: la ocupacion por
-- franja, quien no viene hace tres semanas, quien paga mensual y viene
-- dos veces. Todo eso se calcula sobre cowork_visitas.
--
-- El arreglo mas barato no es poner a alguien en la puerta: es un
-- cartel mas, pegado en la entrada, que no ocupa nada y solo dice
-- "llegue". Mismo gesto que el de una sala —apuntar la camara, un
-- toque— sin reservar nada.
--
-- El token lleva tabla propia y no una columna en venue_config, que se
-- lee con el rol anon: ahi el token quedaria en el bundle del navegador
-- de cualquiera, y un miembro podria marcar su visita desde la casa.
-- Justamente el dato que este cartel viene a arreglar. Aca la tabla es
-- staff-only, igual que cowork_salas, y lo unico que sale afuera es la
-- funcion.
--
-- Igual el token no autoriza nada: el cartel esta pegado en una pared y
-- cualquiera puede fotografiarlo, asi que solo dice "esto es la entrada
-- de Manso". Quien reclama la visita es la credencial del miembro.
-- ============================================================

-- Una sola fila: el CHECK sobre una pk booleana es lo que lo garantiza.
create table if not exists cowork_entrada (
  id         boolean primary key default true check (id),
  token      uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

insert into cowork_entrada (id) values (true) on conflict (id) do nothing;

alter table cowork_entrada enable row level security;

drop policy if exists cowork_entrada_control_all on cowork_entrada;
create policy cowork_entrada_control_all on cowork_entrada
  for all using (
    auth.jwt() ->> 'email' in ('control@manso.internal', 'owner@manso.internal')
  );

drop policy if exists cowork_entrada_staff_read on cowork_entrada;
create policy cowork_entrada_staff_read on cowork_entrada
  for select using (
    auth.jwt() ->> 'email' = 'empleado@manso.internal'
  );

-- ============================================================
-- Registrar la llegada
-- ============================================================
create or replace function cowork_registrar_llegada(
  p_entrada_token   uuid,
  p_credencial_token uuid
)
returns table (ok boolean, motivo text, nombre text, ya_estaba boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_cred cowork_credenciales%rowtype;
  v_per cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
  v_ya boolean;
begin
  if not exists (select 1 from cowork_entrada where token = p_entrada_token) then
    return query select false, 'Este QR no es de la entrada'::text, null::text, false; return;
  end if;

  select * into v_cred from cowork_credenciales
  where token = p_credencial_token and revocada_at is null;
  if not found then
    return query select false, 'Credencial no valida'::text, null::text, false; return;
  end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;
  if v_per.estado <> 'activa' then
    return query select false, 'Tu membresia no esta activa'::text, v_per.nombre, false; return;
  end if;

  select * into v_llave from cowork_llave_vigente(v_per.id);
  if v_llave.id is null then
    return query select false, 'No tenes una llave vigente'::text, v_per.nombre, false; return;
  end if;

  select exists (
    select 1 from cowork_visitas v where v.persona_id = v_per.id and v.fecha = v_hoy
  ) into v_ya;

  -- Una visita por dia: el que sale a almorzar y vuelve a escanear no
  -- cuenta dos veces, igual que dos taps seguidos en la puerta.
  insert into cowork_visitas (persona_id, llave_id, fecha, origen)
  values (v_per.id, v_llave.id, v_hoy, 'qr')
  on conflict (persona_id, fecha) do nothing;

  update cowork_credenciales set ultima_vez_at = now() where id = v_cred.id;

  return query select true, null::text, v_per.nombre, v_ya;
end;
$$;

-- Misma salida que en las salas para el que todavia no abrio su carnet:
-- se identifica por mail y no se le devuelve el token. Ver la 032.
create or replace function cowork_registrar_llegada_por_email(
  p_entrada_token uuid,
  p_email         text
)
returns table (ok boolean, motivo text, nombre text, ya_estaba boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_email));
  v_persona_id uuid;
  v_token uuid;
begin
  select p.id into v_persona_id from cowork_personas p
  where lower(btrim(p.email)) = v_email and p.estado = 'activa';

  if v_persona_id is not null then
    select c.token into v_token from cowork_credenciales c
    where c.persona_id = v_persona_id and c.soporte = 'qr' and c.revocada_at is null
    limit 1;
  end if;

  if v_token is null then
    return query select false,
      'No encontramos una llave vigente con ese mail. Avisale a alguien del staff.'::text,
      null::text, false;
    return;
  end if;

  return query select * from cowork_registrar_llegada(p_entrada_token, v_token);
end;
$$;

-- Callables por anon, como las otras del miembro: el coworker no tiene
-- cuenta en gestion. Ninguna lee las tablas de frente.
revoke all on function cowork_registrar_llegada(uuid, uuid) from public;
revoke all on function cowork_registrar_llegada_por_email(uuid, text) from public;
grant execute on function cowork_registrar_llegada(uuid, uuid) to anon, authenticated, service_role;
grant execute on function cowork_registrar_llegada_por_email(uuid, text) to anon, authenticated, service_role;
