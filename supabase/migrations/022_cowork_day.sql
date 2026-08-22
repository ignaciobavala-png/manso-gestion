-- ============================================================
-- Manso Gestion — Cowork Day
--
-- El pase de cowork se vende con las mismas herramientas que las
-- entradas de eventos: una fila en `events` con precio, cupo y
-- Mercado Pago. Lo único que agrega esta migración es cómo
-- distinguirlo del resto de la cartelera y cómo prender la sección.
--
-- Deliberadamente NO hay tablas nuevas de cowork acá. La propuesta
-- de membresías con stickers NFC (docs/COWORK.md) es otra cosa y
-- otro momento: esto es vender un día suelto, nada más.
-- ============================================================

-- Perilla de la sección pública, mismo patrón que cineclub_activo (021).
ALTER TABLE venue_config
  ADD COLUMN IF NOT EXISTS cowork_activo BOOLEAN NOT NULL DEFAULT false;

-- Marca el evento como pase de cowork. Sirve para dos cosas:
--   1. /cowork lista sólo estas fechas, sin mezclarse con los shows.
--   2. la cartelera de /registro las esconde, porque un pase de un
--      martes a la mañana no es "la próxima fecha" de nadie.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cowork_day BOOLEAN NOT NULL DEFAULT false;

-- La cartelera pública filtra por esta columna en cada carga.
CREATE INDEX IF NOT EXISTS idx_events_cowork_day
  ON events (cowork_day)
  WHERE cowork_day = true;
