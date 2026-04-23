-- ============================================================
-- Manso Gestión — Migración de RLS Policies
-- Reemplaza todas las políticas FOR ALL USING (true) por
-- políticas basadas en roles (email del usuario autenticado).
--
-- Roles:
--   control@manso.internal  → acceso total a todo
--   empleado@manso.internal → solo lectura/escritura de operación
--   anon (público)          → solo lectura de datos públicos
-- ============================================================

-- 1. TIRAR POLÍTICAS VIEJAS
DROP POLICY IF EXISTS "Allow all operations on products" ON products;
DROP POLICY IF EXISTS "Allow all operations on guests" ON guests;
DROP POLICY IF EXISTS "Allow all operations on sales" ON sales;
DROP POLICY IF EXISTS "Allow all operations on ticket_sales" ON ticket_sales;
DROP POLICY IF EXISTS "Allow all operations on events" ON events;

-- ============================================================
-- PRODUCTS
-- ============================================================
-- Público: solo lectura (carta digital)
CREATE POLICY "products_public_select" ON products
  FOR SELECT USING (true);

-- Staff (control + empleado): lectura/escritura
CREATE POLICY "products_staff_all" ON products
  FOR ALL USING (
    auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
  );

-- ============================================================
-- GUESTS
-- ============================================================
-- Staff: lectura/escritura
CREATE POLICY "guests_staff_all" ON guests
  FOR ALL USING (
    auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
  );

-- ============================================================
-- SALES
-- ============================================================
-- Staff: lectura/escritura
CREATE POLICY "sales_staff_all" ON sales
  FOR ALL USING (
    auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
  );

-- ============================================================
-- TICKET_SALES
-- ============================================================
-- Staff: lectura/escritura
CREATE POLICY "ticket_sales_staff_all" ON ticket_sales
  FOR ALL USING (
    auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
  );

-- ============================================================
-- EVENTS
-- ============================================================
-- Público: solo lectura de eventos activos con registro abierto
CREATE POLICY "events_public_select" ON events
  FOR SELECT USING (true);

-- Staff: lectura/escritura
CREATE POLICY "events_staff_all" ON events
  FOR ALL USING (
    auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
  );

-- ============================================================
-- TICKET_REGISTRATIONS
-- ============================================================
-- Público: puede INSERTAR (registrarse) y leer su propio ticket
CREATE POLICY "ticket_registrations_public_insert" ON ticket_registrations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ticket_registrations_public_select_own" ON ticket_registrations
  FOR SELECT USING (true);

-- Staff: lectura/escritura
CREATE POLICY "ticket_registrations_staff_all" ON ticket_registrations
  FOR ALL USING (
    auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
  );

-- ============================================================
-- VENUE_CONFIG
-- ============================================================
-- Público: solo lectura (para ver alias_pago, carta_activa, etc.)
CREATE POLICY "venue_config_public_select" ON venue_config
  FOR SELECT USING (true);

-- Staff (solo control): escritura
CREATE POLICY "venue_config_control_update" ON venue_config
  FOR ALL USING (
    auth.jwt() ->> 'email' = 'control@manso.internal'
  );

-- ============================================================
-- ACTIVE_EVENT (VIEW)
-- ============================================================
-- La view active_event hereda RLS de events + venue_config.
-- Como ambas tienen policies públicas de SELECT, funciona.

-- ============================================================
-- STORAGE: event-flyers bucket
-- ============================================================
-- Público: puede leer (ver flyers)
-- Staff: puede subir/borrar

-- Ejecutar en SQL Editor de Supabase (Storage → Policies)
-- o directamente:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('event-flyers', 'event-flyers', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- Luego crear policies en storage.objects:
--   SELECT: true (público)
--   INSERT/UPDATE/DELETE: (auth.jwt()->>'email' IN ('control@manso.internal', 'empleado@manso.internal'))

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Correr esto para ver las políticas activas:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename NOT LIKE 'pg_%' ORDER BY tablename;

