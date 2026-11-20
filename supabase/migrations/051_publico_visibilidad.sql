-- ============================================================
-- Manso Gestion — Switch para ocultar la seccion "Publico" del panel
--
-- Mismo mecanismo que Barra (025): oculto saca el tab de la navegacion,
-- interno lo muestra. La ruta /admin/publico sigue viva en ambos casos.
--
-- Arranca OCULTA a pedido de Ana: casi no se usa. Se vuelve a prender
-- desde /admin/home -> Secciones.
--
-- Columna nueva, sin booleano viejo: el deploy anterior no la conoce y
-- no la necesita.
-- ============================================================

ALTER TABLE venue_config
  ADD COLUMN IF NOT EXISTS publico_visibilidad TEXT NOT NULL DEFAULT 'oculto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venue_config_publico_visibilidad_valida'
  ) THEN
    ALTER TABLE venue_config ADD CONSTRAINT venue_config_publico_visibilidad_valida
      CHECK (publico_visibilidad IN ('oculto', 'interno'));
  END IF;
END $$;
