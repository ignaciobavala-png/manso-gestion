-- ============================================================
-- Manso Gestión — Migración 041: "Mis entradas" por token, no por email
-- ============================================================
-- get_my_tickets(p_email) (020) es pública y devuelve los tokens —los QR—
-- de cualquier email que alguien escriba: con el mail de otra persona te
-- llevás sus entradas y entrás antes que ella. Desde la 039 eso incluye las
-- del festival que vende la web.
--
-- Principio (brain-data, identidad-sin-cuentas-token-y-mail): quien escribe
-- un email no prueba que sea suyo; quien abre la casilla sí. El token es el
-- secreto; el email, no. Entonces:
--
--   - Búsqueda por email → api/reenviar-entradas.ts manda los QR AL mail
--     (service role), con la respuesta siempre igual. Su freno vive en
--     entradas_reenvios (sección 2).
--   - El dispositivo pregunta por los tokens que ya tiene, y el link del
--     mail (/mi-entrada#t=…) trae los suyos: get_tickets_por_token.
--
-- Aditiva: se aplica ANTES de deployar el front que la usa. La que cierra
-- get_my_tickets es la 042, que va DESPUÉS del deploy.
-- ============================================================

-- ============================================================
-- 1. Entradas por token
-- ============================================================
-- Devuelve sólo las filas de los tokens que le pasan: quien llama ya tiene
-- el QR, así que no se entera de nada que no supiera, salvo el estado.
-- Tope de 50 tokens por llamada (un dispositivo con varias compras ronda la
-- decena); el resto del array se ignora.
CREATE OR REPLACE FUNCTION public.get_tickets_por_token(p_tokens TEXT[])
RETURNS TABLE (
  token              TEXT,
  name               TEXT,
  event_id           UUID,
  ticket_type_nombre TEXT,
  pack_pos           SMALLINT,
  pack_size          SMALLINT,
  -- valida: vendida y sin usar · usada: ya entró · anulada: Rechazar QR
  -- pendiente: MP o web sin pago confirmado (el lector la rechaza)
  estado             TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT r.token,
         r.name,
         r.event_id,
         r.ticket_type_nombre,
         r.pack_pos,
         r.pack_size,
         CASE
           WHEN r.is_banned THEN 'anulada'
           WHEN NOT public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified) THEN 'pendiente'
           WHEN r.used_at IS NOT NULL THEN 'usada'
           ELSE 'valida'
         END
  FROM public.ticket_registrations r
  WHERE r.token = ANY ((p_tokens)[1:50]);
$function$;

REVOKE ALL ON FUNCTION public.get_tickets_por_token(TEXT[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_tickets_por_token(TEXT[]) TO anon, authenticated, service_role;

-- ============================================================
-- 2. Freno del reenvío por mail
-- ============================================================
-- Resend está en plan free (100 mails por día, compartidos con los mails de
-- las entradas): el reenvío no puede servir para llenarle la casilla a
-- alguien ni para gastarse el cupo. Una fila por pedido, haya mandado algo o
-- no, así el freno no depende de si el email tiene entradas.
CREATE TABLE IF NOT EXISTS public.entradas_reenvios (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      TEXT NOT NULL,
  -- SHA-256 del IP: alcanza para contar pedidos por origen sin guardar el IP.
  ip_hash    TEXT,
  -- Mails que salieron por este pedido (uno por evento). Lo completa la ruta
  -- después de mandar; 0 si no había nada o si lo frenó el tope.
  enviados   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entradas_reenvios_email
  ON public.entradas_reenvios (email, created_at);
CREATE INDEX IF NOT EXISTS idx_entradas_reenvios_ip
  ON public.entradas_reenvios (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_entradas_reenvios_created
  ON public.entradas_reenvios (created_at);

-- Sin políticas: sólo la service role (que no pasa por RLS) lee y escribe.
ALTER TABLE public.entradas_reenvios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entradas_reenvios FROM anon, authenticated;

-- ============================================================
-- 3. Índice para buscar entradas por email
-- ============================================================
-- El email se guarda en minúscula (api/_lib/registro.ts y web_reservar).
CREATE INDEX IF NOT EXISTS idx_ticket_registrations_email
  ON public.ticket_registrations (email);

-- ============================================================
-- Verificación
-- ============================================================
SELECT 'fn: get_tickets_por_token con EXECUTE para anon' AS item,
       has_function_privilege('anon', 'public.get_tickets_por_token(text[])', 'EXECUTE') AS ok
UNION ALL
SELECT 'anon no lee entradas_reenvios',
       NOT has_table_privilege('anon', 'public.entradas_reenvios', 'SELECT')
UNION ALL
SELECT 'RLS en entradas_reenvios',
       (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.entradas_reenvios'::regclass);
