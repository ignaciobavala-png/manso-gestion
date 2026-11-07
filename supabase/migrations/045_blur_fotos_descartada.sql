-- ============================================================
-- BLUR · Analógica: la organización decide foto por foto, y se nota.
--
-- Hasta ahora `publicada = false` mezclaba "todavía no la miramos" con "la
-- miramos y no sale". Con cientos de fotos eso no se puede ordenar: no se sabe
-- qué falta revisar. Se agrega `descartada` y el estado sale de las dos marcas:
--
--   publicada = false, descartada = false  → sin revisar
--   publicada = true                       → para publicar
--   descartada = true                      → revisada, no se publica
--
-- Una foto no puede estar en las dos (CHECK). No se borra nada: una descartada
-- se puede recuperar. La app pública (anon) sigue sin leer nada de esta tabla.
-- ============================================================

ALTER TABLE public.blur_fotos
  ADD COLUMN descartada boolean NOT NULL DEFAULT false;

ALTER TABLE public.blur_fotos
  ADD CONSTRAINT blur_fotos_decision_unica CHECK (NOT (publicada AND descartada));

-- El teléfono solo puede insertar fotos sin decisión (antes: publicada = false).
DROP POLICY blur_fotos_insert ON public.blur_fotos;
CREATE POLICY blur_fotos_insert ON public.blur_fotos FOR INSERT TO anon, authenticated
  WITH CHECK (publicada = false AND descartada = false);
