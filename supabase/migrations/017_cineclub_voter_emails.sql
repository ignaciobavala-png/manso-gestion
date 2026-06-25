CREATE TABLE public.cineclub_voter_emails (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id           uuid NOT NULL REFERENCES public.cineclub_polls(id) ON DELETE CASCADE,
  voter_fingerprint text NOT NULL,
  email             text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_fingerprint)
);

ALTER TABLE public.cineclub_voter_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voter_emails_insert_anon" ON public.cineclub_voter_emails FOR INSERT WITH CHECK (true);
CREATE POLICY "voter_emails_select_auth" ON public.cineclub_voter_emails FOR SELECT USING (auth.role() = 'authenticated');
