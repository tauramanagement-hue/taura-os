import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAnthropic, MODELS } from "../_shared/anthropic.ts";
import { parseGeminiJsonResponse } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { athlete_id } = await req.json();
    if (!athlete_id) throw new Error("athlete_id required");

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
    const { data: profile } = await admin.from("profiles").select("agency_id, agencies(name)").eq("id", user.id).single();
    if (!profile?.agency_id) throw new Error("No agency");

    const [athleteRes, contractsRes, campaignsRes] = await Promise.all([
      admin.from("athletes").select("*").eq("id", athlete_id).eq("agency_id", profile.agency_id).single(),
      admin.from("contracts").select("id, brand, contract_type, value, status, start_date, end_date").eq("athlete_id", athlete_id).eq("status", "active"),
      admin.from("campaign_deliverables").select("id, content_type, campaigns(brand)").eq("athlete_id", athlete_id),
    ]);

    if (!athleteRes.data) throw new Error("Atleta non trovato");

    const athlete = athleteRes.data;
    const contracts = contractsRes.data || [];
    const deliverables = campaignsRes.data || [];

    const brands = [...new Set(contracts.map((c: any) => c.brand).filter(Boolean))];
    const totalRevenue = contracts.reduce((s: number, c: any) => s + (c.value || 0), 0);

    const totalFollowers = (athlete.instagram_followers || 0) + (athlete.tiktok_followers || 0) + (athlete.youtube_followers || 0);

    const socials = [
      athlete.instagram_handle ? { platform: "Instagram", handle: `@${athlete.instagram_handle}`, followers: athlete.instagram_followers } : null,
      athlete.tiktok_handle ? { platform: "TikTok", handle: `@${athlete.tiktok_handle}`, followers: athlete.tiktok_followers } : null,
      athlete.youtube_handle ? { platform: "YouTube", handle: `@${athlete.youtube_handle}`, followers: athlete.youtube_followers } : null,
    ].filter(Boolean);

    const prompt = `Genera un breve pitch commerciale (3-4 frasi, tono professionale ma dinamico) per il media kit di questo talent:

Nome: ${athlete.full_name}
Sport: ${athlete.sport}${athlete.category ? ` - ${athlete.category}` : ""}
Follower totali: ${totalFollowers.toLocaleString()}
Social: ${socials.map((s: any) => `${s.platform}: ${s.handle} (${(s.followers || 0).toLocaleString()})`).join(", ")}
Brand collaborati: ${brands.join(", ") || "Nessuno"}
Contratti attivi: ${contracts.length}

Rispondi SOLO con il testo del pitch, senza virgolette o markdown. In italiano.`;

    const aiResponse = await callAnthropic({
      model: MODELS.L2_SONNET,
      system: "",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.4,
    });

    let pitch = "";
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const rawText =
        (aiData.content?.[0] as { text?: string } | undefined)?.text ??
        aiData.choices?.[0]?.message?.content ??
        parseGeminiJsonResponse(aiData);
      pitch = rawText.trim();
    }

    return new Response(JSON.stringify({
      success: true,
      athlete: {
        full_name: athlete.full_name,
        sport: athlete.sport,
        category: athlete.category,
        nationality: athlete.nationality,
        photo_url: athlete.photo_url,
      },
      agency_name: (profile as any).agencies?.name || "TAURA",
      socials,
      total_followers: totalFollowers,
      brands,
      contracts_count: contracts.length,
      total_revenue: totalRevenue,
      deliverables_count: deliverables.length,
      pitch,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-media-kit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
