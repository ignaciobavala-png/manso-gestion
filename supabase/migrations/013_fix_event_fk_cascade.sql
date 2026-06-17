-- Fix ticket_registrations FK: was NO ACTION in production, should be CASCADE
ALTER TABLE ticket_registrations
  DROP CONSTRAINT IF EXISTS ticket_registrations_event_id_fkey;

ALTER TABLE ticket_registrations
  ADD CONSTRAINT ticket_registrations_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Fix drink_orders FK: was NO ACTION, should be CASCADE
ALTER TABLE drink_orders
  DROP CONSTRAINT IF EXISTS drink_orders_event_id_fkey;

ALTER TABLE drink_orders
  ADD CONSTRAINT drink_orders_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
