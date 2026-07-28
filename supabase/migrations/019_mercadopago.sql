-- ============================================================
-- Manso Gestión — Migración 019: Mercado Pago
-- ============================================================
-- Contexto:
--   Hasta acá el único medio de pago era transferencia + comprobante:
--   el ticket se crea válido de entrada y alguien del staff marca
--   payment_verified a mano. Mercado Pago NO cambia ese modelo — el QR
--   se sigue generando al iniciar el pago y el escáner ya avisa
--   "Pendiente" si payment_verified es false (ver src/pages/Entradas.tsx).
--   Lo que agrega MP es que esa verificación se haga sola cuando el pago
--   se aprueba, en vez de a mano.
--
-- Lo que agrega:
--   events:               payment_mode, mp_surcharge_pct
--   ticket_registrations: payment_provider, mp_* , paid_at
--   tabla:                mp_payments (log de pagos + idempotencia)
--   RPC:                  mp_apply_payment (transición de estado única)
-- ============================================================

-- ============================================================
-- 1. EVENTS: método de pago y recargo
-- ============================================================
-- Default 'transferencia' a propósito: los eventos ya creados siguen
-- funcionando exactamente igual hasta que Ana habilite MP evento por evento.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'transferencia';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_payment_mode_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_payment_mode_check
      CHECK (payment_mode IN ('transferencia', 'mercadopago', 'ambos'));
  END IF;
END $$;

-- Recargo opcional para trasladar la comisión de MP (~6,3% + IVA) al precio.
-- Queda en 0 hasta que Ana decida; el cálculo vive en la API, esto es el parámetro.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS mp_surcharge_pct NUMERIC(5,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_mp_surcharge_pct_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_mp_surcharge_pct_check
      CHECK (mp_surcharge_pct >= 0 AND mp_surcharge_pct <= 100);
  END IF;
END $$;

-- ============================================================
-- 2. TICKET_REGISTRATIONS: datos del pago
-- ============================================================
-- payment_provider queda NULL en los registros históricos: no sabemos con
-- qué pagaron los que ya están, y asumir 'transferencia' sería inventar dato.
ALTER TABLE public.ticket_registrations
  ADD COLUMN IF NOT EXISTS payment_provider       TEXT,
  ADD COLUMN IF NOT EXISTS mp_external_reference  TEXT,
  ADD COLUMN IF NOT EXISTS mp_preference_id       TEXT,
  ADD COLUMN IF NOT EXISTS mp_payment_id          TEXT,
  ADD COLUMN IF NOT EXISTS mp_status              TEXT,
  ADD COLUMN IF NOT EXISTS mp_fee_amount          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS mp_net_amount          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS paid_at                TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ticket_registrations'::regclass
      AND conname = 'ticket_registrations_payment_provider_check'
  ) THEN
    ALTER TABLE public.ticket_registrations
      ADD CONSTRAINT ticket_registrations_payment_provider_check
      CHECK (payment_provider IS NULL OR payment_provider IN ('transferencia', 'mercadopago'));
  END IF;
END $$;

