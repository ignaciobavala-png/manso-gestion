-- ============================================================
-- Manso Gestion — Eliminar constraint UNIQUE(email, name, event_id)
-- La compra de una entrada debe ser independiente del historial
-- de registros del email. Se conserva UNIQUE(token) para garantizar
-- que cada QR sea irrepetible.
-- ============================================================

ALTER TABLE ticket_registrations DROP CONSTRAINT IF EXISTS ticket_registrations_email_name_event_id_key;
