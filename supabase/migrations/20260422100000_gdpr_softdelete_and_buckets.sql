-- GDPR hardening part 2
-- 1. Re-create SELECT policies to exclude soft-deleted rows (deleted_at IS NOT NULL)
-- 2. Create storage buckets required by export-user-data and MinorConsentUpload
-- 3. Storage policies for those buckets
-- 4. Seed ai_processing + cookies_necessary in privacy_versions (if missing)

-- ─────────────────────────────────────────────────────────────────
-- 1. Soft-delete filter on SELECT policies
-- ─────────────────────────────────────────────────────────────────
-- athletes
DROP POLICY IF EXISTS "Users can view agency athletes" ON public.athletes;
CREATE POLICY "Users can view agency athletes" ON public.athletes FOR SELECT USING (
  deleted_at IS NULL
  AND agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- contracts
DROP POLICY IF EXISTS "Users can view agency contracts" ON public.contracts;
CREATE POLICY "Users can view agency contracts" ON public.contracts FOR SELECT USING (
  deleted_at IS NULL
  AND agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- deals
DROP POLICY IF EXISTS "Users can view agency deals" ON public.deals;
CREATE POLICY "Users can view agency deals" ON public.deals FOR SELECT USING (
  deleted_at IS NULL
  AND agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- chat_messages (thread-scoped)
DROP POLICY IF EXISTS "Users can view thread messages" ON public.chat_messages;
CREATE POLICY "Users can view thread messages" ON public.chat_messages FOR SELECT USING (
  deleted_at IS NULL
  AND thread_id IN (SELECT id FROM public.chat_threads WHERE user_id = auth.uid())
);

-- notifications (user OR agency)
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (
  deleted_at IS NULL
  AND (user_id = auth.uid() OR agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()))
);

-- campaign_deliverables (via campaign → agency)
DROP POLICY IF EXISTS "Users can view campaign deliverables" ON public.campaign_deliverables;
CREATE POLICY "Users can view campaign deliverables" ON public.campaign_deliverables FOR SELECT USING (
  deleted_at IS NULL
  AND campaign_id IN (
    SELECT id FROM public.campaigns
    WHERE agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- profiles (hide soft-deleted — keep original scope: self only)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (
  deleted_at IS NULL
  AND auth.uid() = id
);

-- ─────────────────────────────────────────────────────────────────
-- 2. Storage buckets
-- ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('exports', 'exports', false),
  ('parental-consents', 'parental-consents', false)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 3. Storage policies
-- ─────────────────────────────────────────────────────────────────
-- exports/: only the owner user can read their own folder (<user_id>/...)
-- Writes handled by service_role (edge function bypasses RLS)
DROP POLICY IF EXISTS "Users can read own export" ON storage.objects;
CREATE POLICY "Users can read own export" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exports'
    AND (auth.uid()::text = (storage.foldername(name))[1])
  );

-- parental-consents/: only members of the agency can read (<agency_id>/<athlete_id>/...)
DROP POLICY IF EXISTS "Agency can read parental consents" ON storage.objects;
CREATE POLICY "Agency can read parental consents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'parental-consents'
    AND (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- parental-consents/: agency members can upload/update in their agency folder
DROP POLICY IF EXISTS "Agency can upload parental consents" ON storage.objects;
CREATE POLICY "Agency can upload parental consents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'parental-consents'
    AND (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 4. Note on privacy_versions:
-- Initial doc_types seeded by 20260421130000 are privacy_policy, terms,
-- cookies, ai_disclosure. Consent types in user_consents map to these
-- documents (e.g. ai_processing consent maps to ai_disclosure version).
-- No additional seed needed here.
-- ─────────────────────────────────────────────────────────────────
