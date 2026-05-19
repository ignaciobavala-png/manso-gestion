-- ============================================================
-- AUDITORÍA: Detectar qué columnas/tablas/RPCs faltan
-- ============================================================
-- Correr esto en SQL Editor de Supabase.
-- Los resultados con 'existe: false' son lo que hay que crear.
-- ============================================================

WITH audit AS (
  SELECT 'products.sort_order' AS item,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sort_order') AS existe
  UNION ALL
  SELECT 'products.visible_en_carta',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='visible_en_carta')
  UNION ALL
  SELECT 'products.container_product_id',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='container_product_id')
  UNION ALL
  SELECT 'products.units_per_container',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='units_per_container')
  UNION ALL
  SELECT 'guests.event_id',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guests' AND column_name='event_id')
  UNION ALL
  SELECT 'events.flyer_url',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='flyer_url')
  UNION ALL
  SELECT 'events.is_paid',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='is_paid')
  UNION ALL
  SELECT 'events.ticket_alias_pago',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='ticket_alias_pago')
  UNION ALL
  SELECT 'events.ticket_cbu_pago',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='ticket_cbu_pago')
  UNION ALL
  SELECT 'ticket_registrations (tabla entera)',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='ticket_registrations' AND table_schema='public')
  UNION ALL
  SELECT 'drink_orders (tabla entera)',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='drink_orders' AND table_schema='public')
  UNION ALL
  SELECT 'rpc: add_sale_batch',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_sale_batch')
  UNION ALL
  SELECT 'rpc: get_current_balance',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_current_balance')
  UNION ALL
  SELECT 'rpc: get_sales_by_payment_method',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_sales_by_payment_method')
  UNION ALL
  SELECT 'bucket: event-flyers',
         EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'event-flyers')
  UNION ALL
  SELECT 'bucket: comprobantes',
         EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'comprobantes')
  UNION ALL
  SELECT 'FK: products.container_product_id -> products.id',
         EXISTS (
           SELECT 1 FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           WHERE t.relname = 'products'
             AND c.confrelid = (SELECT oid FROM pg_class WHERE relname = 'products')
             AND c.conname ~~ '%container%'
         )
  UNION ALL
  SELECT 'col: ticket_registrations.token',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_registrations' AND column_name='token')
  UNION ALL
  SELECT 'col: ticket_registrations.payment_verified',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_registrations' AND column_name='payment_verified')
  UNION ALL
  SELECT 'col: ticket_registrations.used_at',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_registrations' AND column_name='used_at')
  UNION ALL
  SELECT 'col: ticket_registrations.receipt_url',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_registrations' AND column_name='receipt_url')
)
SELECT
  CASE WHEN existe THEN '✅' ELSE '❌' END AS ok,
  item
FROM audit
ORDER BY item;
