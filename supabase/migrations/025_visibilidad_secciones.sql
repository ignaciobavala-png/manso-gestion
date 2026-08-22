-- ============================================================
-- Manso Gestion — Visibilidad de secciones en tres estados
--
-- La perilla si/no prendia la seccion entera: al activar Cowork Day
-- aparecia la pestaña del panel Y la pagina publica. No habia forma
-- de trabajar en una seccion sin exponerla.
--
--   oculto   no se ve en ningun lado
--   interno  se ve en el panel, y la pagina publica solo para quien
--            tenga sesion de staff
--   publico  se ve para todos
--
-- Es una escalera, no dos perillas: asi no existe el estado invalido
-- "publico pero sin panel".
--
-- Barra no tiene pagina publica, por eso su CHECK no acepta 'publico'.
--
-- Los booleanos viejos NO se borran todavia: mientras produccion siga
-- corriendo el deploy anterior, es lo unico que esa version sabe leer.
-- Se van en una migracion de limpieza cuando el deploy nuevo este
-- arriba.
-- ============================================================

ALTER TABLE venue_config
  ADD COLUMN IF NOT EXISTS barra_visibilidad    TEXT NOT NULL DEFAULT 'oculto',
  ADD COLUMN IF NOT EXISTS cineclub_visibilidad TEXT NOT NULL DEFAULT 'oculto',
  ADD COLUMN IF NOT EXISTS cowork_visibilidad   TEXT NOT NULL DEFAULT 'oculto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venue_config_visibilidad_valida'
  ) THEN
    ALTER TABLE venue_config ADD CONSTRAINT venue_config_visibilidad_valida CHECK (
      barra_visibilidad    IN ('oculto', 'interno') AND
      cineclub_visibilidad IN ('oculto', 'interno', 'publico') AND
      cowork_visibilidad   IN ('oculto', 'interno', 'publico')
    );
  END IF;
END $$;

UPDATE venue_config SET
  barra_visibilidad    = CASE WHEN barra_activa    THEN 'interno' ELSE 'oculto' END,
  cineclub_visibilidad = CASE WHEN cineclub_activo THEN 'publico' ELSE 'oculto' END,
  cowork_visibilidad   = CASE WHEN cowork_activo   THEN 'publico' ELSE 'oculto' END
WHERE id = 1;
