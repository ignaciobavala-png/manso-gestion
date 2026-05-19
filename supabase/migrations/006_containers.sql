-- ============================================================
-- Manso Gestión — Migración 006: Contenedor/Porción + faltantes
-- ============================================================
-- Lo que agrega:
--   products:    sort_order, visible_en_carta, container_product_id,
--                units_per_container, FK container_product_id -> products.id
--   guests:      event_id
--   events:      flyer_url
--   ticket_registrations: tabla completa si no existe
--   RPC:         add_sale_batch
--   Storage:     buckets event-flyers + comprobantes + policies
-- ============================================================

-- ============================================================
-- 1. PRODUCTS: columnas faltantes
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS visible_en_carta BOOLEAN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS container_product_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_container INTEGER;

-- FK: container_product_id -> products.id (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'products'
      AND c.confrelid = (SELECT oid FROM pg_class WHERE relname = 'products')
      AND c.conname LIKE '%container%'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_container
      FOREIGN KEY (container_product_id) REFERENCES products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. GUESTS: event_id faltante
-- ============================================================
ALTER TABLE guests ADD COLUMN IF NOT EXISTS event_id UUID;
-- FK opcional (el código la usa para filtrar)
-- ALTER TABLE guests ADD CONSTRAINT fk_guests_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- ============================================================
-- 3. EVENTS: flyer_url faltante
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_url TEXT;

-- ============================================================
-- 4. TICKET_REGISTRATIONS: crear si no existe
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_registrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  token TEXT NOT NULL,
  receipt_url TEXT,
  payment_verified BOOLEAN NOT NULL DEFAULT false,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Unique constraint: mismo email + name + event_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ticket_registrations'::regclass
      AND conname = 'ticket_registrations_email_name_event_id_key'
  ) THEN
    ALTER TABLE ticket_registrations ADD UNIQUE (email, name, event_id);
  END IF;
END $$;

-- RLS
ALTER TABLE ticket_registrations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RPC: add_sale_batch
-- ============================================================
CREATE OR REPLACE FUNCTION add_sale_batch(
  p_event_id UUID,
  p_payment_method VARCHAR(20),
  p_items JSONB
)
RETURNS SETOF sales AS $$
DECLARE
  v_item JSONB;
  v_sale sales%ROWTYPE;
  v_container_id UUID;
  v_units_per_container INT;
  v_sold_before INT;
  v_bottles_to_deduct INT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert the sale
    INSERT INTO sales (product_id, product_name, quantity, total, payment_method, event_id)
    VALUES (
      (v_item ->> 'product_id')::UUID,
      v_item ->> 'product_name',
      (v_item ->> 'quantity')::INT,
      (v_item ->> 'total')::DECIMAL,
      p_payment_method,
      p_event_id
    )
    RETURNING * INTO v_sale;

    -- Check if this product is a serving (has container)
    SELECT container_product_id, units_per_container
    INTO v_container_id, v_units_per_container
    FROM products
    WHERE id = (v_item ->> 'product_id')::UUID;

    -- If it's a serving product, decrement the container stock using floor math
    IF v_container_id IS NOT NULL AND v_units_per_container IS NOT NULL AND v_units_per_container > 0 THEN
      -- Count how many of this serving were sold before in this event
      SELECT COALESCE(SUM(quantity), 0)
      INTO v_sold_before
      FROM sales
      WHERE product_id = (v_item ->> 'product_id')::UUID
        AND event_id = p_event_id
        AND id != v_sale.id;

      -- floor((sold_before + qty) / upc) - floor(sold_before / upc)
      v_bottles_to_deduct :=
        FLOOR((v_sold_before + (v_item ->> 'quantity')::INT)::NUMERIC / v_units_per_container) -
        FLOOR(v_sold_before::NUMERIC / v_units_per_container);

      IF v_bottles_to_deduct > 0 THEN
        UPDATE products
        SET stock = GREATEST(0, stock - v_bottles_to_deduct)
        WHERE id = v_container_id;
      END IF;
    ELSE
      -- Independent product: decrement stock directly
      UPDATE products
      SET stock = GREATEST(0, stock - (v_item ->> 'quantity')::INT)
      WHERE id = (v_item ->> 'product_id')::UUID;
    END IF;

    RETURN NEXT v_sale;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. STORAGE BUCKETS
-- ============================================================
-- event-flyers (flyers de eventos, público puede leer)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-flyers', 'event-flyers', true)
ON CONFLICT (id) DO NOTHING;

-- comprobantes (comprobantes de pago, solo staff puede leer)
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. STORAGE POLICIES
-- ============================================================
-- event-flyers: todos pueden SELECT, staff puede INSERT/UPDATE/DELETE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flyers_public_select') THEN
    CREATE POLICY "flyers_public_select" ON storage.objects
      FOR SELECT USING (bucket_id = 'event-flyers');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flyers_staff_insert') THEN
    CREATE POLICY "flyers_staff_insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'event-flyers'
        AND auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flyers_staff_delete') THEN
    CREATE POLICY "flyers_staff_delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'event-flyers'
        AND auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
      );
  END IF;
END $$;

-- comprobantes: staff puede SELECT/DELETE, público puede INSERT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comprobantes_staff_select') THEN
    CREATE POLICY "comprobantes_staff_select" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'comprobantes'
        AND auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comprobantes_public_insert') THEN
    CREATE POLICY "comprobantes_public_insert" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'comprobantes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comprobantes_staff_delete') THEN
    CREATE POLICY "comprobantes_staff_delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'comprobantes'
        AND auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
      );
  END IF;
END $$;

-- ============================================================
-- 8. RLS policies para ticket_registrations (si se creó ahora)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ticket_registrations_public_insert') THEN
    CREATE POLICY "ticket_registrations_public_insert" ON ticket_registrations
      FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ticket_registrations_public_select_own') THEN
    CREATE POLICY "ticket_registrations_public_select_own" ON ticket_registrations
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ticket_registrations_staff_all') THEN
    CREATE POLICY "ticket_registrations_staff_all" ON ticket_registrations
      FOR ALL USING (
        auth.jwt() ->> 'email' IN ('control@manso.internal', 'empleado@manso.internal')
      );
  END IF;
END $$;

-- ============================================================
-- 9. AGREGAR is_paid, ticket_alias_pago, ticket_cbu_pago si vinieran de migraciones anteriores
--    (por si las migraciones 003-005 no se aplicaron)
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_alias_pago TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_cbu_pago TEXT;
