import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAnthropic, MODELS } from "../_shared/anthropic.ts";
import { parseGeminiJsonResponse } from "../_shared/gemini.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

// Social handles: letters, digits, dots, underscores, hyphens only.
// Max 50 chars — real platforms cap lower, but 50 gives us headroom.
// Blocks any URL / path / whitespace / control chars that could drive SSRF
// or be injected into the LLM prompt.
const HANDLE_RE = /^[a-zA-Z0-9._-]{1,50}$/;

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { athlete_id, platform, handle } = await req.json();
    if (!athlete_id || !platform || !handle) {
      throw new Error("athlete_id, platform, and handle are required");
    }

    const validPlatforms = ["instagram", "tiktok", "youtube"];
    if (!validPlatforms.includes(platform)) {
      throw new Error("platform must be one of: instagram, tiktok, youtube");
    }

    if (typeof handle !== "string" || !HANDLE_RE.test(handle.trim().replace(/^@/, ""))) {
      return new Response(
        JSON.stringify({ code: "INVALID_HANDLE", message: "Handle format not allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const { data: athlete } = await admin
      .from("athletes")
      .select("id, full_name, sport")
      .eq("id", athlete_id)
      .eq("agency_id", profile.agency_id)
      .single();

    if (!athlete) throw new Error("Atleta non trovato");

    const cleanHandle = handle.trim().replace(/^@/, "");

    const platformLabels: Record<string, string> = {
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
    };

    const prompt = `Sei un assistente che stima i follower di profili social.

L'utente ha inserito l'handle "${cleanHandle}" per la piattaforma ${platformLabels[platform]}.
Il profilo appartiene a: ${athlete.full_name} (${athlete.sport}).

Rispondi SOLO con un JSON valido contenente la stima dei follower basata sulla notorietà dell'atleta/talent. Se conosci il profilo reale, dai il numero più accurato possibile. Se non lo conosci con certezza, rispondi con null.

Formato JSON richiesto:
{
  "handle": "${cleanHandle}",
  "followers": 150000,
  "verified": false,
  "note": "breve nota opzionale"
}

- "followers": numero intero o null se non puoi stimare
- "verified": true se sei ragionevolmente sicuro del dato, false altrimenti
- "note": opzionale, breve contesto

Rispondi SOLO con JSON valido, senza markdown.`;

    const aiResponse = await callAnthropic({
      model: MODELS.L1_GEMINI_FAST,
      system: "",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.2,
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Errore AI: " + aiResponse.status);
    }

    const aiData = await aiResponse.json();
    const rawText =
      (aiData.content?.[0] as { text?: string } | undefined)?.text ??
      aiData.choices?.[0]?.message?.content ??
      parseGeminiJsonResponse(aiData);
    let content = rawText;
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let result: any;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      result = { handle: cleanHandle, followers: null, verified: false };
    }

    const handleField = `${platform}_handle`;
    const followersField = `${platform}_followers`;

    const updateData: Record<string, any> = {
      [handleField]: cleanHandle,
      social_enriched_at: new Date().toISOString(),
    };

    if (result.followers && typeof result.followers === "number" && result.followers > 0) {
      updateData[followersField] = result.followers;
    }

    const { error: updateErr } = await admin
      .from("athletes")
      .update(updateData)
      .eq("id", athlete_id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      throw new Error("Errore aggiornamento: " + updateErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      handle: cleanHandle,
      followers: result.followers || null,
      verified: result.verified || false,
      note: result.note || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[enrich-social] error", { message: e instanceof Error ? e.message : "unknown" });
    return new Response(
      JSON.stringify({ code: "INTERNAL", message: "Operazione fallita" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
