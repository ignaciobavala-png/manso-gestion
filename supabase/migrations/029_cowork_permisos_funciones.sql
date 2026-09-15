-- ============================================================
-- Manso Gestion — Cerrar la emision de llaves
--
-- La 027 terminaba con `revoke all on function cowork_emitir_llave
-- from anon`, que no alcanza: en Postgres el EXECUTE de una funcion
-- se otorga a PUBLIC por defecto, y revocarselo a anon no toca ese
-- grant heredado. El advisor de Supabase lo marco apenas se aplico:
--
--   cowork_emitir_llave puede ejecutarse por el rol anon via
--   /rest/v1/rpc/cowork_emitir_llave
--
-- O sea que con la clave publica —la que esta en el bundle del
-- navegador— cualquiera podia emitirse una llave mensual del cowork.
-- Es la funcion que decide quien entra: no puede ser publica.
--
-- La emision entra solo por dos caminos: el trigger del cowork day,
-- que corre como el owner de la funcion, y POST /api/cowork/llave,
-- que usa la service role. Ninguno de los dos necesita que la
-- funcion este expuesta en la API REST.
--
-- Las dos de la puerta si quedan para authenticated, a proposito:
-- este proyecto no tiene registro publico, "authenticated" son las
-- tres cuentas de staff y nadie mas.
-- ============================================================

revoke all on function cowork_emitir_llave(
  text, text, text, date, date, text, text, text, numeric, text, uuid, text, text
) from public, anon, authenticated;

grant execute on function cowork_emitir_llave(
  text, text, text, date, date, text, text, text, numeric, text, uuid, text, text
) to service_role;

-- Funciones de trigger: llamarlas por RPC falla igual, pero no tienen
-- por que estar publicadas en la API.
revoke all on function cowork_llave_desde_registracion() from public, anon, authenticated;
revoke all on function cowork_credencial_al_crear_persona() from public, anon, authenticated;

-- Y las de puerta, explicitas: fuera de anon, adentro para el staff.
revoke all on function cowork_validar_qr(uuid) from public, anon;
revoke all on function cowork_registrar_ingreso(uuid, text, boolean) from public, anon;
grant execute on function cowork_validar_qr(uuid) to authenticated, service_role;
grant execute on function cowork_registrar_ingreso(uuid, text, boolean) to authenticated, service_role;
