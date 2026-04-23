// Database-backed rate limiter. Relies on public.rate_limits table created by
// the security-hardening migration. Timing-safe, no Redis dep.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

/**
 * Fixed-window rate limiter keyed by `(key_scope, key_value)`.
 * Uses a single upsert + read — one round-trip when under limit.
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  scope: string,
  value: string,
  maxRequests: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;

  const { data, error } = await admin.rpc("rl_incr_check", {
    p_scope: scope,
    p_value: value,
    p_window_start: new Date(windowStart).toISOString(),
    p_max: maxRequests,
  });

  if (error) {
    // Fail-open on infra error — don't lock out real users, but log it.
    console.error("[rate-limit] rpc failed", { scope, error: error.message });
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt,
      retryAfterSec: 0,
    };
  }

  const count = Number(data ?? 0);
  const allowed = count <= maxRequests;
  return {
    allowed,
    remaining: Math.max(0, maxRequests - count),
    resetAt,
    retryAfterSec: allowed ? 0 : Math.ceil((resetAt - now) / 1000),
  };
}

export function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
