// Registra consensi GDPR (cookie banner, form onboarding, re-consent)
// Tutti i consensi sono versionati e hash di IP+UA vengono salvati (non raw).
//
// Input: POST { consents: [{ type, granted, version? }], source: string }
// Output: { success: true, consents: [...] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256Hex } from "../_shared/anonymize.ts";
import { audit, extractClientIp } from "../_shared/audit.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const VALID_TYPES = new Set([
  "privacy_policy",
  "terms",
  "cookies_necessary",
  "cookies_analytics",
  "cookies_marketing",
  "ai_processing",
  "marketing_email",
]);

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    let agencyId: string | null = null;
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
      if (userId) {
        const { data: profile } = await adminClient
          .from("profiles").select("agency_id").eq("id", userId).maybeSingle();
        agencyId = profile?.agency_id ?? null;
      }
    }

    const body = await req.json().catch(() => ({}));
    const consents = Array.isArray(body.consents) ? body.consents : [];
    const source = typeof body.source === "string" ? body.source : "unknown";

    if (consents.length === 0) {
      return json({ code: "NO_CONSENTS", message: "Provide consents array" }, 400);
    }

    if (!userId) {
      return json({ code: "UNAUTHORIZED", message: "Must be logged in to persist consents" }, 401);
    }

    const ip = extractClientIp(req);
    const ua = req.headers.get("user-agent") ?? "";
    const ipHash = ip ? await sha256Hex(ip) : null;
    const uaHash = ua ? await sha256Hex(ua) : null;

    const { data: versions } = await adminClient
      .from("privacy_versions")
      .select("doc_type, version")
      .eq("is_current", true);

    const versionMap = new Map<string, string>();
    for (const v of versions ?? []) versionMap.set(v.doc_type, v.version);

    const rows = [];
    for (const c of consents) {
      if (!VALID_TYPES.has(c.type)) continue;
      const version = c.version ?? versionMap.get(c.type) ?? "2026-04-21";
      rows.push({
        user_id: userId,
        consent_type: c.type,
        version,
        granted: Boolean(c.granted),
        granted_at: new Date().toISOString(),
        revoked_at: c.granted ? null : new Date().toISOString(),
        ip_hash: ipHash,
        user_agent_hash: uaHash,
        metadata: { source, ...c.metadata },
      });
    }

    if (rows.length === 0) {
      return json({ code: "INVALID_TYPES", message: "No valid consent types provided" }, 400);
    }

    const { data, error } = await adminClient
      .from("user_consents")
      .upsert(rows, { onConflict: "user_id,consent_type,version" })
      .select();

    if (error) {
      return json({ code: "INSERT_FAILED", message: error.message }, 500);
    }

    for (const c of consents) {
      if (!VALID_TYPES.has(c.type)) continue;
      await audit(adminClient, {
        actor_id: userId,
        agency_id: agencyId,
        action: c.granted ? "consent_grant" : "consent_revoke",
        resource_type: "consent",
        resource_id: c.type,
        ip,
        metadata: { source, version: versionMap.get(c.type) },
      });
    }

    return json({ success: true, consents: data }, 200);
  } catch (e) {
    const traceId = crypto.randomUUID();
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[consent-webhook] fatal", { trace_id: traceId, message: msg });
    return json({ code: "INTERNAL", message: "Errore interno.", trace_id: traceId }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
