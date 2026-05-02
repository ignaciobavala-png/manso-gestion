-- Migration: Add per-event payment alias for ticket registrations
-- This allows each event to have its own alias/CBU for ticket payments,
-- separate from the venue-level alias_pago in venue_config (used for bar).

ALTER TABLE events ADD COLUMN ticket_alias_pago TEXT;
ALTER TABLE events ADD COLUMN ticket_cbu_pago TEXT;
