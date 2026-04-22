-- =====================================================================
-- GDPR Compliance — Taura OS
-- Art. 13/15/17/20/30 GDPR · Linee Guida Garante Privacy (10/6/2021)
-- =====================================================================

-- 1. CONSENSI GRANULARI VERSIONATI ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  version TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata JSONB,
  CONSTRAINT uq_user_consent_version UNIQUE(user_id, consent_type, version)
);

CREATE INDEX IF NOT EXISTS idx_consents_user ON public.user_consents(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consents_type ON public.user_consents(consent_type, granted) WHERE revoked_at IS NULL;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_consents_select_own" ON public.user_consents;
CREATE POLICY "user_consents_select_own"
  ON public.user_consents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_consents_insert_own" ON public.user_consents;
CREATE POLICY "user_consents_insert_own"
  ON public.user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_consents_update_own" ON public.user_consents;
CREATE POLICY "user_consents_update_own"
  ON public.user_consents FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_consents IS 'GDPR Art.7 — consensi granulari versionati, IP e UA conservati in hash SHA-256';


-- 2. AUDIT LOG (Art. 30 ROPA + log accessi) -------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agency_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_hash TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_own" ON public.audit_log;
CREATE POLICY "audit_log_select_own"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = actor_id);

COMMENT ON TABLE public.audit_log IS 'Log attività utente/sistema per accountability GDPR Art.30';


-- 3. DSR (Data Subject Requests) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.dsr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  export_url TEXT,
  export_expires_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_dsr_user ON public.dsr_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsr_status ON public.dsr_requests(status) WHERE status IN ('pending', 'in_progress');

ALTER TABLE public.dsr_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dsr_requests_select_own" ON public.dsr_requests;
CREATE POLICY "dsr_requests_select_own"
  ON public.dsr_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "dsr_requests_insert_own" ON public.dsr_requests;
CREATE POLICY "dsr_requests_insert_own"
  ON public.dsr_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.dsr_requests IS 'Richieste interessato GDPR Art.15/16/17/18/20/21';


