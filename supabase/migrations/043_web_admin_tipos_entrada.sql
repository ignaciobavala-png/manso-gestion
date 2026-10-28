-- ============================================================
-- 043 — Tipos de entrada editables desde el panel de la web
--
-- Ana pidió poder editar precios, cupos y estados de las entradas de BLUR
-- también desde el panel de manso-club, no solo desde Gestión. Los tipos y el
-- stock siguen viviendo acá (event_ticket_types): el stock es uno solo para la
-- web y la app. Estas funciones son la puerta por la que manso-club los edita;
-- no hay una segunda copia de los datos.
--
-- Mismas reglas que el editor de Gestión (src/lib/tiposEntrada.ts):
--   · un tipo con entradas vendidas o reservadas no se borra, se desactiva;
--   · el precio más bajo de los tipos activos queda como regular_ticket_price
--     del evento (referencia para el resto de las pantallas).
--
-- Sólo service_role: las llama el servidor de manso-club después de verificar
-- que quien edita es admin. Ni anon ni authenticated pueden ejecutarlas.
--
-- Aditiva: no toca tablas ni funciones existentes. Para volver atrás, DROP de
-- las cuatro funciones.
-- ============================================================

-- ── Lectura para el editor ────────────────────────────────────
-- A diferencia de web_tipos_entrada (lo que ve el comprador), trae también
-- los inactivos, el cupo propio y cuántas entradas ocupa cada tipo.
CREATE OR REPLACE FUNCTION public.web_tipos_admin(p_event_id UUID)
RETURNS TABLE (
  id                  UUID,
  nombre              TEXT,
  descripcion         TEXT,
  precio              NUMERIC,
  entradas_por_unidad INTEGER,
  cupo                INTEGER,
  max_por_compra      INTEGER,
  estado              TEXT,
  activo              BOOLEAN,
  orden               INTEGER,
  ocupadas            INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT tt.id, tt.nombre, tt.descripcion, tt.precio, tt.entradas_por_unidad,
         tt.cupo, tt.max_por_compra, tt.estado, tt.activo, tt.orden,
         (SELECT COUNT(*)::INTEGER FROM public.ticket_registrations r
           WHERE r.ticket_type_id = tt.id
             AND (public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified)
                  OR public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at))
         ) AS ocupadas
  FROM public.event_ticket_types tt
  WHERE tt.event_id = p_event_id
  ORDER BY tt.orden, tt.created_at;
$function$;

