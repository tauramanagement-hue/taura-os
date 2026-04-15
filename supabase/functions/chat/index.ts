import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAnthropic } from "../_shared/anthropic.ts";
import { routeRequest } from "../_shared/llm-router.ts";
import { convertAnthropicStreamToOpenAI, convertGeminiStreamToOpenAI } from "../_shared/stream-converter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Expose-Headers": "X-Model-Tier, X-Model-Score, X-Model-Name",
};

const normalizeText = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
  luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12,
};

const extractDateFromText = (text: string) => {
  const input = text.slice(0, 500);
  // Try numeric formats first: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const numeric = input.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (!day || !month || day > 31 || month > 12 || year < 2020 || year > 2035) return null;
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }
  // Try Italian format: "1 aprile", "15 maggio 2026", etc.
  const italian = input.toLowerCase().match(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?\b/);
  if (italian) {
    const day = Number(italian[1]);
    const month = ITALIAN_MONTHS[italian[2]];
    const year = italian[3] ? Number(italian[3]) : new Date().getFullYear();
    if (!day || !month || day > 31 || year < 2020 || year > 2035) return null;
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }
  return null;
};

const detectContentType = (text: string): string | null => {
  const t = normalizeText(text);
  if (/\breel\b/.test(t)) return "reel";
  if (/\bpost\b/.test(t)) return "post";
  if (/\bstory\b/.test(t)) return "story";
  if (/\btiktok\b/.test(t)) return "tiktok";
  if (/\byoutube\b/.test(t)) return "youtube";
  return null;
};

const QUESTION_WORDS = /\b(cosa|come|perche|quando|chi|dove|quale|quanti|quanto|dimmi|mostrami|dammi|hai|ce\b|elenca|lista|manca|mancano|ancora|quanti|dammi|fammi)\b/;

const detectDeliverableStatusIntent = (
  message: string,
  recentMessages?: Array<{ role: string; content: unknown }>
): { field: "content_approved" | "post_confirmed"; value: boolean } | null => {
  const text = normalizeText(message);
  if (message.includes("?")) return null;

  // Negative checks first (order matters)
  if (/\b(non approvat|non approvato|bocciat|rifiutat)/.test(text)) return { field: "content_approved", value: false };
  if (/\b(non pubblicat|non postato?|da pubblicare|non ancora post)/.test(text)) return { field: "post_confirmed", value: false };

  // Positive checks — explicit verb
  if (/\b(ok approv|approvato?|approvare|approva\b|flagga.*approv|segna.*approv)/.test(text)) return { field: "content_approved", value: true };
  if (/\b(pubblicato?|postato?|andato online|e online|flagga.*post|segna.*post|metti.*post|marca.*post|segnalo come post)/.test(text)) return { field: "post_confirmed", value: true };

  // Implicit shorthand: short message with a date, no question words, no other commands
  // e.g. "sofia marchetti x zalando 15/05" after a flagging conversation
  const isQuestion = QUESTION_WORDS.test(text);
  const hasDate = extractDateFromText(message) !== null;
  const isShort = message.trim().length < 100;
  if (!isQuestion && hasDate && isShort && recentMessages) {
    const recentCtx = recentMessages
      .slice(-8)
      .map((m) => normalizeText(String(m.content || "")))
      .join(" ");
    if (/flagga|postato|pubblicato|da pubblicare|manca|mancano|segnalo/.test(recentCtx)) {
      return { field: "post_confirmed", value: true };
    }
  }

  return null;
};

