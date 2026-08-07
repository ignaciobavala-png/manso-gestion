-- ============================================================
-- Manso Gestión — Migración 020: pagar primero, después el QR
-- ============================================================
-- Contexto (reporte de Ana):
--   La 019 dejó el mismo modelo que transferencia: el ticket se creaba al
--   iniciar el pago y el QR se entregaba ahí mismo. Resultado real en
--   producción: gente que abandonó el checkout de Mercado Pago se quedó
--   igual con su QR, y esas entradas seguían contando como vendidas.
--
--   Además, "Rechazar QR" (is_banned) no descontaba en todos los contadores:
--   algunos filtraban is_banned y otros no.
--
-- Lo que define esta migración:
--   * Una sola noción de "entrada vendida", en la DB, que usan todos los
--     contadores y el trigger de capacidad. Si esto queda en el front,
--     vuelve a divergir pantalla por pantalla — que es el bug de ahora.
--
--   entrada VENDIDA  = no rechazada Y (no es de MP  Ó  el pago está acreditado)
--   entrada RESERVADA = de MP, sin acreditar, con la preference todavía vigente
--                       (ocupa cupo durante el checkout, después se libera)
--
--   Transferencia no cambia: cuenta desde que se registra, como siempre,
--   porque ahí el comprobante ya está subido y la verificación es a mano.
-- ============================================================

-- ============================================================
-- 1. Vencimiento de la orden de Mercado Pago
-- ============================================================
-- Lo escribe api/mp/preferencia.ts con el mismo plazo que la preference.
-- Pasado ese momento la entrada deja de ocupar cupo: nadie más va a poder
-- pagar esa orden, así que reservarle un lugar es regalar capacidad.
ALTER TABLE public.ticket_registrations
  ADD COLUMN IF NOT EXISTS mp_expires_at TIMESTAMPTZ;

-- Órdenes de MP anteriores a esta migración: no tienen vencimiento guardado.
-- Se les pone la fecha de registro, o sea vencidas. Las acreditadas no
-- dependen de esto (cuentan por payment_verified), y las abandonadas —
-- justamente las que Ana reportó — dejan de ocupar cupo.
UPDATE public.ticket_registrations
SET mp_expires_at = registered_at
WHERE payment_provider = 'mercadopago'
  AND mp_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_registrations_mp_expires_at
  ON public.ticket_registrations (mp_expires_at)
  WHERE mp_expires_at IS NOT NULL;

-- ============================================================
-- 2. Predicados canónicos
-- ============================================================
-- Toda pregunta de "¿esta entrada cuenta?" pasa por acá. Son funciones y no
-- comentarios en cada query a propósito: el bug que arreglan es exactamente
-- el de tener la regla copiada en seis lugares.

