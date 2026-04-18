/**
 * Router AI: L1 = Gemini Fast, L2 = mix (Gemini Mid + Claude Sonnet), L3 = Claude Opus.
 * Solo Google (Gemini) e Anthropic. Nessun Lovable.
 *
 * NOTE: Claude Sonnet 4.5 and Opus 4 reject `temperature` in the request body
 * with HTTP 400. It must be omitted entirely — not set to 0 or any other value.
 * Gemini calls are unaffected and keep their temperature parameter.
 */

import { callGemini, GEMINI_MODELS } from "./gemini.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export const MODELS = {
  L1_GEMINI_FAST: GEMINI_MODELS.FAST,
  L2_SONNET: "claude-sonnet-4-5-20250929",
  L2_GEMINI_MID: GEMINI_MODELS.MID,
  OPUS: "claude-opus-4-20250514",
} as const;

export type ModelLevel = "L1" | "L2" | "L3";

/**
 * Normalize messages before sending to Anthropic:
 * 1. Flatten non-string content to a plain string
 * 2. Strip any role that is not "user" or "assistant"
 * 3. Drop leading assistant messages (API requires user-first)
 * 4. Merge consecutive same-role messages (avoids 400 "non-alternating roles")
 *
 * Export so chat/index.ts can call it for detectActionAndReturnConfirmation too.
 */
export function sanitizeMessages(
  msgs: Array<{ role: string; content: string | unknown }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  // Step 1: normalize content + restrict roles
  const normalized = msgs.map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content:
      typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
        ? (m.content as Array<{ text?: string; content?: string }>)
            .map((b) => b.text ?? b.content ?? "")
            .join("")
        : String(m.content ?? ""),
  }));

  // Step 2: drop leading assistant messages
  let start = 0;
  while (start < normalized.length && normalized[start].role !== "user") start++;
  const trimmed = normalized.slice(start);

  // Step 3: merge consecutive same-role messages
  return trimmed.reduce(
    (acc: Array<{ role: "user" | "assistant"; content: string }>, m) => {
      const last = acc[acc.length - 1];
      if (last && last.role === m.role) {
        last.content = last.content + "\n" + m.content;
      } else {
        acc.push({ role: m.role, content: m.content });
      }
      return acc;
    },
    [],
  );
}

function hasFileOrImageContent(messages: Array<{ role: string; content: string | unknown }>): boolean {
  return messages.some((m) => {
    const c = m.content;
    if (!Array.isArray(c)) return false;
    return c.some((block: { type?: string }) => block.type === "file" || block.type === "image");
  });
}

function withProviderHeader(res: Response, provider: "gemini" | "anthropic"): Response {
  const headers = new Headers(res.headers);
  headers.set("X-AI-Provider", provider);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function callAnthropicDirect(params: {
  model: string;
  system: string;
  messages: Array<{ role: string; content: string | unknown }>;
  max_tokens?: number;
  stream?: boolean;
  // temperature intentionally omitted — Claude Sonnet 4.5 / Opus 4 return 400 if sent
}): Promise<Response> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non configurata. Impostala in Supabase Edge Functions → Secrets.");
  }

  const sanitized = sanitizeMessages(params.messages);

  console.log(
    "[anthropic] →",
    params.model,
    "| messages:",
    sanitized.length,
    "| system_chars:",
    params.system?.length ?? 0,
    "| max_tokens:",
    params.max_tokens ?? 4096,
    "| has_temperature: false",
  );

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.max_tokens ?? 4096,
      system: params.system,
      messages: sanitized,
      stream: params.stream ?? false,
      // temperature is NOT included — omitting it lets Anthropic use its default
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[anthropic]", res.status, errText);
    let detail = "";
    try {
      const errJson = JSON.parse(errText);
      detail = errJson?.error?.message ?? errJson?.message ?? errText.slice(0, 300);
    } catch {
      detail = errText.slice(0, 300);
    }
    throw new Error(`Anthropic error ${res.status}: ${detail}`);
  }

  return withProviderHeader(res, "anthropic");
}

// L2 mix: alterna Gemini Mid e Claude Sonnet in modo deterministico per minuto
function useGeminiForL2(): boolean {
  const minute = Math.floor(Date.now() / 60000);
  return minute % 2 === 0;
}

export async function callAnthropic(params: {
  level?: ModelLevel;
  model?: string;
  system: string;
  messages: Array<{ role: string; content: string | unknown }>;
  max_tokens?: number;
  stream?: boolean;
  temperature?: number; // used only for Gemini calls
}): Promise<Response> {
  const hasFile = hasFileOrImageContent(params.messages);
  const level = params.level;

  // ---- L1: Gemini Fast ----
  if (level === "L1") {
    return await callGemini({
      model: GEMINI_MODELS.FAST,
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 2048,
      stream: params.stream ?? false,
      temperature: params.temperature ?? 0.2,
    });
  }

  // ---- L2: mix Gemini Mid + Claude Sonnet ----
  if (level === "L2") {
    if (useGeminiForL2()) {
      return await callGemini({
        model: GEMINI_MODELS.MID,
        system: params.system,
        messages: params.messages,
        max_tokens: params.max_tokens ?? 4096,
        stream: params.stream ?? false,
        temperature: params.temperature ?? 0.3,
      });
    }
    return await callAnthropicDirect({
      model: MODELS.L2_SONNET,
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 4096,
      stream: params.stream ?? false,
    });
  }

  // ---- L3: Claude Opus ----
  if (level === "L3") {
    return await callAnthropicDirect({
      model: MODELS.OPUS,
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 8192,
      stream: params.stream ?? false,
    });
  }

  // ---- Legacy: chiamate con model string (parse-contract, parse-brief, etc.) ----
  const model = params.model ?? MODELS.L2_SONNET;

  // Con contenuto file (PDF/immagini) usiamo sempre Gemini (Anthropic non supporta PDF inline)
  if (hasFile) {
    return await callGemini({
      model: GEMINI_MODELS.MID,
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 8192,
      stream: false,
      temperature: params.temperature ?? 0.1,
    });
  }

  if (model.includes("gemini") || model === MODELS.L1_GEMINI_FAST || model === GEMINI_MODELS.FAST) {
    return await callGemini({
      model: GEMINI_MODELS.FAST,
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 2048,
      stream: params.stream ?? false,
      temperature: params.temperature ?? 0.2,
    });
  }

  if (model === MODELS.L2_GEMINI_MID || model === GEMINI_MODELS.MID) {
    return await callGemini({
      model: GEMINI_MODELS.MID,
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 4096,
      stream: params.stream ?? false,
      temperature: params.temperature ?? 0.3,
    });
  }

  // Sonnet / Opus → Anthropic (no temperature)
  return await callAnthropicDirect({
    model: model.includes("opus") ? MODELS.OPUS : MODELS.L2_SONNET,
    system: params.system,
    messages: params.messages,
    max_tokens: params.max_tokens ?? 4096,
    stream: params.stream ?? false,
  });
}

export function isAnthropicDirect(): boolean {
  return !!ANTHROPIC_API_KEY;
}
