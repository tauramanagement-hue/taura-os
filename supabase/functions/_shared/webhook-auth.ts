// HMAC signature verification for DB-triggered webhooks.
// Use a shared secret (WAITLIST_WEBHOOK_SECRET, etc.) configured both on the
// DB webhook and the edge function env. Timing-safe comparison.

const encoder = new TextEncoder();

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify `x-webhook-signature` header against HMAC(secret, rawBody).
 * Returns the raw body so the caller can JSON.parse once without double-reading.
 */
export async function verifyWebhookSignature(
  req: Request,
  secret: string,
): Promise<{ ok: boolean; rawBody: string; reason?: string }> {
  const provided = req.headers.get("x-webhook-signature") ?? "";
  if (!provided) {
    return { ok: false, rawBody: "", reason: "missing signature header" };
  }
  const rawBody = await req.text();
  const expected = await hmacSha256(secret, rawBody);
  if (!timingSafeEqual(provided.toLowerCase(), expected.toLowerCase())) {
    return { ok: false, rawBody, reason: "signature mismatch" };
  }
  return { ok: true, rawBody };
}
