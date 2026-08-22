-- ============================================================
-- Manso Gestion — Fondo de la app configurable + venue_config en vivo
--
-- 1. El fondo deja de estar clavado en /fondo.png. La foto actual
--    sigue siendo la que se ve por defecto: background_url en null
--    significa "usar la de siempre", así que esto no cambia nada
--    hasta que alguien suba otra desde Configuración.
--
-- 2. venue_config entra en la publicación de realtime. Sin esto, las
--    perillas de Secciones se guardaban bien pero la navegación no
--    se enteraba hasta recargar el panel — parecía que el toggle no
--    hacía nada.
-- ============================================================

ALTER TABLE venue_config
  ADD COLUMN IF NOT EXISTS background_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'venue_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE venue_config;
  END IF;
END $$;
