import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropic, MODELS } from "../_shared/anthropic.ts";
import { parseGeminiJsonResponse } from "../_shared/gemini.ts";
import { validateMagicBytes } from "../_shared/file-validation.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const toIsoDate = (d: Date) => d.toISOString().split("T")[0];

const base64FromBytes = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

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

/** Levenshtein distance for fuzzy matching */
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

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { file_url, original_name, source, dry_run, extracted_data, confirmed_athletes, cache_key } = body;
    if (!file_url) throw new Error("file_url required");

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

    // --- AI EXTRACTION (skip if extracted_data or cache_key provided) ---
    let parsed: any;

    if (extracted_data) {
      parsed = extracted_data;
    } else if (cache_key) {
      // Read cached parsed data from storage
      const { data: cachedFile, error: cacheErr } = await admin.storage.from("contracts").download(cache_key);
      if (cacheErr || !cachedFile) throw new Error("Cache non trovata: " + (cacheErr?.message || ""));
      parsed = JSON.parse(await cachedFile.text());
      // Clean up cache file
      await admin.storage.from("contracts").remove([cache_key]);
    } else {
      const { data: fileData, error: dlErr } = await admin.storage.from("contracts").download(file_url);
      if (dlErr || !fileData) throw new Error("Impossibile scaricare: " + (dlErr?.message || ""));

      const arrayBuffer = await fileData.arrayBuffer();
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        return new Response(JSON.stringify({ error: "File troppo grande (max 20MB)." }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bytes = new Uint8Array(arrayBuffer);

      // Magic-bytes check before passing bytes to the LLM — stops renamed
      // executables / mismatched extensions from reaching Gemini.
      const fname = String(original_name || file_url).split("/").pop() ?? "";
      const magic = validateMagicBytes(bytes, fname);
      if (!magic.ok) {
        console.warn(`[parse-contract] magic-bytes rejected ${fname}: ${magic.reason}`);
        return new Response(
          JSON.stringify({
            code: "INVALID_FILE_TYPE",
            message: "Il contenuto del file non corrisponde all'estensione.",
          }),
          { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const base64Content = base64FromBytes(bytes);

      const lower = String(original_name || file_url).toLowerCase();
      let mimeType = "application/pdf";
      if (lower.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (lower.endsWith(".doc")) mimeType = "application/msword";
      else if (lower.endsWith(".pptx")) mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mimeType = "image/jpeg";
      else if (lower.endsWith(".png")) mimeType = "image/png";
      else if (lower.endsWith(".webp")) mimeType = "image/webp";

      const { data: athletes } = await admin
        .from("athletes")
        .select("id, full_name, sport, instagram_handle, tiktok_handle, youtube_handle")
        .eq("agency_id", profile.agency_id);
      const rosterList = (athletes || []).map((a: any) => {
        const handles = [a.instagram_handle, a.tiktok_handle, a.youtube_handle].filter(Boolean).map((h: string) => `@${h}`).join(", ");
        return `${a.full_name} (${a.sport})${handles ? ` [handles: ${handles}]` : ""}`;
      }).join("\n");

      const { data: existingContracts } = await admin
        .from("contracts")
        .select("id, brand, contract_type, exclusivity_category, exclusivity_territory, start_date, end_date, athlete_id, athletes(full_name)")
        .eq("agency_id", profile.agency_id);

      const systemPrompt = `Sei un avvocato esperto in contratti di sponsorizzazione sportiva e talent management. Analizza il documento con MASSIMA PRECISIONE (target: 98% accuratezza).

ROSTER AGENZIA (nome completo | sport | handle social):
${rosterList || "(roster vuoto)"}

CONTRATTI ESISTENTI:
${(existingContracts || [])
  .map((c: any) => `- ${c.athletes?.full_name}: ${c.brand} (${c.contract_type}) | Esclusività: ${c.exclusivity_category || "N/D"} | ${c.start_date} → ${c.end_date}`)
  .join("\n") || "(nessuno)"}

## ISTRUZIONI DI ANALISI

### CLASSIFICAZIONE
- "contract" = accordo legale vincolante tra brand e talent (sponsorship, endorsement, licensing, ambassadorship, collaborazione)
- "brief" = documento operativo/creativo per una campagna (istruzioni, deliverable, timeline, guidelines)

### IDENTIFICAZIONE TALENT
REGOLE FONDAMENTALI:
1. TALENT = le persone fisiche che prestano la propria immagine/servizio al brand. NON sono talent: il brand stesso, l'agenzia, i referenti aziendali, i legali, i manager.
2. Cerca nel roster: confronta OGNI nome, handle (@username), soprannome con il roster sopra. Se trovi corrispondenza, usa il NOME COMPLETO dal roster.
3. Se il documento menziona handle social (es. "@iolediba", "iolediba"), cerca nel roster chi ha quell'handle tra instagram_handle, tiktok_handle, youtube_handle.
4. NON INVENTARE talent. Se un nome non è matchabile con certezza, riportalo esattamente come nel documento.
5. ESCLUDI SEMPRE: nomi di brand, aziende, agenzie, referenti commerciali, avvocati, manager.

### ESTRAZIONE DATI - LEGGI IL DOCUMENTO PAROLA PER PAROLA
Per ogni campo, estrai il dato ESATTO dal testo del documento:
- "value": il compenso TOTALE in numero (es. 50000). Se ci sono più pagamenti, SOMMA tutti. Se il valore è "50.000€" estrai 50000.
- "currency": la valuta (EUR, USD, GBP). Default EUR se non specificato.
- "start_date" / "end_date": date in formato YYYY-MM-DD. Cerca "decorrenza", "durata", "validità", "dal...al...", "efficacia". Se c'è solo durata (es. "12 mesi"), calcola end_date da start_date.
- "contract_type": classifica come sponsorship, endorsement, licensing, ambassadorship, collaborazione, altro.
- "exclusivity_category": la CATEGORIA MERCEOLOGICA di esclusiva (es. "bevande energetiche", "abbigliamento sportivo", "automotive"). Cerca "esclusiva", "esclusività", "non-compete", "categoria merceologica".
- "exclusivity_territory": il territorio di esclusiva (es. "Italia", "Europa", "Worldwide"). Cerca "territorio", "area geografica".
- "obligations": obblighi contrattuali principali del talent. Riassumi in modo chiaro.
- "social_obligations": obblighi specifici sui social media. Cerca "post", "story", "reel", "contenuti", "pubblicazioni social".
- "penalties": penali contrattuali. Cerca "penale", "penalità", "inadempimento", "risoluzione anticipata".
- "renewal_clause": clausola di rinnovo. Cerca "rinnovo", "proroga", "tacito rinnovo".
- "image_rights": diritti d'immagine concessi. Cerca "diritti d'immagine", "image rights", "utilizzo immagine", "cessione diritti".

### DELIVERABLES
Elenca TUTTI i contenuti che il talent deve produrre. Per ciascuno:
- "athlete_name": nome REALE del talent (dal roster se matchato)
- "content_type": post, reel, tiktok, story, youtube, evento, shooting, altro
- "scheduled_date": data se specificata, altrimenti null
- "description": cosa deve fare il talent (max 100 caratteri)
- "ai_overview": istruzioni operative dettagliate estratte dal documento

### CONFLITTI
Confronta con i contratti esistenti: cerca sovrapposizioni di esclusività, overlap temporali, cannibalizzazione tra brand concorrenti.

Rispondi SOLO con JSON valido, senza markdown né commenti:
{
  "document_type": "contract",
  "athletes_detected": [{"name": "Nome Cognome", "original_text": "testo esatto dal documento", "matched_from_roster": true, "sport": "sport"}],
  "brand": "Nome Brand ESATTO",
  "campaign_name": null,
  "contract_type": "sponsorship",
  "value": 50000,
  "currency": "EUR",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "exclusivity_category": "categoria",
  "exclusivity_territory": "territorio",
  "obligations": "obblighi",
  "social_obligations": "obblighi social",
  "penalties": "penali",
  "renewal_clause": "clausola rinnovo",
  "image_rights": "diritti immagine",
  "ai_extracted_clauses": {
    "key_terms": ["termine1", "termine2"],
    "payment_schedule": "calendario pagamenti dettagliato",
    "termination_conditions": "condizioni risoluzione",
    "non_compete": "clausole non-compete",
    "other_notes": "altre note rilevanti"
  },
  "deliverables": [{"athlete_name": "Nome", "content_type": "post", "scheduled_date": null, "description": "desc", "ai_overview": "dettagli"}],
  "conflicts_detected": [{"type": "exclusivity", "severity": "high", "description": "desc", "suggestion": "suggerimento"}]
}

ATTENZIONE: Se un campo non è presente nel documento, usa null. Per value usa SOLO numeri interi senza valuta. Leggi OGNI pagina del documento.`;

      const userContent = [
        {
          type: "file",
          file: {
            filename: String(original_name || file_url).split("/").pop(),
            file_data: `data:${mimeType};base64,${base64Content}`,
          },
        },
        { type: "text", text: "Analizza questo documento con la MASSIMA PRECISIONE. Estrai TUTTI i dati contrattuali: valore economico esatto, date precise, obblighi, esclusività, deliverable. Identifica i talent confrontando con il roster. NON includere brand o aziende come talent." },
      ];

      const aiResponse = await callAnthropic({
        model: MODELS.L2_SONNET,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 8192,
        temperature: 0.1,
      });

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
        console.error("Failed to parse:", content);
        const guessedBrand = (original_name ? String(original_name).split("-")[0].trim() : "") || "N/D";
        parsed = {
          document_type: "contract",
          athletes_detected: [],
          brand: guessedBrand,
          contract_type: "Da classificare",
          value: null, currency: "EUR",
          start_date: null, end_date: null,
          obligations: null, social_obligations: null, penalties: null,
          renewal_clause: null, image_rights: null,
          ai_extracted_clauses: { raw_text_fallback: String(content || "").slice(0, 4000) },
          deliverables: [], conflicts_detected: [],
        };
      }
    }

    // --- MATCHING ENGINE ---
    const { data: currentAthletes } = await admin
      .from("athletes")
      .select("id, full_name, sport, instagram_handle, tiktok_handle, youtube_handle")
      .eq("agency_id", profile.agency_id);

    // Build multiple indexes for matching
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

    const aiDetectedAthletes = Array.isArray(parsed.athletes_detected) ? parsed.athletes_detected : [];
    const detectedAthletes: Array<{ name: string; original_text?: string; sport?: string | null }> = [];
    const seenDetected = new Set<string>();

    const pushDetectedAthlete = (name?: string, originalText?: string, sport?: string | null) => {
      const cleanName = String(name || "").trim();
      if (!cleanName) return;
      const key = `${normalizeName(cleanName)}|${normalizeHandle(originalText || "")}`;
      if (seenDetected.has(key)) return;
      seenDetected.add(key);
      detectedAthletes.push({
        name: cleanName,
        original_text: originalText || cleanName,
        sport: sport || null,
      });
    };

    // 1) Keep AI-detected athletes
    aiDetectedAthletes.forEach((a: any) => {
      pushDetectedAthlete(a?.name, a?.original_text, a?.sport);
    });

    // 2) Fallback + reinforcement from handles found in deliverables and contract text
    const handleSources: Array<string | null | undefined> = [
      parsed.obligations,
      parsed.social_obligations,
      ...(Array.isArray(parsed.deliverables)
        ? parsed.deliverables.flatMap((d: any) => [d?.athlete_name, d?.description, d?.ai_overview])
        : []),
    ];

    const ignoredHandles = new Set(["airup", "air_up", "air.up"]);
    const handlesInDocument = extractHandleCandidates(...handleSources);

    for (const handle of handlesInDocument) {
      if (ignoredHandles.has(handle)) continue;
      const existingId = handleToId[handle];

      // Avoid low-confidence unknown short handles (e.g. "@cap")
      if (!existingId && handle.length < 5) continue;

      if (existingId) {
        const athlete = idToAthlete[existingId];
        pushDetectedAthlete(athlete?.full_name || `@${handle}`, `@${handle}`, athlete?.sport || null);
      } else {
        pushDetectedAthlete(`@${handle}`, `@${handle}`, "Da definire");
      }
    }

    const findExistingId = (name: string, originalText?: string): string | null => {
      const key = normalizeName(name);
      if (!key) return null;

      // 1. Exact name match
      if (nameToId[key]) return nameToId[key];

      // 2. Exact handle match (name or original text)
      const handleCandidates = extractHandleCandidates(name, originalText);
      for (const handle of handleCandidates) {
        if (handleToId[handle]) return handleToId[handle];
      }

      // 3. Token-based match (strict)
      const keyTokens = key.split(" ").filter(Boolean);
      if (keyTokens.length >= 2) {
        for (const [n, id] of Object.entries(nameToId)) {
          if (keyTokens.every((t) => n.includes(t))) return id;
        }
      }

      // 4. Conservative fuzzy match (only very close names)
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

      // If the source text looks like a handle, handle evidence is mandatory.
      if (looksLikeHandle(originalText) || looksLikeHandle(detectedName)) {
        return hasHandleEvidence;
      }

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

    const newAthletes: { name: string; sport: string; original_text?: string }[] = [];
    const existingMatches: { name: string; id: string }[] = [];

    for (const a of detectedAthletes) {
      if (!a?.name) continue;
      const existingId = resolveAthleteId(a.name, a.original_text);

      if (existingId) {
        const rosterAthlete = allAthletesList.find((r: any) => r.id === existingId);
        existingMatches.push({ name: rosterAthlete?.full_name || a.name, id: existingId });
      } else {
        const suggestedName = looksLikeHandle(a.original_text)
          ? String(a.original_text).replace(/^@/, "")
          : a.name;
        newAthletes.push({
          name: suggestedName,
          sport: a.sport || "Da definire",
          original_text: a.original_text || a.name,
        });
      }
    }

    // --- Filter: only keep real persons, exclude brands/companies ---
    // NO AI enrichment — LLMs hallucinate identities and follower counts
    // User will verify and fill data in the confirmation popup
    const brandName = normalizeName(parsed.brand || "");
    const seenEnrichedNames = new Set<string>();
    const enrichedNewAthletes: any[] = [];

    for (const a of newAthletes) {
      const name = String(a.name || "").trim();
      if (!name) continue;

      const normalizedKey = normalizeName(name);

      // Skip if it's clearly the brand
      if (brandName && (normalizedKey === brandName || normalizedKey.includes(brandName) || brandName.includes(normalizedKey))) {
        console.log(`Skipping brand name: ${name}`);
        continue;
      }

      // Skip duplicates
      if (seenEnrichedNames.has(normalizedKey)) continue;

      // Skip if already in roster
      if (nameToId[normalizedKey]) {
        const rosterAthlete = idToAthlete[nameToId[normalizedKey]];
        if (rosterAthlete && !existingMatches.find((m: any) => m.id === nameToId[normalizedKey])) {
          existingMatches.push({ name: rosterAthlete.full_name, id: nameToId[normalizedKey] });
        }
        continue;
      }

      // Skip if handle matches roster
      let matchedExisting = false;
      const handleCands = extractHandleCandidates(name, a.original_text);
      for (const h of handleCands) {
        if (handleToId[h]) {
          const rid = handleToId[h];
          const rosterAthlete = idToAthlete[rid];
          if (rosterAthlete && !existingMatches.find((m: any) => m.id === rid)) {
            existingMatches.push({ name: rosterAthlete.full_name, id: rid });
          }
          matchedExisting = true;
          break;
        }
      }
      if (matchedExisting) continue;

      seenEnrichedNames.add(normalizedKey);

      // Present name exactly as detected — user fills real data in popup
      enrichedNewAthletes.push({
        name: name,
        original_name: a.original_text || name,
        sport: a.sport || "Da definire",
        category: null,
        nationality: null,
        instagram_handle: null,
        instagram_followers: null,
        tiktok_handle: null,
        tiktok_followers: null,
        youtube_handle: null,
        youtube_followers: null,
      });
    }

    if (dry_run) {
      // Cache parsed data server-side to avoid sending large payload back
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
        brand: parsed.brand || "N/D",
        deliverables_count: (parsed.deliverables || []).length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- FULL RUN: create athletes, campaign, deliverables, contracts ---
    const effectiveDocumentType = source === "contracts_upload"
      ? "contract"
      : (parsed.document_type === "brief" ? "brief" : "contract");

    const today = toIsoDate(new Date());
    const defaultEnd = toIsoDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

    let athletesCreated = 0;

    // Create confirmed new athletes with enriched data
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
          category: a.category || null,
          nationality: a.nationality || null,
          instagram_handle: a.instagram_handle || null,
          instagram_followers: a.instagram_followers ? Number(a.instagram_followers) : null,
          tiktok_handle: a.tiktok_handle || null,
          tiktok_followers: a.tiktok_followers ? Number(a.tiktok_followers) : null,
          youtube_handle: a.youtube_handle || null,
          youtube_followers: a.youtube_followers ? Number(a.youtube_followers) : null,
          status: "active",
        })
        .select("id")
        .single();

      if (error) {
        console.error("Athlete insert error:", error);
      }

      if (!error && newAthlete?.id) {
        athletesCreated++;
        nameToId[key] = newAthlete.id;
        // Also map original_name and handles
        if (a.original_name) {
          const origKey = normalizeName(a.original_name);
          if (origKey && origKey !== key) nameToId[origKey] = newAthlete.id;
        }
        if (a.instagram_handle) handleToId[normalizeHandle(a.instagram_handle)] = newAthlete.id;
        if (a.tiktok_handle) handleToId[normalizeHandle(a.tiktok_handle)] = newAthlete.id;
        if (a.youtube_handle) handleToId[normalizeHandle(a.youtube_handle)] = newAthlete.id;
      }
    }

    // Build athlete IDs list using reliability-aware matching
    const athleteIds: string[] = [];
    for (const a of detectedAthletes) {
      if (!a?.name) continue;
      const id = resolveAthleteId(a.name, a.original_text);
      if (id && !athleteIds.includes(id)) athleteIds.push(id);
    }
    // Also check existing matches
    for (const m of existingMatches) {
      if (m.id && !athleteIds.includes(m.id)) athleteIds.push(m.id);
    }

    let primaryAthleteId = athleteIds[0] || null;
    const brand = parsed.brand || (original_name ? String(original_name).split("-")[0].trim() : null) || "N/D";

    // Ensure deliverables always get an athlete_id in full run
    if (!primaryAthleteId) {
      const { data: fallbackAthlete, error: fallbackErr } = await admin
        .from("athletes")
        .insert({ agency_id: profile.agency_id, full_name: "Talent da definire", sport: "Da definire", status: "active" })
        .select("id")
        .single();

      if (fallbackErr) {
        console.error("Fallback athlete creation failed before deliverables:", fallbackErr);
      } else if (fallbackAthlete?.id) {
        primaryAthleteId = fallbackAthlete.id;
        if (!athleteIds.includes(fallbackAthlete.id)) athleteIds.unshift(fallbackAthlete.id);
      }
    }

    // Campaign
    const campaignName = (effectiveDocumentType === "brief" ? parsed.campaign_name : null) || brand;

    const { data: newCampaign, error: campErr } = await admin
      .from("campaigns")
      .insert({
        agency_id: profile.agency_id,
        name: campaignName,
        brand,
        description: parsed.obligations || null,
        brief_file_url: file_url,
        status: "active",
        start_date: parsed.start_date || null,
        end_date: parsed.end_date || null,
      })
      .select("id")
      .single();

    if (campErr) {
      console.error("Campaign insert error:", campErr);
      throw campErr;
    }

    console.log("Campaign created:", newCampaign?.id);

    // Deliverables
    let deliverablesInserted = 0;
    if (newCampaign?.id) {
      const aiDeliverables = Array.isArray(parsed.deliverables) ? parsed.deliverables : [];

      const fallbackDeliverables = (athleteIds.length ? athleteIds : [primaryAthleteId].filter(Boolean) as string[]).map((athleteId) => ({
        athlete_id: athleteId,
        content_type: "post",
        scheduled_date: null,
        description: `Contenuto social per ${brand}`,
        ai_overview: parsed.social_obligations || parsed.obligations || `Deliverable generato dal contratto ${brand}`,
      }));

      const sourceDeliverables = aiDeliverables.length
        ? aiDeliverables
        : (effectiveDocumentType === "contract" ? fallbackDeliverables : []);

      if (sourceDeliverables.length) {
        const delsToInsert = [] as any[];

        for (const d of sourceDeliverables) {
          if (d?.athlete_id) {
            delsToInsert.push({
              campaign_id: newCampaign.id,
              athlete_id: d.athlete_id,
              content_type: d?.content_type || "post",
              scheduled_date: d?.scheduled_date || null,
              description: d?.description || null,
              ai_overview: d?.ai_overview || null,
            });
            continue;
          }

          const name = d?.athlete_name ? String(d.athlete_name) : "";
          let athleteId = resolveAthleteId(name, undefined, [d?.description, d?.ai_overview]);

          if (!athleteId && !name) {
            athleteId = resolveAthleteId("", undefined, [d?.description, d?.ai_overview]);
          }

          if (!athleteId) athleteId = primaryAthleteId;

          delsToInsert.push({
            campaign_id: newCampaign.id,
            athlete_id: athleteId,
            content_type: d?.content_type || "post",
            scheduled_date: d?.scheduled_date || null,
            description: d?.description || null,
            ai_overview: d?.ai_overview || null,
          });
        }

        const { error: delErr } = await admin.from("campaign_deliverables").insert(delsToInsert);
        if (!delErr) deliverablesInserted = delsToInsert.length;
        else console.error("Deliverable insert error:", delErr);
      }
    }

    // Brief: no contract to create
    if (effectiveDocumentType === "brief") {
      return new Response(
        JSON.stringify({
          success: true,
          document_type: "brief",
          campaign_id: newCampaign?.id,
          campaign_name: campaignName,
          deliverables_count: deliverablesInserted,
          athletes_created: athletesCreated,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- CONTRACT CREATION ---
    console.log("Creating contract. Athletes:", athleteIds, "Primary:", primaryAthleteId);

    const startDate = parsed.start_date || today;
    const endDate = parsed.end_date || defaultEnd;
    const contractType = parsed.contract_type || "Da classificare";

    const contractBase: any = {
      agency_id: profile.agency_id,
      brand,
      contract_type: contractType,
      value: parsed.value ?? null,
      currency: parsed.currency || "EUR",
      start_date: startDate,
      end_date: endDate,
      file_url,
      status: "active",
      exclusivity_category: parsed.exclusivity_category || null,
      exclusivity_territory: parsed.exclusivity_territory || null,
      obligations: parsed.obligations || null,
      social_obligations: parsed.social_obligations || null,
      penalties: parsed.penalties || null,
      renewal_clause: parsed.renewal_clause || null,
      image_rights: parsed.image_rights || null,
    };

    // Ensure we always have an athlete for the contract
    let targetAthleteId: string;

    if (!primaryAthleteId) {
      console.log("No primary athlete found, creating fallback");
      const { data: fallbackAthlete, error: fbErr } = await admin
        .from("athletes")
        .insert({ agency_id: profile.agency_id, full_name: "Talent da definire", sport: "Da definire", status: "active" })
        .select("id")
        .single();
      if (fbErr) {
        console.error("Fallback athlete creation failed:", fbErr);
        throw new Error("Impossibile creare il talent di fallback");
      }
      targetAthleteId = fallbackAthlete!.id;
      athleteIds.unshift(targetAthleteId);
    } else {
      targetAthleteId = primaryAthleteId;
    }

    const finalAthleteIds = athleteIds.length ? athleteIds : [targetAthleteId];
    const isGroupContract = finalAthleteIds.length > 1;

    if (isGroupContract) {
      const groupKey = normalizeName("Group");
      if (nameToId[groupKey]) {
        targetAthleteId = nameToId[groupKey];
      } else {
        const { data: groupAthlete } = await admin
          .from("athletes")
          .insert({ agency_id: profile.agency_id, full_name: "Group", sport: "Campaign Group", status: "active" })
          .select("id")
          .single();
        if (groupAthlete?.id) {
          nameToId[groupKey] = groupAthlete.id;
          targetAthleteId = groupAthlete.id;
        }
      }
    }

    console.log("Inserting contract with athlete_id:", targetAthleteId);

    const { data: insertedPrimary, error: insErr } = await admin
      .from("contracts")
      .insert({
        ...contractBase,
        athlete_id: targetAthleteId,
        ai_extracted_clauses: {
          ...(parsed.ai_extracted_clauses || {}),
          participants: detectedAthletes.map((a: any) => a?.name).filter(Boolean),
          is_group_contract: isGroupContract,
          participant_athlete_ids: finalAthleteIds,
        },
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("CONTRACT INSERT ERROR:", insErr);
      throw new Error("Errore creazione contratto: " + insErr.message);
    }

    console.log("Contract created successfully:", insertedPrimary?.id);

    // Conflicts
    let conflictsInserted = 0;
    if (insertedPrimary?.id && Array.isArray(parsed.conflicts_detected) && parsed.conflicts_detected.length) {
      const conflictsToInsert = parsed.conflicts_detected
        .filter((c: any) => c?.description)
        .map((c: any) => ({
          agency_id: profile.agency_id,
          contract_a_id: insertedPrimary.id,
          conflict_type: c.type || "exclusivity",
          severity: c.severity || "medium",
          description: c.description,
          suggestion: c.suggestion || null,
          status: "open",
        }));

      if (conflictsToInsert.length) {
        const { error: confErr } = await admin.from("conflicts").insert(conflictsToInsert);
        if (!confErr) conflictsInserted = conflictsToInsert.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_type: "contract",
        contract_id: insertedPrimary?.id,
        campaign_id: newCampaign?.id,
        campaign_name: campaignName,
        contracts_created: 1,
        deliverables_count: deliverablesInserted,
        conflicts_count: conflictsInserted,
        athletes_created: athletesCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const traceId = crypto.randomUUID();
    console.error("[parse-contract] fatal", { trace_id: traceId, message: e instanceof Error ? e.message : "unknown" });
    return new Response(
      JSON.stringify({ code: "INTERNAL", message: "Errore interno.", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
