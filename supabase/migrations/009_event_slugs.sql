-- Slugs amigables para los eventos
-- Permite URLs del tipo /registro/la-nube-este-sabado en vez de /registro?event=<uuid>

ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
