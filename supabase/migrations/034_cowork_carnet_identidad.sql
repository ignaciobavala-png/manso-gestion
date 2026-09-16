-- ============================================================
-- Manso Gestion — El carnet como carta de identidad
--
-- Dos cosas, y las dos salen de mirar el sistema andando.
--
-- 1. La sala sale del camino por mail.
--
-- Con la 033, escribir el mail de alguien alcanzaba para ver en que
-- sala esta y hasta que hora. Que un desconocido vea el plan de otro es
-- molesto; que vea donde esta sentado en este momento es otra cosa, y
-- es justo lo que el diseno de las salas evitaba: el QR pegado en una
-- pared nunca dice por quien esta ocupada. Ahora el estado de sala sale
-- solo por /c/<token>, que es el link propio de cada persona.
--
-- 2. El carnet deja de ser un porta-QR.
--
-- Hoy nadie escanea los ingresos: no hay nadie parado en la puerta del
-- cowork. Asi que el QR, como credencial de puerta, no es lo que hace
-- util a esta pantalla — lo util es que sea una carta de identidad: que
-- diga quien sos, que sos socio y que estas al dia. Para eso le faltaban
-- dos datos que un carnet siempre tiene: un numero y desde cuando.
--
-- El numero se asigna por antiguedad y no se reusa. Es identidad, no un
-- indice: si alguien se da de baja, su numero se va con el.
-- ============================================================

alter table cowork_personas add column if not exists numero int;

-- Los que ya estan, numerados por antiguedad.
with orden as (
  select id, row_number() over (order by created_at, id) as n
  from cowork_personas
)
update cowork_personas p
   set numero = orden.n
  from orden
 where orden.id = p.id and p.numero is null;

create sequence if not exists cowork_personas_numero_seq owned by cowork_personas.numero;
select setval(
  'cowork_personas_numero_seq',
  coalesce((select max(numero) from cowork_personas), 0) + 1,
  false
);
alter table cowork_personas alter column numero set default nextval('cowork_personas_numero_seq');
alter table cowork_personas alter column numero set not null;

create unique index if not exists cowork_personas_numero_key on cowork_personas (numero);

-- ============================================================
-- El carnet, con los dos datos nuevos y la sala como decision
-- ============================================================
drop function if exists cowork_carnet_de_persona(uuid);
drop function if exists cowork_carnet(uuid);
drop function if exists cowork_carnet_por_email(text);

create or replace function cowork_carnet_de_persona(
  p_persona_id uuid,
  -- Falso cuando quien mira llego escribiendo un mail y no con su link.
  p_con_sala boolean default true
)
returns table (
  nombre text, foto_url text, puede_entrar boolean, motivo text,
  llave_tipo text, llave_plan text, llave_hasta date, dias_restantes int,
  visitas_totales bigint, sala_actual text, sala_hasta timestamptz,
  email text, numero int, socio_desde date
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_per cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
begin
  select * into v_per from cowork_personas where id = p_persona_id;
  if not found then return; end if;

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
    case when p_con_sala then sa.nombre end,
    case when p_con_sala then ses.vence_at end,
    v_per.email, v_per.numero,
    (v_per.created_at at time zone 'America/Argentina/Buenos_Aires')::date
  from (select 1) _
  left join lateral (
    select * from cowork_sesiones_sala v
    where v.persona_id = v_per.id and v.cerrada_at is null and v.vence_at > now()
    order by v.vence_at desc limit 1
  ) ses on true
  left join cowork_salas sa on sa.id = ses.sala_id;
end;
$$;

create or replace function cowork_carnet(p_token uuid)
returns table (
  nombre text, foto_url text, puede_entrar boolean, motivo text,
  llave_tipo text, llave_plan text, llave_hasta date, dias_restantes int,
  visitas_totales bigint, sala_actual text, sala_hasta timestamptz,
  email text, numero int, socio_desde date
)
language plpgsql security definer set search_path = public stable as $$
declare v_cred cowork_credenciales%rowtype;
begin
  select * into v_cred from cowork_credenciales where token = p_token and revocada_at is null;
  if not found then return; end if;
  -- Con el link propio si: saber donde estoy sentado es un dato mio.
  return query select * from cowork_carnet_de_persona(v_cred.persona_id, true);
end;
$$;

create or replace function cowork_carnet_por_email(p_email text)
returns table (
  nombre text, foto_url text, puede_entrar boolean, motivo text,
  llave_tipo text, llave_plan text, llave_hasta date, dias_restantes int,
  visitas_totales bigint, sala_actual text, sala_hasta timestamptz,
  email text, numero int, socio_desde date, token uuid
)
language plpgsql security definer set search_path = public stable as $$
declare v_email text := lower(btrim(p_email)); v_persona_id uuid; v_token uuid;
begin
  select p.id into v_persona_id from cowork_personas p
  where lower(btrim(p.email)) = v_email;
  if v_persona_id is null then return; end if;

  select c.token into v_token from cowork_credenciales c
  where c.persona_id = v_persona_id and c.soporte = 'qr' and c.revocada_at is null
  limit 1;
  if v_token is null then return; end if;

  -- Sin sala: saber un mail no puede ser saber donde esta una persona.
  return query select cp.*, v_token from cowork_carnet_de_persona(v_persona_id, false) cp;
end;
$$;

revoke all on function cowork_carnet_de_persona(uuid, boolean) from public, anon, authenticated;
revoke all on function cowork_carnet(uuid) from public;
revoke all on function cowork_carnet_por_email(text) from public;
grant execute on function cowork_carnet(uuid) to anon, authenticated, service_role;
grant execute on function cowork_carnet_por_email(text) to anon, authenticated, service_role;
