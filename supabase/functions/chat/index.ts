import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callAnthropic, sanitizeMessages, MODELS } from "../_shared/anthropic.ts";
import { routeRequest } from "../_shared/llm-router.ts";
import { convertAnthropicStreamToOpenAI, convertGeminiStreamToOpenAI } from "../_shared/stream-converter.ts";

// ─── Action tool definitions (Anthropic tool-use format) ──────────────────
const AI_TOOLS = [
  {
    name: "update_deliverable",
    description: "Aggiorna i campi di un campaign_deliverable (data, approvazione, note, metriche). Usa questo tool quando l'utente vuole cambiare la data schedulata, aggiungere note, inserire impressions/reach/engagement, o cambiare lo stato approved/confirmed.",
    input_schema: {
      type: "object",
      properties: {
        deliverable_id: { type: "string", description: "UUID del deliverable" },
        deliverable_hint: { type: "string", description: "Descrizione testuale per trovare il deliverable (es. 'reel Sofia Nike 15 maggio')" },
        fields: {
          type: "object",
          properties: {
            scheduled_date: { type: "string", description: "Nuova data schedulata ISO (YYYY-MM-DD)" },
            content_approved: { type: "boolean" },
            post_confirmed: { type: "boolean" },
            notes: { type: "string" },
            impressions: { type: "number" },
            reach: { type: "number" },
            engagement_rate: { type: "number", description: "Valore tra 0 e 1 (es. 0.045 = 4.5%)" },
          },
        },
      },
      required: ["fields"],
    },
  },
  {
    name: "update_deal_stage",
    description: "Sposta un deal CRM a un nuovo stage. Usa quando l'utente dice 'porta il deal in negotiation', 'chiudi il deal', 'sposta a proposal', ecc.",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "UUID del deal (se noto)" },
        deal_hint: { type: "string", description: "Descrizione testuale per trovare il deal (es. 'deal Nike di Sofia')" },
        stage: {
          type: "string",
          enum: ["inbound", "qualified", "proposal", "negotiation", "signed"],
          description: "Nuovo stage",
        },
        notes: { type: "string", description: "Note opzionali da aggiungere al deal" },
      },
      required: ["stage"],
    },
  },
  {
    name: "create_deal",
    description: "Crea un nuovo deal CRM. Usa quando l'utente vuole aggiungere una nuova opportunità commerciale.",
    input_schema: {
      type: "object",
      properties: {
        athlete_hint: { type: "string", description: "Nome dell'atleta/talent" },
        brand: { type: "string" },
        value: { type: "number", description: "Valore in EUR" },
        deal_type: { type: "string", description: "Tipo deal (es. sponsorship, ambassador, endorsement)" },
        notes: { type: "string" },
        expected_close_date: { type: "string", description: "Data attesa chiusura ISO (YYYY-MM-DD)" },
        stage: {
          type: "string",
          enum: ["inbound", "qualified", "proposal", "negotiation"],
          description: "Stage iniziale (default: inbound)",
        },
      },
      required: ["brand"],
    },
  },
  {
    name: "create_notification",
    description: "Crea una notifica interna per il team dell'agenzia.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Tipo notifica (es. deal, campaign, contract, alert)" },
        title: { type: "string" },
        message: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high"] },
        related_entity_type: { type: "string" },
        related_entity_id: { type: "string" },
      },
      required: ["title", "message"],
    },
  },
  {
    name: "update_contract_field",
    description: "Aggiorna campi testuali di un contratto (status, clausola di rinnovo, note).",
    input_schema: {
      type: "object",
      properties: {
        contract_id: { type: "string", description: "UUID del contratto (se noto)" },
        contract_hint: { type: "string", description: "Descrizione testuale per trovare il contratto (es. 'contratto Nike di Sofia')" },
        fields: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["active", "expired", "terminated", "draft"] },
            renewal_clause: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
      required: ["fields"],
    },
  },
];

// ─── Action intent detection regex ────────────────────────────────────────
// Implemented as a duck-typed object so we can OR two patterns without
// changing the .test() call sites.
const ACTION_INTENT_RE = {
  test: (s: string) =>
    // Direct command forms (imperative)
    /\b(sposta(re)?( il)?( deal| lo stage| contratto)?|porta(re)?( il deal| in stage)?|aggiorna(re)?( il| la| le| lo)?( deal| stage| data| nota| contratto| deliverable| metrics|impressions|reach)?|crea(re)?( un| una)?( deal| notifica)|nuovo deal|inserisci( un)?( deal)|reschedula(re)?|rimanda(re)?|cambia(re)?( la)?( data| lo stage)|modifica(re)?( il| la)?( deal| contratto| nota)|update( deal| stage| contratto))\b/i.test(s) ||
    // Polite / modal / question forms ("puoi spostare", "vorrei aggiornare", "si può cambiare", "come faccio a reschedular")
    /\b(puoi|potresti|vorrei|si\s+pu[oò]|come\s+faccio\s+a)\s+(spostare|aggiornare|cambiare|creare|modificare|reschedular)/i.test(s),
};

