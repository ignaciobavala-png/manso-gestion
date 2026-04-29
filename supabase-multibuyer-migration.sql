-- ============================================================
-- Manso Gestion — Migracion Multibuyer
-- Permite que un mismo email registre multiples entradas
-- para el mismo evento, cada una con distinto nombre de asistente.
--
-- Constraint resultante: UNIQUE (email, name, event_id)
-- ============================================================

-- Verificar si la constraint vieja UNIQUE(email, event_id) existe
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'ticket_registrations'::regclass
    AND pg_get_constraintdef(oid) = 'UNIQUE (email, event_id)';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ticket_registrations DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- Crear la nueva constraint si no existe
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'ticket_registrations'::regclass
    AND pg_get_constraintdef(oid) = 'UNIQUE (email, name, event_id)';

  IF con_name IS NULL THEN
    ALTER TABLE ticket_registrations ADD UNIQUE (email, name, event_id);
  END IF;
END $$;