-- 4. SOFT-DELETE SU TABELLE CON PII ---------------------------------------
ALTER TABLE public.athletes                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.contracts               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.deals                   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.campaign_deliverables   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.notifications           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.profiles                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.agencies                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.waitlist                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_athletes_deleted ON public.athletes(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_deleted ON public.contracts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_deleted ON public.deals(deleted_at) WHERE deleted_at IS NOT NULL;


-- 5. FLAG MINORI + CONSENSO GENITORIALE ------------------------------------
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parental_consent_url TEXT,
  ADD COLUMN IF NOT EXISTS parental_consent_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parental_consent_verified_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.athletes.is_minor IS 'GDPR Art.8 — richiede consenso genitoriale se TRUE';


-- 6. HELPER HASH SHA-256 --------------------------------------------------
CREATE OR REPLACE FUNCTION public.hash_text(val TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(digest(val, 'sha256'), 'hex');
$$;

COMMENT ON FUNCTION public.hash_text(TEXT) IS 'SHA-256 hash utility — usata per IP/UA hashing lato audit';


-- 7. PRIVACY VERSION CONFIG (consent version gating) ----------------------
CREATE TABLE IF NOT EXISTS public.privacy_versions (
  id SERIAL PRIMARY KEY,
  doc_type TEXT NOT NULL,
  version TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_url TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  CONSTRAINT uq_privacy_version UNIQUE(doc_type, version)
);

-- Seed versione iniziale
INSERT INTO public.privacy_versions (doc_type, version, is_current) VALUES
  ('privacy_policy', '2026-04-21', TRUE),
  ('terms', '2026-04-21', TRUE),
  ('cookies', '2026-04-21', TRUE),
  ('ai_disclosure', '2026-04-21', TRUE)
ON CONFLICT (doc_type, version) DO NOTHING;

ALTER TABLE public.privacy_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "privacy_versions_read_all" ON public.privacy_versions;
CREATE POLICY "privacy_versions_read_all"
  ON public.privacy_versions FOR SELECT
  USING (TRUE);


-- 8. pg_cron RETENTION JOBS ----------------------------------------------
-- Richiede estensione pg_cron. Su Supabase è disponibile: activate prima.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hard-delete dopo 30gg da soft-delete
SELECT cron.schedule(
  'gdpr-hard-delete-daily',
  '0 3 * * *',
  $$
    DELETE FROM public.athletes              WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days';
    DELETE FROM public.contracts             WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days';
    DELETE FROM public.deals                 WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days';
    DELETE FROM public.chat_messages         WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days';
    DELETE FROM public.campaign_deliverables WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days';
    DELETE FROM public.notifications         WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days';
  $$
) ON CONFLICT DO NOTHING;

-- Retention audit_log 24 mesi
SELECT cron.schedule(
  'gdpr-audit-retention-weekly',
  '0 4 * * 0',
  $$
    DELETE FROM public.audit_log WHERE created_at < now() - INTERVAL '24 months';
  $$
) ON CONFLICT DO NOTHING;

-- Retention waitlist 12 mesi
SELECT cron.schedule(
  'gdpr-waitlist-retention-weekly',
  '0 5 * * 0',
  $$
    DELETE FROM public.waitlist WHERE created_at < now() - INTERVAL '12 months';
  $$
) ON CONFLICT DO NOTHING;

-- Retention chat_messages 12 mesi (hard-delete anche senza soft-delete)
SELECT cron.schedule(
  'gdpr-chat-retention-weekly',
  '0 6 * * 0',
  $$
    DELETE FROM public.chat_messages WHERE created_at < now() - INTERVAL '12 months';
  $$
) ON CONFLICT DO NOTHING;

-- Retention export signed URL scaduti (pulizia dsr_requests.export_url obsoleti)
SELECT cron.schedule(
  'gdpr-export-url-cleanup-daily',
  '0 2 * * *',
  $$
    UPDATE public.dsr_requests
    SET export_url = NULL
    WHERE export_expires_at IS NOT NULL AND export_expires_at < now() AND export_url IS NOT NULL;
  $$
) ON CONFLICT DO NOTHING;


-- 9. AGGIORNAMENTO RLS: esclude righe soft-deleted ------------------------
-- Nota: le policy esistenti vanno aggiornate manualmente per ogni tabella
-- (qui riportiamo il pattern da applicare — le policy attuali non vengono rimosse
-- automaticamente per evitare di rompere accessi esistenti; servirà audit puntuale).

-- Esempio pattern da replicare in ogni policy SELECT:
--   USING ((agency_id = <agency_id_corrente>) AND (deleted_at IS NULL))
-- Verranno aggiornate in una migration successiva dopo audit delle policy attuali.


-- 10. HELPER: SOFT DELETE USER ACCOUNT ------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_user_data(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_agency_id UUID;
BEGIN
  SELECT agency_id INTO target_agency_id FROM public.profiles WHERE id = target_user_id;

  UPDATE public.profiles              SET deleted_at = now() WHERE id = target_user_id AND deleted_at IS NULL;
  UPDATE public.athletes              SET deleted_at = now() WHERE agency_id = target_agency_id AND deleted_at IS NULL;
  UPDATE public.contracts             SET deleted_at = now() WHERE agency_id = target_agency_id AND deleted_at IS NULL;
  UPDATE public.deals                 SET deleted_at = now() WHERE agency_id = target_agency_id AND deleted_at IS NULL;
  UPDATE public.chat_messages         SET deleted_at = now() WHERE user_id = target_user_id AND deleted_at IS NULL;
  UPDATE public.campaign_deliverables SET deleted_at = now() WHERE agency_id = target_agency_id AND deleted_at IS NULL;
  UPDATE public.notifications         SET deleted_at = now() WHERE user_id = target_user_id AND deleted_at IS NULL;

  INSERT INTO public.audit_log(actor_id, agency_id, action, resource_type, resource_id, metadata)
  VALUES (target_user_id, target_agency_id, 'data_delete', 'user_account', target_user_id::TEXT,
          jsonb_build_object('soft_delete', true, 'hard_delete_after', (now() + INTERVAL '30 days')::TEXT));
END;
$$;

COMMENT ON FUNCTION public.soft_delete_user_data(UUID) IS 'Art.17 GDPR — soft-delete cascade sui dati utente + logging';


-- 11. HELPER: CHECK CONSENSO ATTIVO ---------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_consent(p_user_id UUID, p_consent_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_consents
    WHERE user_id = p_user_id
      AND consent_type = p_consent_type
      AND granted = TRUE
      AND revoked_at IS NULL
      AND version = (
        SELECT version FROM public.privacy_versions
        WHERE doc_type = p_consent_type AND is_current = TRUE
        LIMIT 1
      )
  );
$$;
