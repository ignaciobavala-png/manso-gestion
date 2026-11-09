-- ============================================================
-- Notas internas por evento (bloc de notas del equipo).
--
-- Ana anota ahí lo que el equipo tiene que saber de la dinámica: cuántas
-- consumiciones se dan, horarios, proveedores, cosas a tener en cuenta.
--
-- Va en una tabla APARTE y no como columna de `events`: `events` la lee el
-- público (anon) para armar la página de entradas, y una columna `notes` ahí
-- quedaría expuesta. Esta tabla solo la ve el staff autenticado; anon no tiene
-- ni grant.
-- ============================================================

CREATE TABLE public.event_notes (
  event_id   uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  body       text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_notes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.event_notes TO authenticated;

CREATE POLICY event_notes_staff_select ON public.event_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY event_notes_staff_insert ON public.event_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY event_notes_staff_update ON public.event_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE FUNCTION public.event_notes_tocar() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER event_notes_tocar BEFORE UPDATE ON public.event_notes
  FOR EACH ROW EXECUTE FUNCTION public.event_notes_tocar();
