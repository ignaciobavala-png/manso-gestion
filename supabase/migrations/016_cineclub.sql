-- ── CINECLUB: tablas de votación ─────────────────────────────────────────────

CREATE TABLE public.cineclub_polls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status     text NOT NULL DEFAULT 'voting'
               CHECK (status IN ('voting', 'closed')),
  closes_at  timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cineclub_movies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES public.cineclub_polls(id) ON DELETE CASCADE,
  title       text NOT NULL,
  synopsis    text NOT NULL DEFAULT '',
  flyer_url   text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cineclub_votes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id             uuid NOT NULL REFERENCES public.cineclub_polls(id) ON DELETE CASCADE,
  movie_id            uuid NOT NULL REFERENCES public.cineclub_movies(id) ON DELETE CASCADE,
  voter_fingerprint   text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_fingerprint)
);

CREATE INDEX idx_cineclub_votes_movie_id ON public.cineclub_votes(movie_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.cineclub_polls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cineclub_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cineclub_votes  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "polls_select_public"  ON public.cineclub_polls FOR SELECT USING (true);
CREATE POLICY "polls_insert_auth"    ON public.cineclub_polls FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "polls_update_auth"    ON public.cineclub_polls FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "polls_delete_auth"    ON public.cineclub_polls FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "movies_select_public" ON public.cineclub_movies FOR SELECT USING (true);
CREATE POLICY "movies_insert_auth"   ON public.cineclub_movies FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "movies_update_auth"   ON public.cineclub_movies FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "movies_delete_auth"   ON public.cineclub_movies FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "votes_select_public"  ON public.cineclub_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_anon"    ON public.cineclub_votes FOR INSERT WITH CHECK (true);

-- ── Storage bucket (ejecutar como superuser / service role) ───────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('cineclub-flyers', 'cineclub-flyers', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "cineclub_flyers_select" ON storage.objects FOR SELECT USING (bucket_id = 'cineclub-flyers');
-- CREATE POLICY "cineclub_flyers_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cineclub-flyers' AND auth.role() = 'authenticated');
-- CREATE POLICY "cineclub_flyers_update" ON storage.objects FOR UPDATE USING (bucket_id = 'cineclub-flyers' AND auth.role() = 'authenticated');
-- CREATE POLICY "cineclub_flyers_delete" ON storage.objects FOR DELETE USING (bucket_id = 'cineclub-flyers' AND auth.role() = 'authenticated');
-- Nota: el bucket 'cineclub-flyers' ya fue creado vía MCP en el proyecto de producción.
