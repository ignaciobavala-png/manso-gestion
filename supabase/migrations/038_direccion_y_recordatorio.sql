-- ============================================================
-- 038: dirección del evento y mail recordatorio del día
-- ============================================================
-- La entrada decía cuándo pero no dónde. La dirección vive en dos lugares:
--   venue_config.direccion  la de Manso, la que vale para casi todo
--   events.direccion        opcional, sólo cuando un evento es en otro lado
-- Quien muestra la dirección usa la del evento y, si está vacía, la general.
-- Vacía en los dos lados = no se muestra nada (ni el link a Maps).
ALTER TABLE public.venue_config
  ADD COLUMN IF NOT EXISTS direccion TEXT NOT NULL DEFAULT '';

UPDATE public.venue_config
  SET direccion = 'Cdad. de la Paz 601, Colegiales, CABA'
  WHERE id = 1 AND direccion = '';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS direccion TEXT;

-- Cuándo se le mandó a esa entrada el mail "Es hoy". Misma mecánica que
-- qr_mail_enviado_at (037): el cron reclama filas con UPDATE ... WHERE IS
-- NULL RETURNING, así dos corridas superpuestas no mandan dos veces, y si
-- Resend falla se vuelve a NULL para que la corrida siguiente lo reintente.
ALTER TABLE public.ticket_registrations
  ADD COLUMN IF NOT EXISTS recordatorio_enviado_at TIMESTAMPTZ;
