import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X, AlertTriangle, Calendar, TrendingUp, FileText } from "lucide-react";

const MAX_CONFLICTS = 3;
const MAX_DEADLINES = 3;
const MAX_DEALS = 3;

/** Extract "€XXk rischio" from description like "Rischio penale €24.000" */
function extractRiskBadge(description: string | null): string | null {
  if (!description) return null;
  const match = description.match(/€\s*([\d.,]+)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(".", "").replace(",", "."));
  if (num >= 1000) return `€${(num / 1000).toFixed(0)}k rischio`;
  return `€${num} rischio`;
}

/** One-line key fact: take first sentence or up to 50 chars before "Rischio" */
function conflictKeyFact(description: string | null): string {
  if (!description) return "Conflitto rilevato";
  const beforeRisk = description.split(/\s*Rischio\s*/i)[0].trim();
  const truncated = beforeRisk.length > 55 ? beforeRisk.slice(0, 52) + "…" : beforeRisk;
  return truncated;
}

export const MorningBriefing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const key = `taura_briefing_${new Date().toISOString().split("T")[0]}`;
    if (sessionStorage.getItem(key)) return;

    const load = async () => {
      const { data: profile } = await supabase.from("profiles").select("last_briefing_date").eq("id", user.id).single();
      const today = new Date().toISOString().split("T")[0];
      if (profile?.last_briefing_date === today) return;

      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];
      const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];

      const [deadlines, conflicts, deals, contracts] = await Promise.all([
        supabase.from("contracts").select("id, brand, end_date, athletes(full_name)").lte("end_date", in30).gte("end_date", today).eq("status", "active").order("end_date").limit(10),
        supabase.from("conflicts").select("id, severity, description").eq("status", "open").limit(10),
        supabase.from("deals").select("id, brand, value, stage, athletes(full_name)").neq("stage", "signed").neq("stage", "lost").order("last_activity_date", { ascending: false }).limit(10),
        supabase.from("contracts").select("id", { count: "exact", head: true }),
      ]);

      const briefing = {
        deadlines: deadlines.data || [],
        conflicts: conflicts.data || [],
        activeDeals: deals.data || [],
        totalContracts: (contracts as any)?.count || 0,
      };

      if (briefing.deadlines.length > 0 || briefing.conflicts.length > 0 || briefing.activeDeals.length > 0) {
        setData(briefing);
        setOpen(true);
      }
    };
    load();
  }, [user]);

  const dismiss = async () => {
    setOpen(false);
    const today = new Date().toISOString().split("T")[0];
    sessionStorage.setItem(`taura_briefing_${today}`, "1");
    if (user) {
      await supabase.from("profiles").update({ last_briefing_date: today }).eq("id", user.id);
    }
  };

  if (!open || !data) return null;

  const hour = new Date().getHours();
  const greeting = hour >= 6 && hour < 12 ? "Buongiorno" : hour >= 12 && hour < 17 ? "Buon pomeriggio" : "Buonasera";

  const borderBySeverity = (sev: string) =>
    sev === "high"
      ? "3px solid hsl(var(--destructive))"
      : sev === "medium"
        ? "3px solid hsl(var(--taura-amber))"
        : "3px solid hsl(var(--border))";

  const conflictsSlice = data.conflicts.slice(0, MAX_CONFLICTS);
  const deadlinesSlice = data.deadlines.slice(0, MAX_DEADLINES);
  const dealsSlice = data.activeDeals.slice(0, MAX_DEALS);
  const moreConflicts = data.conflicts.length > MAX_CONFLICTS;
  const moreDeadlines = data.deadlines.length > MAX_DEADLINES;
  const moreDeals = data.activeDeals.length > MAX_DEALS;

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center" onClick={dismiss}>
      <div
        className="bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
        style={{ width: 500, maxHeight: "70vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid hsl(var(--border))",
            background: "hsl(var(--muted) / 0.3)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)", fontWeight: 600, letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}>
              {greeting}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
              Ecco cosa richiede la tua attenzione oggi.
            </div>
          </div>
          <button
            onClick={dismiss}
            style={{ padding: 6, color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer", borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = "hsl(var(--foreground))"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "hsl(var(--muted-foreground))"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content — scrollable */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {/* Conflicts */}
          {data.conflicts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={14} style={{ color: "hsl(var(--destructive))", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                  Conflitti
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {data.conflicts.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {conflictsSlice.map((c: any) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { dismiss(); navigate("/alerts"); }}
                    onKeyDown={e => e.key === "Enter" && (dismiss(), navigate("/alerts"))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      minHeight: 36,
                      padding: "0 12px",
                      background: "hsl(var(--muted) / 0.5)",
                      borderRadius: 4,
                      borderLeft: borderBySeverity(c.severity || "low"),
                      cursor: "pointer",
                      gap: 10,
                    }}
                  >
                    <span style={{ flex: 1, fontSize: "var(--text-xs)", color: "hsl(var(--foreground))", lineHeight: 1.3 }}>
                      {conflictKeyFact(c.description)}
                    </span>
                    {extractRiskBadge(c.description) && (
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          color: "hsl(var(--destructive))",
                          flexShrink: 0,
                        }}
                      >
                        {extractRiskBadge(c.description)}
                      </span>
                    )}
                  </div>
                ))}
                {moreConflicts && (
                  <button
                    type="button"
                    onClick={() => { dismiss(); navigate("/alerts"); }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      color: "hsl(var(--primary))",
                      padding: "4px 0",
                      textAlign: "left",
                    }}
                  >
                    e altri {data.conflicts.length - MAX_CONFLICTS} →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Deadlines */}
          {data.deadlines.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Calendar size={14} style={{ color: "hsl(var(--taura-amber))", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                  Scadenze
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {data.deadlines.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {deadlinesSlice.map((d: any) => {
                  const days = Math.ceil((new Date(d.end_date).getTime() - Date.now()) / 86400000);
                  const daysColor =
                    days <= 14
                      ? "hsl(var(--destructive))"
                      : days <= 30
                        ? "hsl(var(--taura-amber))"
                        : "hsl(var(--muted-foreground))";
                  return (
                    <div
                      key={d.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { dismiss(); navigate("/deadlines"); }}
                      onKeyDown={e => e.key === "Enter" && (dismiss(), navigate("/deadlines"))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        height: 36,
                        padding: "0 12px",
                        background: "hsl(var(--muted) / 0.5)",
                        borderRadius: 4,
                        borderLeft: "3px solid hsl(var(--border))",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--foreground))" }}>
                        <span style={{ fontWeight: 600 }}>{d.brand}</span>
                        {" — "}
                        {(d.athletes as any)?.full_name || "N/A"}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 600, color: daysColor }}>
                        {days}g
                      </span>
                    </div>
                  );
                })}
                {moreDeadlines && (
                  <button
                    type="button"
                    onClick={() => { dismiss(); navigate("/deadlines"); }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      color: "hsl(var(--primary))",
                      padding: "4px 0",
                      textAlign: "left",
                    }}
                  >
                    e altri {data.deadlines.length - MAX_DEADLINES} →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Active deals */}
          {data.activeDeals.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <TrendingUp size={14} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                  Deal in pipeline
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {data.activeDeals.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {dealsSlice.map((d: any) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      height: 36,
                      padding: "0 12px",
                      background: "hsl(var(--muted) / 0.5)",
                      borderRadius: 4,
                      borderLeft: "3px solid hsl(var(--border))",
                    }}
                  >
                    <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--foreground))" }}>
                      <span style={{ fontWeight: 600 }}>{d.brand}</span>
                      {" — "}
                      {(d.athletes as any)?.full_name || "N/A"}
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "hsl(var(--muted-foreground))" }}>
                      {d.value != null ? `€${Number(d.value).toLocaleString("it-IT")}` : "—"}
                    </span>
                  </div>
                ))}
                {moreDeals && (
                  <button
                    type="button"
                    onClick={() => { dismiss(); navigate("/contracts"); }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      color: "hsl(var(--primary))",
                      padding: "4px 0",
                      textAlign: "left",
                    }}
                  >
                    e altri {data.activeDeals.length - MAX_DEALS} →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingTop: 12,
              borderTop: "1px solid hsl(var(--border))",
            }}
          >
            <FileText size={14} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))" }}>
              {data.totalContracts} contratti totali nel vault
            </span>
          </div>
        </div>

        {/* Footer — CTA */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid hsl(var(--border))",
            background: "hsl(var(--muted) / 0.2)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={dismiss}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 6,
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Inizia la giornata
          </button>
        </div>
      </div>
    </div>
  );
};
