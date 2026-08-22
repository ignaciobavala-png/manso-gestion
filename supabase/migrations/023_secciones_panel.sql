-- ============================================================
-- Manso Gestion — Perillas de secciones del panel
--
-- Hasta ahora las perillas apagaban secciones públicas. Esta suma
-- la primera que apaga una sección del propio panel: Barra, que no
-- se está usando y sólo ocupa lugar en la nav de abajo.
--
-- Apagar NO borra nada ni cierra la ruta: /admin/barra sigue
-- respondiendo si alguien tiene el link. Lo único que hace es
-- sacarla de la nav, que es lo que molesta.
-- ============================================================

ALTER TABLE venue_config
  ADD COLUMN IF NOT EXISTS barra_activa BOOLEAN NOT NULL DEFAULT false;
