/**
 * ConfirmActionCard — inline confirmation UI for AI write actions.
 *
 * Rendered inside the AIChatPanel message list when the edge function
 * returns { requires_confirmation: true }. The user must explicitly
 * click Conferma or Annulla before the write is executed.
 */

import { CheckCircle, XCircle, AlertTriangle, ArrowRight } from "lucide-react";

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

const ACTION_LABELS: Record<string, string> = {
  update_deliverable: "Aggiornamento deliverable",
  update_deal_stage: "Aggiornamento stage deal",
  create_deal: "Creazione deal",
  create_notification: "Creazione notifica",
  update_contract_field: "Aggiornamento contratto",
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
  const actionLabel = ACTION_LABELS[confirmation.action_type] ?? confirmation.action_type;

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
      {/* Header */}
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
          {actionLabel}
        </span>
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            padding: "1px 6px",
            borderRadius: 3,
            background: confirmation.reversible
              ? "hsl(var(--muted))"
              : "hsl(var(--destructive) / 0.1)",
            color: confirmation.reversible
              ? "hsl(var(--muted-foreground))"
              : "hsl(var(--destructive))",
            border: `1px solid ${confirmation.reversible ? "hsl(var(--border))" : "hsl(var(--destructive) / 0.3)"}`,
            letterSpacing: "0.04em",
          }}
        >
          {confirmation.reversible ? "reversibile" : "irreversibile"}
        </span>
      </div>

      {/* AI message */}
      <p
        style={{
          color: "hsl(var(--foreground))",
          lineHeight: "var(--leading-normal)",
          marginBottom: 10,
        }}
      >
        {message}
      </p>

      {/* Human-readable description */}
      <p
        style={{
          color: "hsl(var(--muted-foreground))",
          fontSize: "var(--text-xs)",
          marginBottom: confirmation.fields_to_change.length > 0 ? 10 : 14,
          fontStyle: "italic",
        }}
      >
        {confirmation.human_readable_description}
      </p>

      {/* Fields before/after */}
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
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                  color: "hsl(var(--muted-foreground))",
                  minWidth: 100,
                }}
              >
                {fc.field}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "hsl(var(--muted-foreground))",
                  background: "hsl(var(--muted))",
                  padding: "1px 6px",
                  borderRadius: 3,
                  textDecoration: "line-through",
                }}
              >
                {formatValue(fc.before)}
              </span>
              <ArrowRight size={10} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
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

      {/* Action buttons */}
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
