-- ============================================================
-- Manso Gestión — Migración 040: cerrar el INSERT público de entradas
-- ============================================================
-- Hasta acá, cualquiera con la anon key (que está en el bundle del
-- navegador) podía insertar en ticket_registrations por PostgREST, con
-- with_check true: una fila con payment_verified = true y el precio que
-- quisiera era una entrada válida sin pagar. Con los tipos de entrada (039)
-- además podía meterse en el cupo de un tipo.
--
-- Desde el deploy que acompaña a la 039, el único camino que inserta es
-- api/_lib/registro.ts, y lo hace con la service role (que no pasa por RLS).
-- El staff conserva su política ticket_registrations_staff_all.
--
-- ORDEN — no aplicar antes de:
--   1. La 039 aplicada y el código que inserta con service role deployado.
--   2. Verificado con grep que ningún otro camino inserte con anon:
--        grep -rn "ticket_registrations" src api scripts \
--          | grep -i "insert\|upsert"
--      Al escribir esta migración, el único resultado es api/_lib/registro.ts
--      (adminClient). El comodín inserta en wildcard_qr_redemptions, no acá.
--
-- Para revertir: recrear las dos políticas como estaban (ver el final).
-- ============================================================

DROP POLICY IF EXISTS registro_publico_insert ON public.ticket_registrations;
DROP POLICY IF EXISTS ticket_registrations_public_insert ON public.ticket_registrations;

-- Defensa en profundidad: aunque alguien vuelva a crear una política
-- permisiva, anon no tiene el privilegio de tabla.
REVOKE INSERT ON public.ticket_registrations FROM anon;

-- Verificación: anon no puede insertar; el staff y la service role sí.
SELECT 'anon sin INSERT' AS item,
       NOT has_table_privilege('anon', 'public.ticket_registrations', 'INSERT') AS ok
UNION ALL
SELECT 'sin políticas de INSERT públicas',
       NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'ticket_registrations'
                     AND policyname IN ('registro_publico_insert', 'ticket_registrations_public_insert'))
UNION ALL
SELECT 'staff conserva su política',
       EXISTS (SELECT 1 FROM pg_policies
               WHERE tablename = 'ticket_registrations'
                 AND policyname = 'ticket_registrations_staff_all');

-- Reversa (no ejecutar salvo que haga falta volver atrás):
--   GRANT INSERT ON public.ticket_registrations TO anon;
--   CREATE POLICY registro_publico_insert ON public.ticket_registrations
--     FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY ticket_registrations_public_insert ON public.ticket_registrations
--     FOR INSERT TO public WITH CHECK (true);
