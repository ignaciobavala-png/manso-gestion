-- ============================================================
-- Manso Gestion — Dar de alta un miembro desde el panel
--
-- El llavero se llenaba solo: una compra de cowork day o una membresia
-- activada en manso.club. Eso cubre el caso normal y deja afuera todos
-- los demas — el canje, la prueba de una semana, el socio que paga por
-- transferencia, el invitado del mes. Para esos, hasta ahora, habia que
-- entrar a la base a mano.
--
-- cowork_emitir_llave sigue cerrada: es la funcion que decide quien
-- entra y la 029 la saco de la API REST por buenas razones. Lo que se
-- abre es esta, que es una puerta con nombre y con control en la base y
-- no solo en la pantalla: el rol lo verifica Postgres leyendo el JWT,
-- asi que no alcanza con saber la URL del panel.
--
-- Empleado no emite llaves. Puede mirar el tablero y registrar
-- ingresos; dar de alta a alguien —que es decidir quien paga y quien
-- no— es de control y del owner.
--
-- Devuelve si la persona era nueva porque cambia lo que la pantalla
-- tiene que decir: "ya existia, le agregamos la llave" no es lo mismo
-- que un miembro nuevo, y confundirlos hace que alguien emita dos veces
-- creyendo que la primera no anduvo.
-- ============================================================

create or replace function cowork_alta_miembro(
  p_nombre    text,
  p_email     text,
  p_tipo      text,
  p_hasta     date default null,
  p_plan      text default null,
  p_telefono  text default null,
  p_instagram text default null
)
returns table (persona_id uuid, creada boolean, token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_email text := lower(btrim(p_email));
  v_existia boolean;
  v_persona_id uuid;
  v_token uuid;
begin
  if auth.jwt() ->> 'email' not in ('control@manso.internal', 'owner@manso.internal') then
    raise exception 'Solo control y owner pueden dar de alta miembros';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'El mail es obligatorio: es con lo que se reconoce a la persona';
  end if;

  if p_tipo not in ('dia', 'mensual') then
    raise exception 'Tipo de llave invalido: %', p_tipo;
  end if;

  select exists (
    select 1 from cowork_personas p where lower(btrim(p.email)) = v_email
  ) into v_existia;

  perform cowork_emitir_llave(
    p_email      => v_email,
    p_nombre     => p_nombre,
    p_tipo       => p_tipo,
    p_desde      => v_hoy,
    -- Un pase de un dia es hoy y nada mas. El mensual puede no vencer:
    -- null es el vitalicio, igual que el que emite la pagina.
    p_hasta      => case when p_tipo = 'dia' then v_hoy else p_hasta end,
    p_origen     => 'manual',
    p_origen_ref => null,
    p_plan       => nullif(btrim(p_plan), ''),
    p_telefono   => p_telefono,
    p_instagram  => p_instagram
  );

  select p.id into v_persona_id from cowork_personas p
  where lower(btrim(p.email)) = v_email;

  -- La credencial la emite el trigger de la 028 al crear la persona; se
  -- devuelve para que la pantalla pueda ofrecer el carnet en el acto, que
  -- es lo unico que hay que hacer despues de un alta.
  select c.token into v_token from cowork_credenciales c
  where c.persona_id = v_persona_id and c.soporte = 'qr' and c.revocada_at is null
  limit 1;

  return query select v_persona_id, not v_existia, v_token;
end;
$$;

-- "authenticated" en este proyecto son las tres cuentas de staff y nadie
-- mas: no hay registro publico. El rol fino lo decide la funcion.
revoke all on function cowork_alta_miembro(text, text, text, date, text, text, text) from public, anon;
grant execute on function cowork_alta_miembro(text, text, text, date, text, text, text)
  to authenticated, service_role;
