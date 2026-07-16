-- QR comodín: tickets del evento "FREES PARA MANSO" pueden habilitarse
-- para entrar en otros eventos reales, evento por evento, sin quemarse
-- para siempre (a diferencia de un ticket normal que usa used_at).

alter table public.events
  add column accepts_wildcard_qr boolean not null default false;

create table public.wildcard_qr_redemptions (
  id uuid primary key default gen_random_uuid(),
  ticket_registration_id uuid not null references public.ticket_registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  used_at timestamptz not null default now(),
  unique (ticket_registration_id, event_id)
);

alter table public.wildcard_qr_redemptions enable row level security;

create policy wildcard_qr_redemptions_staff_all
  on public.wildcard_qr_redemptions
  for all
  using ((auth.jwt() ->> 'email') = any (array['control@manso.internal', 'empleado@manso.internal', 'owner@manso.internal']))
  with check ((auth.jwt() ->> 'email') = any (array['control@manso.internal', 'empleado@manso.internal', 'owner@manso.internal']));

-- Espejo de check_event_capacity(), pero contando registros del evento real
-- MÁS redenciones de QR comodín ya usadas en ese mismo evento.
create or replace function public.check_wildcard_capacity()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_max_capacity integer;
  v_current_count integer;
begin
  select max_capacity into v_max_capacity
  from public.events
  where id = new.event_id
  for update;

  if v_max_capacity is null then
    return new;
  end if;

  select
    (select count(*) from public.ticket_registrations
      where event_id = new.event_id and is_banned = false)
    +
    (select count(*) from public.wildcard_qr_redemptions
      where event_id = new.event_id)
  into v_current_count;

  if v_current_count >= v_max_capacity then
    raise exception 'capacity_exceeded: el evento alcanzó su capacidad máxima (%)', v_max_capacity
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

create trigger enforce_wildcard_capacity
  before insert on public.wildcard_qr_redemptions
  for each row execute function public.check_wildcard_capacity();
