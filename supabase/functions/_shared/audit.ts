// Audit log helper — GDPR Art.30 accountability
// Best-effort insert: non blocca mai la request principale se il log fallisce.

import { sha256Hex } from "./anonymize.ts";

type SupabaseClient = {
  from: (table: string) => {
    insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => Promise<{ error: unknown }>;
  };
};

export type AuditAction =
  | "data_access"
  | "data_export"
  | "data_delete"
  | "data_create"
  | "data_update"
  | "consent_grant"
  | "consent_revoke"
  | "login"
  | "logout"
  | "ai_call"
  | "file_upload"
  | "file_download";

export interface AuditEntry {
  actor_id?: string | null;
  agency_id?: string | null;
  action: AuditAction;
  resource_type?: string;
  resource_id?: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

export async function audit(client: SupabaseClient, entry: AuditEntry): Promise<void> {
  try {
    const ip_hash = entry.ip ? await sha256Hex(entry.ip) : null;
    const { error } = await client.from("audit_log").insert({
      actor_id: entry.actor_id ?? null,
      agency_id: entry.agency_id ?? null,
      action: entry.action,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      ip_hash,
      metadata: entry.metadata ?? null,
    });
    if (error) console.warn("[audit] insert failed:", error);
  } catch (e) {
    console.warn("[audit] unexpected error:", e);
  }
}

export function extractClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}
