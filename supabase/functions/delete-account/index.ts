// GDPR Art.17 — Right to erasure
// Soft-delete cascade sui dati utente + invalida sessioni + log audit.
// Hard-delete schedulato via pg_cron dopo 30gg.
//
// Input: POST { confirm: true, reason?: string }
// Output: { success: true, hard_delete_after }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { audit, extractClientIp } from "../_shared/audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ code: "UNAUTHORIZED", message: "Missing auth header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ code: "UNAUTHORIZED", message: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return json({ code: "CONFIRM_REQUIRED", message: "Pass { confirm: true }" }, 400);
    }

    const userId = user.id;
    const ip = extractClientIp(req);
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

    const { data: profile } = await adminClient
      .from("profiles").select("agency_id").eq("id", userId).maybeSingle();
    const agencyId = profile?.agency_id ?? null;

    const { error: rpcErr } = await adminClient.rpc("soft_delete_user_data", { target_user_id: userId });
    if (rpcErr) {
      return json({ code: "SOFT_DELETE_FAILED", message: rpcErr.message }, 500);
    }

    const { error: dsrErr } = await adminClient.from("dsr_requests").insert({
      user_id: userId,
      request_type: "erasure",
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: { reason, ip_present: !!ip, hard_delete_after: isoInDays(30) },
    });
    if (dsrErr) console.warn("[delete-account] dsr insert warn:", dsrErr);

    await audit(adminClient, {
      actor_id: userId,
      agency_id: agencyId,
      action: "data_delete",
      resource_type: "user_account",
      resource_id: userId,
      ip,
      metadata: { soft_delete: true, hard_delete_after: isoInDays(30), reason },
    });

    // Invalida tutte le sessioni dell'utente (logout globale)
    try {
      await adminClient.auth.admin.signOut(userId, "global");
    } catch (e) {
      console.warn("[delete-account] signout warn:", e);
    }

    return json({
      success: true,
      message: "Account eliminato. I tuoi dati saranno cancellati definitivamente tra 30 giorni.",
      hard_delete_after: isoInDays(30),
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[delete-account] fatal:", msg);
    return json({ code: "INTERNAL", message: msg }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isoInDays(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}
