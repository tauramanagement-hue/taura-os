// GDPR Art.15 (Accesso) + Art.20 (Portabilità)
// Raccoglie tutti i dati dell'utente autenticato → JSON → upload storage → signed URL
//
// Input: POST (body vuoto, usa JWT per user_id)
// Output: { success: true, request_id, download_url, expires_at }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { audit, extractClientIp } from "../_shared/audit.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const BUCKET = "exports";
const URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 giorni

// Explicit allowlist. Each entry MUST have a filter that ensures the data
// belongs to the requesting user (directly or via agency). Adding a table
// here requires auditing the chosen filter column — missing filter would
// dump every row via service_role bypass of RLS.
type TableFilter =
  | { kind: "user"; col: string }
  | { kind: "agency"; col: string };

const EXPORTABLE_TABLES: { name: string; filter: TableFilter }[] = [
  { name: "profiles",              filter: { kind: "user",   col: "id" } },
  { name: "agencies",              filter: { kind: "agency", col: "id" } },
  { name: "athletes",              filter: { kind: "agency", col: "agency_id" } },
  { name: "contracts",             filter: { kind: "agency", col: "agency_id" } },
  { name: "deals",                 filter: { kind: "agency", col: "agency_id" } },
  { name: "campaign_deliverables", filter: { kind: "agency", col: "agency_id" } },
  { name: "notifications",         filter: { kind: "user",   col: "user_id" } },
  { name: "user_consents",         filter: { kind: "user",   col: "user_id" } },
  { name: "dsr_requests",          filter: { kind: "user",   col: "user_id" } },
  { name: "audit_log",             filter: { kind: "user",   col: "actor_id" } },
];

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
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

    for (const t of EXPORTABLE_TABLES) {
      const filterVal = t.filter.kind === "user" ? userId : agencyId;
      if (!filterVal) {
        exportData[t.name] = [];
        continue;
      }
      const { data, error } = await adminClient
        .from(t.name)
        .select("*")
        .eq(t.filter.col, filterVal);
      if (error) {
        console.warn(`[export] ${t.name} error:`, error.message);
        exportData[t.name] = { error: "fetch_failed" };
        continue;
      }
      // Defense-in-depth: strip rows whose agency_id does not match the caller,
      // in case a join or mis-filter leaked cross-tenant data.
      const rows = (data ?? []) as Record<string, unknown>[];
      if (t.filter.kind === "agency" && agencyId) {
        exportData[t.name] = rows.filter(
          (r) => !("agency_id" in r) || r.agency_id === agencyId,
        );
      } else {
        exportData[t.name] = rows;
      }
    }

    // chat_messages needs a join via chat_threads (no user_id column on messages)
    if (agencyId) {
      const { data: threads } = await adminClient
        .from("chat_threads")
        .select("id")
        .eq("user_id", userId);
      const threadIds = (threads ?? []).map((t: any) => t.id as string);
      if (threadIds.length > 0) {
        const { data: msgs } = await adminClient
          .from("chat_messages")
          .select("*")
          .in("thread_id", threadIds);
        exportData["chat_messages"] = msgs ?? [];
      } else {
        exportData["chat_messages"] = [];
      }
    } else {
      exportData["chat_messages"] = [];
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
      console.error("[export-user-data] dsr insert:", dsrErr.message);
      return json({ code: "DSR_INSERT_FAILED", message: "Impossibile creare richiesta di export." }, 500);
    }

    const filename = `${userId}/${dsr.id}.json`;
    const body = new TextEncoder().encode(JSON.stringify(exportData, null, 2));

    const { error: uploadErr } = await adminClient.storage
      .from(BUCKET)
      .upload(filename, body, { contentType: "application/json", upsert: true });

    if (uploadErr) {
      console.error("[export-user-data] upload error:", uploadErr.message);
      await adminClient.from("dsr_requests").update({
        status: "rejected",
        rejection_reason: `upload_failed: ${uploadErr.message}`,
        completed_at: new Date().toISOString(),
      }).eq("id", dsr.id);
      return json({ code: "UPLOAD_FAILED", message: "Impossibile salvare il file di export." }, 500);
    }

    const { data: signed, error: signErr } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(filename, URL_EXPIRY_SECONDS);

    if (signErr || !signed) {
      console.error("[export-user-data] signed url error:", signErr?.message);
      return json({ code: "SIGN_URL_FAILED", message: "Impossibile generare il link di download." }, 500);
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
      metadata: { dsr_id: dsr.id, tables: EXPORTABLE_TABLES.map(t => t.name).concat("chat_messages") },
    });

    return json({
      success: true,
      request_id: dsr.id,
      download_url: signed.signedUrl,
      expires_at: expiresAt,
    }, 200);
  } catch (e) {
    const traceId = crypto.randomUUID();
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[export-user-data] fatal", { trace_id: traceId, message: msg });
    return json({ code: "INTERNAL", message: "Errore interno.", trace_id: traceId }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
