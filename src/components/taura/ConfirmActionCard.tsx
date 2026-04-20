/**
 * ConfirmActionCard — inline confirmation UI for AI write actions.
 *
 * Rendered inside the AIChatPanel message list when the edge function
 * returns { requires_confirmation: true }. The user must explicitly
 * click Conferma or Annulla before the write is executed.
 */

import { CheckCircle, XCircle, AlertTriangle, ArrowRight, LockOpen, Lock } from "lucide-react";

export interface FieldChange {
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
}

export interface ConfirmationPayload {
  action_type: string;
  human_readable_description: string;
  fields_to_change: FieldChange[];
  reversible: boolean;
}

export interface ActionPayload {
  tool: string;
  [key: string]: unknown;
}

export interface ConfirmActionCardProps {
  message: string;
  confirmation: ConfirmationPayload;
  action_payload: ActionPayload;
  onConfirm: (payload: ActionPayload) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Card title (noun phrase)
const ACTION_TITLES: Record<string, string> = {
  update_deliverable:   "Aggiornamento deliverable",
  update_deal_stage:    "Aggiornamento stage deal",
  create_deal:          "Creazione deal",
  create_notification:  "Creazione notifica",
  update_contract_field:"Aggiornamento contratto",
};

// User-facing question (replaces raw "Vuoi che esegua: tool_name?")
const ACTION_QUESTIONS: Record<string, string> = {
  update_deliverable:   "Vuoi aggiornare questo deliverable?",
  update_deal_stage:    "Vuoi spostare questo deal?",
  create_deal:          "Vuoi creare questo nuovo deal?",
  create_notification:  "Vuoi creare questa notifica?",
  update_contract_field:"Vuoi modificare questo contratto?",
};

// Italian labels for DB field names
const FIELD_LABELS: Record<string, string> = {
  scheduled_date:  "Data pubblicazione",
  stage:           "Stage pipeline",
  content_approved:"Contenuto approvato",
  post_confirmed:  "Pubblicato",
  notes:           "Note",
  value:           "Valore (€)",
  brand:           "Brand",
  status:          "Stato contratto",
  renewal_clause:  "Clausola rinnovo",
  impressions:     "Impressioni",
  reach:           "Reach",
  engagement_rate: "Engagement rate",
};

function formatValue(v: string | number | boolean | null): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sì" : "No";
  return String(v);
}

export const ConfirmActionCard = ({
  message,
  confirmation,
  action_payload,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmActionCardProps) => {
  const title    = ACTION_TITLES[confirmation.action_type]    ?? confirmation.action_type;
  const question = ACTION_QUESTIONS[confirmation.action_type] ?? "Vuoi procedere con questa azione?";

  // The edge function falls back to "Vuoi che esegua: <tool>?" when Claude
  // returns no text block — don't surface that raw string to the user.
  const isRawFallback = message.startsWith("Vuoi che esegua:");
  const showAiContext = !isRawFallback && message.trim().length > 0;

  return (
    <div
      style={{
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        background: "hsl(var(--card))",
        padding: "14px 16px",
        maxWidth: "92%",
        fontSize: "var(--text-sm)",
      }}
    >
      {/* ── Title row ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <AlertTriangle size={14} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            color: "hsl(var(--foreground))",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </span>
      </div>

      {/* ── Action question ─────────────────────────────────────────────── */}
      <p
        style={{
          color: "hsl(var(--foreground))",
          lineHeight: "var(--leading-normal)",
          marginBottom: 8,
        }}
      >
        {question}
      </p>

      {/* ── Reversibility badge (moved below question) ───────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: showAiContext ? 10 : 12 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 4,
            letterSpacing: "0.04em",
            background: confirmation.reversible
              ? "hsl(var(--muted))"
              : "hsl(38 92% 50% / 0.12)",
            color: confirmation.reversible
              ? "hsl(var(--muted-foreground))"
              : "hsl(38 70% 45%)",
            border: `1px solid ${
              confirmation.reversible
                ? "hsl(var(--border))"
                : "hsl(38 92% 50% / 0.35)"
            }`,
          }}
        >
          {confirmation.reversible
            ? <LockOpen size={9} />
            : <Lock size={9} />
          }
          {confirmation.reversible ? "reversibile" : "irreversibile"}
        </span>
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {confirmation.reversible
            ? "Puoi annullare questa modifica manualmente"
            : "Questa azione non può essere annullata automaticamente"}
        </span>
      </div>

      {/* ── Optional AI context (only when substantive) ──────────────────── */}
      {showAiContext && (
        <p
          style={{
            color: "hsl(var(--muted-foreground))",
            fontSize: "var(--text-xs)",
            marginBottom: 10,
            fontStyle: "italic",
          }}
        >
          {message}
        </p>
      )}

      {/* ── Field before → after rows ───────────────────────────────────── */}
      {confirmation.fields_to_change.length > 0 && (
        <div
          style={{
            background: "hsl(var(--muted) / 0.5)",
            borderRadius: 6,
            padding: "8px 10px",
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {confirmation.fields_to_change.map((fc, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
            >
              {/* Italian field label */}
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "hsl(var(--muted-foreground))",
                  minWidth: 120,
                  fontWeight: 500,
                }}
              >
                {FIELD_LABELS[fc.field] ?? fc.field}
              </span>

              {/* Before: null → plain "—", has value → struck-through muted red */}
              {fc.before == null ? (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "hsl(var(--muted-foreground))",
                    padding: "1px 6px",
                  }}
                >
                  —
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "hsl(0 60% 55%)",
                    background: "hsl(0 60% 55% / 0.08)",
                    padding: "1px 6px",
                    borderRadius: 3,
                    textDecoration: "line-through",
                    border: "1px solid hsl(0 60% 55% / 0.2)",
                  }}
                >
                  {formatValue(fc.before)}
                </span>
              )}

              <ArrowRight size={10} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />

              {/* After: always in primary/cyan */}
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "hsl(var(--primary))",
                  fontWeight: 600,
                  background: "hsl(var(--primary) / 0.1)",
                  padding: "1px 6px",
                  borderRadius: 3,
                  border: "1px solid hsl(var(--primary) / 0.25)",
                }}
              >
                {formatValue(fc.after)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          disabled={isLoading}
          style={{
            flex: 1,
            height: 32,
            borderRadius: 6,
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            cursor: isLoading ? "not-allowed" : "pointer",
            background: "hsl(var(--secondary))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          <XCircle size={12} />
          Annulla
        </button>
        <button
          onClick={() => onConfirm(action_payload)}
          disabled={isLoading}
          style={{
            flex: 2,
            height: 32,
            borderRadius: 6,
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          <CheckCircle size={12} />
          {isLoading ? "Esecuzione..." : "Conferma"}
        </button>
      </div>
    </div>
  );
};
