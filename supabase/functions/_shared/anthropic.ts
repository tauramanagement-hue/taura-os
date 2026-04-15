/**
 * Router AI: L1 = Gemini Fast, L2 = mix (Gemini Mid + Claude Sonnet), L3 = Claude Opus.
 * Solo Google (Gemini) e Anthropic. Nessun Lovable.
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
  temperature?: number;
}): Promise<Response> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY non configurata. Impostala in Supabase Edge Functions → Secrets.");
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
      messages: params.messages,
      stream: params.stream ?? false,
      temperature: params.temperature ?? 0.3,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[anthropic]", res.status, err);
    throw new Error(`Anthropic error ${res.status}`);
  }
  return withProviderHeader(res, "anthropic");
}

// L2 mix: alterna Gemini Mid e Claude Sonnet in modo deterministico per sessione
// Hash del secondo corrente → stesso utente ottiene lo stesso modello per ~1 minuto
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
  temperature?: number;
}): Promise<Response> {
  const hasFile = hasFileOrImageContent(params.messages);
  const level = params.level;

  // ---- L1: Gemini Fast ----
  if (level === "L1") {
    const res = await callGemini({
      model: GEMINI_MODELS.FAST,
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 2048,
      stream: params.stream ?? false,
      temperature: params.temperature ?? 0.2,
    });
    return res; // già con header X-AI-Provider: gemini
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
      model: "claude-sonnet-4-5-20250929",
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 4096,
      stream: params.stream ?? false,
      temperature: params.temperature ?? 0.3,
    });
  }

  // ---- L3: Claude Opus ----
  if (level === "L3") {
    return await callAnthropicDirect({
      model: "claude-opus-4-20250514",
      system: params.system,
      messages: params.messages,
      max_tokens: params.max_tokens ?? 8192,
      stream: params.stream ?? false,
      temperature: params.temperature ?? 0.3,
    });
  }

  // ---- Legacy: chiamate con model string (parse-contract, parse-brief, etc.) ----
  const model = params.model ?? MODELS.L2_SONNET;

  // Con contenuto file (PDF/immagini) usiamo sempre Gemini (Anthropic non supporta PDF)
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

  // Sonnet / Opus → Anthropic
  return await callAnthropicDirect({
    model: model.includes("opus") ? "claude-opus-4-20250514" : "claude-sonnet-4-5-20250929",
    system: params.system,
    messages: params.messages,
    max_tokens: params.max_tokens ?? 4096,
    stream: params.stream ?? false,
    temperature: params.temperature ?? 0.3,
  });
}

export function isAnthropicDirect(): boolean {
  return !!ANTHROPIC_API_KEY;
}
