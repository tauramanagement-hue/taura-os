/**
 * qie-router — orchestrator edge function for Taura AI (Layer 5 per spec).
 *
 * Pipeline per request:
 *   1. Auth + resolve agency
 *   2. buildSystemContext (cached per thread, 5min TTL)
 *   3. QIE classify → run domain fetcher(s) → QIEPayload (data_quality aware)
 *   4. Complexity router → L1/L2/L3 (applies insufficient-data bump override)
 *   5. Assemble system prompt via template (PRESENTER role)
 *   6. Call LLM with streaming SSE (or JSON in lab_mode)
 *   7. Log routing decision + outcome to ai_routing_logs
 *
 * Architectural law: the LLM NEVER queries the DB. It receives only
 * (a) the context snapshot (b) the pre-computed QIE payload
 * (c) the user message thread.
 *
 * Accepts BOTH request schemas:
 *   - Legacy / UI:  { thread_id?, messages: [{role, content}], lab_mode? }
 *   - Spec:         { message, thread_id?, agency_id?, user_id?, attachments?,
 *                     conversation_history?, system_context? }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callAnthropic } from "../_shared/anthropic.ts";
// @ts-ignore Deno resolves .ts
import {
  buildSystemContext,
  serializeContextBlock,
  type SystemContext,
} from "../../../src/lib/ai/contextBuilder.ts";
// @ts-ignore
import { buildSystemPrompt, detectLang } from "../../../src/lib/ai/systemPrompt.ts";
// @ts-ignore
import {
  classifyQuery,
  detectChain,
  type QIEClassification,
} from "../../../src/lib/ai/qieDomainClassifier.ts";
// @ts-ignore
import { runQIEChain } from "../../../src/lib/ai/qieDataFetchers.ts";
// @ts-ignore
import {
  routeRequest,
  modelNameForLevel,
  type RoutingDecision,
} from "../../../src/lib/ai/complexityRouter.ts";

// @ts-ignore
import { buildCorsHeaders } from "../_shared/cors.ts";

// ----------------------------------------------------------------------------
// Request schema — accept both legacy and spec forms.
// ----------------------------------------------------------------------------
interface ChatMessage {
  role: "user" | "assistant";
  content: string | unknown;
}

interface AttachmentMeta {
  filename?: string;
  mime?: string;
  type?: string;
  url?: string;
  size?: number;
}

interface RequestBody {
  // Legacy
  messages?: ChatMessage[];
  // Spec
  message?: string;
  conversation_history?: ChatMessage[];
  // Common
  thread_id?: string;
  agency_id?: string; // informational; actual agency is profile-bound
  user_id?: string;   // informational; actual user from JWT
  attachments?: AttachmentMeta[];
  system_context?: SystemContext | null; // allow pre-built context
  lab_mode?: boolean;
}

// ----------------------------------------------------------------------------
// Context cache (per warm instance).
// ----------------------------------------------------------------------------
const CONTEXT_CACHE = new Map<string, { ctx: SystemContext; at: number }>();
const CTX_TTL_MS = 5 * 60_000;

async function getOrBuildContext(
  supabase: SupabaseClient,
  agencyId: string,
  threadKey: string,
  override?: SystemContext | null,
): Promise<SystemContext> {
  if (override) return override;
  const key = `${agencyId}:${threadKey}`;
  const cached = CONTEXT_CACHE.get(key);
  if (cached && Date.now() - cached.at < CTX_TTL_MS) return cached.ctx;
  const ctx = await buildSystemContext(supabase, agencyId);
  CONTEXT_CACHE.set(key, { ctx, at: Date.now() });
  return ctx;
}

// ----------------------------------------------------------------------------
// Attachment analysis: count + multi + legal PDF heuristic.
// ----------------------------------------------------------------------------
const LEGAL_HINT_RE = /\b(contract|contratto|clausol|accord|agreement|addend|mandato)/i;

function analyseAttachments(
  attachments: AttachmentMeta[] | undefined,
  messages: ChatMessage[],
): { count: number; multi: boolean; legal: boolean } {
  let count = 0;
  let legal = false;

  // 1. Spec-style attachments metadata
  if (Array.isArray(attachments)) {
    for (const a of attachments) {
      count++;
      const hay = `${a.filename ?? ""} ${a.mime ?? ""} ${a.type ?? ""}`.toLowerCase();
      if (hay.includes("pdf") && LEGAL_HINT_RE.test(hay)) legal = true;
      if (LEGAL_HINT_RE.test(a.filename ?? "")) legal = true;
    }
  }

  // 2. Legacy: inline content blocks
  for (const m of messages) {
    const c = m.content;
    if (!Array.isArray(c)) continue;
    for (const b of c as Array<Record<string, unknown>>) {
      if (!b || typeof b !== "object") continue;
      const t = b.type as string | undefined;
      if (t === "file" || t === "image") count++;
      const name = (b.filename as string | undefined) ?? "";
      if (LEGAL_HINT_RE.test(name)) legal = true;
    }
  }

  return { count, multi: count >= 2, legal };
}

// ----------------------------------------------------------------------------
// Message extraction — normalise both schemas to one thread + user text.
// ----------------------------------------------------------------------------
function assembleThread(body: RequestBody): { messages: ChatMessage[]; userText: string } {
  // Spec form: { message, conversation_history }
  if (typeof body.message === "string" && body.message.trim().length > 0) {
    const history = Array.isArray(body.conversation_history) ? body.conversation_history : [];
    const messages: ChatMessage[] = [
      ...history,
      { role: "user", content: body.message },
    ];
    return { messages, userText: body.message };
  }
  // Legacy form: { messages: [...] }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  let userText = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") {
      userText = m.content;
      break;
    }
    if (Array.isArray(m.content)) {
      const textPart = (m.content as Array<Record<string, unknown>>).find(
        (b) => b?.type === "text" || typeof b === "string",
      );
      if (textPart) {
        userText = typeof textPart === "string" ? textPart : String(textPart.text ?? "");
        break;
      }
    }
  }
  return { messages, userText };
}

// ----------------------------------------------------------------------------
// Big-penalty detector: scans query text + extracted entities.
// ----------------------------------------------------------------------------
function detectBigPenalty(text: string, entities: QIEClassification["entities"]): boolean {
  if (entities?.mentions_penalty_over_threshold) return true;
  // Fallback regex: "€10k", "€ 25.000", "50.000 euro", "$20,000"
  const re = /([€$])\s*([\d]{1,3}(?:[.,]\d{3})+|\d{4,})|\b(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(?:eur|euro|euros|usd)\b/i;
  const m = text.match(re);
  if (!m) return false;
  const raw = (m[2] ?? m[3] ?? "").replace(/[.,]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) && n >= 10_000;
}

// ----------------------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const corsHeaders = { ...buildCorsHeaders(req), "X-Content-Type-Options": "nosniff" };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const queryId = crypto.randomUUID();
  const startedAt = Date.now();
  let logAgencyId: string | null = null;
  let logUserId: string | null = null;
  let logDecision: RoutingDecision | null = null;
  let logClassification: QIEClassification | null = null;
  let logChain: string[] = [];
  let logDataQuality: "full" | "partial" | "insufficient" = "full";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await adminClient.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logUserId = user.id;

    const { data: profile } = await adminClient
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.agency_id) {
      return new Response(JSON.stringify({ error: "Nessuna agenzia" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const agencyId = profile.agency_id as string;
    logAgencyId = agencyId;

    // Body
    const body = (await req.json()) as RequestBody;
    const { messages, userText } = assembleThread(body);
    const threadId = body.thread_id || `ephemeral:${user.id}`;

    if (!userText) {
      return new Response(JSON.stringify({ error: "Messaggio vuoto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Context (cached)
    const ctx = await getOrBuildContext(adminClient, agencyId, threadId, body.system_context);

    // 2. QIE classify + fetch
    const classification = classifyQuery(userText, ctx);
    const chain = detectChain(classification, userText);
    logChain = chain;
    const qiePayload = await runQIEChain(adminClient, agencyId, chain, classification, ctx, userText);
    logClassification = classification;
    logDataQuality = qiePayload.data_quality;

    // 3. Complexity router
    const attach = analyseAttachments(body.attachments, messages);
    const bigPenalty = detectBigPenalty(userText, classification.entities);
    const decision = routeRequest({
      text: userText,
      classification,
      attachmentCount: attach.count,
      multiplePdfs: attach.multi,
      legalPdf: attach.legal || (attach.count > 0 && LEGAL_HINT_RE.test(userText)),
      conversationLength: messages.length,
      threadSameTopicTurns: messages.length,
      bigPenaltyDetected: bigPenalty,
      dataQuality: qiePayload.data_quality,
    });
    logDecision = decision;

    // 4. System prompt
    const lang = detectLang(userText);
    const systemPrompt = buildSystemPrompt({
      agencyContextBlock: serializeContextBlock(ctx),
      qieDomain: classification.domain,
      qieDataBlock: qiePayload.rendered || "(nessun payload specifico)",
      userLang: lang,
      currentDateISO: new Date().toISOString(),
      agencyType: ctx.agency.type,
      needsClarification: qiePayload.needs_clarification,
      dataQuality: qiePayload.data_quality,
      suggestedFollowups: qiePayload.suggested_followups,
    });

    // 5a. Lab mode → JSON with debug
    if (body.lab_mode) {
      const llmRes = await callAnthropic({
        level: decision.level,
        system: systemPrompt,
        messages: messages as unknown as Array<{ role: string; content: unknown }>,
        stream: false,
        temperature: 0.3,
      });
      const raw = await llmRes.json();
      const assistantText =
        raw?.content?.[0]?.text ??
        raw?.candidates?.[0]?.content?.parts?.[0]?.text ??
        raw?.choices?.[0]?.message?.content ??
        "";

      const respMs = Date.now() - startedAt;
      logRouting(adminClient, {
        queryId, agencyId, userId: user.id, threadId,
        queryText: userText, lang,
        attachmentCount: attach.count, conversationLength: messages.length,
        classification, decision, chain,
        qiePayloadSummary: qiePayload.summary,
        dataQuality: qiePayload.data_quality,
        responseMs: respMs, responseOk: true,
      }).catch((e) => console.warn("[log]", e));

      return new Response(
        JSON.stringify({
          response: assistantText,
          debug: {
            query_id: queryId,
            domain: classification.domain,
            domain_confidence: classification.confidence,
            matched_rules: classification.matched_rules,
            entities: classification.entities,
            chain,
            score: decision.score,
            score_breakdown: decision.score_breakdown,
            level: decision.level,
            model: modelNameForLevel(decision.level),
            reasons: decision.reasons,
            override: decision.override,
            qie_summary: qiePayload.summary,
            qie_rendered: qiePayload.rendered,
            data_quality: qiePayload.data_quality,
            data_quality_note: qiePayload.data_quality_note,
            needs_clarification: qiePayload.needs_clarification,
            requires_confirmation: qiePayload.requires_confirmation,
            suggested_followups: qiePayload.suggested_followups,
            response_ms: respMs,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5b. Streaming mode
    const llmRes = await callAnthropic({
      level: decision.level,
      system: systemPrompt,
      messages: messages as unknown as Array<{ role: string; content: unknown }>,
      stream: true,
      temperature: 0.3,
    });

    logRouting(adminClient, {
      queryId, agencyId, userId: user.id, threadId,
      queryText: userText, lang,
      attachmentCount: attach.count, conversationLength: messages.length,
      classification, decision, chain,
      qiePayloadSummary: qiePayload.summary,
      dataQuality: qiePayload.data_quality,
      responseMs: Date.now() - startedAt, responseOk: true,
    }).catch((e) => console.warn("[log]", e));

    const headers = new Headers(llmRes.headers);
    headers.set("X-QIE-Domain", classification.domain);
    headers.set("X-QIE-Score", String(decision.score));
    headers.set("X-QIE-Level", decision.level);
    headers.set("X-QIE-Query-Id", queryId);
    headers.set("X-QIE-Data-Quality", qiePayload.data_quality);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);

    return new Response(llmRes.body, {
      status: llmRes.status,
      statusText: llmRes.statusText,
      headers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[qie-router] fatal:", msg);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey && logAgencyId && logClassification && logDecision) {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        await logRouting(adminClient, {
          queryId, agencyId: logAgencyId, userId: logUserId, threadId: "error",
          queryText: "(error)", lang: "it",
          attachmentCount: 0, conversationLength: 0,
          classification: logClassification, decision: logDecision, chain: logChain,
          qiePayloadSummary: null, dataQuality: logDataQuality,
          responseMs: Date.now() - startedAt, responseOk: false, error: msg,
        });
      }
    } catch {
      /* swallow */
    }

    const traceId = crypto.randomUUID();
    console.error("[qie-router] trace_id:", traceId, msg);
    return new Response(
      JSON.stringify({ code: "INTERNAL", message: "Errore interno.", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ----------------------------------------------------------------------------
// Logging — writes to ai_routing_logs (schema per migration 20260417140000).
// ----------------------------------------------------------------------------
async function logRouting(
  adminClient: SupabaseClient,
  args: {
    queryId: string;
    agencyId: string;
    userId: string | null;
    threadId: string;
    queryText: string;
    lang: "it" | "en";
    attachmentCount: number;
    conversationLength: number;
    classification: QIEClassification;
    decision: RoutingDecision;
    chain: string[];
    qiePayloadSummary: string | null;
    dataQuality: "full" | "partial" | "insufficient";
    responseMs: number;
    responseOk: boolean;
    error?: string;
  },
): Promise<void> {
  await adminClient.from("ai_routing_logs").insert({
    query_id: args.queryId,
    agency_id: args.agencyId,
    user_id: args.userId,
    thread_id: args.threadId.startsWith("ephemeral:") ? null : args.threadId,
    query_text: args.queryText.slice(0, 2000),
    query_lang: args.lang,
    attachment_count: args.attachmentCount,
    conversation_length: args.conversationLength,
    domain: args.classification.domain,
    domain_confidence: args.classification.confidence,
    entities: args.classification.entities,
    chain: args.chain,
    data_quality: args.dataQuality,
    score: args.decision.score,
    score_breakdown: args.decision.score_breakdown,
    scoring_reasons: args.decision.reasons,
    model_level: args.decision.level,
    model_selected: modelNameForLevel(args.decision.level),
    override_reason: args.decision.override ?? null,
    qie_summary: args.qiePayloadSummary,
    response_time_ms: args.responseMs,
    response_ok: args.responseOk,
    error: args.error ?? null,
  });
}
