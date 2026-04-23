-- =====================================================================
-- GDPR Art. 8 enforcement (minors) + Art. 30 audit coverage
-- =====================================================================
-- 1. Auto-computes athletes.is_minor from date_of_birth (server-side, can't be spoofed by client)
-- 2. Blocks operational data entry (contracts/deals/campaign_deliverables) for minors
--    until parental_consent_verified_at IS NOT NULL
-- 3. Extends audit_log coverage to all CRM mutations via triggers
-- =====================================================================


-- 1. is_minor auto-computation (Art. 8) -----------------------------------
CREATE OR REPLACE FUNCTION public.athletes_set_is_minor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.date_of_birth IS NULL THEN
    NEW.is_minor := FALSE;
  ELSE
    NEW.is_minor := (EXTRACT(YEAR FROM age(NEW.date_of_birth::DATE)) < 18);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_athletes_set_is_minor ON public.athletes;
CREATE TRIGGER trg_athletes_set_is_minor
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.athletes
  FOR EACH ROW
  EXECUTE FUNCTION public.athletes_set_is_minor();

COMMENT ON FUNCTION public.athletes_set_is_minor() IS 'GDPR Art.8 — is_minor calcolato server-side, non accetta override client';


-- 2. Parental-consent enforcement (Art. 8) --------------------------------
-- Funzione helper: blocca operazioni su minorenni senza consenso genitoriale verificato
CREATE OR REPLACE FUNCTION public.athlete_can_operate(p_athlete_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT
       NOT is_minor
       OR parental_consent_verified_at IS NOT NULL
     FROM public.athletes
     WHERE id = p_athlete_id),
    FALSE
  );
$$;

COMMENT ON FUNCTION public.athlete_can_operate(UUID) IS 'GDPR Art.8 — TRUE se maggiorenne OR minorenne con consenso genitoriale verificato';

-- RLS policy: contratti — vietato INSERT/UPDATE su minorenni senza consenso
-- SELECT/DELETE non bloccati per permettere listing e cleanup record legacy.
DROP POLICY IF EXISTS "contracts_block_minor_insert" ON public.contracts;
CREATE POLICY "contracts_block_minor_insert"
  ON public.contracts AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.athlete_can_operate(athlete_id));

DROP POLICY IF EXISTS "contracts_block_minor_update" ON public.contracts;
CREATE POLICY "contracts_block_minor_update"
  ON public.contracts AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.athlete_can_operate(athlete_id))
  WITH CHECK (public.athlete_can_operate(athlete_id));

-- RLS policy: deals
DROP POLICY IF EXISTS "deals_block_minor_insert" ON public.deals;
CREATE POLICY "deals_block_minor_insert"
  ON public.deals AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.athlete_can_operate(athlete_id));

DROP POLICY IF EXISTS "deals_block_minor_update" ON public.deals;
CREATE POLICY "deals_block_minor_update"
  ON public.deals AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.athlete_can_operate(athlete_id))
  WITH CHECK (public.athlete_can_operate(athlete_id));

-- RLS policy: campaign_deliverables (athlete_id nullable — permetti NULL)
DROP POLICY IF EXISTS "deliverables_block_minor_insert" ON public.campaign_deliverables;
CREATE POLICY "deliverables_block_minor_insert"
  ON public.campaign_deliverables AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (athlete_id IS NULL OR public.athlete_can_operate(athlete_id));

DROP POLICY IF EXISTS "deliverables_block_minor_update" ON public.campaign_deliverables;
CREATE POLICY "deliverables_block_minor_update"
  ON public.campaign_deliverables AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (athlete_id IS NULL OR public.athlete_can_operate(athlete_id))
  WITH CHECK (athlete_id IS NULL OR public.athlete_can_operate(athlete_id));


-- 3. Audit coverage estesa (Art. 30) --------------------------------------
-- Trigger generico: logga ogni INSERT/UPDATE/DELETE sulle tabelle CRM critiche
CREATE OR REPLACE FUNCTION public.audit_crm_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_agency UUID;
  v_resource_id TEXT;
  v_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := TG_TABLE_NAME || '_create';
    v_resource_id := NEW.id::TEXT;
    v_agency := NEW.agency_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := TG_TABLE_NAME || '_update';
    v_resource_id := NEW.id::TEXT;
    v_agency := NEW.agency_id;
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      v_action := TG_TABLE_NAME || '_soft_delete';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := TG_TABLE_NAME || '_delete';
    v_resource_id := OLD.id::TEXT;
    v_agency := OLD.agency_id;
  END IF;

  -- Skip logging se non c'è un actor (es. job di sistema, pg_cron)
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_log(actor_id, agency_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_actor,
    v_agency,
    v_action,
    TG_TABLE_NAME,
    v_resource_id,
    CASE
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('op', 'update')
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('op', 'delete')
      ELSE jsonb_build_object('op', 'create')
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.audit_crm_mutation() IS 'GDPR Art.30 — registro trattamenti: logga mutazioni CRM con actor, agenzia, risorsa';

-- Attach trigger su tabelle CRM sensibili
DROP TRIGGER IF EXISTS trg_audit_athletes ON public.athletes;
CREATE TRIGGER trg_audit_athletes
  AFTER INSERT OR UPDATE OR DELETE ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.audit_crm_mutation();

DROP TRIGGER IF EXISTS trg_audit_contracts ON public.contracts;
CREATE TRIGGER trg_audit_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_crm_mutation();

DROP TRIGGER IF EXISTS trg_audit_deals ON public.deals;
CREATE TRIGGER trg_audit_deals
  AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.audit_crm_mutation();

DROP TRIGGER IF EXISTS trg_audit_campaigns ON public.campaigns;
CREATE TRIGGER trg_audit_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.audit_crm_mutation();

DROP TRIGGER IF EXISTS trg_audit_campaign_deliverables ON public.campaign_deliverables;
CREATE TRIGGER trg_audit_campaign_deliverables
  AFTER INSERT OR UPDATE OR DELETE ON public.campaign_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.audit_crm_mutation();


-- 4. Backfill is_minor per righe esistenti ---------------------------------
UPDATE public.athletes
SET is_minor = (EXTRACT(YEAR FROM age(date_of_birth::DATE)) < 18)
WHERE date_of_birth IS NOT NULL;
