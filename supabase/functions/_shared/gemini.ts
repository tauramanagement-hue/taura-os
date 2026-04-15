/**
 * Google Gemini API (Generative Language API v1beta).
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}
 * Request body must use "contents" array with "parts", not "messages".
 */

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const GEMINI_MODELS = {
  FAST: "gemini-2.5-flash-lite",
  MID: "gemini-2.5-flash",
} as const;

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

function buildParts(content: string | unknown): Part[] {
  if (typeof content === "string") {
    const t = content.trim();
    return t ? [{ text: t }] : [];
  }
  if (!Array.isArray(content)) return [];
  const parts: Part[] = [];
  for (const block of content) {
    if (block?.type === "text" && block.text != null) {
      const t = String(block.text).trim();
      if (t) parts.push({ text: t });
    }
    if (block?.type === "file" && block?.file?.file_data) {
      const match = String(block.file.file_data).match(/^data:([^;]+);base64,(.+)$/);
      const mimeType = match ? match[1] : "application/pdf";
      const data = match ? match[2] : String(block.file.file_data);
      parts.push({ inlineData: { mimeType, data } });
    }
  }
  return parts;
}

/** Build Gemini v1beta "contents" array (role + parts). First content must be "user". */
function buildContents(messages: Array<{ role: string; content: string | unknown }>) {
  const contents: { role: "user" | "model"; parts: Part[] }[] = [];
  for (const m of messages) {
    const parts = buildParts(m.content);
    if (parts.length === 0) continue;
    const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts });
  }
  // Gemini requires the first content to be from "user"
  while (contents.length > 0 && contents[0].role === "model") contents.shift();
  if (contents.length === 0) throw new Error("No user message in contents");
  return contents;
}

export async function callGemini(params: {
  model: string;
  system: string;
  messages: Array<{ role: string; content: string | unknown }>;
  max_tokens?: number;
  stream?: boolean;
  temperature?: number;
}): Promise<Response> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY non configurata. Impostala in Supabase Edge Functions → Secrets.");

  const contents = buildContents(params.messages);
  if (contents.length === 0) throw new Error("Messaggi vuoti");

  const url = params.stream
    ? `${GEMINI_BASE}/models/${encodeURIComponent(params.model)}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`
    : `${GEMINI_BASE}/models/${encodeURIComponent(params.model)}:generateContent?key=${GEMINI_API_KEY}`;

  const systemText = typeof params.system === "string" ? params.system.trim() : "";
  const body: Record<string, unknown> = {
    contents,
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    generationConfig: {
      maxOutputTokens: params.max_tokens ?? 2048,
      temperature: params.temperature ?? 0.3,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errDetail = errText;
    try {
      const errJson = JSON.parse(errText);
      errDetail = errJson?.error?.message ?? errJson?.message ?? errText;
    } catch {
      // keep errText as-is
    }
    console.error("[gemini]", res.status, errDetail);
    throw new Error(`Gemini error ${res.status}: ${errDetail}`);
  }

  const outHeaders = new Headers(res.headers);
  outHeaders.set("X-AI-Provider", "gemini");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders });
}

/** Estrae il testo dalla risposta JSON non-stream di Gemini */
export function parseGeminiJsonResponse(data: { candidates?: { content?: { parts?: { text?: string }[] } }[] }): string {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text;
}
