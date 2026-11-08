-- ============================================================
-- BLUR · Analógica: cada rollo pertenece a una ENTRADA, no a "cualquiera".
--
-- Hasta ahora el rollo era solo un id que la app guarda en el teléfono: nada lo
-- ataba a una entrada, el tope de 10 se esquivaba borrando los datos del
-- navegador, y como anon puede insertar fotos, un script podía inventar ids y
-- llenar el bucket. Ahora:
--
--   · Un rollo se ACTIVA con el código de una entrada (los primeros 10
--     caracteres del token, que se ven junto al QR, o el token entero desde un
--     link personal). No se usa el mail: con un mail se compran varias
--     entradas y no se sabría de quién es cada una (ver brain-data
--     identidad-sin-cuentas-token-y-mail: el token es el secreto, el mail no).
--   · Solo se activa si esa entrada YA PASÓ POR LA PUERTA (used_at) y cuenta
--     como vendida. Un teléfono toma un solo rollo, y una entrada se activa en
--     un solo teléfono.
--   · Una llave en blur_config (rollo_requiere_entrada) decide si las fotos
--     exigen un rollo activado. Arranca APAGADA: aplicar esta migración no
--     cambia nada hasta que la organización la prenda desde el panel.
--
-- Aditiva y reversible: para volver atrás basta apagar la llave.
-- ============================================================

-- ── 1. El rollo se ata a una entrada ─────────────────────────
ALTER TABLE public.blur_rollos
  ADD COLUMN IF NOT EXISTS entrada_id   uuid UNIQUE
    REFERENCES public.ticket_registrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activado_at  timestamptz;

COMMENT ON COLUMN public.blur_rollos.entrada_id IS
  'Entrada que activó este rollo (única: una entrada, un teléfono). NULL = rollo anterior a la 048 o todavía sin activar.';

-- ── 2. La llave: ¿se exige entrada para sacar fotos? ──────────
ALTER TABLE public.blur_config
  ADD COLUMN IF NOT EXISTS rollo_requiere_entrada boolean NOT NULL DEFAULT false;

GRANT UPDATE (revelado_desde, rollo_requiere_entrada) ON public.blur_config TO authenticated;

-- ── 3. El tope de fotos pasa a exigir el rollo activado ──────
CREATE OR REPLACE FUNCTION public.blur_fotos_tope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE((SELECT rollo_requiere_entrada FROM public.blur_config WHERE id), false)
     AND NOT EXISTS (SELECT 1 FROM public.blur_rollos
                      WHERE dispositivo = NEW.dispositivo AND entrada_id IS NOT NULL) THEN
    RAISE EXCEPTION 'rollo_no_activado: activá tu rollo con el código de tu entrada' USING ERRCODE = 'P0001';
  END IF;

  IF (SELECT count(*) FROM public.blur_fotos WHERE dispositivo = NEW.dispositivo) >= 10 THEN
    RAISE EXCEPTION 'rollo_completo: este dispositivo ya usó sus 10 fotos' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

