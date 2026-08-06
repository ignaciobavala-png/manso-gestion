-- La view active_event se creó en 001_schema.sql con `SELECT e.*`, pero Postgres
-- congela el `*` a la lista de columnas que existían en ese momento (las 13
-- primeras de events). Las 14 columnas agregadas después por ALTER TABLE nunca
-- aparecieron en la view, así que el store leía `undefined` en todas ellas:
--   flyer_url, is_paid, ticket_alias_pago, ticket_cbu_pago, slug, is_private,
--   private_token, background_url, one_ticket_per_email, require_instagram,
--   require_phone, accepts_wildcard_qr, payment_mode, mp_surcharge_pct
--
-- Efecto visible: activeEvent.accepts_wildcard_qr era siempre undefined, así que
-- TODO QR comodín de "FREES PARA MANSO" se rechazaba con "El QR comodín no está
-- habilitado para este evento" aunque el evento tuviera el flag en true.
-- Por eso wildcard_qr_redemptions quedó vacía desde que se lanzó la feature.
--
-- CREATE OR REPLACE VIEW puede agregar columnas al final: las 13 originales
-- mantienen nombre, tipo y orden, y las nuevas se anexan.

create or replace view public.active_event
with (security_invoker = true) as
  select e.*
  from public.events e
  join public.venue_config vc on vc.current_event_id = e.id
  where vc.id = 1;
