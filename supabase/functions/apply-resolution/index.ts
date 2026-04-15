import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic, MODELS } from "../_shared/anthropic.ts";
import { parseGeminiJsonResponse } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const parseAmount = (raw: string): number | null => {
    if (!raw) return null;
    const clean = raw.toLowerCase().replace(/€|\s/g, "");

    const withUnit = clean.match(/([+-]?\d+(?:[\.,]\d+)?)\s*([km])/i);
    if (withUnit) {
      const n = Number(withUnit[1].replace(",", "."));
      const unit = withUnit[2].toLowerCase();
      return unit === "m" ? Math.round(n * 1_000_000) : Math.round(n * 1_000);
    }

    const normalized = clean
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(/,(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");

    const plain = normalized.match(/[+-]?\d+(?:\.\d+)?/);
    if (!plain) return null;
    return Math.round(Number(plain[0]));
  };

  const extractDeltaFromNote = (note: string): number | null => {
    const lowered = note.toLowerCase();

    const signByWords = /tagli|riduc|scont|tolt|decurt|meno|-\s*€?\d/.test(lowered)
      ? -1
      : /aument|aggiung|increment|più|\+\s*€?\d/.test(lowered)
        ? 1
        : 0;

    const amountMatch = lowered.match(/([+-]?\s*€?\s*\d+(?:[\.,]\d+)?\s*[km]?)/i);
    if (!amountMatch) return null;

    const amount = parseAmount(amountMatch[1]);
    if (amount == null) return null;

    if (amountMatch[1].includes("-")) return -Math.abs(amount);
    if (amountMatch[1].includes("+")) return Math.abs(amount);
    if (signByWords < 0) return -Math.abs(amount);
    if (signByWords > 0) return Math.abs(amount);

    return null;
  };

  try {
    const { conflict_id, resolution_note } = await req.json();
    if (!conflict_id || !resolution_note) throw new Error("conflict_id and resolution_note required");

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

    // Get conflict details
    const { data: conflict } = await admin
      .from("conflicts")
      .select("*, contracts:contract_a_id(id, brand, value, athlete_id, athletes(full_name))")
      .eq("id", conflict_id)
      .single();
    if (!conflict) throw new Error("Conflict not found");

    const currentValue = Number(conflict.contracts?.value || 0);

    const systemContent = `Sei un assistente che interpreta note di risoluzione conflitti per agenzie di talent management.
Data una nota di risoluzione, estrai le azioni da eseguire nel database.

Regole IMPORTANTI:
- Devi SEMPRE riferirti al contratto principale indicato nel testo (contract_id fornito).
- Interpreta anche frasi come "tagliando 10k", "riducendo 10.000", "sconto 5k", "tolti 7000" come DELTA negativo.
- Interpreta "aumentando 10k", "aggiungendo 10.000", "incremento 5k" come DELTA positivo.
- Supporta k/m: 10k=10000, 2.5k=2500, 1M=1000000.

Rispondi SOLO con JSON valido:
{
  "actions": [
    {
      "type": "update_contract_value",
      "contract_id": "uuid",
      "new_value": 50000
    },
    {
      "type": "note_only",
      "description": "nessuna modifica automatica necessaria"
    }
  ]
}

Se la nota contiene una variazione di valore, calcola il nuovo valore a partire dal valore attuale fornito.
Se non ci sono modifiche numeriche chiare, usa "note_only".`;

    const userContent = `Conflitto: ${conflict.description}\nContract ID: ${conflict.contract_a_id}\nContratto: ${conflict.contracts?.brand} - Valore attuale: €${currentValue} - Atleta: ${conflict.contracts?.athletes?.full_name}\n\nNota di risoluzione: ${resolution_note}`;

    let parsed: any = null;
    try {
      const aiResponse = await callAnthropic({
        model: MODELS.L1_GEMINI_FAST,
        system: systemContent,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 2048,
        temperature: 0.1,
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const rawText =
          (aiData.content?.[0] as { text?: string } | undefined)?.text ??
          aiData.choices?.[0]?.message?.content ??
          parseGeminiJsonResponse(aiData);
        let content = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        try {
          parsed = JSON.parse(content);
        } catch {
          console.log("Could not parse AI response for resolution actions:", content);
        }
      }
    } catch (aiErr) {
      console.error("AI error:", aiErr);
    }

    let actionsApplied = 0;

    for (const action of (parsed?.actions || [])) {
      if (action.type !== "update_contract_value") continue;

      const targetId = action.contract_id || conflict.contract_a_id;
      const nextValue = Number(action.new_value);
      if (!Number.isFinite(nextValue)) continue;

      const { error } = await admin
        .from("contracts")
        .update({ value: Math.max(0, Math.round(nextValue)) })
        .eq("id", targetId)
        .eq("agency_id", profile.agency_id);

      if (!error) actionsApplied++;
    }

    // Fallback deterministic parser for natural language if AI did not produce actions
    if (actionsApplied === 0) {
      const delta = extractDeltaFromNote(String(resolution_note || ""));
      if (delta !== null) {
        const newValue = Math.max(0, currentValue + delta);
        const { error } = await admin
          .from("contracts")
          .update({ value: newValue })
          .eq("id", conflict.contract_a_id)
          .eq("agency_id", profile.agency_id);

        if (!error) actionsApplied = 1;
      }
    }

    return new Response(JSON.stringify({ success: true, actions_applied: actionsApplied }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("apply-resolution error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

