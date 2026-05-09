-- ============================================================
-- Manso Gestion — Migracion Payments
-- Agrega is_paid a events, receipt_url a ticket_registrations
-- y el bucket de storage "comprobantes"
-- ============================================================

-- 1. Nueva columna: events.is_paid
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

-- 2. Nueva columna: ticket_registrations.receipt_url
ALTER TABLE ticket_registrations ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 3. Crear bucket storage: comprobantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS policies para storage.objects del bucket comprobantes
-- SELECT: solo staff (control + empleado)
CREATE POLICY "comprobantes_staff_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'comprobantes'
    AND auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
  );

-- INSERT: publico (cualquiera puede subir comprobante)
CREATE POLICY "comprobantes_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'comprobantes');

-- DELETE: solo staff
CREATE POLICY "comprobantes_staff_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'comprobantes'
    AND auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
  );