// Keywords that indicate the user is asking about FILE CONTENT
const FILE_QUERY_RE =
  /\b(leggi|analizza|apri|mostra il contenuto|cosa (dice|c[''']è nel)|estratto|estratta|testo del|clausole del|brief di|contratto di|media kit di|leggimi|apri il)\b/i;

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

interface CommissionIntent {
  type: "pct" | "fixed";
  value: number;
}

const detectCommissionIntent = (msg: string): CommissionIntent | null => {
  const t = normalizeText(msg);
  if (!/commission/.test(t)) return null;
  if (msg.includes("?")) return null;
  // Percentage: "12%", "12 percento", "al 15%"
  const pctMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:%|percento|pct)/);
  if (pctMatch) {
    const val = parseFloat(pctMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 0 && val <= 100) return { type: "pct", value: val };
  }
  // Fixed: "12000 euro", "12k", "€15000", "15.000 euro"
  const fixedMatch = t.match(/(\d[\d.]*(?:,\d+)?)\s*(k\b|euro|eur)/);
  if (fixedMatch) {
    const raw = fixedMatch[1].replace(/\./g, "").replace(",", ".");
    let val = parseFloat(raw);
    if (!isNaN(val)) {
      if (fixedMatch[2] === "k") val *= 1000;
      if (val > 0) return { type: "fixed", value: val };
    }
  }
  return null;
};

async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  for (const model of ["text-embedding-004", "embedding-001"]) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] } }),
      });
      if (res.status === 404) continue;
      if (!res.ok) return null;
      const data = await res.json();
      const values = data.embedding?.values;
      if (values?.length) return values;
    } catch {
      // try next model
    }
  }
  return null;
}

// ─── Tool execution (post-confirmation) ───────────────────────────────────
interface ToolInput {
  tool: string;
  // update_deliverable
  deliverable_id?: string;
  deliverable_hint?: string;
  deliverable_fields?: Record<string, unknown>;
  // update_deal_stage
  deal_id?: string;
  deal_hint?: string;
  stage?: string;
  // create_deal
  athlete_id?: string;
  athlete_hint?: string;
  brand?: string;
  value?: number;
  deal_type?: string;
  expected_close_date?: string;
  // create_notification
  type?: string;
  title?: string;
  message?: string;
  severity?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  // update_contract_field
  contract_id?: string;
  contract_hint?: string;
  contract_fields?: Record<string, unknown>;
  // shared
  notes?: string;
}

async function executeTool(
  tool: ToolInput,
  agencyId: string,
  userId: string,
  adminClient: SupabaseClient,
): Promise<string> {
  switch (tool.tool) {
    case "update_deliverable": {
      // Resolve ID via hint if needed
      let id = tool.deliverable_id;
      if (!id && tool.deliverable_hint) {
        // Step 1: get campaign IDs scoped to this agency.
        // NOTE: nested .eq("campaigns.agency_id") is silently ignored by Supabase JS
        // without !inner syntax — always do a two-step query instead.
        const { data: agencyCampaigns } = await adminClient
          .from("campaigns")
          .select("id")
          .eq("agency_id", agencyId);
        const campaignIds = (agencyCampaigns ?? []).map((c: { id: string }) => c.id);

        // Step 2: fetch only deliverables belonging to those campaigns
        const { data } = campaignIds.length
          ? await adminClient
              .from("campaign_deliverables")
              .select("id, content_type, scheduled_date, athlete_id, athletes(full_name), campaign_id, campaigns(brand)")
              .in("campaign_id", campaignIds)
          : { data: [] };

        console.log(
          "[executeTool] deliverable hint:", tool.deliverable_hint,
          "| agency campaigns:", campaignIds.length,
          "| deliverables fetched:", (data ?? []).length,
        );

        const hint = normalizeText(tool.deliverable_hint ?? "");
        const hintTokens = hint.split(" ").filter((t: string) => t.length > 2);

        const match = (data || []).find((d: {
          content_type?: string;
          scheduled_date?: string;
          athletes?: { full_name?: string };
          campaigns?: { brand?: string };
        }) => {
          const athleteName = normalizeText((d.athletes as { full_name?: string })?.full_name ?? "");
          const brandName   = normalizeText((d.campaigns as { brand?: string })?.brand ?? "");
          // Match if hint tokens overlap with athlete name OR brand name (more permissive than .every())
          const athleteMatch = hintTokens.some((t: string) => athleteName.includes(t));
          const brandMatch   = hintTokens.some((t: string) => brandName.includes(t));
          return athleteMatch || brandMatch;
        });

        console.log("[executeTool] matched deliverable:", match?.id ?? "none");
        id = match?.id;
      }
      if (!id) return "⚠️ Deliverable non trovato. Specifica atleta, tipo contenuto e data.";
      const { error } = await adminClient
        .from("campaign_deliverables")
        .update(tool.deliverable_fields ?? {})
        .eq("id", id);
      if (error) return `⚠️ Errore aggiornamento: ${error.message}`;
      return `✅ Deliverable aggiornato.`;
    }

    case "update_deal_stage": {
      let id = tool.deal_id;
      if (!id && tool.deal_hint) {
        const { data } = await adminClient
          .from("deals")
          .select("id, brand, athletes(full_name), stage")
          .eq("agency_id", agencyId);
        const hint = normalizeText(tool.deal_hint);
        const match = (data || []).find((d: { brand?: string; athletes?: { full_name?: string }; stage?: string }) => {
          const hay = normalizeText(`${d.brand} ${(d.athletes as { full_name?: string })?.full_name}`);
          return hint.split(" ").filter((t) => t.length > 2).some((t) => hay.includes(t));
        });
        id = match?.id;
      }
      if (!id) return "⚠️ Deal non trovato. Specifica brand e/o atleta.";
      const update: Record<string, unknown> = { stage: tool.stage, updated_at: new Date().toISOString() };
      if (tool.notes) update.notes = tool.notes;
      const { error } = await adminClient.from("deals").update(update).eq("id", id).eq("agency_id", agencyId);
      if (error) return `⚠️ Errore: ${error.message}`;
      return `✅ Stage deal aggiornato a **${tool.stage}**.`;
    }

    case "create_deal": {
      let athleteId = tool.athlete_id;
      if (!athleteId && tool.athlete_hint) {
        const { data } = await adminClient.from("athletes").select("id, full_name").eq("agency_id", agencyId);
        const hint = normalizeText(tool.athlete_hint);
        const match = (data || []).find((a: { full_name?: string }) =>
          normalizeText(a.full_name || "").split(" ").some((t) => hint.includes(t))
        );
        athleteId = match?.id;
      }
      if (!athleteId) return "⚠️ Atleta non trovato nel roster. Specifica il nome completo.";
      const { error } = await adminClient.from("deals").insert({
        agency_id: agencyId,
        athlete_id: athleteId,
        brand: tool.brand ?? "N/D",
        value: tool.value ?? null,
        currency: "EUR",
        deal_type: tool.deal_type ?? null,
        notes: tool.notes ?? null,
        expected_close_date: tool.expected_close_date ?? null,
        stage: tool.stage ?? "inbound",
        probability: 10,
      });
      if (error) return `⚠️ Errore creazione deal: ${error.message}`;
      return `✅ Deal **${tool.brand}** creato in stage **${tool.stage ?? "inbound"}**.`;
    }

    case "create_notification": {
      const { error } = await adminClient.from("notifications").insert({
        agency_id: agencyId,
        user_id: userId,
        type: tool.type ?? "alert",
        title: tool.title ?? "Notifica AI",
        message: tool.message ?? "",
        severity: tool.severity ?? "medium",
        related_entity_type: tool.related_entity_type ?? null,
        related_entity_id: tool.related_entity_id ?? null,
      });
      if (error) return `⚠️ Errore: ${error.message}`;
      return `✅ Notifica **"${tool.title}"** creata.`;
    }

    case "update_contract_field": {
      let id = tool.contract_id;
      if (!id && tool.contract_hint) {
        const { data } = await adminClient
          .from("contracts")
          .select("id, brand, athletes(full_name)")
          .eq("agency_id", agencyId);
        const hint = normalizeText(tool.contract_hint);
        const match = (data || []).find((c: { brand?: string; athletes?: { full_name?: string } }) => {
          const hay = normalizeText(`${c.brand} ${(c.athletes as { full_name?: string })?.full_name}`);
          return hint.split(" ").filter((t) => t.length > 2).some((t) => hay.includes(t));
        });
        id = match?.id;
      }
      if (!id) return "⚠️ Contratto non trovato. Specifica brand e/o atleta.";
      const { error } = await adminClient
        .from("contracts")
        .update(tool.contract_fields ?? {})
        .eq("id", id)
        .eq("agency_id", agencyId);
      if (error) return `⚠️ Errore: ${error.message}`;
      return `✅ Contratto aggiornato.`;
    }

    default:
      return "⚠️ Tool non riconosciuto.";
  }
}

// ─── Detect action intent + call Anthropic tool-use → confirmation JSON ───
async function detectActionAndReturnConfirmation(
  userMsg: string,
  messages: Array<{ role: string; content: unknown }>,
  systemContext: string,
  agencyId: string,
  adminClient: SupabaseClient,
): Promise<Response | null> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return null;

  try {
    // 10s hard timeout — prevents this call from hanging forever when
    // Anthropic is slow or the response shape is unexpected.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    // Call Anthropic non-streaming with tool definitions
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        tools: AI_TOOLS,
        tool_choice: { type: "auto" },
        system: `${systemContext}\n\nSei in modalità ACTION DETECTION. L'utente vuole eseguire una modifica nel sistema. Usa i tool disponibili per strutturare l'azione richiesta. Sii preciso con gli ID o fornisci hint descrittivi se l'ID non è nel contesto.`,
        // Prepare a focused slice for action detection:
        // – keep last 6 turns for context but trim long assistant replies to
        //   500 chars so the model can clearly see the user command
        // – guarantee the slice ends with the current user message so the
        //   model never sees an assistant turn as the last prompt
        messages: sanitizeMessages((() => {
          const rawSlice = messages.slice(-6).map((m: { role: string; content: unknown }) => {
            if (m.role === "assistant" && typeof m.content === "string" && m.content.length > 500) {
              return { ...m, content: m.content.slice(0, 500) };
            }
            return m;
          });
          const lastIsUser = rawSlice.length > 0 && rawSlice[rawSlice.length - 1].role === "user";
          return lastIsUser ? rawSlice : [...rawSlice, { role: "user", content: userMsg }];
        })()),
      }),
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[detectAction] Anthropic ${res.status}:`, errBody.slice(0, 300));
      return null;
    }
    const data = await res.json();

    // Check if LLM chose to call a tool
    const toolUse = data.content?.find((b: { type: string }) => b.type === "tool_use");
    if (!toolUse) return null;

    const toolName: string = toolUse.name;
    const toolInput = toolUse.input ?? {};

    // Get text part (AI explanation)
    const textPart = data.content?.find((b: { type: string }) => b.type === "text");
    const aiMessage = textPart?.text ?? `Vuoi che esegua: ${toolName}?`;

    // Build before/after fields for display
    const fieldsToChange: Array<{ field: string; before: unknown; after: unknown }> = [];

    if (toolName === "update_deal_stage" && toolInput.deal_hint) {
      const { data: deals } = await adminClient
        .from("deals")
        .select("id, brand, stage, athletes(full_name)")
        .eq("agency_id", agencyId);
      const hint = normalizeText(toolInput.deal_hint);
      const match = (deals || []).find((d: { brand?: string; athletes?: { full_name?: string } }) => {
        const hay = normalizeText(`${d.brand} ${(d.athletes as { full_name?: string })?.full_name}`);
        return hint.split(" ").filter((t) => t.length > 2).some((t) => hay.includes(t));
      });
      if (match) {
        toolInput.deal_id = match.id;
        fieldsToChange.push({ field: "stage", before: match.stage, after: toolInput.stage });
      }
    }

    if (toolName === "update_deliverable" && toolInput.fields) {
      Object.entries(toolInput.fields as Record<string, unknown>).forEach(([k, v]) => {
        fieldsToChange.push({ field: k, before: null, after: v });
      });
    }

    if (toolName === "update_contract_field" && toolInput.fields) {
      Object.entries(toolInput.fields as Record<string, unknown>).forEach(([k, v]) => {
        fieldsToChange.push({ field: k, before: null, after: v });
      });
    }

    if (toolName === "create_deal") {
      fieldsToChange.push({ field: "brand", before: null, after: toolInput.brand });
      if (toolInput.value) fieldsToChange.push({ field: "valore", before: null, after: `€${toolInput.value}` });
      if (toolInput.stage) fieldsToChange.push({ field: "stage", before: null, after: toolInput.stage });
    }

    // Map tool name to description
    const toolDescriptions: Record<string, string> = {
      update_deliverable: "Aggiornamento deliverable",
      update_deal_stage: "Aggiornamento stage deal",
      create_deal: "Creazione nuovo deal",
      create_notification: "Creazione notifica",
      update_contract_field: "Aggiornamento contratto",
    };
    const humanDescription = toolDescriptions[toolName] ?? toolName;

    // Build action payload for execution
    const actionPayload: ToolInput = { tool: toolName };
    if (toolName === "update_deliverable") {
      actionPayload.deliverable_id = toolInput.deliverable_id;
      actionPayload.deliverable_hint = toolInput.deliverable_hint;
      actionPayload.deliverable_fields = toolInput.fields;
    } else if (toolName === "update_deal_stage") {
      actionPayload.deal_id = toolInput.deal_id;
      actionPayload.deal_hint = toolInput.deal_hint;
      actionPayload.stage = toolInput.stage;
      actionPayload.notes = toolInput.notes;
    } else if (toolName === "create_deal") {
      actionPayload.athlete_hint = toolInput.athlete_hint;
      actionPayload.brand = toolInput.brand;
      actionPayload.value = toolInput.value;
      actionPayload.deal_type = toolInput.deal_type;
      actionPayload.notes = toolInput.notes;
      actionPayload.expected_close_date = toolInput.expected_close_date;
      actionPayload.stage = toolInput.stage;
    } else if (toolName === "create_notification") {
      Object.assign(actionPayload, toolInput);
    } else if (toolName === "update_contract_field") {
      actionPayload.contract_id = toolInput.contract_id;
      actionPayload.contract_hint = toolInput.contract_hint;
      actionPayload.contract_fields = toolInput.fields;
    }

    const irreversible = toolName === "create_deal" || toolName === "create_notification";

    return new Response(
      JSON.stringify({
        requires_confirmation: true,
        message: aiMessage,
        confirmation: {
          action_type: toolName,
          human_readable_description: humanDescription,
          fields_to_change: fieldsToChange,
          reversible: !irreversible,
        },
        action_payload: actionPayload,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Model-Tier": "L2" },
      },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.warn("[detectAction] timeout after 10s — falling through to normal chat");
    } else {
      console.error("[chat] action detection error:", e);
    }
    return null; // always fall through to normal chat
  }
}

// ─── File content extraction via file-processor ───────────────────────────
async function fetchFileContent(
  bucket: string,
  path: string,
  agencyId: string,
  serviceKey: string,
  supabaseUrl: string,
  authToken: string,
): Promise<string | null> {
  try {
    const fpUrl = `${supabaseUrl}/functions/v1/file-processor`;
    const res = await fetch(fpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({ action: "extract", bucket, path, agency_id: agencyId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text ?? null;
  } catch {
    return null;
  }
}

// ─── Context compression for ranking / comparison queries ─────────────────
// Strips per-deliverable rows (noise for ranking) while keeping roster,
// contract deadlines, conflicts and campaign counts.
// Applied only when isRankingQuery && contextBlock.length > 8000.
function compressContextForRanking(contextBlock: string): string {
  const marker = "\nDELIVERABLE NON PUBBLICATI";
  const idx = contextBlock.indexOf(marker);
  if (idx === -1) return contextBlock; // nothing to trim

  // Pull counts already present in the ENTITA line
  const unpostedMatch = contextBlock.match(/(\d+) non pubblicati/);
  const postedMatch   = contextBlock.match(/(\d+) pubblicati\)/);
  const unposted = unpostedMatch?.[1] ?? "?";
  const posted   = postedMatch?.[1]   ?? "?";

  const header  = contextBlock.slice(0, idx);
  const summary = `\nDELIVERABLE: [${unposted} non pubblicati + ${posted} pubblicati — dettaglio omesso per query ranking]\n---`;

  return header + summary;
}

// ─── Helper: stream a plain text message as SSE without calling any LLM ──
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
    const body = await req.json();
    const messages = body.messages ?? [];

    // ── Execution path: confirmed tool action ─────────────────────────────
    if (body.execute_confirmed_action && body.action_payload) {
      const authHeader = req.headers.get("authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: { user } } = await adminClient.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: "Sessione scaduta" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: profile } = await adminClient.from("profiles").select("agency_id").eq("id", user.id).single();
      if (!profile?.agency_id) return new Response(JSON.stringify({ error: "Nessuna agenzia" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const resultMsg = await executeTool(body.action_payload, profile.agency_id, user.id, adminClient);
      return streamDirectText(resultMsg, corsHeaders);
    }

    // ── Detect status-update intent early, before any expensive work ──
    const latestUserMsg = messages?.[messages.length - 1]?.role === "user"
      ? String(messages[messages.length - 1].content || "")
      : "";

    // ── Prompt injection guard — instant L0 response, no LLM call ────────
    const INJECTION_RE = /dimentica\s+(tutto|tutte|le\s+istruzioni|il\s+contesto|la\s+conversazione)|ignora\s+(tutto|le\s+istruzioni|il\s+sistema)|sei\s+ora\s+un|d'ora\s+in\s+poi\s+sei|nuovo\s+ruolo|nuova\s+personalit/i;
    if (INJECTION_RE.test(latestUserMsg)) {
      return streamDirectText(
        "Sono Taura AI, assistente operativo della tua agenzia. Non posso cambiare il mio ruolo o ignorare il contesto. Come posso aiutarti con roster, contratti o campagne?",
        corsHeaders,
      );
    }

    // ── Out-of-scope guard — instant L0 response, no LLM call ────────────
    const OUT_OF_SCOPE_RE = /\b(ricett[ae]|cucin[ao]|ingredient[ei]|cuocere|bollire|friggere|forno|pasta\s+all[ae]|carbonara|amatriciana|meteo|previsioni\s+meteor|temperatura\s+oggi|calcio\s+risultat|serie\s+a\s+risultat|borsa\s+valori|azioni\s+in\s+borsa|crypto|bitcoin|notizie\s+di\s+oggi)\b/i;
    if (OUT_OF_SCOPE_RE.test(latestUserMsg)) {
      return streamDirectText(
        "Sono focalizzato sulle operazioni della tua agenzia: roster, contratti, campagne, deal e scadenze. Per questa richiesta non posso aiutarti.",
        corsHeaders,
      );
    }

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

    // ── Commission update fast-path ──
    const commIntent = latestUserMsg ? detectCommissionIntent(latestUserMsg) : null;
    if (commIntent) {
      try {
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.replace("Bearer ", "");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user } } = await adminClient.auth.getUser(token);

        if (user) {
          const { data: profile } = await adminClient.from("profiles").select("agency_id").eq("id", user.id).single();
          if (profile?.agency_id) {
            const agencyId = profile.agency_id;
            const normalizedMsg = normalizeText(latestUserMsg);

            const { data: contracts } = await adminClient
              .from("contracts")
              .select("id, brand, athletes(full_name), commission_type, commission_value")
              .eq("agency_id", agencyId);

            if (contracts) {
              const matched = (contracts as Array<{ id: string; brand: string; athletes: { full_name?: string } | null; commission_type: string | null; commission_value: number | null }>).filter((c) => {
                const brandNorm = normalizeText(c.brand || "");
                const athleteNorm = normalizeText(c.athletes?.full_name || "");
                const brandTokens = brandNorm.split(" ").filter((t) => t.length > 2);
                const athleteTokens = athleteNorm.split(" ").filter((t) => t.length > 2);
                return brandTokens.some((t) => normalizedMsg.includes(t)) || athleteTokens.some((t) => normalizedMsg.includes(t));
              });

              if (matched.length === 0) {
                return streamDirectText(
                  "Non ho trovato contratti corrispondenti. Specifica atleta e/o brand (es. *\"commissione Sofia Marchetti × Zalando al 12%\"*).",
                  corsHeaders,
                );
              } else if (matched.length > 5) {
                return streamDirectText(
                  `Il filtro corrisponde a **${matched.length} contratti**. Specifica atleta e/o brand.`,
                  corsHeaders,
                );
              } else {
                const { error: updateErr } = await adminClient
                  .from("contracts")
                  .update({ commission_type: commIntent.type, commission_value: commIntent.value })
                  .in("id", matched.map((c) => c.id));

                if (!updateErr) {
                  const label = commIntent.type === "pct"
                    ? `${commIntent.value}%`
                    : `€${commIntent.value.toLocaleString("it-IT")}`;
                  const lines = matched.map((c) => `• **${c.athletes?.full_name || "?"}** × **${c.brand}**`).join("\n");
                  console.log(`[chat] commission update: ${matched.length} contracts → ${commIntent.type}=${commIntent.value}`);
                  return streamDirectText(`✅ Commissione aggiornata a **${label}** per:\n\n${lines}`, corsHeaders);
                }
              }
            }
          }
        }
      } catch (commErr) {
        console.error("commission-path error:", commErr);
        // Fall through to normal path
      }
    }

    let contextBlock = "";
    let agencyPlan = "free";
    // Track for action detection & file fetching (resolved after context build)
    let resolvedAgencyId = "";
    let resolvedUserId = "";
    let resolvedToken = "";
    let resolvedServiceKey = "";
    let resolvedSupabaseUrl = "";
    try {
      const authHeader = req.headers.get("authorization") || "";
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const token = authHeader.replace("Bearer ", "");
      resolvedToken = token;
      resolvedServiceKey = supabaseServiceKey;
      resolvedSupabaseUrl = supabaseUrl;

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
          resolvedAgencyId = agencyId;
          resolvedUserId = user.id;
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

          // Contract clause search: fetch detailed clauses for relevant contracts
          const CLAUSE_KEYWORDS = /clausol|esclusiv|penal|obbligh|diritti.immagin|non.compete|rinnov|rescission|ingaggio|mandato|accordo|compenso|royalt|termini|condizioni/i;
          let semanticBlock = "";
          if (CLAUSE_KEYWORDS.test(latestUserMsg)) {
            try {
              // Build keyword tokens from the message for matching
              const msgTokens = normalizeText(latestUserMsg).split(" ").filter((t) => t.length > 3);
              // Fetch all contracts with full clause data
              const { data: clauseContracts } = await adminClient
                .from("contracts")
                .select("id, brand, start_date, end_date, exclusivity_category, exclusivity_territory, obligations, social_obligations, penalties, renewal_clause, image_rights, ai_extracted_clauses, athlete_id, athletes(full_name)")
                .eq("agency_id", agencyId);

              if (clauseContracts && clauseContracts.length > 0) {
                type ContractRow = { id: string; brand: string; start_date?: string; end_date?: string; exclusivity_category?: string; exclusivity_territory?: string; obligations?: string; social_obligations?: string; penalties?: string; renewal_clause?: string; image_rights?: string; ai_extracted_clauses?: Record<string, unknown>; athletes?: { full_name?: string } };
                // Score contracts by keyword match
                const scored = (clauseContracts as ContractRow[]).map((c) => {
                  const searchText = normalizeText([
                    c.brand, c.athletes?.full_name, c.exclusivity_category,
                    c.obligations, c.penalties, c.renewal_clause,
                    JSON.stringify(c.ai_extracted_clauses || {})
                  ].filter(Boolean).join(" "));
                  const score = msgTokens.filter((t) => searchText.includes(t)).length;
                  return { c, score };
                }).filter(({ score }) => score > 0)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 5);

                if (scored.length > 0) {
                  const lines = scored.map(({ c }) => {
                    const clauses = c.ai_extracted_clauses || {};
                    const parts = [
                      `**${c.athletes?.full_name || "?"}** × **${c.brand}** (${c.start_date || "?"} → ${c.end_date || "?"})`,
                      c.exclusivity_category ? `Esclusività: ${c.exclusivity_category} / ${c.exclusivity_territory || "N/D"}` : null,
                      c.obligations ? `Obblighi: ${c.obligations}` : null,
                      c.social_obligations ? `Social: ${c.social_obligations}` : null,
                      c.penalties ? `Penali: ${c.penalties}` : null,
                      c.renewal_clause ? `Rinnovo: ${c.renewal_clause}` : null,
                      c.image_rights ? `Diritti immagine: ${c.image_rights}` : null,
                      Object.keys(clauses).length > 0 ? `Clausole AI: ${JSON.stringify(clauses)}` : null,
                    ].filter(Boolean).join("\n  ");
                    return parts;
                  }).join("\n---\n");
                  semanticBlock = `\nCLAUSOLE CONTRATTI RILEVANTI:\n${lines}`;
                  console.log(`[chat] clause search: ${scored.length} contracts enriched`);
                }
              }
            } catch (semErr) {
              console.error("clause search error:", semErr);
            }
          }

          // ── File ingestion: if user mentions a file, extract content ──
          let fileContentBlock = "";
          if (FILE_QUERY_RE.test(latestUserMsg)) {
            try {
              const msgNorm = normalizeText(latestUserMsg);
              // Try contracts
              const { data: fcContracts } = await adminClient
                .from("contracts")
                .select("id, brand, file_url, athletes(full_name)")
                .eq("agency_id", agencyId)
                .not("file_url", "is", null);
              const matchedContract = (fcContracts || []).find((c: { brand?: string; athletes?: { full_name?: string }; file_url?: string }) => {
                const hay = normalizeText(`${c.brand} ${(c.athletes as { full_name?: string })?.full_name}`);
                return msgNorm.split(" ").filter((t) => t.length > 2).some((t) => hay.includes(t));
              });
              if (matchedContract?.file_url) {
                const text = await fetchFileContent("contracts", matchedContract.file_url, agencyId, supabaseServiceKey, supabaseUrl, token);
                if (text) fileContentBlock = `\n\nCONTENUTO FILE CONTRATTO (${matchedContract.brand}):\n${text.slice(0, 6000)}`;
              }

              // Try campaigns (briefs)
              if (!fileContentBlock) {
                const { data: fcCampaigns } = await adminClient
                  .from("campaigns")
                  .select("id, name, brand, brief_file_url")
                  .eq("agency_id", agencyId)
                  .not("brief_file_url", "is", null);
                const matchedCampaign = (fcCampaigns || []).find((c: { name?: string; brand?: string; brief_file_url?: string }) => {
                  const hay = normalizeText(`${c.name} ${c.brand}`);
                  return msgNorm.split(" ").filter((t) => t.length > 2).some((t) => hay.includes(t));
                });
                if (matchedCampaign?.brief_file_url) {
                  const text = await fetchFileContent("briefs", matchedCampaign.brief_file_url, agencyId, supabaseServiceKey, supabaseUrl, token);
                  if (text) fileContentBlock = `\n\nCONTENUTO BRIEF (${matchedCampaign.brand} / ${matchedCampaign.name}):\n${text.slice(0, 6000)}`;
                }
              }

              // Try athletes (media kit)
              if (!fileContentBlock) {
                const matchedAthlete = (athletes as Array<{ id: string; full_name?: string; media_kit_url?: string }>).find((a) => {
                  const hay = normalizeText(a.full_name || "");
                  return msgNorm.split(" ").filter((t) => t.length > 2).some((t) => hay.includes(t));
                });
                if (matchedAthlete?.media_kit_url) {
                  const text = await fetchFileContent("media-kits", matchedAthlete.media_kit_url, agencyId, supabaseServiceKey, supabaseUrl, token);
                  if (text) fileContentBlock = `\n\nMEDIA KIT (${matchedAthlete.full_name}):\n${text.slice(0, 4000)}`;
                }
              }
              if (fileContentBlock) console.log(`[chat] file enrichment: ${fileContentBlock.length} chars`);
            } catch (fe) {
              console.error("[chat] file enrichment error:", fe);
            }
          }

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
${semanticBlock}
---`;

          // Append file content (after truncation check, so it always gets through)
          if (fileContentBlock) {
            contextBlock += fileContentBlock.slice(0, 5000);
          }

          // Final safety: truncate context block if still too large
          if (contextBlock.length > MAX_CONTEXT_CHARS) {
            contextBlock = contextBlock.slice(0, MAX_CONTEXT_CHARS) + "\n... [contesto troncato per limiti di dimensione]";
          }
        }
      }
    } catch (ctxErr) {
      console.error("Context fetch error:", ctxErr);
    }

    // ── Action detection: intercept write intents, return confirmation JSON ─
    if (
      ACTION_INTENT_RE.test(latestUserMsg) &&
      !statusIntent &&
      !commIntent &&
      resolvedAgencyId &&
      resolvedToken
    ) {
      const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
      const serviceKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient2 = createClient(supabaseUrl2, serviceKey2);
      const confirmResponse = await detectActionAndReturnConfirmation(
        latestUserMsg,
        messages,
        contextBlock,
        resolvedAgencyId,
        adminClient2,
      );
      if (confirmResponse) return confirmResponse;
      // If detection failed, fall through to normal LLM chat
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

    // ── QIE formatter-domain override ────────────────────────────────────────
    // For retrieval-only domains, QIE pre-computes the answer and the LLM is a
    // pure formatter. Opus adds no reasoning value over Sonnet here, costing 5×
    // more due to DEEP_PATTERN matches (e.g. /ranking/, /esclusivit/, time-horizon).
    //
    // Cap L3→L2 when agency data is in the context block ("full" quality).
    // Only restore L3 if context is absent ("insufficient") — sparse data
    // requires the extra reasoning capacity to compensate.
    const FORMATTER_DOMAIN_PATTERNS: [string, RegExp][] = [
      ["roster_overview",   /\b(quanti atleti|quanti talent|lista roster|mostra roster|tutti gli atleti|chi gestisco)\b/i],
      ["athlete_ranking",   /\branking\b.*atleti|classifica atleti|dammi (un |il )?ranking|migliore atleta|peggiore atleta|chi ([eè] il (pi[uù]|nostro)|genera di pi[uù])|ordina (gli )?atleti/i],
      ["contract_expiry",   /\bscad(e|on|enza|enze|uti|ute)\b|in scadenza|cosa scade|contratti in scadenza/i],
      ["exclusivity_check", /ha esclusivit|chi ha esclusiv|categoria libera|possiamo pitchare|posso fare deal con/i],
      ["deadline_alert",    /cosa devo fare (oggi|domani|questa settimana)|cose urgenti|priorit[aà] della settimana|scadenze (di )?(oggi|questa settimana)/i],
      ["conflict_check",    /ci sono conflitti|conflitti aperti|quanti conflitti/i],
    ];
    const matchedFormatterDomain = FORMATTER_DOMAIN_PATTERNS.find(([, re]) => re.test(latestUserMsg))?.[0];
    const dataQuality: "full" | "insufficient" =
      contextBlock.length > 300 && contextBlock.includes("DATI AGENZIA") ? "full" : "insufficient";

    if (matchedFormatterDomain && dataQuality === "full" && routing.level === "L3") {
      routing.level = "L2";
      routing.model = MODELS.L2_SONNET;
      routing.reasoning += `, qie-cap:${matchedFormatterDomain}→L2`;
    }

    // ── Ranking compression: strip deliverable rows — irrelevant for ranking ──
    const isRankingQuery = /ranking|classifica|migliore|peggiore|pi[uù] redditiz|pi[uù] valu/i.test(latestUserMsg);
    if (isRankingQuery && contextBlock.length > 8000) {
      const before = contextBlock.length;
      contextBlock = compressContextForRanking(contextBlock);
      console.log(`[chat] ranking compression: ${before} → ${contextBlock.length} chars`);
    }

    console.log(`[chat] ${routing.level} (score:${routing.score}) model=${routing.model} | len=${latestUserMsg.length}`);

    // ── Italy-aware calendar ───────────────────────────────────────────────
    // Deno edge functions run in UTC. getDay()/getDate() return UTC values
    // which are 1-2 hours behind Italy (CEST=UTC+2, CET=UTC+1), causing
    // wrong day-of-week labels and broken week ranges near midnight.
    //
    // Fix: use Intl.DateTimeFormat("Europe/Rome") to get the Italian calendar
    // date as a YYYY-MM-DD string, then build a synthetic UTC-midnight Date
    // from it. All subsequent operations use getUTCDay/setUTCDate so they
    // are never re-shifted by the runtime TZ. DST is handled automatically
    // by the Intl API — no manual offset arithmetic needed.
    const nowUTC = new Date();
    // "sv" (Swedish) locale reliably formats dates as YYYY-MM-DD
    const italyDateStr = new Intl.DateTimeFormat("sv", { timeZone: "Europe/Rome" }).format(nowUTC);
    const [iy, im, id] = italyDateStr.split("-").map(Number);
    // Synthetic UTC-midnight anchor representing today in Italy
    const today = new Date(Date.UTC(iy, im - 1, id));

    const dayNames = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
    const todayStr = italyDateStr;                                   // "2026-04-20"
    const dayOfWeek = dayNames[today.getUTCDay()];                  // "Lunedi"
    const tomorrowStr = new Date(Date.UTC(iy, im - 1, id + 1)).toISOString().split("T")[0];
    const tomorrowName = dayNames[(today.getUTCDay() + 1) % 7];

    // Mon=0 … Sun=6 offset from Monday
    const dayIdx = today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1;
    const thisMonday = new Date(Date.UTC(iy, im - 1, id - dayIdx));
    const thisSunday = new Date(Date.UTC(iy, im - 1, id - dayIdx + 6));
    const nextMonday = new Date(Date.UTC(iy, im - 1, id - dayIdx + 7));
    const nextSunday = new Date(Date.UTC(iy, im - 1, id - dayIdx + 13));
    // Build Mon–Sun label map for this week so the LLM never re-derives day names.
    // i=0→Monday … i=6→Sunday; dayNames is 0=Sun,1=Mon…6=Sat so Mon = dayNames[1+i] clamped.
    const weekDayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    const weekDayMap = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(iy, im - 1, id - dayIdx + i));
      return `${weekDayLabels[i]} ${d.toISOString().split("T")[0]}`;
    }).join(" | ");
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const depthInstruction = routing.level === "L1"
      ? "Rispondi in modo ultra-breve: 1-2 frasi max."
      : routing.level === "L3"
        ? "Rispondi in modo approfondito con analisi strategica, pro/contro, e raccomandazioni concrete."
        : "Rispondi in modo chiaro e operativo, con dettagli sufficienti.";

    const systemPrompt = `Sei Taura AI, assistente operativo per agenzie di management sportivo/talent.

LINGUA: Italiano. Valori in €XX.XXX, date DD/MM/YYYY.

## PERMESSI DI SCRITTURA (OBBLIGATORI)
Puoi e DEVI eseguire azioni di modifica quando l'utente te lo chiede. NON dire mai "non posso modificare", "non ho i permessi", "non posso eseguire operazioni di scrittura" — usa sempre i tool disponibili e chiedi conferma prima di procedere.
- Se l'utente vuole spostare una data → usa update_deliverable
- Se l'utente vuole aggiornare uno stage → usa update_deal_stage
- Se l'utente vuole creare un deal → usa create_deal
- Se l'utente vuole aggiungere note o metriche → usa update_deliverable o update_contract_field
- Proponi SEMPRE l'azione strutturata. Non chiedere se vuole procedere — mostra la preview e chiedi conferma.

## REGOLE BASE:
- Usa SOLO i dati del blocco DATI AGENZIA sotto. NON inventare, NON stimare, NON aggiungere info esterne.
- Se il blocco DATI AGENZIA e assente: rispondi "⚠️ Sessione non caricata. Ricarica la pagina o effettua di nuovo il login."
- Se una campagna, atleta o brand non e presente nel blocco dati, dillo chiaramente.
- Segnala conflitti con ⚠️.
- MAI troncare un elenco. Se ci sono 6 deliverable non pubblicati, elencane 6.
- Se l'utente menziona un file (contratto, brief, media kit): il contenuto estratto è nel blocco CONTENUTO FILE sotto — analizzalo e rispondi con i dettagli.

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

DATA E CALENDARIO (timezone: Europe/Rome — valori già corretti, NON ricalcolare):
- Oggi: ${todayStr} (${dayOfWeek})
- Domani: ${tomorrowStr} (${tomorrowName})
- Questa settimana: ${fmt(thisMonday)} (Lun) → ${fmt(thisSunday)} (Dom)
- Prossima settimana: ${fmt(nextMonday)} (Lun) → ${fmt(nextSunday)} (Dom)
- Mappa giorni settimana corrente: ${weekDayMap}
- Quando l'utente dice "settimana prossima" intende ${fmt(nextMonday)} → ${fmt(nextSunday)}, NON questa settimana.
- Quando dice "questa settimana" intende ${fmt(thisMonday)} → ${fmt(thisSunday)}.
- IMPORTANTE: usa SOLO le date e i nomi giorno elencati sopra. Non derivare nomi di giorni autonomamente da date ISO.

${contextBlock}`;

    // 22s hard timeout: if the LLM call hangs, return a graceful message
    // rather than leaving the client spinning indefinitely.
    const LLM_TIMEOUT_MS = 22_000;
    let response: Response;
    try {
      response = await Promise.race([
        callAnthropic({
          level: routing.level,
          system: systemPrompt,
          messages,
          stream: true,
          max_tokens: routing.level === "L3" ? 8192 : routing.level === "L2" ? 4096 : 2048,
          temperature: routing.level === "L1" ? 0.2 : routing.level === "L2" ? 0.15 : 0.1,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("LLM_TIMEOUT")), LLM_TIMEOUT_MS)
        ),
      ]);
    } catch (timeoutErr) {
      if (timeoutErr instanceof Error && timeoutErr.message === "LLM_TIMEOUT") {
        console.warn("[chat] LLM call exceeded 22s — returning timeout message");
        return streamDirectText(
          "Elaborazione in corso — riprova con una domanda più specifica.",
          corsHeaders,
        );
      }
      throw timeoutErr;
    }

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
