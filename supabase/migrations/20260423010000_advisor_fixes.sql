-- Fixes from Supabase security advisor (2026-04-23).
--
-- 1. contract_embeddings "Service role can manage embeddings" policy had
--    roles={public}, USING=true, WITH CHECK=true → any authenticated user
--    can read/write any tenant's embeddings. Restrict to service_role only.
-- 2. Four public.* functions were missing `SET search_path = public`.
--    Pin them to prevent search_path hijack attacks.
-- 3. rate_limits has RLS enabled with no policies (intentional — only
--    service_role accesses). Document via COMMENT to silence the INFO lint.

-- ─── 1. contract_embeddings — restrict ALL policy to service_role
DROP POLICY IF EXISTS "Service role can manage embeddings" ON public.contract_embeddings;
CREATE POLICY "Service role can manage embeddings" ON public.contract_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 2. Pin search_path on functions flagged by advisor
ALTER FUNCTION public.hash_text(TEXT)                   SET search_path = public;
ALTER FUNCTION public.athletes_set_is_minor()           SET search_path = public;
ALTER FUNCTION public.has_active_consent(UUID, TEXT)    SET search_path = public;

-- search_contracts may have multiple overloads; pin by signature if present
DO $$
DECLARE
  v_sig TEXT;
BEGIN
  FOR v_sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'search_contracts'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_sig);
  END LOOP;
END $$;

-- ─── 3. Document rate_limits intentional lack of policies
COMMENT ON TABLE public.rate_limits IS
  'Rate-limit counters. RLS enabled with zero user policies by design — only service_role reads/writes via rl_incr_check RPC.';
