-- Waitlist table for pre-launch early access capture.
-- Captures email, optional plan interest, and optional agency reference.

CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  plan_interest TEXT,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON public.waitlist (created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_plan_interest_idx ON public.waitlist (plan_interest);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update their waitlist entry by email" ON public.waitlist;
CREATE POLICY "Anyone can update their waitlist entry by email"
  ON public.waitlist
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "No public read" ON public.waitlist;
CREATE POLICY "No public read"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (false);
