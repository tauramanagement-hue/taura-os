// Centralised CORS helper. Replace wildcard with explicit allowlist.
// Preview deploys on Vercel use *.vercel.app — we match the pattern.
const ALLOWED_ORIGINS = [
  "https://tauraos.com",
  "https://www.tauraos.com",
  "https://app.tauraos.com",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
];

const VERCEL_PREVIEW = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

export function resolveOrigin(req: Request): string | null {
  const origin = req.headers.get("origin") ?? "";
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (VERCEL_PREVIEW.test(origin)) return origin;
  return null;
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = resolveOrigin(req);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-webhook-signature",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
  // Only emit Allow-Origin for origins we trust. Requests from untrusted
  // browser origins are blocked by the browser's CORS check (no header →
  // cross-origin read denied). Non-browser clients (curl, webhooks, mobile)
  // ignore CORS entirely, so omitting the header does not affect them.
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

// For webhooks invoked by Supabase DB — no browser origin, skip CORS check.
// They must still pass HMAC signature validation.
export const WEBHOOK_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
