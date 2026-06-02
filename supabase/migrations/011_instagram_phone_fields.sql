-- Add optional fields to events to enable per-event instagram/phone collection
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS require_instagram BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_phone BOOLEAN NOT NULL DEFAULT false;

-- Add instagram and phone columns to ticket registrations
ALTER TABLE ticket_registrations
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;
