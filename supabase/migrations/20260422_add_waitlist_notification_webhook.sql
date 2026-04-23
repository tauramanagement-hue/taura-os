-- Database webhook for waitlist notifications
-- Supabase DB webhooks cannot currently be created through pure SQL migration
-- (they live in the pg_net / supabase_functions.hooks layer which is managed
-- via the Supabase dashboard). This file documents the required configuration
-- so any new environment (staging, fresh project) can reproduce it.
--
-- ─── Manual setup steps (Supabase dashboard → Database → Webhooks → Create)
--
--   Name:       waitlist-new-entry
--   Table:      public.waitlist
--   Events:     INSERT
--   Type:       HTTP Request
--   Method:     POST
--   URL:        https://<project-ref>.supabase.co/functions/v1/waitlist-notification
--   HTTP Headers:
--     Content-Type:          application/json
--     x-webhook-signature:   {{ hmac_sha256(env.WAITLIST_WEBHOOK_SECRET, body) }}
--
-- Both the webhook and the edge function must share WAITLIST_WEBHOOK_SECRET.
-- Rotate both together.
--
-- ─── Required edge function env vars (Supabase → Edge Functions → Secrets)
--
--   WAITLIST_WEBHOOK_SECRET  — random 32+ byte hex string
--   RESEND_API_KEY           — from Resend dashboard
--   SUPABASE_URL             — auto-injected
--   SUPABASE_SERVICE_ROLE_KEY — auto-injected
--
-- ─── Verification
--
--   curl -X POST \
--     https://<project-ref>.supabase.co/functions/v1/waitlist-notification \
--     -H "Content-Type: application/json" \
--     -H "x-webhook-signature: <hex sha256>" \
--     -d '{"record":{"email":"test@example.com"}}'
--
-- Expected: 200 if signature matches, 401 otherwise.

-- Keep track that this configuration is required:
INSERT INTO public.audit_log (
  actor_id, action, resource_type, resource_id, metadata
) VALUES (
  NULL, 'system_note', 'webhook_config', 'waitlist-notification',
  jsonb_build_object(
    'note', 'Requires manual dashboard setup — see file comment.',
    'secret_env', 'WAITLIST_WEBHOOK_SECRET'
  )
) ON CONFLICT DO NOTHING;
