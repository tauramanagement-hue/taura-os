import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAnthropic, MODELS } from "../_shared/anthropic.ts";
import { parseGeminiJsonResponse } from "../_shared/gemini.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const normalizeName = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeHandle = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._]/g, "");

const looksLikeHandle = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const noAt = raw.replace(/^@/, "");
  return raw.startsWith("@") || (!/\s/.test(noAt) && noAt.length >= 4 && /[a-z]/i.test(noAt));
};

const extractHandleCandidates = (...texts: Array<string | null | undefined>) => {
  const out = new Set<string>();
  for (const text of texts) {
    const str = String(text || "");
    if (!str) continue;
    const regex = /@([a-zA-Z0-9._]{3,40})/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
      const handle = normalizeHandle(match[1]);
      if (handle) out.add(handle);
    }
    if (looksLikeHandle(str)) {
      const direct = normalizeHandle(str);
      if (direct) out.add(direct);
    }
  }
  return out;
};

const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
};

const base64FromBytes = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { campaign_id, dry_run, confirmed_athletes, cache_key } = body;
    if (!campaign_id) throw new Error("campaign_id required");

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

    const { data: campaign } = await admin
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("agency_id", profile.agency_id)
      .single();

    if (!campaign) throw new Error("Campagna non trovata");
    if (!campaign.brief_file_url) throw new Error("Nessun brief caricato");

    let parsed: any;

    if (cache_key) {
      const { data: cachedFile, error: cacheErr } = await admin.storage.from("contracts").download(cache_key);
      if (cacheErr || !cachedFile) throw new Error("Cache non trovata: " + (cacheErr?.message || ""));
      parsed = JSON.parse(await cachedFile.text());
      await admin.storage.from("contracts").remove([cache_key]);
    } else {
      const { data: fileData, error: dlErr } = await admin.storage
        .from("contracts")
        .download(campaign.brief_file_url);

      if (dlErr || !fileData) throw new Error("Impossibile scaricare il brief: " + (dlErr?.message || "file non trovato"));

      const arrayBuffer = await fileData.arrayBuffer();
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        return new Response(JSON.stringify({ error: "File troppo grande (max 20MB)." }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bytes = new Uint8Array(arrayBuffer);
      const base64Content = base64FromBytes(bytes);

      const { data: athletes } = await admin
        .from("athletes")
        .select("id, full_name, sport, instagram_handle, tiktok_handle, youtube_handle")
        .eq("agency_id", profile.agency_id);

      const rosterList = (athletes || []).map((a: any) => {
        const handles = [a.instagram_handle, a.tiktok_handle, a.youtube_handle].filter(Boolean).map((h: string) => `@${h}`).join(", ");
        return `${a.full_name} (${a.sport})${handles ? ` [handles: ${handles}]` : ""}`;
      }).join("\n");

      const fileName = campaign.brief_file_url.toLowerCase();
      let mimeType = "application/pdf";
      if (fileName.endsWith(".pptx")) mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      else if (fileName.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (fileName.endsWith(".doc")) mimeType = "application/msword";

      const today = new Date();
      const dayNames = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];

      const systemPrompt = `Sei un assistente esperto che analizza brief di campagne marketing per agenzie di talent management.
DATA OGGI: ${today.toISOString().split("T")[0]} (${dayNames[today.getDay()]})

ROSTER AGENZIA (nome completo | sport | handle social):
${rosterList || "(roster vuoto)"}

Analizza il brief allegato e restituisci un JSON con i deliverable da creare.

### IDENTIFICAZIONE TALENT
1. TALENT = le persone fisiche che devono pubblicare contenuti. NON sono talent: il brand, l'agenzia, referenti aziendali.
2. Cerca nel roster: confronta OGNI nome, handle (@username), soprannome. Se trovi corrispondenza, usa il NOME COMPLETO dal roster.
3. Se il documento menziona handle social (@username), cerca nel roster chi ha quell'handle.
4. NON INVENTARE talent. Se un nome non e matchabile, riportalo esattamente come nel documento.
5. ESCLUDI SEMPRE: nomi di brand, aziende, agenzie.

### ESTRAZIONE DATI
Per ogni deliverable estrai:
- athlete_name, content_type (post/reel/tiktok/story/youtube), scheduled_date (YYYY-MM-DD), description, ai_overview (istruzioni operative dettagliate)

Rispondi SOLO con JSON valido:
{
  "athletes_detected": [{"name": "Nome Cognome", "original_text": "testo dal doc", "matched_from_roster": true, "sport": "sport", "handles": ["@handle"]}],
  "deliverables": [{"athlete_name": "Nome Cognome", "content_type": "reel", "scheduled_date": "2026-03-01", "description": "Reel prodotto X", "ai_overview": "istruzioni operative..."}]
}`;

      const userContent = [
        {
          type: "file",
          file: {
            filename: campaign.brief_file_url.split("/").pop(),
            file_data: `data:${mimeType};base64,${base64Content}`,
          },
        },
        {
          type: "text",
          text: `Analizza questo brief per la campagna "${campaign.name}" del brand "${campaign.brand}". Estrai tutti i deliverable con istruzioni operative per ogni talent. Identifica i talent confrontando con il roster.`,
        },
      ];

      const aiResponse = await callAnthropic({
        model: MODELS.L2_SONNET,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 4096,
        temperature: 0.1,
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit. Riprova tra poco." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Errore AI: " + aiResponse.status);
      }

      const aiData = await aiResponse.json();
      const rawText =
        (aiData.content?.[0] as { text?: string } | undefined)?.text ??
        aiData.choices?.[0]?.message?.content ??
        parseGeminiJsonResponse(aiData);
      let content = rawText;
      content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      try {
        parsed = JSON.parse(content);
      } catch {
        console.error("Failed to parse AI response:", content);
        return new Response(JSON.stringify({ error: "AI non ha restituito JSON valido", raw: content }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!parsed.deliverables || !Array.isArray(parsed.deliverables)) {
      throw new Error("Formato risposta AI non valido");
    }

    const { data: currentAthletes } = await admin
      .from("athletes")
      .select("id, full_name, sport, instagram_handle, tiktok_handle, youtube_handle")
      .eq("agency_id", profile.agency_id);

    const nameToId: Record<string, string> = {};
    const handleToId: Record<string, string> = {};
    const idToAthlete: Record<string, any> = {};
    const allAthletesList = currentAthletes || [];

    allAthletesList.forEach((a: any) => {
      const key = normalizeName(a.full_name || "");
      if (key) nameToId[key] = a.id;
      idToAthlete[a.id] = a;
      for (const h of [a.instagram_handle, a.tiktok_handle, a.youtube_handle]) {
        const hNorm = normalizeHandle(h || "");
        if (hNorm) handleToId[hNorm] = a.id;
      }
    });

    const findExistingId = (name: string, originalText?: string): string | null => {
      const key = normalizeName(name);
      if (!key) return null;
      if (nameToId[key]) return nameToId[key];
      const handleCandidates = extractHandleCandidates(name, originalText);
      for (const handle of handleCandidates) {
        if (handleToId[handle]) return handleToId[handle];
      }
      const keyTokens = key.split(" ").filter(Boolean);
      if (keyTokens.length >= 2) {
        for (const [n, id] of Object.entries(nameToId)) {
          if (keyTokens.every((t) => n.includes(t))) return id;
        }
      }
      if (key.length >= 8) {
        let bestId: string | null = null;
        let bestDist = Infinity;
        for (const [n, id] of Object.entries(nameToId)) {
          const dist = levenshtein(key, n);
          const maxLen = Math.max(key.length, n.length);
          if (dist <= 1 && dist < bestDist && dist / maxLen <= 0.12) {
            bestDist = dist;
            bestId = id;
          }
        }
        if (bestId) return bestId;
      }
      return null;
    };

    const isReliableMatch = (candidateId: string, detectedName: string, originalText?: string) => {
      const athlete = idToAthlete[candidateId];
      if (!athlete) return false;
      const rosterName = normalizeName(athlete.full_name || "");
      const detectedKey = normalizeName(detectedName || "");
      const originalKey = normalizeName(originalText || "");
      const rosterHandles = new Set(
        [athlete.instagram_handle, athlete.tiktok_handle, athlete.youtube_handle]
          .map((h: string) => normalizeHandle(h || ""))
          .filter(Boolean),
      );
      const handleCandidates = extractHandleCandidates(detectedName, originalText);
      const hasHandleEvidence = Array.from(handleCandidates).some((h) => rosterHandles.has(h));
      if (looksLikeHandle(originalText) || looksLikeHandle(detectedName)) return hasHandleEvidence;
      if (detectedKey && detectedKey === rosterName) return true;
      if (originalKey && originalKey === rosterName) return true;
      const detectedTokens = detectedKey.split(" ").filter(Boolean);
      if (detectedTokens.length >= 2 && detectedTokens.every((t) => rosterName.includes(t))) return true;
      return hasHandleEvidence;
    };

    const resolveAthleteId = (name: string, originalText?: string, contextTexts: string[] = []) => {
      const direct = findExistingId(name, originalText);
      if (direct && isReliableMatch(direct, name, originalText)) return direct;
      const handlesFromContext = extractHandleCandidates(name, originalText, ...contextTexts);
      for (const handle of handlesFromContext) {
        if (handleToId[handle]) return handleToId[handle];
      }
      return null;
    };

    const aiDetectedAthletes = Array.isArray(parsed.athletes_detected) ? parsed.athletes_detected : [];
    const detectedAthletes: Array<{ name: string; original_text?: string; sport?: string | null }> = [];
    const seenDetected = new Set<string>();

    const pushDetectedAthlete = (name?: string, originalText?: string, sport?: string | null) => {
      const cleanName = String(name || "").trim();
      if (!cleanName) return;
      const key = `${normalizeName(cleanName)}|${normalizeHandle(originalText || "")}`;
      if (seenDetected.has(key)) return;
      seenDetected.add(key);
      detectedAthletes.push({ name: cleanName, original_text: originalText || cleanName, sport: sport || null });
    };

    aiDetectedAthletes.forEach((a: any) => pushDetectedAthlete(a?.name, a?.original_text, a?.sport));

    const handleSources: Array<string | null | undefined> = [
      ...(parsed.deliverables.flatMap((d: any) => [d?.athlete_name, d?.description, d?.ai_overview])),
    ];
    const handlesInDocument = extractHandleCandidates(...handleSources);
    for (const handle of handlesInDocument) {
      if (handle.length < 5) continue;
      const existingId = handleToId[handle];
      if (existingId) {
        const athlete = idToAthlete[existingId];
        pushDetectedAthlete(athlete?.full_name || `@${handle}`, `@${handle}`, athlete?.sport || null);
      } else {
        pushDetectedAthlete(`@${handle}`, `@${handle}`, "Da definire");
      }
    }

    const newAthletes: { name: string; sport: string; original_text?: string }[] = [];
    const existingMatches: { name: string; id: string }[] = [];

    for (const a of detectedAthletes) {
      if (!a?.name) continue;
      const existingId = resolveAthleteId(a.name, a.original_text);
      if (existingId) {
        const rosterAthlete = allAthletesList.find((r: any) => r.id === existingId);
        if (!existingMatches.find(m => m.id === existingId)) {
          existingMatches.push({ name: rosterAthlete?.full_name || a.name, id: existingId });
        }
      } else {
        const suggestedName = looksLikeHandle(a.original_text)
          ? String(a.original_text).replace(/^@/, "")
          : a.name;
        newAthletes.push({ name: suggestedName, sport: a.sport || "Da definire", original_text: a.original_text || a.name });
      }
    }

    const brandName = normalizeName(campaign.brand || "");
    const seenEnrichedNames = new Set<string>();
    const enrichedNewAthletes: any[] = [];

    for (const a of newAthletes) {
      const name = String(a.name || "").trim();
      if (!name) continue;
      const normalizedKey = normalizeName(name);
      if (brandName && (normalizedKey === brandName || normalizedKey.includes(brandName) || brandName.includes(normalizedKey))) continue;
      if (seenEnrichedNames.has(normalizedKey)) continue;
      if (nameToId[normalizedKey]) continue;
      let matchedExisting = false;
      const handleCands = extractHandleCandidates(name, a.original_text);
      for (const h of handleCands) {
        if (handleToId[h]) { matchedExisting = true; break; }
      }
      if (matchedExisting) continue;
      seenEnrichedNames.add(normalizedKey);
      enrichedNewAthletes.push({
        name,
        original_name: a.original_text || name,
        sport: a.sport || "Da definire",
        instagram_handle: null,
        tiktok_handle: null,
        youtube_handle: null,
      });
    }

    if (dry_run) {
      const cacheKey = `${profile.agency_id}/cache/${crypto.randomUUID()}.json`;
      await admin.storage.from("contracts").upload(cacheKey, JSON.stringify(parsed), {
        contentType: "application/json",
        upsert: true,
      });

      return new Response(JSON.stringify({
        needs_confirmation: enrichedNewAthletes.length > 0,
        cache_key: cacheKey,
        new_athletes: enrichedNewAthletes,
        existing_athletes: existingMatches,
        brand: campaign.brand || "N/D",
        deliverables_count: (parsed.deliverables || []).length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let athletesCreated = 0;
    const athletesToCreate = Array.isArray(confirmed_athletes) ? confirmed_athletes : newAthletes;

    for (const a of athletesToCreate) {
      if (!a?.name) continue;
      const key = normalizeName(a.name);
      if (nameToId[key]) continue;

      const { data: newAthlete, error } = await admin
        .from("athletes")
        .insert({
          agency_id: profile.agency_id,
          full_name: a.name,
          sport: a.sport || "Da definire",
          instagram_handle: a.instagram_handle || null,
          tiktok_handle: a.tiktok_handle || null,
          youtube_handle: a.youtube_handle || null,
          status: "active",
        })
        .select("id")
        .single();

      if (!error && newAthlete?.id) {
        athletesCreated++;
        nameToId[key] = newAthlete.id;
        if (a.original_name) {
          const origKey = normalizeName(a.original_name);
          if (origKey && origKey !== key) nameToId[origKey] = newAthlete.id;
        }
        if (a.instagram_handle) handleToId[normalizeHandle(a.instagram_handle)] = newAthlete.id;
        if (a.tiktok_handle) handleToId[normalizeHandle(a.tiktok_handle)] = newAthlete.id;
        if (a.youtube_handle) handleToId[normalizeHandle(a.youtube_handle)] = newAthlete.id;
      }
    }

    const toInsert = parsed.deliverables.map((d: any) => {
      const name = d.athlete_name ? String(d.athlete_name) : "";
      let athleteId = resolveAthleteId(name, undefined, [d?.description, d?.ai_overview]);
      if (!athleteId) {
        const key = normalizeName(name);
        if (key && nameToId[key]) athleteId = nameToId[key];
      }

      return {
        campaign_id: campaign.id,
        athlete_id: athleteId || null,
        content_type: d.content_type || "post",
        scheduled_date: d.scheduled_date || null,
        description: d.description || null,
        ai_overview: d.ai_overview || null,
      };
    });

    // Filter out deliverables with no athlete_id (log warning)
    const validInserts = toInsert.filter((d: { athlete_id: string | null }) => {
      if (!d.athlete_id) {
        console.warn("Skipping deliverable with null athlete_id:", d);
        return false;
      }
      return true;
    });

    // Save old IDs before inserting new ones
    const { data: oldDeliverables } = await admin.from("campaign_deliverables").select("id").eq("campaign_id", campaign.id);
    const oldIds = (oldDeliverables || []).map((d: { id: string }) => d.id);

    // Insert new deliverables FIRST
    const { error: insertErr } = await admin.from("campaign_deliverables").insert(validInserts);
    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error("Errore salvataggio deliverable");
    }

    // Only delete old deliverables after successful insert
    if (oldIds.length > 0) {
      const { error: cleanupErr } = await admin.from("campaign_deliverables").delete().in("id", oldIds);
      if (cleanupErr) console.warn("Cleanup of old deliverables failed (non-critical):", cleanupErr);
    }

    return new Response(JSON.stringify({
      success: true,
      count: toInsert.length,
      deliverables: parsed.deliverables,
      athletes_created: athletesCreated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const traceId = crypto.randomUUID();
    console.error("[parse-brief] fatal", { trace_id: traceId, message: e instanceof Error ? e.message : "unknown" });
    return new Response(
      JSON.stringify({ code: "INTERNAL", message: "Errore interno.", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