-- ── Alta y edición ────────────────────────────────────────────
-- p_id NULL = tipo nuevo (queda al final). Devuelve el id.
CREATE OR REPLACE FUNCTION public.web_guardar_tipo(
  p_event_id            UUID,
  p_id                  UUID,
  p_nombre              TEXT,
  p_descripcion         TEXT,
  p_precio              NUMERIC,
  p_entradas_por_unidad INTEGER,
  p_cupo                INTEGER,
  p_max_por_compra      INTEGER,
  p_estado              TEXT,
  p_activo              BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id     UUID;
  v_nombre TEXT := btrim(COALESCE(p_nombre, ''));
  v_desde  NUMERIC;
BEGIN
  IF v_nombre = '' THEN
    RAISE EXCEPTION 'datos_invalidos: el tipo necesita un nombre' USING ERRCODE = 'P0001';
  END IF;
  IF p_precio IS NULL OR p_precio < 0 THEN
    RAISE EXCEPTION 'datos_invalidos: el precio no es válido' USING ERRCODE = 'P0001';
  END IF;
  IF p_entradas_por_unidad IS NULL OR p_entradas_por_unidad < 1 THEN
    RAISE EXCEPTION 'datos_invalidos: las entradas por unidad tienen que ser 1 o más' USING ERRCODE = 'P0001';
  END IF;
  IF p_cupo IS NOT NULL AND p_cupo < 0 THEN
    RAISE EXCEPTION 'datos_invalidos: el cupo no puede ser negativo' USING ERRCODE = 'P0001';
  END IF;
  IF p_max_por_compra IS NOT NULL AND p_max_por_compra < 1 THEN
    RAISE EXCEPTION 'datos_invalidos: el máximo por compra tiene que ser 1 o más' USING ERRCODE = 'P0001';
  END IF;
  IF p_estado NOT IN ('en_venta', 'proximamente', 'agotado', 'finalizado') THEN
    RAISE EXCEPTION 'datos_invalidos: estado % desconocido', p_estado USING ERRCODE = 'P0001';
  END IF;

  -- Mismo lock que web_reservar: no se edita un tipo a mitad de una reserva.
  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'evento_inexistente: %', p_event_id USING ERRCODE = 'P0001';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.event_ticket_types (
      event_id, nombre, descripcion, precio, entradas_por_unidad, cupo,
      max_por_compra, estado, activo, orden
    )
    VALUES (
      p_event_id, v_nombre, NULLIF(btrim(COALESCE(p_descripcion, '')), ''), p_precio,
      p_entradas_por_unidad, p_cupo, p_max_por_compra, p_estado, COALESCE(p_activo, true),
      COALESCE((SELECT MAX(t.orden) + 1 FROM public.event_ticket_types t WHERE t.event_id = p_event_id), 0)
    )
    RETURNING event_ticket_types.id INTO v_id;
  ELSE
    UPDATE public.event_ticket_types t
    SET nombre = v_nombre,
        descripcion = NULLIF(btrim(COALESCE(p_descripcion, '')), ''),
        precio = p_precio,
        entradas_por_unidad = p_entradas_por_unidad,
        cupo = p_cupo,
        max_por_compra = p_max_por_compra,
        estado = p_estado,
        activo = COALESCE(p_activo, true)
    WHERE t.id = p_id AND t.event_id = p_event_id
    RETURNING t.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'tipo_inexistente: % no es un tipo de este evento', p_id USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Referencia del evento: el precio más bajo entre los tipos activos.
  SELECT MIN(t.precio) INTO v_desde
  FROM public.event_ticket_types t
  WHERE t.event_id = p_event_id AND t.activo AND t.precio > 0;
  IF v_desde IS NOT NULL THEN
    UPDATE public.events SET regular_ticket_price = v_desde
    WHERE id = p_event_id AND regular_ticket_price IS DISTINCT FROM v_desde;
  END IF;

  RETURN v_id;
END;
$function$;

-- ── Orden ─────────────────────────────────────────────────────
-- p_ids: los ids del evento en el orden nuevo. Los que falten quedan al final.
CREATE OR REPLACE FUNCTION public.web_ordenar_tipos(p_event_id UUID, p_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;

  UPDATE public.event_ticket_types t
  SET orden = COALESCE(array_position(p_ids, t.id) - 1, cardinality(p_ids) + t.orden)
  WHERE t.event_id = p_event_id;
END;
$function$;

-- ── Baja ──────────────────────────────────────────────────────
-- Con entradas vendidas o reservadas no se borra: se desactiva (las entradas
-- ya emitidas guardan el nombre del tipo, pero el cupo y el historial salen de
-- acá).
CREATE OR REPLACE FUNCTION public.web_borrar_tipo(p_event_id UUID, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ocupadas INTEGER;
BEGIN
  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;

  SELECT COUNT(*)::INTEGER INTO v_ocupadas
  FROM public.ticket_registrations r
  WHERE r.ticket_type_id = p_id
    AND (public.entrada_vendida(r.is_banned, r.payment_provider, r.payment_verified)
         OR public.entrada_reservada(r.is_banned, r.payment_provider, r.payment_verified, r.mp_expires_at));
  IF v_ocupadas > 0 THEN
    RAISE EXCEPTION 'tipo_con_ventas: tiene % entrada(s) vendidas o reservadas; desactivalo en vez de borrarlo', v_ocupadas
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.event_ticket_types WHERE id = p_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tipo_inexistente: % no es un tipo de este evento', p_id USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.web_tipos_admin(UUID) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.web_guardar_tipo(UUID, UUID, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.web_ordenar_tipos(UUID, UUID[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.web_borrar_tipo(UUID, UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_tipos_admin(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_guardar_tipo(UUID, UUID, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_ordenar_tipos(UUID, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_borrar_tipo(UUID, UUID) TO service_role;

-- Verificación: solo service_role puede ejecutarlas.
SELECT f AS item,
       has_function_privilege('service_role', f, 'EXECUTE')
         AND NOT has_function_privilege('anon', f, 'EXECUTE')
         AND NOT has_function_privilege('authenticated', f, 'EXECUTE') AS ok
FROM unnest(ARRAY[
  'public.web_tipos_admin(uuid)',
  'public.web_guardar_tipo(uuid,uuid,text,text,numeric,integer,integer,integer,text,boolean)',
  'public.web_ordenar_tipos(uuid,uuid[])',
  'public.web_borrar_tipo(uuid,uuid)'
]) AS f;
