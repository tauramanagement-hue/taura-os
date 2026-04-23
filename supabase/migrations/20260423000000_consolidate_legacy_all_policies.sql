-- Consolidate legacy "ALL" policies into per-command policies.
--
-- Context: prior migrations added SELECT policies with `deleted_at IS NULL`
-- for soft-delete, but several tables still carried permissive ALL policies
-- WITHOUT the filter. Since Postgres evaluates permissive policies with OR,
-- the ALL policies let soft-deleted rows leak through SELECT. This migration
-- drops the overlapping ALL policies and installs explicit INSERT/UPDATE/
-- DELETE policies that match the previous semantics (agency-scoped writes).
-- SELECT remains governed by the existing deleted_at-aware policies added
-- in 20260422100000_gdpr_softdelete_and_buckets.

-- ─────────────────────────────────────────────────────────────────
-- athletes
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Agency members can manage athletes" ON public.athletes;
-- Per-command policies (INSERT/SELECT/UPDATE/DELETE) already exist.

-- ─────────────────────────────────────────────────────────────────
-- contracts
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Agency members can manage contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can manage agency contracts"   ON public.contracts;

DROP POLICY IF EXISTS "Users can insert agency contracts" ON public.contracts;
CREATE POLICY "Users can insert agency contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update agency contracts" ON public.contracts;
CREATE POLICY "Users can update agency contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete agency contracts" ON public.contracts;
CREATE POLICY "Users can delete agency contracts" ON public.contracts
  FOR DELETE TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- deals
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Agency members can manage deals" ON public.deals;
DROP POLICY IF EXISTS "Users can manage agency deals"   ON public.deals;

DROP POLICY IF EXISTS "Users can insert agency deals" ON public.deals;
CREATE POLICY "Users can insert agency deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update agency deals" ON public.deals;
CREATE POLICY "Users can update agency deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete agency deals" ON public.deals;
CREATE POLICY "Users can delete agency deals" ON public.deals
  FOR DELETE TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- campaign_deliverables
-- scoped via campaign_id → campaigns.agency_id
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Agency members can manage deliverables" ON public.campaign_deliverables;
DROP POLICY IF EXISTS "Users can manage campaign deliverables" ON public.campaign_deliverables;

DROP POLICY IF EXISTS "Users can insert campaign deliverables" ON public.campaign_deliverables;
CREATE POLICY "Users can insert campaign deliverables" ON public.campaign_deliverables
  FOR INSERT TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT c.id FROM public.campaigns c
      WHERE c.agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update campaign deliverables" ON public.campaign_deliverables;
CREATE POLICY "Users can update campaign deliverables" ON public.campaign_deliverables
  FOR UPDATE TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id FROM public.campaigns c
      WHERE c.agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT c.id FROM public.campaigns c
      WHERE c.agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete campaign deliverables" ON public.campaign_deliverables;
CREATE POLICY "Users can delete campaign deliverables" ON public.campaign_deliverables
  FOR DELETE TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id FROM public.campaigns c
      WHERE c.agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- notifications
-- INSERT/SELECT/UPDATE per-cmd already in place; only DELETE missing.
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Agency members can manage notifications" ON public.notifications;

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────
-- profiles
-- Duplicate SELECT "Users can read own profile" bypasses deleted_at filter;
-- drop it so only the deleted_at-aware SELECT remains.
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
