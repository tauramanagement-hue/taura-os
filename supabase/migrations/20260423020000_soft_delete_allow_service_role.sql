-- Fix regression: delete-account edge function calls soft_delete_user_data via
-- service_role client (adminClient). The bounds check in security_hardening
-- rejected NULL auth.uid() → broke GDPR Art.17 erasure flow.
-- Allow service_role context while keeping strict check for direct user calls.
CREATE OR REPLACE FUNCTION public.soft_delete_user_data(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  target_agency_id UUID;
  caller_role TEXT := current_setting('request.jwt.claim.role', TRUE);
BEGIN
  -- Allow when:
  --   (a) caller is service_role (edge function trusted path), OR
  --   (b) caller is the data subject themselves.
  IF caller_role = 'service_role' THEN
    NULL;
  ELSIF auth.uid() IS NULL OR auth.uid() <> target_user_id THEN
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

  UPDATE public.chat_messages
    SET deleted_at = now()
    WHERE deleted_at IS NULL
      AND thread_id IN (SELECT id FROM public.chat_threads WHERE user_id = target_user_id);

  INSERT INTO public.audit_log(actor_id, agency_id, action, resource_type, resource_id, metadata)
  VALUES (target_user_id, target_agency_id, 'data_delete', 'user_account', target_user_id::TEXT,
          jsonb_build_object('soft_delete', true, 'hard_delete_after', (now() + INTERVAL '30 days')::TEXT));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_user_data(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.soft_delete_user_data(UUID) TO authenticated, service_role;
