// GDPR Art.15 (Accesso) + Art.20 (Portabilità)
// Raccoglie tutti i dati dell'utente autenticato → JSON → upload storage → signed URL
//
// Input: POST (body vuoto, usa JWT per user_id)
// Output: { success: true, request_id, download_url, expires_at }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { audit, extractClientIp } from "../_shared/audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "exports";
const URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 giorni

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ code: "UNAUTHORIZED", message: "Missing auth header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ code: "UNAUTHORIZED", message: "Invalid token" }, 401);
    }

    const userId = user.id;
    const ip = extractClientIp(req);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const agencyId = profile?.agency_id ?? null;

    const tables = [
      { name: "profiles", filter: { col: "id", val: userId } },
      { name: "agencies", filter: agencyId ? { col: "id", val: agencyId } : null },
      { name: "athletes", filter: agencyId ? { col: "agency_id", val: agencyId } : null },
      { name: "contracts", filter: agencyId ? { col: "agency_id", val: agencyId } : null },
      { name: "deals", filter: agencyId ? { col: "agency_id", val: agencyId } : null },
      { name: "campaign_deliverables", filter: agencyId ? { col: "agency_id", val: agencyId } : null },
      { name: "chat_messages", filter: { col: "user_id", val: userId } },
      { name: "notifications", filter: { col: "user_id", val: userId } },
      { name: "user_consents", filter: { col: "user_id", val: userId } },
      { name: "dsr_requests", filter: { col: "user_id", val: userId } },
      { name: "audit_log", filter: { col: "actor_id", val: userId } },
    ];

    const exportData: Record<string, unknown> = {
      _meta: {
        exported_at: new Date().toISOString(),
        user_id: userId,
        email: user.email,
        gdpr_articles: ["Art.15 — right of access", "Art.20 — data portability"],
        format: "JSON",
        encoding: "UTF-8",
      },
    };

    for (const t of tables) {
      if (!t.filter) {
        exportData[t.name] = [];
        continue;
      }
      const { data, error } = await adminClient
        .from(t.name)
        .select("*")
        .eq(t.filter.col, t.filter.val);
      if (error) {
        console.warn(`[export] ${t.name} error:`, error);
        exportData[t.name] = { error: error.message };
      } else {
        exportData[t.name] = data ?? [];
      }
    }

    const { data: dsr, error: dsrErr } = await adminClient
      .from("dsr_requests")
      .insert({
        user_id: userId,
        request_type: "export",
        status: "in_progress",
        metadata: { source: "export-user-data", ip_present: !!ip },
      })
      .select()
      .single();

    if (dsrErr) {
      return json({ code: "DSR_INSERT_FAILED", message: dsrErr.message }, 500);
    }

    const filename = `${userId}/${dsr.id}.json`;
    const body = new TextEncoder().encode(JSON.stringify(exportData, null, 2));

    const { error: uploadErr } = await adminClient.storage
      .from(BUCKET)
      .upload(filename, body, { contentType: "application/json", upsert: true });

    if (uploadErr) {
      await adminClient.from("dsr_requests").update({
        status: "rejected",
        rejection_reason: `upload_failed: ${uploadErr.message}`,
        completed_at: new Date().toISOString(),
      }).eq("id", dsr.id);
      return json({ code: "UPLOAD_FAILED", message: uploadErr.message }, 500);
    }

    const { data: signed, error: signErr } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(filename, URL_EXPIRY_SECONDS);

    if (signErr || !signed) {
      return json({ code: "SIGN_URL_FAILED", message: signErr?.message ?? "unknown" }, 500);
    }

    const expiresAt = new Date(Date.now() + URL_EXPIRY_SECONDS * 1000).toISOString();

    await adminClient.from("dsr_requests").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      export_url: signed.signedUrl,
      export_expires_at: expiresAt,
    }).eq("id", dsr.id);

    await audit(adminClient, {
      actor_id: userId,
      agency_id: agencyId,
      action: "data_export",
      resource_type: "user_account",
      resource_id: userId,
      ip,
      metadata: { dsr_id: dsr.id, tables: tables.map(t => t.name) },
    });

    return json({
      success: true,
      request_id: dsr.id,
      download_url: signed.signedUrl,
      expires_at: expiresAt,
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[export-user-data] fatal:", msg);
    return json({ code: "INTERNAL", message: msg }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
