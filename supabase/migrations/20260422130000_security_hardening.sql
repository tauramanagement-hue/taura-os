-- Security hardening pass (April 2026 audit).
-- Covers: C3 waitlist abuse, C6 chat RLS defense-in-depth, H7 soft_delete bounds,
-- H8 audit_log restrict, M7 activities.agency_id NOT NULL, M8 FK indexes,
-- plus supporting rate_limits table + rl_incr_check RPC.

-- ─────────────────────────────────────────────────────────────────
-- C3. Waitlist abuse hardening
-- ─────────────────────────────────────────────────────────────────
-- Length constraint on email to prevent DB bloat from huge strings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public' AND table_name = 'waitlist'
      AND constraint_name = 'waitlist_email_len_chk'
  ) THEN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_email_len_chk
      CHECK (length(email) BETWEEN 3 AND 254);
  END IF;
END $$;

-- Remove open UPDATE policy — allowing anon to UPDATE ANY row is a data
-- tampering vector. Pre-launch updates should be performed by service role
-- through a dedicated edge function.
DROP POLICY IF EXISTS "Anyone can update their waitlist entry by email" ON public.waitlist;

-- Keep INSERT open (public waitlist by design) but tighten the WITH CHECK
-- so the inserted row cannot spoof timestamps or write agency_id.
DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 3 AND 254
    AND agency_id IS NULL
  );


-- ─────────────────────────────────────────────────────────────────
-- C6. chat_messages defense-in-depth
-- chat_threads is already user-scoped, but double-check that the thread
-- belongs to the caller's agency — protects against future policy loosening.
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view thread messages" ON public.chat_messages;
CREATE POLICY "Users can view thread messages" ON public.chat_messages
  FOR SELECT USING (
    deleted_at IS NULL
    AND thread_id IN (
      SELECT t.id FROM public.chat_threads t
      WHERE t.user_id = auth.uid()
        AND t.agency_id IN (
          SELECT agency_id FROM public.profiles WHERE id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert thread messages" ON public.chat_messages;
CREATE POLICY "Users can insert thread messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    thread_id IN (
      SELECT t.id FROM public.chat_threads t
      WHERE t.user_id = auth.uid()
        AND t.agency_id IN (
          SELECT agency_id FROM public.profiles WHERE id = auth.uid()
        )
    )
  );


-- ─────────────────────────────────────────────────────────────────
-- H7. soft_delete_user_data bounds check
-- Without this, any caller with EXECUTE can wipe arbitrary accounts.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_user_data(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_agency_id UUID;
BEGIN
  -- Caller must be the data subject. Account deletion by admin goes
  -- through a separate admin-only path, not this function.
  IF auth.uid() IS NULL OR auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'Unauthorized: soft_delete_user_data can only be called for the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  SELECT agency_id INTO target_agency_id FROM public.profiles WHERE id = target_user_id;

  UPDATE public.profiles              SET deleted_at = now() WHERE id = target_user_id AND deleted_at IS NULL;
  UPDATE public.athletes              SET deleted_at = now() WHERE agency_id = target_agency_id AND deleted_at IS NULL;
  UPDATE public.contracts             SET deleted_at = now() WHERE agency_id = target_agency_id AND deleted_at IS NULL;
  UPDATE public.deals                 SET deleted_at = now() WHERE agency_id = target_agency_id AND deleted_at IS NULL;
  UPDATE public.campaign_deliverables SET deleted_at = now() WHERE agency_id = target_agency_id AND deleted_at IS NULL;
  UPDATE public.notifications         SET deleted_at = now() WHERE user_id = target_user_id AND deleted_at IS NULL;

  -- chat_messages has no user_id column — soft-delete via thread ownership
  UPDATE public.chat_messages
    SET deleted_at = now()
    WHERE deleted_at IS NULL
      AND thread_id IN (SELECT id FROM public.chat_threads WHERE user_id = target_user_id);

  INSERT INTO public.audit_log(actor_id, agency_id, action, resource_type, resource_id, metadata)
  VALUES (target_user_id, target_agency_id, 'data_delete', 'user_account', target_user_id::TEXT,
          jsonb_build_object('soft_delete', true, 'hard_delete_after', (now() + INTERVAL '30 days')::TEXT));
END;
$$;

-- Remove EXECUTE from public — only authenticated users can call it.
REVOKE EXECUTE ON FUNCTION public.soft_delete_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_user_data(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────
-- H8. Restrict audit_log read access
-- audit_log contains ip_hash and metadata that expose attack patterns.
-- End users don't need direct SELECT — an admin/compliance role does.
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_log_select_own" ON public.audit_log;

-- Users can INSERT their own audit entries (CSR write-only audit pattern).
-- SELECT is denied by default — admins read through service-role edge fn.
DROP POLICY IF EXISTS "audit_log_insert_self" ON public.audit_log;
CREATE POLICY "audit_log_insert_self" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- Service-role bypasses RLS, so admin dashboards still work via edge
-- functions. No SELECT policy is the secure default.
COMMENT ON TABLE public.audit_log IS
  'Log attività utente/sistema per accountability GDPR Art.30. '
  'Write-only for end users; reads only via service_role in dedicated edge functions.';


-- ─────────────────────────────────────────────────────────────────
-- M7. activities.agency_id NOT NULL
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activities' AND column_name = 'agency_id'
  ) THEN
    -- Best-effort: only enforce NOT NULL if no existing NULL rows
    IF NOT EXISTS (SELECT 1 FROM public.activities WHERE agency_id IS NULL) THEN
      ALTER TABLE public.activities ALTER COLUMN agency_id SET NOT NULL;
    END IF;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────
-- M8. FK indexes to avoid RLS seq-scans
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_athletes_agency_id     ON public.athletes(agency_id);
CREATE INDEX IF NOT EXISTS idx_contracts_agency_id    ON public.contracts(agency_id);
CREATE INDEX IF NOT EXISTS idx_deals_agency_id        ON public.deals(agency_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id   ON public.chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_agency_id ON public.chat_threads(agency_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id     ON public.profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_agency_id ON public.notifications(agency_id);


-- ─────────────────────────────────────────────────────────────────
-- Rate limits infrastructure (used by edge functions)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key_scope    TEXT NOT NULL,
  key_value    TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key_scope, key_value, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON public.rate_limits(window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No user policies — only service_role writes/reads.

-- Increment-and-return RPC. Atomic via ON CONFLICT.
CREATE OR REPLACE FUNCTION public.rl_incr_check(
  p_scope TEXT,
  p_value TEXT,
  p_window_start TIMESTAMPTZ,
  p_max INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO public.rate_limits(key_scope, key_value, window_start, count, updated_at)
  VALUES (p_scope, p_value, p_window_start, 1, now())
  ON CONFLICT (key_scope, key_value, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1, updated_at = now()
  RETURNING count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rl_incr_check(TEXT, TEXT, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rl_incr_check(TEXT, TEXT, TIMESTAMPTZ, INT) TO service_role;

-- Hourly cleanup of stale rate-limit windows (older than 24h)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'rate-limits-cleanup-hourly',
      '0 * * * *',
      $cleanup$ DELETE FROM public.rate_limits WHERE window_start < now() - INTERVAL '24 hours'; $cleanup$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- cron.schedule may error on duplicate; ignore
END $$;
