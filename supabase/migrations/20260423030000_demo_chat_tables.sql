-- Landing interactive demo — rate limit + audit tables.
-- Used by edge function `demo-chat`. Accessed ONLY via service_role.
-- No RLS policies = anon/authenticated cannot read/write (service_role bypasses RLS).

-- Per-visitor rolling quota (IP+fingerprint hash → count within 24h window).
CREATE TABLE IF NOT EXISTS public.demo_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_hash TEXT NOT NULL UNIQUE,
  fingerprint TEXT,
  prompt_count INT NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_demo_usage_reset_at ON public.demo_usage(reset_at);

-- Per-request log for abuse monitoring + global daily budget cap.
CREATE TABLE IF NOT EXISTS public.demo_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_hash TEXT NOT NULL,
  prompt_preview TEXT,
  response_preview TEXT,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_log_created_at ON public.demo_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_log_visitor_hash ON public.demo_log(visitor_hash);

-- Lock down: RLS on with zero policies = deny all to anon/authenticated.
-- service_role bypasses RLS entirely, so edge functions work normally.
ALTER TABLE public.demo_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_log ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup: drop entries older than 30 days to limit PII retention.
CREATE OR REPLACE FUNCTION public.prune_demo_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  DELETE FROM public.demo_usage WHERE reset_at < now() - interval '30 days';
  DELETE FROM public.demo_log WHERE created_at < now() - interval '30 days';
END;
$fn$;

COMMENT ON TABLE public.demo_usage IS 'Landing demo chat per-visitor quota. Anon-facing endpoint. Accessed ONLY via service_role in demo-chat edge function.';
COMMENT ON TABLE public.demo_log IS 'Landing demo chat audit log. 30d retention via prune_demo_tables().';
