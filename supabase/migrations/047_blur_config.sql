-- ============================================================
-- BLUR · Analógica: cuándo abre el revelado, que lo maneja la organización.
--
-- Antes la fecha de apertura era una variable de entorno de Vercel
-- (BLUR_REVELADO_DESDE): cambiarla pedía acceso a Vercel y un redeploy. Ahora
-- vive en la base y se cambia desde /admin/fotos (pestaña Revelado): programar
-- una fecha, abrir ahora o volver a cerrar.
--
--   revelado_desde IS NULL            → cerrado
--   revelado_desde > now()            → cerrado, abre en esa fecha
--   revelado_desde <= now()           → abierto
--
-- Una sola fila (id = true). anon no la lee: la app se entera de la fecha por
-- las funciones de servidor (api/blur-*.ts), que además fallan cerrando si no
-- pueden leerla.
-- ============================================================

CREATE TABLE public.blur_config (
  id             boolean PRIMARY KEY DEFAULT true CHECK (id),
  revelado_desde timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.blur_config (id) VALUES (true);

ALTER TABLE public.blur_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.blur_config FROM anon, authenticated;
GRANT SELECT ON public.blur_config TO authenticated;
GRANT UPDATE (revelado_desde) ON public.blur_config TO authenticated;

CREATE POLICY blur_config_staff_select ON public.blur_config FOR SELECT TO authenticated USING (true);
CREATE POLICY blur_config_staff_update ON public.blur_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE FUNCTION public.blur_config_tocar() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER blur_config_tocar BEFORE UPDATE ON public.blur_config
  FOR EACH ROW EXECUTE FUNCTION public.blur_config_tocar();
