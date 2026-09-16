-- ============================================================
-- Manso Gestion — Sacar a la sala del callejon sin salida
--
-- La pantalla de sala reconoce al miembro por la credencial que quedo
-- guardada en su navegador la primera vez que abrio su carnet. Al que
-- llega sin esa credencial se le explicaba que abriera su carnet, pero
-- ahi mismo no tiene el link ni forma de conseguirlo: es el unico
-- punto del sistema sin salida.
--
-- Esta funcion lo destraba pidiendole el mail, y a proposito NO le
-- devuelve su token: ocupa la sala y nada mas. Si devolviera el token,
-- cualquiera que adivine el mail de un miembro podria abrir su carnet
-- y ver su plan y en que sala esta — justo lo que el diseno de las
-- salas evita. Asi, lo maximo que consigue quien adivina un mail es
-- ocupar una sala a nombre de otro, que es el riesgo que el modelo de
-- token ya aceptaba (ver COWORK.md §6).
--
-- El mismo motivo para "ese mail no existe" y para "no tiene llave
-- vigente": la pantalla no es un buscador de socios.
-- ============================================================

create or replace function cowork_ocupar_sala_por_email(
  p_sala_token uuid,
  p_email      text
)
returns table (ok boolean, motivo text, sala_nombre text, hasta timestamptz, extendida boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_persona_id uuid;
  v_token uuid;
begin
  select p.id into v_persona_id
  from cowork_personas p
  where lower(btrim(p.email)) = v_email
    and p.estado = 'activa';

  if v_persona_id is not null then
    select c.token into v_token
    from cowork_credenciales c
    where c.persona_id = v_persona_id
      and c.soporte = 'qr'
      and c.revocada_at is null
    limit 1;
  end if;

  if v_token is null then
    return query select
      false,
      'No encontramos una llave vigente con ese mail. Avisale a alguien del staff.'::text,
      null::text, null::timestamptz, false;
    return;
  end if;

  -- La llave vigente, la sala libre y la visita del dia las decide la
  -- funcion de siempre: este camino cambia como se identifica la
  -- persona, no que puede hacer una vez identificada.
  return query select * from cowork_ocupar_sala(p_sala_token, v_token);
end;
$$;

-- Callable por anon, igual que las otras tres del miembro: el coworker
-- no tiene cuenta en gestion. No lee las tablas de frente.
revoke all on function cowork_ocupar_sala_por_email(uuid, text) from public;
grant execute on function cowork_ocupar_sala_por_email(uuid, text) to anon, authenticated, service_role;
