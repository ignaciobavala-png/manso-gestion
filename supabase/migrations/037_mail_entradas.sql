-- ============================================================
-- 037: mail con el QR de la entrada
-- ============================================================
-- Cuándo se le mandó a esa persona el mail con su QR. Es la marca que hace
-- el envío idempotente: el webhook de Mercado Pago y la pantalla de retorno
-- (api/mp/estado.ts) aplican el mismo pago, a veces a la vez, y sin esto
-- cada uno mandaría su mail.
--
-- El envío "reclama" las filas con un UPDATE ... WHERE qr_mail_enviado_at
-- IS NULL RETURNING, que Postgres serializa por fila: el que llega segundo
-- no encuentra nada que reclamar. Si Resend falla, se vuelve a NULL para
-- que un próximo intento lo mande.
--
-- Las entradas anteriores a esta migración quedan en NULL a propósito: si
-- esa persona vuelve a registrarse para el mismo evento, le llega todo
-- junto, también lo que ya tenía.
ALTER TABLE public.ticket_registrations
  ADD COLUMN IF NOT EXISTS qr_mail_enviado_at TIMESTAMPTZ;