-- external_reference es la clave por la que la API reconcilia una orden
-- completa (varios asistentes = varios tickets = un solo pago).
CREATE INDEX IF NOT EXISTS idx_ticket_registrations_mp_external_reference
  ON public.ticket_registrations (mp_external_reference)
  WHERE mp_external_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_registrations_mp_payment_id
  ON public.ticket_registrations (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

-- ============================================================
-- 3. MP_PAYMENTS: log crudo + idempotencia
-- ============================================================
-- MP reintenta las notificaciones y puede mandar la misma varias veces.
-- El UNIQUE en payment_id es lo que hace que reprocesar sea inofensivo.
CREATE TABLE IF NOT EXISTS public.mp_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          TEXT NOT NULL UNIQUE,
  external_reference  TEXT,
  event_id            UUID REFERENCES public.events(id) ON DELETE SET NULL,
  status              TEXT,
  status_detail       TEXT,
  amount              NUMERIC(10,2),
  fee_amount          NUMERIC(10,2),
  net_amount          NUMERIC(10,2),
  payer_email         TEXT,
  raw                 JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_payments_external_reference
  ON public.mp_payments (external_reference);

CREATE INDEX IF NOT EXISTS idx_mp_payments_event_id
  ON public.mp_payments (event_id);

DROP TRIGGER IF EXISTS update_mp_payments_updated_at ON public.mp_payments;
CREATE TRIGGER update_mp_payments_updated_at
  BEFORE UPDATE ON public.mp_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: sólo staff lee. La API escribe con service role, que saltea RLS,
-- así que no hace falta ninguna policy de INSERT para el webhook.
ALTER TABLE public.mp_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mp_payments_staff_select') THEN
    CREATE POLICY "mp_payments_staff_select" ON public.mp_payments
      FOR SELECT USING (
        (auth.jwt() ->> 'email') = ANY (ARRAY[
          'control@manso.internal',
          'empleado@manso.internal',
          'owner@manso.internal'
        ])
      );
  END IF;
END $$;

-- ============================================================
-- 4. RPC: mp_apply_payment
-- ============================================================
-- Única puerta de entrada para aplicar el resultado de un pago. La usan
-- tanto el webhook como el endpoint de reconciliación (el botón
-- "Revisar en MP" del admin), así que no hay dos implementaciones que
-- puedan divergir. Es idempotente: correrla dos veces con el mismo
-- payment_id deja el mismo estado.
--
-- Nota deliberada: cuando el pago NO está aprobado, se registra el estado
-- pero NO se toca payment_verified. Si Ana ya verificó a mano (porque le
-- mandaron el comprobante por otro lado), una notificación posterior de
-- MP no le pisa esa decisión. Devolver la plata / desverificar es una
-- acción manual, no automática.
CREATE OR REPLACE FUNCTION public.mp_apply_payment(
  p_payment_id         TEXT,
  p_external_reference TEXT,
  p_status             TEXT,
  p_status_detail      TEXT    DEFAULT NULL,
  p_amount             NUMERIC DEFAULT NULL,
  p_fee_amount         NUMERIC DEFAULT NULL,
  p_net_amount         NUMERIC DEFAULT NULL,
  p_payer_email        TEXT    DEFAULT NULL,
  p_raw                JSONB   DEFAULT '{}'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_event_id       UUID;
  v_ticket_count   INTEGER := 0;
  v_approved       BOOLEAN := (p_status = 'approved');
  v_fee_per_ticket NUMERIC(10,2);
  v_net_per_ticket NUMERIC(10,2);
BEGIN
  IF p_payment_id IS NULL OR p_external_reference IS NULL THEN
    RAISE EXCEPTION 'mp_apply_payment: payment_id y external_reference son obligatorios';
  END IF;

  -- Cuántos tickets cubre esta orden (para prorratear comisión y neto)
  SELECT COUNT(*), MIN(event_id)
  INTO v_ticket_count, v_event_id
  FROM public.ticket_registrations
  WHERE mp_external_reference = p_external_reference;

  IF v_ticket_count > 0 THEN
    v_fee_per_ticket := ROUND(COALESCE(p_fee_amount, 0) / v_ticket_count, 2);
    v_net_per_ticket := ROUND(COALESCE(p_net_amount, 0) / v_ticket_count, 2);
  END IF;

  INSERT INTO public.mp_payments (
    payment_id, external_reference, event_id, status, status_detail,
    amount, fee_amount, net_amount, payer_email, raw
  )
  VALUES (
    p_payment_id, p_external_reference, v_event_id, p_status, p_status_detail,
    p_amount, p_fee_amount, p_net_amount, p_payer_email, p_raw
  )
  ON CONFLICT (payment_id) DO UPDATE SET
    external_reference = EXCLUDED.external_reference,
    event_id           = COALESCE(EXCLUDED.event_id, public.mp_payments.event_id),
    status             = EXCLUDED.status,
    status_detail      = EXCLUDED.status_detail,
    amount             = EXCLUDED.amount,
    fee_amount         = EXCLUDED.fee_amount,
    net_amount         = EXCLUDED.net_amount,
    payer_email        = COALESCE(EXCLUDED.payer_email, public.mp_payments.payer_email),
    raw                = EXCLUDED.raw;

  IF v_ticket_count = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.ticket_registrations SET
    mp_payment_id    = p_payment_id,
    mp_status        = p_status,
    mp_fee_amount    = CASE WHEN p_fee_amount IS NULL THEN mp_fee_amount ELSE v_fee_per_ticket END,
    mp_net_amount    = CASE WHEN p_net_amount IS NULL THEN mp_net_amount ELSE v_net_per_ticket END,
    payment_verified = CASE WHEN v_approved THEN true ELSE payment_verified END,
    paid_at          = CASE WHEN v_approved THEN COALESCE(paid_at, NOW()) ELSE paid_at END
  WHERE mp_external_reference = p_external_reference;

  RETURN v_ticket_count;
END;
$function$;

-- Sólo service role. Nadie desde el navegador debería poder marcar un pago
-- como aprobado, así que se revoca el EXECUTE por defecto a anon/authenticated.
REVOKE ALL ON FUNCTION public.mp_apply_payment(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

-- El REVOKE a PUBLIC también deja afuera a service_role, así que hay que
-- devolvérselo explícitamente: es el rol con el que la API llama esta función.
GRANT EXECUTE ON FUNCTION public.mp_apply_payment(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB
) TO service_role;

-- ============================================================
-- 5. Verificación
-- ============================================================
SELECT 'col: events.payment_mode' AS item,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'events' AND column_name = 'payment_mode') AS ok
UNION ALL
SELECT 'col: events.mp_surcharge_pct',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'events' AND column_name = 'mp_surcharge_pct')
UNION ALL
SELECT 'col: ticket_registrations.mp_external_reference',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'ticket_registrations' AND column_name = 'mp_external_reference')
UNION ALL
SELECT 'tabla: mp_payments',
       EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'mp_payments')
UNION ALL
SELECT 'rpc: mp_apply_payment',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mp_apply_payment');
