import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contract_id } = await req.json();
    if (!contract_id) throw new Error("contract_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin.from("profiles").select("agency_id").eq("id", user.id).single();
    if (!profile?.agency_id) throw new Error("No agency");

    const { data: contract } = await admin
      .from("contracts")
      .select("id, agency_id, file_url")
      .eq("id", contract_id)
      .eq("agency_id", profile.agency_id)
      .single();

    if (!contract) throw new Error("Contratto non trovato");

    // Pulizia conflitti collegati
    await admin.from("conflicts").delete().eq("contract_a_id", contract_id);
    await admin.from("conflicts").delete().eq("contract_b_id", contract_id);

    // Elimina contratto
    const { error: delErr } = await admin.from("contracts").delete().eq("id", contract_id);
    if (delErr) throw delErr;

    // Elimina file storage (best-effort)
    if (contract.file_url) {
      await admin.storage.from("contracts").remove([contract.file_url]);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-contract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
