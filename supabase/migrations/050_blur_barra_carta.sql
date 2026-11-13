-- ============================================================
-- BLUR · Barra: la carta (bebidas, comida, precios) se carga desde el panel.
--
-- Antes la carta era una lista fija en la webapp (blur/src/lib/mock.ts). Ahora
-- vive en esta tabla y se edita en /admin/blur/barra.
--
--   anon          → lee sólo los productos activos (la webapp BLUR los muestra)
--   authenticated → staff: lee, crea, edita y borra todo
--
-- Si la tabla está vacía, la webapp sigue mostrando la carta de maqueta.
-- ============================================================

CREATE TABLE public.blur_carta_productos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL CHECK (length(btrim(nombre)) > 0),
  categoria   TEXT NOT NULL CHECK (length(btrim(categoria)) > 0),
  descripcion TEXT,
  etiqueta    TEXT,
  -- Lugar reservado (trago de la marca invitada): se muestra punteado y no se pide.
  vacante     BOOLEAN NOT NULL DEFAULT false,
  -- NULL = el producto se muestra pero no se puede pedir (sin precio cargado).
  precio      NUMERIC(12,2) CHECK (precio IS NULL OR precio >= 0),
  foto        TEXT,
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX blur_carta_productos_orden_idx ON public.blur_carta_productos (categoria, orden);

CREATE FUNCTION public.blur_carta_productos_tocar() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER blur_carta_productos_tocar BEFORE UPDATE ON public.blur_carta_productos
  FOR EACH ROW EXECUTE FUNCTION public.blur_carta_productos_tocar();

ALTER TABLE public.blur_carta_productos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.blur_carta_productos FROM anon, authenticated;
GRANT SELECT ON public.blur_carta_productos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blur_carta_productos TO authenticated;

CREATE POLICY blur_carta_publica_lee ON public.blur_carta_productos
  FOR SELECT TO anon USING (activo);

CREATE POLICY blur_carta_staff_todo ON public.blur_carta_productos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