// Helper: stream a plain text message as SSE without calling any LLM
function streamDirectText(text: string, headers: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
      ));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, {
    headers: { ...headers, "Content-Type": "text/event-stream", "X-Model-Tier": "L0", "X-Model-Score": "0", "X-Model-Name": "direct" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { messages } = await req.json();

    // ── Detect status-update intent early, before any expensive work ──
    const latestUserMsg = messages?.[messages.length - 1]?.role === "user"
      ? String(messages[messages.length - 1].content || "")
      : "";
    const statusIntent = latestUserMsg ? detectDeliverableStatusIntent(latestUserMsg, messages) : null;

    // If this is a status-update command → fast path: minimal fetch + update + direct SSE (no LLM)
    if (statusIntent) {
      try {
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.replace("Bearer ", "");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user } } = await adminClient.auth.getUser(token);

        if (user) {
          const { data: profile } = await adminClient
            .from("profiles").select("agency_id").eq("id", user.id).single();

          if (profile?.agency_id) {
            const agencyId = profile.agency_id;
            const campaignIds = (
              await adminClient.from("campaigns").select("id").eq("agency_id", agencyId)
            ).data?.map((c: { id: string }) => c.id) || [];

            // Minimal fetch: only what's needed for matching + update
            const [athletesRes, deliverablesRes] = await Promise.all([
              adminClient.from("athletes").select("id, full_name").eq("agency_id", agencyId),
              adminClient.from("campaign_deliverables")
                .select("id, content_type, scheduled_date, athlete_id, athletes(full_name), campaign_id, campaigns(brand, name)")
                .in("campaign_id", campaignIds),
            ]);

            const athletes      = athletesRes.data      || [];
            const deliverables  = deliverablesRes.data  || [];
            const normalizedMsg = normalizeText(latestUserMsg);
            const dateInMsg     = extractDateFromText(latestUserMsg);
            const ctypeInMsg    = detectContentType(latestUserMsg);

            // Build a combined search string from the last 4 user messages for context look-back
            const recentUserText = (messages || [])
              .filter((m: { role: string }) => m.role === "user")
              .slice(-4)
              .map((m: { content: string }) => String(m.content || ""))
              .join(" ");
            const normalizedRecent = normalizeText(recentUserText);

            const matchInText = (norm: string, searchIn: string) => {
              if (!norm) return false;
              const tokens = norm.split(" ").filter((t: string) => t.length > 2);
              if (tokens.length === 0) return false;
              return tokens.filter((t: string) => searchIn.includes(t)).length >= Math.min(2, tokens.length);
            };

            // First try to match athlete in current message; fall back to recent conversation context
            let athleteCandidates = athletes
              .map((a: { id: string; full_name?: string }) => ({ ...a, norm: normalizeText(a.full_name || "") }))
              .filter((a: { id: string; norm: string }) => matchInText(a.norm, normalizedMsg))
              .map((a: { id: string }) => a.id);

            if (athleteCandidates.length === 0) {
              athleteCandidates = athletes
                .map((a: { id: string; full_name?: string }) => ({ ...a, norm: normalizeText(a.full_name || "") }))
                .filter((a: { id: string; norm: string }) => matchInText(a.norm, normalizedRecent))
                .map((a: { id: string }) => a.id);
            }

            const filterCount = (athleteCandidates.length > 0 ? 1 : 0) + (dateInMsg ? 1 : 0) + (ctypeInMsg ? 1 : 0);

            if (filterCount === 0) {
              return streamDirectText(
                "Quale deliverable intendi? Specifica atleta e/o data (es. *\"flagga come postato il reel di Sofia del 08/05\"*).",
                corsHeaders,
              );
            }

            if (athleteCandidates.length > 1) {
              const names = athletes
                .filter((a: { id: string }) => athleteCandidates.includes(a.id))
                .map((a: { full_name?: string }) => a.full_name).join(", ");
              return streamDirectText(
                `Ho trovato più atleti corrispondenti: **${names}**. Specifica il nome completo.`,
                corsHeaders,
              );
            }

            const toUpdate = deliverables.filter((d: { athlete_id: string; scheduled_date?: string; content_type?: string }) => {
              const matchAthlete = athleteCandidates.length ? athleteCandidates.includes(d.athlete_id) : true;
              const matchDate    = dateInMsg  ? String(d.scheduled_date || "").startsWith(dateInMsg) : true;
              const matchType    = ctypeInMsg ? (d.content_type || "").toLowerCase().includes(ctypeInMsg.toLowerCase()) : true;
              return matchAthlete && matchDate && matchType;
            });

            if (toUpdate.length === 0) {
              return streamDirectText(
                "Non ho trovato deliverable corrispondenti. Specifica atleta e data (es. *\"reel di Sofia del 08/05\"*).",
                corsHeaders,
              );
            }

            if (toUpdate.length > 5) {
              return streamDirectText(
                `Il filtro corrisponde a **${toUpdate.length} deliverable**. Restringi la ricerca con atleta + data + tipo contenuto.`,
                corsHeaders,
              );
            }

            const updateIds = toUpdate.map((d: { id: string }) => d.id);
            const { error: updateErr } = await adminClient
              .from("campaign_deliverables")
              .update({ [statusIntent.field]: statusIntent.value })
              .in("id", updateIds);

            if (updateErr) {
              console.error("fast-path update error:", updateErr);
              return streamDirectText("⚠️ Errore aggiornamento. Riprova tra un momento.", corsHeaders);
            }

            const fieldLabel = statusIntent.field === "post_confirmed"
              ? (statusIntent.value ? "pubblicato" : "non pubblicato")
              : (statusIntent.value ? "approvato" : "non approvato");

            const formatDate = (iso?: string) => {
              if (!iso) return "?";
              const [y, m, d] = iso.split("-");
              return `${d}/${m}/${y}`;
            };

            const lines = toUpdate.map((d: { content_type?: string; scheduled_date?: string; athletes?: { full_name?: string }; campaigns?: { brand?: string } }) =>
              `• **${d.content_type}** · ${d.athletes?.full_name || "?"} × ${d.campaigns?.brand || "?"} · 📅 ${formatDate(d.scheduled_date)}`
            ).join("\n");

            const emoji = statusIntent.value ? "✅" : "↩️";
            const confirmMsg = `${emoji} ${toUpdate.length === 1 ? "Contenuto" : `${toUpdate.length} contenuti`} segnati come **${fieldLabel}**:\n\n${lines}`;

            console.log(`[chat] fast-path update: ${updateIds.length} deliverables → ${statusIntent.field}=${statusIntent.value}`);
            return streamDirectText(confirmMsg, corsHeaders);
          }
        }
      } catch (fastErr) {
        console.error("fast-path error:", fastErr);
        // Fall through to normal path
      }
    }

    let contextBlock = "";
    let agencyPlan = "free";
    try {
      const authHeader = req.headers.get("authorization") || "";
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const token = authHeader.replace("Bearer ", "");

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: { user } } = await adminClient.auth.getUser(token);

      // Auth check: return 401 so the frontend can show a clear "refresh session" message
      if (!user) {
        return new Response(JSON.stringify({ error: "Sessione scaduta" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("agency_id, full_name, role, agencies(name, sport_sector, plan)")
          .eq("id", user.id)
          .single();

        if (profile?.agency_id) {
          const agencyId = profile.agency_id;
          agencyPlan = (profile as { agencies?: { plan?: string } }).agencies?.plan || "free";

          const campaignIds = (await adminClient.from("campaigns").select("id").eq("agency_id", agencyId)).data?.map((c: { id: string }) => c.id) || [];

          const [athletesRes, contractsRes, conflictsRes, notificationsRes, campaignsRes, deliverablesRes] = await Promise.all([
            adminClient.from("athletes").select("id, full_name, sport, category, status, instagram_followers").eq("agency_id", agencyId),
            adminClient.from("contracts").select("id, brand, contract_type, value, currency, start_date, end_date, status, exclusivity_category, athlete_id, athletes(full_name)").eq("agency_id", agencyId),
            adminClient.from("conflicts").select("*").eq("agency_id", agencyId).eq("status", "open"),
            adminClient.from("notifications").select("*").eq("agency_id", agencyId).eq("is_read", false).limit(5),
            adminClient.from("campaigns").select("id, name, brand, status, start_date, end_date").eq("agency_id", agencyId),
            adminClient.from("campaign_deliverables").select("id, content_type, scheduled_date, description, ai_overview, content_approved, post_confirmed, athlete_id, athletes(full_name), campaign_id, campaigns(name, brand)").in("campaign_id", campaignIds),
          ]);

          const athletes = athletesRes.data || [];
          const contracts = contractsRes.data || [];
          const conflicts = conflictsRes.data || [];
          const notifications = notificationsRes.data || [];
          const campaignsData = campaignsRes.data || [];
          let deliverablesData = deliverablesRes.data || [];
          const today = new Date().toISOString().split("T")[0];
          let updateResultBlock = "";

          const deadlines = contracts
            .map((c: { end_date: string; athletes?: { full_name?: string }; brand?: string }) => ({
              ...c,
              days_left: Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
              athlete_name: (c as { athletes?: { full_name?: string } }).athletes?.full_name,
            }))
            .sort((a: { days_left: number }, b: { days_left: number }) => a.days_left - b.days_left);

          const unpostedDeliverables = deliverablesData.filter((d: { post_confirmed?: boolean }) => !d.post_confirmed);
          const postedDeliverables = deliverablesData.filter((d: { post_confirmed?: boolean }) => d.post_confirmed);

          // Context size cap: truncate brief text for large rosters to avoid token overflow
          const MAX_CONTEXT_CHARS = 14000;
          const isLargeRoster = athletes.length > 50 || deliverablesData.length > 80;

          const rosterStr = isLargeRoster
            ? athletes.slice(0, 60).map((a: { full_name?: string; sport?: string }) => `${a.full_name} (${a.sport})`).join(", ") + (athletes.length > 60 ? ` ... e altri ${athletes.length - 60}` : "")
            : athletes.map((a: { full_name?: string; sport?: string }) => `${a.full_name} (${a.sport})`).join(", ") || "Nessuno";

          const formatDeliverable = (d: { athletes?: { full_name?: string }; campaigns?: { name?: string; brand?: string }; content_type?: string; scheduled_date?: string; content_approved?: boolean; ai_overview?: string }, idx: number, total: number) => {
            const brief = isLargeRoster ? (d.ai_overview || "N/D").slice(0, 60) : (d.ai_overview || "N/D");
            return `[${idx + 1}/${total}] ${d.athletes?.full_name || "?"} × ${d.campaigns?.brand || "?"} | ${d.content_type} | Data: ${d.scheduled_date || "?"} | Approvato:${d.content_approved ? "✓" : "✗"} | Brief: ${brief}`;
          };

          contextBlock = `${updateResultBlock}
--- DATI AGENZIA (${today}) ---
Agenzia: ${(profile as { agencies?: { name?: string; sport_sector?: string } }).agencies?.name || "N/D"} | Settore: ${(profile as { agencies?: { sport_sector?: string } }).agencies?.sport_sector || "N/D"}
ENTITA PRESENTI NEL DATABASE: ${athletes.length} atleti, ${contracts.length} contratti, ${conflicts.length} conflitti, ${campaignsData.length} campagne, ${deliverablesData.length} deliverable totali (${unpostedDeliverables.length} non pubblicati, ${postedDeliverables.length} pubblicati)
IMPORTANTE: Rispondi SOLO riguardo alle entita elencate qui sotto. Se un atleta, brand, contratto o deliverable non e presente in questi dati, di' esplicitamente "Non ho questo dato nel database."

ROSTER (${athletes.length} atleti): ${rosterStr}

SCADENZE CONTRATTI (entro 90gg): ${deadlines.filter((c: { days_left: number }) => c.days_left >= 0 && c.days_left <= 90).map((c: { athlete_name?: string; brand?: string; days_left: number }) => `${c.athlete_name}×${c.brand} ${c.days_left}gg`).join(" | ") || "Nessuna"}

CONFLITTI (${conflicts.length}): ${conflicts.map((c: { severity?: string; description?: string }) => `[${c.severity}] ${c.description}`).join(" | ") || "Nessuno"}

CAMPAGNE (${campaignsData.length}): ${campaignsData.map((c: { name?: string; brand?: string; status?: string }) => `${c.name} (${c.brand}, ${c.status})`).join(" | ") || "Nessuna"}

DELIVERABLE NON PUBBLICATI — TOTALE ESATTO: ${unpostedDeliverables.length} righe. Elencale TUTTE, non saltare nessuna anche se sembrano simili tra loro.
${unpostedDeliverables.map((d: any, idx: number) => formatDeliverable(d, idx, unpostedDeliverables.length)).join("\n") || "Nessuno"}

DELIVERABLE PUBBLICATI (${postedDeliverables.length} totali):
${postedDeliverables.map((d: { athletes?: { full_name?: string }; campaigns?: { name?: string; brand?: string }; content_type?: string; scheduled_date?: string }) => `- ${d.athletes?.full_name || "?"} × ${d.campaigns?.brand || "?"} (${d.campaigns?.name || "?"}) | ${d.content_type} | ${d.scheduled_date || "?"}`).join("\n") || "Nessuno"}
---`;

          // Final safety: truncate context block if still too large
          if (contextBlock.length > MAX_CONTEXT_CHARS) {
            contextBlock = contextBlock.slice(0, MAX_CONTEXT_CHARS) + "\n... [contesto troncato per limiti di dimensione]";
          }
        }
      }
    } catch (ctxErr) {
      console.error("Context fetch error:", ctxErr);
    }

    const planToTier = (plan: string): "starter" | "professional" | "enterprise" => {
      if (plan === "enterprise") return "enterprise";
      if (plan === "professional" || plan === "pro") return "professional";
      return "starter";
    };

    const routing = routeRequest({
      text: latestUserMsg,
      hasAttachment: false,
      conversationLength: messages?.length ?? 0,
      userTier: planToTier(agencyPlan ?? "free"),
    });

    console.log(`[chat] ${routing.level} (score:${routing.score}) model=${routing.model} | len=${latestUserMsg.length}`);

    const now = new Date();
    const dayNames = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
    const todayStr = now.toISOString().split("T")[0];
    const dayOfWeek = dayNames[now.getDay()];
    const dayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - dayIdx);
    const thisSunday = new Date(thisMonday); thisSunday.setDate(thisMonday.getDate() + 6);
    const nextMonday = new Date(thisMonday); nextMonday.setDate(thisMonday.getDate() + 7);
    const nextSunday = new Date(nextMonday); nextSunday.setDate(nextMonday.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const depthInstruction = routing.level === "L1"
      ? "Rispondi in modo ultra-breve: 1-2 frasi max."
      : routing.level === "L3"
        ? "Rispondi in modo approfondito con analisi strategica, pro/contro, e raccomandazioni concrete."
        : "Rispondi in modo chiaro e operativo, con dettagli sufficienti.";

    const systemPrompt = `Sei Taura AI, assistente operativo per agenzie di management sportivo/talent.

LINGUA: Italiano. Valori in €XX.XXX, date DD/MM/YYYY.

REGOLE BASE:
- Usa SOLO i dati del blocco DATI AGENZIA sotto. NON inventare, NON stimare, NON aggiungere info esterne.
- Se il blocco DATI AGENZIA e assente: rispondi "⚠️ Sessione non caricata. Ricarica la pagina o effettua di nuovo il login."
- Se una campagna, atleta o brand non e presente nel blocco dati, dillo chiaramente.
- Segnala conflitti con ⚠️.
- MAI troncare un elenco. Se ci sono 6 deliverable non pubblicati, elencane 6.

---
## FORMATO RISPOSTA — LISTA DELIVERABLE
Quando l'utente chiede cosa manca da postare, cosa e in scadenza, o deliverable pendenti per una campagna/talent, usa SEMPRE questo formato per ogni deliverable:

**[Tipo contenuto]** — 📅 GG/MM/YYYY
✅ Approvato / ❌ Da approvare
[Se ai_overview presente]: 💬 _"[testo istruzioni]"_
[Se ai_overview assente]: _(nessuna istruzione specifica nel brief)_

Intestazione risposta: una riga riassuntiva es. "**Sofia Marchetti × Zalando** — 6 contenuti da pubblicare:"
Ordina per data crescente. Nessun testo extra tra i blocchi.

---
## FORMATO RISPOSTA — BRIEF WHATSAPP
Quando l'utente chiede dettagli su un contenuto specifico per istruire il talent (es. "cosa dico al talent per le stories?", "mandami il brief per il reel", "cosa deve fare per X"), raccogli TUTTI i dati disponibili nel blocco (ai_overview del deliverable, obblighi contrattuali social_obligations, descrizione campagna) e rispondi con un messaggio PRONTO DA COPIARE su WhatsApp, nel formato:

---
📋 *[Campagna] — [Tipo contenuto] | [Data]*

Ciao [NomeTalent]! 👋

Ecco le istruzioni per il contenuto [Brand]:

[Istruzioni dettagliate dal brief ai_overview, scritte in modo chiaro e diretto per il talent]

📌 *Dettagli tecnici:*
• Formato: [tipo: Reel / Post / Story / TikTok]
• Da pubblicare entro: [data GG/MM/YYYY]
• Tag obbligatori: [ricava dal brief o dal contratto]
• Caption/copy: [se presente nel brief]
• Hashtag: [se presenti]
[Se obblighi contratto rilevanti]: • Note contratto: [social_obligations rilevante]

Fammi sapere se hai domande! 🙏
---

Dopo il blocco, aggiungi una riga: _"Copiato dal brief · verifica prima di inviare"_

---
## COMPLETEZZA LISTE:
- Includi TUTTI gli elementi richiesti, inclusi quelli con scadenza passata.
- I deliverable nel blocco dati sono numerati [1/N], [2/N] ecc. — ogni numero e un deliverable DISTINTO. NON unire o saltare righe anche se hanno lo stesso tipo di contenuto o lo stesso atleta.
- Conta sempre i totali: se il blocco dice "TOTALE ESATTO: 3", la tua lista deve avere 3 voci.

PROFONDITA: ${depthInstruction}

DATA E CALENDARIO:
- Oggi: ${todayStr} (${dayOfWeek})
- Questa settimana: ${fmt(thisMonday)} (Lun) → ${fmt(thisSunday)} (Dom)
- Prossima settimana: ${fmt(nextMonday)} (Lun) → ${fmt(nextSunday)} (Dom)
- Quando l'utente dice "settimana prossima" intende ${fmt(nextMonday)} → ${fmt(nextSunday)}, NON questa settimana.
- Quando dice "questa settimana" intende ${fmt(thisMonday)} → ${fmt(thisSunday)}.

${contextBlock}`;

    const response = await callAnthropic({
      level: routing.level,
      system: systemPrompt,
      messages,
      stream: true,
      max_tokens: routing.level === "L3" ? 8192 : routing.level === "L2" ? 4096 : 2048,
      temperature: routing.level === "L1" ? 0.2 : routing.level === "L2" ? 0.15 : 0.1,
    });

    const provider = response.headers.get("X-AI-Provider");
    const outputStream =
      provider === "anthropic" && response.body
        ? convertAnthropicStreamToOpenAI(response.body)
        : provider === "gemini" && response.body
          ? convertGeminiStreamToOpenAI(response.body)
          : response.body!;

    return new Response(outputStream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Model-Tier": routing.level,
        "X-Model-Score": String(routing.score),
        "X-Model-Name": routing.model,
      },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
