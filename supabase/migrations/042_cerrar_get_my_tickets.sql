-- ============================================================
-- Manso Gestión — Migración 042: cerrar get_my_tickets
-- ============================================================
-- get_my_tickets(p_email) devolvía los QR de cualquier email (ver la 041).
-- Desde el deploy que acompaña a la 041, /mi-entrada ya no la llama: la
-- búsqueda por email reenvía al mail (api/reenviar-entradas.ts) y la recarga
-- pregunta por token (get_tickets_por_token).
--
-- Ojo: la 020 la creó sin REVOKE, así que además de anon y authenticated
-- tenía EXECUTE para PUBLIC (`=X` en el ACL). Revocar sólo a anon y
-- authenticated la dejaba abierta igual: cualquier rol hereda de PUBLIC.
--
-- Se revoca en vez de borrarla para poder volver atrás con un GRANT si hiciera
-- falta. La service role la conserva.
--
-- ORDEN — no aplicar antes de:
--   1. La 041 aplicada.
--   2. El front nuevo deployado y verificado:
--        grep -rn "get_my_tickets" src api   → sin resultados
--      Un navegador con la versión vieja cacheada recibe un error en la
--      búsqueda: el QR guardado en el dispositivo sigue apareciendo igual.
-- ============================================================

REVOKE ALL ON FUNCTION public.get_my_tickets(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tickets(TEXT) TO service_role;

-- Verificación: nadie del lado público puede ejecutarla.
SELECT 'anon sin EXECUTE en get_my_tickets' AS item,
       NOT has_function_privilege('anon', 'public.get_my_tickets(text)', 'EXECUTE') AS ok
UNION ALL
SELECT 'authenticated sin EXECUTE en get_my_tickets',
       NOT has_function_privilege('authenticated', 'public.get_my_tickets(text)', 'EXECUTE')
UNION ALL
SELECT 'sin EXECUTE para PUBLIC',
       NOT EXISTS (
         SELECT 1
         FROM pg_proc p, aclexplode(p.proacl) a
         WHERE p.oid = 'public.get_my_tickets(text)'::regprocedure
           AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       );
