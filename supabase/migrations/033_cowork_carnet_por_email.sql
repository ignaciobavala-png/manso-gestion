-- ============================================================
-- Manso Gestion — Una sola pagina personal
--
-- Hasta ahora una persona tenia dos paginas y ninguna sabia de la
-- otra: /mi-entrada, que la reconoce por el mail, y /c/<token>, que la
-- reconoce por el link de su carnet. El que compro una entrada y
-- ademas es coworker tenia que acordarse de cual era cual.
--
-- Se unifican por el mail, que es la identidad que el proyecto ya
-- venia usando para las entradas: con un mail, get_my_tickets devuelve
-- los QR de los shows de esa persona, que valen plata. Un carnet de
-- cowork no es mas sensible que eso, asi que el mismo criterio vale
-- para los dos y no hace falta inventar cuentas, contraseñas ni
-- recuperacion de acceso.
--
-- Dos cambios chicos:
--
-- 1. cowork_carnet devuelve tambien el mail, para que la pagina del
--    carnet pueda ir a buscar las entradas de esa misma persona. Quien
--    tiene el token ya tiene el carnet entero: el mail no agrega nada
--    que no supiera.
--
-- 2. cowork_carnet_por_email hace el camino inverso y devuelve, ademas,
--    el token de la credencial. Es lo que permite que quien perdio su
--    link lo recupere solo, y que su celular quede reconocido para los
--    QR de las salas sin molestar a nadie.
--
-- Ojo con la diferencia respecto de cowork_ocupar_sala_por_email (032),
-- que a proposito NO devuelve el token: esa la llama un QR pegado en
-- una pared, donde el que escanea puede ser cualquiera que pase. Esta
-- la llama alguien que esta escribiendo su propio mail en su pagina.
-- ============================================================

-- Agregar una columna al RETURNS TABLE obliga a recrearla.
drop function if exists cowork_carnet(uuid);

create or replace function cowork_carnet(p_token uuid)
returns table (
  nombre text, foto_url text, puede_entrar boolean, motivo text,
  llave_tipo text, llave_plan text, llave_hasta date, dias_restantes int,
  visitas_totales bigint, sala_actual text, sala_hasta timestamptz,
  email text
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_cred cowork_credenciales%rowtype;
begin
  select * into v_cred from cowork_credenciales where token = p_token and revocada_at is null;
  if not found then return; end if;
  return query select * from cowork_carnet_de_persona(v_cred.persona_id);
end;
$$;

-- El cuerpo de los dos caminos, en un solo lugar: lo que ve el miembro
-- no puede depender de si llego por el link o por el mail.
create or replace function cowork_carnet_de_persona(p_persona_id uuid)
returns table (
  nombre text, foto_url text, puede_entrar boolean, motivo text,
  llave_tipo text, llave_plan text, llave_hasta date, dias_restantes int,
  visitas_totales bigint, sala_actual text, sala_hasta timestamptz,
  email text
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
    sa.nombre, ses.vence_at,
    v_per.email
  from (select 1) _
  left join lateral (
    select * from cowork_sesiones_sala v
    where v.persona_id = v_per.id and v.cerrada_at is null and v.vence_at > now()
    order by v.vence_at desc limit 1
  ) ses on true
  left join cowork_salas sa on sa.id = ses.sala_id;
end;
$$;

create or replace function cowork_carnet_por_email(p_email text)
returns table (
  nombre text, foto_url text, puede_entrar boolean, motivo text,
  llave_tipo text, llave_plan text, llave_hasta date, dias_restantes int,
  visitas_totales bigint, sala_actual text, sala_hasta timestamptz,
  email text, token uuid
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_email text := lower(btrim(p_email));
  v_persona_id uuid;
  v_token uuid;
begin
  select p.id into v_persona_id from cowork_personas p
  where lower(btrim(p.email)) = v_email;
  if v_persona_id is null then return; end if;

  -- Sin credencial vigente no hay carnet que mostrar: el QR es la
  -- credencial, no un adorno de la pantalla.
  select c.token into v_token from cowork_credenciales c
  where c.persona_id = v_persona_id and c.soporte = 'qr' and c.revocada_at is null
  limit 1;
  if v_token is null then return; end if;

  return query select cp.*, v_token from cowork_carnet_de_persona(v_persona_id) cp;
end;
$$;

-- El carnet, por los dos caminos, lo abre el navegador del miembro.
-- La de persona es interna: la llaman las otras dos, no la API.
revoke all on function cowork_carnet_de_persona(uuid) from public, anon, authenticated;
revoke all on function cowork_carnet(uuid) from public;
revoke all on function cowork_carnet_por_email(text) from public;
grant execute on function cowork_carnet(uuid) to anon, authenticated, service_role;
grant execute on function cowork_carnet_por_email(text) to anon, authenticated, service_role;
