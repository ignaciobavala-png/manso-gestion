-- ============================================================
-- Manso Gestion — Usernames configurables en venue_config
-- Permite cambiar el nombre de usuario de login desde Configuración.
-- Por defecto: control='control', empleados='empleados'
-- ============================================================

ALTER TABLE venue_config
  ADD COLUMN IF NOT EXISTS control_username TEXT NOT NULL DEFAULT 'control',
  ADD COLUMN IF NOT EXISTS empleado_username TEXT NOT NULL DEFAULT 'empleados';
