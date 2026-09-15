-- ============================================================
-- Manso Gestion — La credencial: el QR de cada miembro
--
-- El QR identifica a la PERSONA, no a la llave. Si colgara de la
-- llave, cada renovacion mensual generaria un QR nuevo y habria que
-- volver a entregarselo a todo el mundo. Asi la credencial se entrega
-- una vez y lo que cambia abajo es la llave, que es la que decide si
-- hoy abre o no.
--
-- El token es un bearer token: identifica, no autoriza. Un QR sacado
-- de una captura de pantalla ajena lo unico que logra es que el staff
-- vea el carnet de otro — cobrar, aplicar promos o dejar entrar sigue
-- siendo decision de una persona con sesion. Por eso alcanza con
-- poder revocarlo, y no hace falta firma ni expiracion.
--
-- Tabla aparte y no una columna en cowork_personas por dos razones:
-- revocar un QR filtrado sin perder a la persona ni su historial, y
-- dejar lugar a los stickers NFC de docs/COWORK.md sin migracion:
-- son el mismo token con otro soporte.
-- ============================================================

create table if not exists cowork_credenciales (
  id            uuid primary key default gen_random_uuid(),
  persona_id    uuid not null references cowork_personas(id) on delete cascade,
  -- Lo que viaja adentro del QR. UUID opaco, mismo patron que
  -- ticket_registrations.token.
  token         uuid not null unique default gen_random_uuid(),
  soporte       text not null default 'qr' check (soporte in ('qr', 'nfc')),
  -- Para cuando haya varios: "llavero", "notebook".
  etiqueta      text,
  emitida_at    timestamptz not null default now(),
  ultima_vez_at timestamptz,
  revocada_at   timestamptz,
  revocada_por  text
);

-- Una credencial vigente por persona y por soporte. Rotar es revocar
-- la vieja y emitir otra, no pisar el token: el QR impreso que quedo
-- dando vueltas tiene que poder distinguirse del nuevo.
create unique index if not exists cowork_credenciales_vigente_key
  on cowork_credenciales (persona_id, soporte)
  where revocada_at is null;

create index if not exists cowork_credenciales_persona_idx
  on cowork_credenciales (persona_id);

-- ── Toda persona nace con su QR ─────────────────────────────
-- Va por trigger y no en cowork_emitir_llave() para que tambien valga
-- para las personas que cargue el staff a mano desde el panel.
create or replace function cowork_credencial_al_crear_persona()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into cowork_credenciales (persona_id, soporte)
  values (new.id, 'qr')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists cowork_credencial_nueva_persona on cowork_personas;
create trigger cowork_credencial_nueva_persona
  after insert on cowork_personas
  for each row execute function cowork_credencial_al_crear_persona();

-- Las que ya existan cuando esto se aplique.
insert into cowork_credenciales (persona_id, soporte)
select p.id, 'qr'
from cowork_personas p
where not exists (
  select 1 from cowork_credenciales c
  where c.persona_id = p.id and c.soporte = 'qr' and c.revocada_at is null
);

