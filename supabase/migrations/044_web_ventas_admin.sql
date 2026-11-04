-- ============================================================
-- 044 — Ventas de BLUR para el panel de manso-club (solo lectura)
--
-- El panel de Ventas de manso-club leía únicamente festival_ordenes, su tabla
-- de órdenes. Las ventas cargadas a mano en Gestión (transferencias, efectivo)
-- no estaban ahí, así que cada lado veía una parte. Gestión es la fuente de
-- verdad de las entradas: esta función le deja al panel leer TODAS desde acá,
-- las de la web y las manuales, sin copiar nada.
--
-- Devuelve una fila por entrada. No devuelve el token (es la credencial del
-- QR) ni datos de pago de terceros. Expone los campos crudos además de
-- vendida/reservada para no reinterpretar: en Gestión una transferencia cargada
-- a mano cuenta como vendida desde que se carga (entrada_vendida), y
-- payment_verified dice si alguien ya la confirmó contra el banco.
--
-- Sólo service_role: la llama el servidor de manso-club después de verificar
-- que quien mira es admin. Ni anon ni authenticated pueden ejecutarla.
--
-- Aditiva y de solo lectura: no toca tablas ni funciones existentes. Para
-- volver atrás: DROP FUNCTION public.web_ventas_admin(UUID[]);
-- ============================================================

CREATE OR REPLACE FUNCTION public.web_ventas_admin(p_event_ids UUID[])
RETURNS TABLE (
  registro_id         UUID,
  event_id            UUID,
  evento              TEXT,
  order_ref           TEXT,
  nombre              TEXT,
  email               TEXT,
  phone               TEXT,
  origen              TEXT,
  payment_provider    TEXT,
  payment_verified    BOOLEAN,
  vendida             BOOLEAN,
  reservada           BOOLEAN,
  rechazada           BOOLEAN,
  tipo                TEXT,
  precio              NUMERIC,
  tiene_comprobante   BOOLEAN,
  registered_at       TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  mp_expires_at       TIMESTAMPTZ,
  qr_mail_enviado_at  TIMESTAMPTZ,
  used_at             TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT r.id, r.event_id, e.name, r.order_ref, r.name, r.email, r.phone,
         r.origen, r.payment_provider, COALESCE(r.payment_verified, false),
         public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified),
         public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at),
         COALESCE(r.is_banned, false),
         r.ticket_type_nombre, r.price_per_ticket,
         (r.receipt_url IS NOT NULL),
         r.registered_at, r.paid_at, r.mp_expires_at,
         r.qr_mail_enviado_at, r.used_at
  FROM public.ticket_registrations r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.event_id = ANY (p_event_ids)
  ORDER BY r.registered_at DESC
  LIMIT 2000;
$function$;

REVOKE ALL ON FUNCTION public.web_ventas_admin(UUID[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_ventas_admin(UUID[]) TO service_role;