CREATE OR REPLACE FUNCTION public.entrada_vendida(
  p_is_banned        BOOLEAN,
  p_payment_provider TEXT,
  p_payment_verified BOOLEAN
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(p_is_banned, false) = false
     AND (
       p_payment_provider IS DISTINCT FROM 'mercadopago'
       OR COALESCE(p_payment_verified, false)
     );
$function$;

COMMENT ON FUNCTION public.entrada_vendida(BOOLEAN, TEXT, BOOLEAN) IS
  'Entrada que cuenta como vendida y da derecho a QR. Rechazar QR (is_banned) '
  'la saca; una de Mercado Pago sin acreditar nunca entró.';

CREATE OR REPLACE FUNCTION public.entrada_reservada(
  p_is_banned        BOOLEAN,
  p_payment_provider TEXT,
  p_payment_verified BOOLEAN,
  p_mp_expires_at    TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(p_is_banned, false) = false
     AND p_payment_provider = 'mercadopago'
     AND COALESCE(p_payment_verified, false) = false
     AND p_mp_expires_at IS NOT NULL
     AND p_mp_expires_at > NOW();
$function$;

COMMENT ON FUNCTION public.entrada_reservada(BOOLEAN, TEXT, BOOLEAN, TIMESTAMPTZ) IS
  'Checkout de Mercado Pago en curso: ocupa cupo hasta que vence la preference. '
  'No es una venta — no da QR ni entra en los totales de vendidas.';

GRANT EXECUTE ON FUNCTION public.entrada_vendida(BOOLEAN, TEXT, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.entrada_reservada(BOOLEAN, TEXT, BOOLEAN, TIMESTAMPTZ) TO anon, authenticated, service_role;

-- ============================================================
-- 3. Capacidad: vendidas + reservas vivas
-- ============================================================
-- Antes contaba todo lo no rechazado. Ahora una orden de MP abandonada
-- deja de bloquear un lugar, pero mientras el checkout está abierto sí lo
-- reserva: sin eso, dos personas pueden pagar el último cupo a la vez.
CREATE OR REPLACE FUNCTION public.check_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_max_capacity  INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Bloquea la fila del evento para que requests concurrentes no pasen
  -- el check al mismo tiempo (TOCTOU race condition)
  SELECT max_capacity INTO v_max_capacity
  FROM public.events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_max_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.ticket_registrations
  WHERE event_id = NEW.event_id
    AND (
      public.entrada_vendida(is_banned, payment_provider, payment_verified)
      OR public.entrada_reservada(is_banned, payment_provider, payment_verified, mp_expires_at)
    );

  IF v_current_count >= v_max_capacity THEN
    RAISE EXCEPTION 'capacity_exceeded: el evento alcanzó su capacidad máxima (%)', v_max_capacity
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- Espejo del anterior, sumando las redenciones de QR comodín (ver 018).
CREATE OR REPLACE FUNCTION public.check_wildcard_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_max_capacity  INTEGER;
  v_current_count INTEGER;
BEGIN
  SELECT max_capacity INTO v_max_capacity
  FROM public.events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_max_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    (SELECT COUNT(*) FROM public.ticket_registrations
      WHERE event_id = NEW.event_id
        AND (
          public.entrada_vendida(is_banned, payment_provider, payment_verified)
          OR public.entrada_reservada(is_banned, payment_provider, payment_verified, mp_expires_at)
        ))
    +
    (SELECT COUNT(*) FROM public.wildcard_qr_redemptions
      WHERE event_id = NEW.event_id)
  INTO v_current_count;

  IF v_current_count >= v_max_capacity THEN
    RAISE EXCEPTION 'capacity_exceeded: el evento alcanzó su capacidad máxima (%)', v_max_capacity
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 4. Cupo mostrado en la pantalla pública de registro
-- ============================================================
-- Tiene que dar el mismo número que el trigger, si no la pantalla dice
-- "quedan 3" y el insert falla por capacidad.
CREATE OR REPLACE FUNCTION public.get_event_registration_count(p_event_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM public.ticket_registrations
  WHERE event_id = p_event_id
    AND (
      public.entrada_vendida(is_banned, payment_provider, payment_verified)
      OR public.entrada_reservada(is_banned, payment_provider, payment_verified, mp_expires_at)
    );
$function$;

-- ============================================================
-- 5. "Buscar mis entradas por email": sólo lo pagado
-- ============================================================
-- Este es el agujero que quedaba abierto aunque el front no guarde el token:
-- alguien abandonaba el pago y recuperaba su QR escribiendo su email.
CREATE OR REPLACE FUNCTION public.get_my_tickets(p_email TEXT)
RETURNS TABLE(token TEXT, name TEXT, event_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT token, name, event_id
  FROM public.ticket_registrations
  WHERE email = lower(trim(p_email))
    AND public.entrada_vendida(is_banned, payment_provider, payment_verified);
$function$;

-- ============================================================
-- 6. Contadores para el panel
-- ============================================================
-- Una sola fuente para "cuántas entradas tiene este evento". security_invoker
-- para que siga mandando la RLS de ticket_registrations (staff), no la del
-- dueño de la vista.
DROP VIEW IF EXISTS public.event_ticket_counts;
CREATE VIEW public.event_ticket_counts
WITH (security_invoker = on) AS
SELECT
  event_id,
  COUNT(*) FILTER (
    WHERE public.entrada_vendida(is_banned, payment_provider, payment_verified)
  )::INTEGER AS vendidas,
  COUNT(*) FILTER (
    WHERE public.entrada_reservada(is_banned, payment_provider, payment_verified, mp_expires_at)
  )::INTEGER AS reservadas,
  COUNT(*) FILTER (WHERE is_banned)::INTEGER AS rechazadas,
  COUNT(*) FILTER (
    WHERE payment_provider = 'mercadopago'
      AND payment_verified = false
      AND is_banned = false
      AND (mp_expires_at IS NULL OR mp_expires_at <= NOW())
  )::INTEGER AS mp_sin_pagar,
  COUNT(*)::INTEGER AS total
FROM public.ticket_registrations
GROUP BY event_id;

GRANT SELECT ON public.event_ticket_counts TO authenticated;

-- ============================================================
-- 7. Verificación
-- ============================================================
SELECT 'col: ticket_registrations.mp_expires_at' AS item,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'ticket_registrations' AND column_name = 'mp_expires_at') AS ok
UNION ALL
SELECT 'fn: entrada_vendida',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'entrada_vendida')
UNION ALL
SELECT 'fn: entrada_reservada',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'entrada_reservada')
UNION ALL
SELECT 'view: event_ticket_counts',
       EXISTS (SELECT 1 FROM information_schema.views
               WHERE table_name = 'event_ticket_counts');