-- ============================================================
-- Escanear: leer el carnet
-- ============================================================
-- Lo que ve el staff al apuntar la camara. Es security definer y
-- devuelve solo lo que va en pantalla —nombre, foto y semaforo— para
-- que el empleado de la puerta pueda usarlo sin que le abramos
-- cowork_personas, donde estan el telefono y las notas.
--
-- No escribe nada: escanear dos veces para mirar no puede tener
-- consecuencias. El ingreso se registra aparte, a proposito.
create or replace function cowork_validar_qr(p_token uuid)
returns table (
  persona_id     uuid,
  nombre         text,
  foto_url       text,
  estado         text,
  puede_entrar   boolean,
  motivo         text,
  llave_tipo     text,
  llave_plan     text,
  llave_hasta    date,
  dias_restantes int,
  ultima_visita  date,
  visitas_totales bigint,
  ya_ingreso_hoy boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_cred cowork_credenciales%rowtype;
  v_per  cowork_personas%rowtype;
  v_llave cowork_llaves%rowtype;
begin
  select * into v_cred from cowork_credenciales where token = p_token;
  if not found then
    return query select
      null::uuid, null::text, null::text, null::text, false,
      'Este QR no es de nadie'::text,
      null::text, null::text, null::date, null::int, null::date, null::bigint, false;
    return;
  end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;

  select * into v_llave
  from cowork_llaves l
  where l.persona_id = v_per.id
    and l.anulada_at is null
    and v_hoy between l.desde and l.hasta
  -- Si tiene mensual y ademas compro un dia suelto, manda el que vence
  -- mas tarde: es el que describe mejor su situacion.
  order by l.hasta desc
  limit 1;

  return query select
    v_per.id,
    v_per.nombre,
    v_per.foto_url,
    v_per.estado,
    (v_cred.revocada_at is null and v_per.estado = 'activa' and v_llave.id is not null),
    case
      when v_cred.revocada_at is not null then 'Credencial revocada'
      when v_per.estado = 'baja'          then 'Se dio de baja'
      when v_per.estado = 'pausada'       then 'Membresia pausada'
      when v_llave.id is null             then 'Sin llave vigente'
      else null
    end::text,
    v_llave.tipo,
    v_llave.plan,
    v_llave.hasta,
    (v_llave.hasta - v_hoy)::int,
    (select max(v.fecha) from cowork_visitas v where v.persona_id = v_per.id),
    (select count(*)     from cowork_visitas v where v.persona_id = v_per.id),
    exists (select 1 from cowork_visitas v where v.persona_id = v_per.id and v.fecha = v_hoy);
end;
$$;

-- ============================================================
-- Escanear: registrar el ingreso
-- ============================================================
-- Separado de la lectura porque son dos decisiones distintas: mirar el
-- carnet no es dejar entrar.
--
-- p_forzar existe para el caso real de la puerta: alguien sin llave
-- vigente al que el staff igual deja pasar (invitado, prueba, se le
-- vencio ayer y paga manana). Queda registrado con llave_id null, que
-- es justamente el dato que despues explica el numero de ocupacion.
create or replace function cowork_registrar_ingreso(
  p_token  uuid,
  p_origen text default 'qr',
  p_forzar boolean default false
)
returns table (
  ok             boolean,
  motivo         text,
  nombre         text,
  ya_estaba      boolean,
  sin_llave      boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_cred  cowork_credenciales%rowtype;
  v_per   cowork_personas%rowtype;
  v_llave_id uuid;
  v_ya    boolean;
begin
  select * into v_cred from cowork_credenciales where token = p_token;
  if not found then
    return query select false, 'Este QR no es de nadie'::text, null::text, false, false;
    return;
  end if;

  if v_cred.revocada_at is not null then
    return query select false, 'Credencial revocada'::text, null::text, false, false;
    return;
  end if;

  select * into v_per from cowork_personas where id = v_cred.persona_id;

  if v_per.estado = 'baja' then
    return query select false, 'Se dio de baja'::text, v_per.nombre, false, false;
    return;
  end if;

  select l.id into v_llave_id
  from cowork_llaves l
  where l.persona_id = v_per.id
    and l.anulada_at is null
    and v_hoy between l.desde and l.hasta
  order by l.hasta desc
  limit 1;

  if v_llave_id is null and not p_forzar then
    return query select false, 'Sin llave vigente'::text, v_per.nombre, false, true;
    return;
  end if;

  select exists (
    select 1 from cowork_visitas v where v.persona_id = v_per.id and v.fecha = v_hoy
  ) into v_ya;

  insert into cowork_visitas (persona_id, llave_id, fecha, origen, registrada_por)
  values (v_per.id, v_llave_id, v_hoy, p_origen, auth.jwt() ->> 'email')
  on conflict (persona_id, fecha) do nothing;

  update cowork_credenciales set ultima_vez_at = now() where id = v_cred.id;

  return query select true, null::text, v_per.nombre, v_ya, (v_llave_id is null);
end;
$$;

-- ============================================================
-- RLS y permisos
-- ============================================================
alter table cowork_credenciales enable row level security;

-- El token es lo unico que hace falta para hacerse pasar por alguien en
-- la puerta: la tabla no se lee entera salvo con sesion de control.
drop policy if exists cowork_credenciales_control_all on cowork_credenciales;
create policy cowork_credenciales_control_all on cowork_credenciales
  for all using (
    auth.jwt() ->> 'email' in ('control@manso.internal', 'owner@manso.internal')
  );

-- Las dos de la puerta las usa tambien el empleado, que no lee las
-- tablas: entra por estas funciones y no ve nada mas que el carnet.
revoke all on function cowork_validar_qr(uuid) from public, anon;
revoke all on function cowork_registrar_ingreso(uuid, text, boolean) from public, anon;
grant execute on function cowork_validar_qr(uuid) to authenticated;
grant execute on function cowork_registrar_ingreso(uuid, text, boolean) to authenticated;
