-- ============================================================
-- BLUR · Analógica: un rollo por cámara descartable, con link propio.
--
-- Cada teléfono (dispositivo) es una cámara. `blur_rollos` le da a cada una:
--   · un token largo para su link personal (/blur/rollo/<token>), que la
--     organización puede mandar a su dueño;
--   · un contacto opcional (mail) que la propia persona deja al entregar el
--     rollo, para poder mandarle sus fotos;
--   · una marca de cuándo se le mandó.
--
-- Quién puede qué:
--   · anon NO lee ni escribe la tabla. El token no va a una tabla legible por
--     anon (si no, terminaría en el navegador de cualquiera): solo staff.
--   · anon solo puede llamar a blur_rollo_dejar_contacto(), que guarda el mail
--     y NO devuelve el token (quien escribe un mail no prueba que sea suyo).
--   · Las fotos se leen desde una función de servidor (api/blur-rollo.ts y
--     api/blur-reveladas.ts, con la clave de servicio) que firma URLs
--     temporales: el bucket `blur-analogica` sigue privado.
-- ============================================================

CREATE TABLE public.blur_rollos (
  dispositivo uuid PRIMARY KEY,
  token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Mismo número que muestra la app en el sobre de entrega (src/lib/fotos.ts,
  -- numeroRollo): primeros 6 hex del dispositivo módulo 10000. Decorativo: puede
  -- repetirse entre dos teléfonos; el identificador real es `dispositivo`.
  numero      text GENERATED ALWAYS AS (
    lpad((((('x' || substr(replace(dispositivo::text, '-', ''), 1, 6))::bit(24))::int) % 10000)::text, 4, '0')
  ) STORED,
  contacto    text,
  contacto_at timestamptz,
  enviado_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blur_rollos_contacto_formato CHECK (
    contacto IS NULL
    OR (length(contacto) <= 254 AND contacto ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  )
);

ALTER TABLE public.blur_rollos ENABLE ROW LEVEL SECURITY;

-- Staff (authenticated, como en el resto de Gestión): lee todo y solo puede
-- editar el contacto y la marca de envío; el token y el dispositivo no se tocan.
REVOKE ALL ON public.blur_rollos FROM anon, authenticated;
GRANT SELECT ON public.blur_rollos TO authenticated;
GRANT UPDATE (contacto, contacto_at, enviado_at) ON public.blur_rollos TO authenticated;

CREATE POLICY blur_rollos_staff_select ON public.blur_rollos FOR SELECT TO authenticated USING (true);
CREATE POLICY blur_rollos_staff_update ON public.blur_rollos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- El rollo nace con la primera foto del dispositivo.
CREATE FUNCTION public.blur_rollos_alta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.blur_rollos (dispositivo) VALUES (NEW.dispositivo) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.blur_rollos_alta() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER blur_rollos_alta AFTER INSERT ON public.blur_fotos
  FOR EACH ROW EXECUTE FUNCTION public.blur_rollos_alta();

-- Rollos que ya existían antes de esta migración.
INSERT INTO public.blur_rollos (dispositivo)
SELECT DISTINCT dispositivo FROM public.blur_fotos
ON CONFLICT DO NOTHING;

-- La persona deja su mail desde su propio teléfono. Hace la acción y no
-- devuelve nada: ni el token ni si el rollo "existía" más allá del error.
CREATE FUNCTION public.blur_rollo_dejar_contacto(p_dispositivo uuid, p_contacto text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v text := lower(btrim(p_contacto));
BEGIN
  IF v IS NULL OR length(v) > 254 OR v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'contacto_invalido' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.blur_rollos SET contacto = v, contacto_at = now() WHERE dispositivo = p_dispositivo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rollo_inexistente' USING ERRCODE = 'P0001';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.blur_rollo_dejar_contacto(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blur_rollo_dejar_contacto(uuid, text) TO anon, authenticated;
