import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { WEBHOOK_CORS_HEADERS } from "../_shared/cors.ts";
import { verifyWebhookSignature } from "../_shared/webhook-auth.ts";
import { checkRateLimit, clientIpFromRequest } from "../_shared/rate-limit.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TO_ADDRESS = "hello@tauraos.com";
const FROM_ADDRESS = "Taura OS <noreply@tauraos.com>";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...WEBHOOK_CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c] || c);
}

function formatDate(input: unknown): string {
  try {
    const d = input ? new Date(input as string) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toISOString();
    return d.toLocaleString("it-IT");
  } catch {
    return new Date().toISOString();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: WEBHOOK_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const secret = Deno.env.get("WAITLIST_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[waitlist-notification] missing WAITLIST_WEBHOOK_SECRET");
    return jsonResponse({ code: "CONFIG_ERROR" }, 500);
  }

  const signed = await verifyWebhookSignature(req, secret);
  if (!signed.ok) {
    console.warn("[waitlist-notification] rejected:", signed.reason);
    return jsonResponse({ code: "UNAUTHORIZED" }, 401);
  }

  let payload: { record?: { email?: string; plan_interest?: string; source?: string; created_at?: string } };
  try {
    payload = JSON.parse(signed.rawBody);
  } catch {
    return jsonResponse({ code: "INVALID_JSON" }, 400);
  }

  const record = payload?.record;
  if (!record?.email || typeof record.email !== "string" || record.email.length > 254) {
    return jsonResponse({ code: "INVALID_PAYLOAD" }, 400);
  }

  // Rate limit per IP — protect against spam even if HMAC is leaked.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceRole) {
    const admin = createClient(supabaseUrl, serviceRole);
    const ip = clientIpFromRequest(req);
    const rl = await checkRateLimit(admin, "waitlist-notification:ip", ip, 20, 60);
    if (!rl.allowed) {
      return jsonResponse(
        { code: "RATE_LIMITED" },
        429,
      );
    }
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("[waitlist-notification] RESEND_API_KEY not configured");
    return jsonResponse({ code: "EMAIL_NOT_CONFIGURED" }, 500);
  }

  const emailSafe = escapeHtml(record.email);
  const planSafe = escapeHtml(record.plan_interest || "—");
  const sourceSafe = escapeHtml(record.source || "—");
  const dateSafe = escapeHtml(formatDate(record.created_at));

  const textBody =
    `Nuova richiesta di accesso ricevuta:\n\n` +
    `Email: ${record.email}\n` +
    `Piano interessato: ${record.plan_interest || "non specificato"}\n` +
    `Fonte: ${record.source || "unknown"}\n` +
    `Data: ${formatDate(record.created_at)}\n\n` +
    `Accedi al dashboard per gestire le richieste di accesso.`;

  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
      <h2 style="color:#0f172a;margin-bottom:20px;">Nuova richiesta di accesso</h2>
      <dl style="line-height:1.8;">
        <dt style="font-weight:600;color:#0f172a;">Email:</dt>
        <dd style="margin:0 0 12px 0;">${emailSafe}</dd>
        <dt style="font-weight:600;color:#0f172a;">Piano:</dt>
        <dd style="margin:0 0 12px 0;">${planSafe}</dd>
        <dt style="font-weight:600;color:#0f172a;">Fonte:</dt>
        <dd style="margin:0 0 12px 0;">${sourceSafe}</dd>
        <dt style="font-weight:600;color:#0f172a;">Data:</dt>
        <dd style="margin:0;">${dateSafe}</dd>
      </dl>
    </div>
  `.trim();

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: TO_ADDRESS,
        subject: `Nuova richiesta di accesso — ${record.email.slice(0, 5)}***`,
        text: textBody,
        html: htmlBody,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error("[waitlist-notification] resend failed", {
        status: response.status,
        body: errText.slice(0, 200),
      });
      return jsonResponse({ code: "EMAIL_SEND_FAILED" }, 502);
    }
    const result = await response.json();
    return jsonResponse({ ok: true, id: result.id }, 200);
  } catch (err) {
    console.error("[waitlist-notification] fatal", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return jsonResponse({ code: "INTERNAL" }, 500);
  }
});
