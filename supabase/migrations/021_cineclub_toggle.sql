-- ============================================================
-- Manso Gestion — Perilla para mostrar/ocultar el Cineclub
-- La sección no se borra: queda apagada por defecto y se
-- vuelve a encender desde Configuración (panel de control).
-- ============================================================

ALTER TABLE venue_config
  ADD COLUMN IF NOT EXISTS cineclub_activo BOOLEAN NOT NULL DEFAULT false;

-- La policy de escritura original solo contemplaba a control@, pero la
-- perilla vive en Configuración, que también ve el owner.
DROP POLICY IF EXISTS "venue_config_control_update" ON venue_config;
CREATE POLICY "venue_config_control_update" ON venue_config
  FOR ALL USING (
    (auth.jwt() ->> 'email') = ANY (ARRAY['control@manso.internal', 'owner@manso.internal'])
  );