-- ── 4. Freno de intentos de activación (por origen) ──────────
-- Una fila por intento. Sin políticas: solo la clave de servicio escribe y lee.
CREATE TABLE IF NOT EXISTS public.blur_activaciones (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash    text,
  estado     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blur_activaciones_ip_idx ON public.blur_activaciones (ip_hash, created_at);
ALTER TABLE public.blur_activaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blur_activaciones FROM anon, authenticated;

-- ── 5. Activar un rollo ──────────────────────────────────────
-- Todo en una transacción para que dos teléfonos no ganen la misma entrada.
-- Solo la llama el servidor (api/blur-activar.ts) con la clave de servicio.
-- Devuelve {estado}; nunca nombre, mail ni token.
--   activado · codigo_invalido · no_encontrada · ambiguo · anulada · sin_pago ·
--   sin_ingreso · entrada_ya_activada · dispositivo_con_otra_entrada
CREATE OR REPLACE FUNCTION public.blur_activar_rollo(p_dispositivo uuid, p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cod  text := upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Za-z]', '', 'g'));
  v_ids  uuid[];
  v_row  public.ticket_registrations%ROWTYPE;
  v_n    integer;
BEGIN
  IF p_dispositivo IS NULL OR v_cod !~ '^[0-9A-F]+$' OR length(v_cod) NOT IN (10, 32) THEN
    RETURN jsonb_build_object('estado', 'codigo_invalido');
  END IF;

  -- Código corto (10) = primeros 10 caracteres del token sin guiones; largo (32) = el token entero.
  SELECT array_agg(r.id) INTO v_ids
  FROM public.ticket_registrations r
  JOIN public.events e ON e.id = r.event_id
  WHERE e.name ILIKE 'BLUR%'
    AND CASE WHEN length(v_cod) = 32
             THEN upper(replace(r.token, '-', '')) = v_cod
             ELSE upper(left(replace(r.token, '-', ''), 10)) = v_cod END;

  v_n := COALESCE(cardinality(v_ids), 0);
  IF v_n = 0 THEN RETURN jsonb_build_object('estado', 'no_encontrada'); END IF;
  IF v_n > 1 THEN RETURN jsonb_build_object('estado', 'ambiguo'); END IF;

  SELECT * INTO v_row FROM public.ticket_registrations WHERE id = v_ids[1];

  IF COALESCE(v_row.is_banned, false) THEN RETURN jsonb_build_object('estado', 'anulada'); END IF;
  IF NOT public.entrada_vendida(v_row.is_banned, v_row.payment_provider, v_row.payment_verified) THEN
    RETURN jsonb_build_object('estado', 'sin_pago');
  END IF;
  -- La puerta es lo que valida la entrada: sin ingreso registrado no hay rollo.
  IF v_row.used_at IS NULL THEN RETURN jsonb_build_object('estado', 'sin_ingreso'); END IF;

  INSERT INTO public.blur_rollos (dispositivo) VALUES (p_dispositivo) ON CONFLICT DO NOTHING;

  BEGIN
    UPDATE public.blur_rollos
       SET entrada_id = v_row.id, activado_at = now()
     WHERE dispositivo = p_dispositivo AND entrada_id IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN unique_violation THEN
    -- Esa entrada ya la tomó otro teléfono (salvo que sea este mismo, ver abajo).
    IF EXISTS (SELECT 1 FROM public.blur_rollos WHERE dispositivo = p_dispositivo AND entrada_id = v_row.id) THEN
      RETURN jsonb_build_object('estado', 'activado');
    END IF;
    RETURN jsonb_build_object('estado', 'entrada_ya_activada');
  END;

  IF v_n = 1 THEN RETURN jsonb_build_object('estado', 'activado'); END IF;

  -- No se actualizó nada: este teléfono ya tenía una entrada. Si es la misma, es un reintento.
  IF EXISTS (SELECT 1 FROM public.blur_rollos WHERE dispositivo = p_dispositivo AND entrada_id = v_row.id) THEN
    RETURN jsonb_build_object('estado', 'activado');
  END IF;
  RETURN jsonb_build_object('estado', 'dispositivo_con_otra_entrada');
END $$;

REVOKE ALL ON FUNCTION public.blur_activar_rollo(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blur_activar_rollo(uuid, text) TO service_role;

-- ── 6. ¿Este teléfono ya tiene su rollo activado? ────────────
-- Para que la app sepa qué pantalla mostrar. Solo servidor.
CREATE OR REPLACE FUNCTION public.blur_rollo_estado(p_dispositivo uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'requiere', COALESCE((SELECT rollo_requiere_entrada FROM public.blur_config WHERE id), false),
    'activado', EXISTS (SELECT 1 FROM public.blur_rollos WHERE dispositivo = p_dispositivo AND entrada_id IS NOT NULL)
  )
$$;
REVOKE ALL ON FUNCTION public.blur_rollo_estado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blur_rollo_estado(uuid) TO service_role;

-- ── Verificación ─────────────────────────────────────────────
SELECT 'col: blur_rollos.entrada_id' AS item,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blur_rollos' AND column_name = 'entrada_id') AS ok
UNION ALL
SELECT 'llave rollo_requiere_entrada apagada',
       NOT COALESCE((SELECT rollo_requiere_entrada FROM public.blur_config WHERE id), true)
UNION ALL
SELECT 'anon NO ejecuta blur_activar_rollo',
       NOT has_function_privilege('anon', 'public.blur_activar_rollo(uuid,text)', 'EXECUTE')
UNION ALL
SELECT 'anon NO lee blur_activaciones',
       NOT has_table_privilege('anon', 'public.blur_activaciones', 'SELECT');
