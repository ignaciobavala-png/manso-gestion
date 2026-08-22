-- ============================================================
-- Manso Gestion — Presentacion del Cowork Day, editable
--
-- El titulo, la leyenda, las tarjetas de "que incluye", la nota
-- sobre los datos y la portada estaban clavados en el codigo, asi
-- que cambiar una palabra pedia un deploy.
--
-- Va como JSONB en venue_config y no en una tabla nueva porque esa
-- tabla ya tiene las policies correctas (lectura publica, escritura
-- de control/owner), ya esta en la publicacion de realtime y ya la
-- carga el store: un cambio de texto se ve al instante en la pantalla
-- de al lado, sin recargar y sin piezas nuevas.
--
-- null = "los textos por defecto", que viven en src/lib/coworkLanding.ts.
-- ============================================================

ALTER TABLE venue_config
  ADD COLUMN IF NOT EXISTS cowork_landing JSONB;
