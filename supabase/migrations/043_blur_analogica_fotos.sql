-- ============================================================
-- BLUR · Analógica: fotos del rollo de cada persona.
--
-- La app del festival (blur/, anon) primero inserta una fila en `blur_fotos`
-- (ahí se cuenta el tope de 10 por dispositivo) y después sube el archivo al
-- bucket privado `blur-analogica` con el mismo path. La policy del bucket solo
-- deja subir a un path que ya tenga fila. Anon no lee ni lista nada: las fotos
-- las ve el staff (authenticated, como en el resto de Gestión) en
-- /admin/fotos, que marca cuáles se publican.
-- ============================================================

CREATE TABLE public.blur_fotos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Id anónimo que genera la app en cada teléfono; no identifica a nadie.
  dispositivo uuid NOT NULL,
  path        text NOT NULL UNIQUE,
  filtro      text,
  -- La decide la organización. false = sin revisar o descartada.
  publicada   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- <dispositivo>/<id>.jpg: la policy del bucket no acepta rutas arbitrarias.
  CONSTRAINT blur_fotos_path_formato CHECK (path = dispositivo::text || '/' || id::text || '.jpg')
);

CREATE INDEX blur_fotos_dispositivo_idx ON public.blur_fotos (dispositivo);
CREATE INDEX blur_fotos_created_idx ON public.blur_fotos (created_at DESC);

ALTER TABLE public.blur_fotos ENABLE ROW LEVEL SECURITY;

-- Tope de 10 por dispositivo. SECURITY DEFINER: anon no puede contar sus
-- propias filas (no tiene SELECT).
CREATE FUNCTION public.blur_fotos_tope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.blur_fotos WHERE dispositivo = NEW.dispositivo) >= 10 THEN
    RAISE EXCEPTION 'rollo_completo: este dispositivo ya usó sus 10 fotos' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.blur_fotos_tope() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER blur_fotos_tope BEFORE INSERT ON public.blur_fotos
  FOR EACH ROW EXECUTE FUNCTION public.blur_fotos_tope();

-- Anon: solo INSERT y sin SELECT (la app inserta con return=minimal).
CREATE POLICY blur_fotos_insert ON public.blur_fotos FOR INSERT TO anon, authenticated
  WITH CHECK (publicada = false);
CREATE POLICY blur_fotos_staff_select ON public.blur_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY blur_fotos_staff_update ON public.blur_fotos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY blur_fotos_staff_delete ON public.blur_fotos FOR DELETE TO authenticated USING (true);

REVOKE ALL ON public.blur_fotos FROM anon, authenticated;
GRANT INSERT ON public.blur_fotos TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.blur_fotos TO authenticated;

-- Bucket privado: 3 MB, solo JPEG.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blur-analogica', 'blur-analogica', false, 3145728, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 3145728, allowed_mime_types = ARRAY['image/jpeg'];

-- ¿Hay una fila esperando este archivo? Aparte porque la policy corre como
-- anon, que no puede leer blur_fotos.
CREATE FUNCTION public.blur_foto_registrada(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.blur_fotos WHERE path = p_path)
$$;
REVOKE ALL ON FUNCTION public.blur_foto_registrada(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blur_foto_registrada(text) TO anon, authenticated;

CREATE POLICY blur_analogica_subir ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'blur-analogica' AND public.blur_foto_registrada(name));

-- Sin SELECT para anon: no se puede listar ni leer. El staff ve y borra.
CREATE POLICY blur_analogica_staff_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'blur-analogica');
CREATE POLICY blur_analogica_staff_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blur-analogica');
