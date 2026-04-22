/**
 * Google Vertex AI — EU region (europe-west1).
 * GDPR-compliant alternative to Generative Language API (which is USA-only).
 *
 * Endpoint: https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent
 *
 * Auth: OAuth2 access token (service account key).
 * Env vars required:
 *   GCP_PROJECT_ID      — es. "gen-lang-client-0075878010"
 *   GCP_LOCATION        — es. "europe-west1" (MAI us-central1 per GDPR)
 *   GCP_SA_KEY_JSON     — JSON completo della service account (stringified)
 *   VERTEX_ENABLED      — "true" per attivare (fallback gemini.ts altrimenti)
 *
 * Provider confermato in audit: progetto `gen-lang-client-0075878010` con CDPA firmato
 * + SCC EU certificate, no training sui dati (piano a pagamento).
 */

const GCP_PROJECT_ID = Deno.env.get("GCP_PROJECT_ID");
const GCP_LOCATION = Deno.env.get("GCP_LOCATION") ?? "europe-west1";
const GCP_SA_KEY_JSON = Deno.env.get("GCP_SA_KEY_JSON");
const VERTEX_ENABLED = Deno.env.get("VERTEX_ENABLED") === "true";

export const VERTEX_MODELS = {
  FAST: "gemini-2.5-flash-lite",
  MID: "gemini-2.5-flash",
} as const;

export function isVertexEnabled(): boolean {
  return VERTEX_ENABLED && !!GCP_PROJECT_ID && !!GCP_SA_KEY_JSON;
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  if (!GCP_SA_KEY_JSON) throw new Error("GCP_SA_KEY_JSON missing");

  const sa: ServiceAccountKey = JSON.parse(GCP_SA_KEY_JSON);
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const header = { alg: "RS256", typ: "JWT" };
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const toSign = `${b64(header)}.${b64(claims)}`;

  const pem = sa.private_key.replace(/\\n/g, "\n");
  const keyBytes = pemToBytes(pem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${toSign}.${sigB64}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Vertex token error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in * 1000) };
  return data.access_token;
}

function pemToBytes(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

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

function buildContents(messages: Array<{ role: string; content: string | unknown }>) {
  const contents: { role: "user" | "model"; parts: Part[] }[] = [];
  for (const m of messages) {
    const parts = buildParts(m.content);
    if (parts.length === 0) continue;
    const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts });
  }
  while (contents.length > 0 && contents[0].role === "model") contents.shift();
  if (contents.length === 0) throw new Error("No user message in contents");
  return contents;
}

export async function callVertex(params: {
  model: string;
  system: string;
  messages: Array<{ role: string; content: string | unknown }>;
  max_tokens?: number;
  stream?: boolean;
  temperature?: number;
}): Promise<Response> {
  if (!isVertexEnabled()) {
    throw new Error("Vertex AI non abilitato. Imposta VERTEX_ENABLED=true + GCP_PROJECT_ID + GCP_SA_KEY_JSON.");
  }

  const token = await getAccessToken();
  const contents = buildContents(params.messages);
  const systemText = typeof params.system === "string" ? params.system.trim() : "";

  const endpoint = params.stream ? "streamGenerateContent" : "generateContent";
  const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${params.model}:${endpoint}${params.stream ? "?alt=sse" : ""}`;

  const body = {
    contents,
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    generationConfig: {
      maxOutputTokens: params.max_tokens ?? 2048,
      temperature: params.temperature ?? 0.3,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[vertex]", res.status, errText);
    throw new Error(`Vertex error ${res.status}: ${errText}`);
  }

  const outHeaders = new Headers(res.headers);
  outHeaders.set("X-AI-Provider", "vertex-eu");
  outHeaders.set("X-AI-Region", GCP_LOCATION);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders });
}

export function parseVertexJsonResponse(data: { candidates?: { content?: { parts?: { text?: string }[] } }[] }): string {
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
