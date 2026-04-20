import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgencyContext } from "@/hooks/useAgencyContext";
import { SeverityBadge } from "@/components/taura/ui-primitives";
import { FileText, UserPlus, Megaphone, MessageSquare, CheckCircle2, Circle, ChevronDown, ChevronUp } from "lucide-react";
import DashboardAnalytics from "@/components/taura/DashboardAnalytics";

type Period = "Q1" | "Q2" | "Q3" | "Q4" | "YTD";

const getPeriodRange = (p: Period): { start: Date; end: Date } => {
  const now = new Date();
  const year = now.getFullYear();
  switch (p) {
    case "Q1": return { start: new Date(year, 0, 1), end: new Date(year, 3, 0, 23, 59, 59) };
    case "Q2": return { start: new Date(year, 3, 1), end: new Date(year, 6, 0, 23, 59, 59) };
    case "Q3": return { start: new Date(year, 6, 1), end: new Date(year, 9, 0, 23, 59, 59) };
    case "Q4": return { start: new Date(year, 9, 1), end: new Date(year, 12, 0, 23, 59, 59) };
    case "YTD": return { start: new Date(year, 0, 1), end: now };
  }
};

const getPrevPeriodRange = (p: Period): { start: Date; end: Date } => {
  const now = new Date();
  const year = now.getFullYear();
  const prevYear = year - 1;
  switch (p) {
    case "Q1": return { start: new Date(prevYear, 0, 1), end: new Date(prevYear, 3, 0, 23, 59, 59) };
    case "Q2": return { start: new Date(prevYear, 3, 1), end: new Date(prevYear, 6, 0, 23, 59, 59) };
    case "Q3": return { start: new Date(prevYear, 6, 1), end: new Date(prevYear, 9, 0, 23, 59, 59) };
    case "Q4": return { start: new Date(prevYear, 9, 1), end: new Date(prevYear, 12, 0, 23, 59, 59) };
    case "YTD": return { start: new Date(prevYear, 0, 1), end: new Date(prevYear, now.getMonth(), now.getDate(), 23, 59, 59) };
  }
};

const isDateInRange = (dateStr: string | null, start: Date, end: Date) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
};

// Check if a contract [startDate, endDate] overlaps with a period [periodStart, periodEnd]
const isContractActiveInPeriod = (startDate: string | null, endDate: string | null, periodStart: Date, periodEnd: Date) => {
  const s = startDate ? new Date(startDate) : new Date(0);
  const e = endDate ? new Date(endDate) : new Date(9999, 11, 31);
  return s <= periodEnd && e >= periodStart;
};

// Tipi di accordo diretto agenzia-talent (NON deal brand)
const AGENCY_AGREEMENT_TYPES = ["esclusiva", "accordo", "mandato", "rappresentanza", "agenzia", "gestione"];
const isBrandDeal = (type: string) =>
  !AGENCY_AGREEMENT_TYPES.some(t => (type || "").toLowerCase().includes(t));

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { labels } = useAgencyContext();
  const [period, setPeriod] = useState<Period>("YTD");
  const [stats, setStats] = useState({ roster: 0, underContract: 0, dealCount: 0, revenue: 0, pipeline: 0, pipelineDeals: 0, conflicts: 0, commissions: 0 });
  const [prevStats, setPrevStats] = useState({ revenue: 0, dealCount: 0, pipeline: 0, roster: 0, commissions: 0 });
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [briefings, setBriefings] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; value: number }[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [checklist, setChecklist] = useState({ contract: false, athlete: false, threeContracts: false, colleague: false, chatMsg: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    const range = getPeriodRange(period);

    const [athletesRes, contractsRes, dealsRes, conflictsRes, notifRes, agencyCommRes] = await Promise.all([
      supabase.from("athletes").select("id").eq("status", "active"),
      supabase.from("contracts").select("id, brand, contract_type, value, end_date, start_date, status, athlete_id, commission_type, commission_value, athletes(full_name)").order("end_date"),
      supabase.from("deals").select("id, brand, athlete_id, value, stage, probability, created_at, updated_at, athletes(full_name)").order("probability", { ascending: false }),
      supabase.from("conflicts").select("id, description, severity, status").eq("status", "open"),
      supabase.from("notifications").select("id, title, message, severity, type, related_entity_type, is_read").eq("is_read", false).order("created_at", { ascending: false }).limit(4),
      supabase.from("profiles").select("agencies(default_commission_type, default_commission_value)").eq("id", user?.id || "").single(),
    ]);

    const allContracts = contractsRes.data || [];
    const allDeals = dealsRes.data || [];
    const conflicts = conflictsRes.data || [];
    const notifications = notifRes.data || [];
    const agencyComm = (agencyCommRes.data as any)?.agencies;
    const defaultCommType: string = agencyComm?.default_commission_type || "pct";
    const defaultCommValue: number = agencyComm?.default_commission_value ?? 15;

    const calcCommission = (c: any) => {
      const type = c.commission_type || defaultCommType;
      const val = c.commission_value ?? defaultCommValue;
      return type === "fixed" ? val : (c.value || 0) * val / 100;
    };

    // Separa contratti brand-talent (deal) da accordi diretti agenzia-talent (mandati)
    const brandContracts = allContracts.filter((c: any) => isBrandDeal(c.contract_type));
    const agencyContracts = allContracts.filter((c: any) => !isBrandDeal(c.contract_type));

    // Filtra per il periodo corrente: un contratto è incluso se è attivo (anche parzialmente) nel periodo
    const periodBrandDeals = brandContracts.filter((c: any) =>
      isContractActiveInPeriod(c.start_date, c.end_date, range.start, range.end)
    );
    const periodAgencyContracts = agencyContracts.filter((c: any) =>
      isContractActiveInPeriod(c.start_date, c.end_date, range.start, range.end)
    );

    // Monte Deal = solo deal brand-talent attivi nel periodo
    const activeBrandDeals = periodBrandDeals.filter((c: any) => c.status === "active" || !c.status);
    const revenue = activeBrandDeals.reduce((sum: number, c: any) => sum + (c.value || 0), 0);
    const totalCommissions = activeBrandDeals.reduce((sum: number, c: any) => sum + calcCommission(c), 0);

    // Pipeline CRM = deal non firmati nel periodo, valore ponderato per probabilità
    const periodPipelineDeals = allDeals.filter((d: any) => {
      const dateOk = isDateInRange(d.updated_at || d.created_at, range.start, range.end);
      return dateOk && d.stage !== "signed";
    });
    const pipelineValue = periodPipelineDeals.reduce(
      (sum: number, d: any) => sum + ((d.value || 0) * (d.probability || 50) / 100), 0
    );

    // Roster = talent unici con mandato agenzia attivo + talent in deal brand nel periodo
    const agencyAthleteIds = new Set(periodAgencyContracts.map((c: any) => c.athlete_id).filter(Boolean));
    const brandAthleteIds = new Set(periodBrandDeals.map((c: any) => c.athlete_id).filter(Boolean));
    const rosterIds = new Set([...agencyAthleteIds, ...brandAthleteIds]);

    setStats({
      roster: rosterIds.size,
      underContract: agencyAthleteIds.size,
      dealCount: periodBrandDeals.length,
      revenue,
      pipeline: pipelineValue,
      pipelineDeals: periodPipelineDeals.length,
      conflicts: conflicts.length,
      commissions: totalCommissions,
    });

    // Periodo precedente per confronto
    const prevRange = getPrevPeriodRange(period);
    const prevBrandDeals = brandContracts.filter((c: any) =>
      isContractActiveInPeriod(c.start_date, c.end_date, prevRange.start, prevRange.end)
    );
    const prevAgencyContracts = agencyContracts.filter((c: any) =>
      isContractActiveInPeriod(c.start_date, c.end_date, prevRange.start, prevRange.end)
    );
    const prevActiveBrandDeals = prevBrandDeals.filter((c: any) => c.status === "active" || !c.status);
    const prevRevenue = prevActiveBrandDeals.reduce((sum: number, c: any) => sum + (c.value || 0), 0);
    const prevCommissions = prevActiveBrandDeals.reduce((sum: number, c: any) => sum + calcCommission(c), 0);
    const prevPipelineDeals = allDeals.filter((d: any) =>
      isDateInRange(d.updated_at || d.created_at, prevRange.start, prevRange.end) && d.stage !== "signed"
    );
    const prevPipeline = prevPipelineDeals.reduce(
      (sum: number, d: any) => sum + ((d.value || 0) * (d.probability || 50) / 100), 0
    );
    const prevAgencyIds = new Set(prevAgencyContracts.map((c: any) => c.athlete_id).filter(Boolean));
    const prevBrandIds = new Set(prevBrandDeals.map((c: any) => c.athlete_id).filter(Boolean));
    const prevRoster = new Set([...prevAgencyIds, ...prevBrandIds]).size;
    setPrevStats({ revenue: prevRevenue, dealCount: prevBrandDeals.length, pipeline: prevPipeline, roster: prevRoster, commissions: prevCommissions });

    const monthLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const monthMap: Record<string, number> = {};
    const chartYear = range.start.getFullYear();
    const todayForChart = new Date();

    if (period === "YTD") {
      // Solo mesi passati/correnti — non mostrare mesi futuri
      for (let i = 0; i <= todayForChart.getMonth(); i++) {
        const key = `${chartYear}-${String(i + 1).padStart(2, "0")}`;
        monthMap[key] = 0;
      }
    } else {
      const startMonth = range.start.getMonth();
      const endMonth = range.end.getMonth();
      for (let i = startMonth; i <= endMonth; i++) {
        const key = `${chartYear}-${String(i + 1).padStart(2, "0")}`;
        monthMap[key] = 0;
      }
    }

    // Grafico mensile: portfolio attivo per mese (overlap, coerente con i KPI card)
    const activeForChart = brandContracts.filter((c: any) => c.status === "active" || !c.status);
    Object.keys(monthMap).forEach((key) => {
      const [ky, km] = key.split("-").map(Number);
      const mStart = new Date(ky, km - 1, 1);
      const mEnd = new Date(ky, km, 0, 23, 59, 59);
      monthMap[key] = activeForChart
        .filter((c: any) => isContractActiveInPeriod(c.start_date, c.end_date, mStart, mEnd))
        .reduce((sum: number, c: any) => sum + (Number(c.value) || 0), 0);
    });

    const mr = Object.entries(monthMap).map(([key, val]) => ({
      month: monthLabels[parseInt(key.split("-")[1]) - 1],
      value: val,
    }));
    setMonthlyRevenue(mr);

    const today = new Date();
    // Scadenze: mostra mandati agenzia-talent in scadenza (le più critiche) + deal brand in scadenza
    const dl = allContracts
      .map((c: any) => ({
        ...c,
        athlete_name: c.athletes?.full_name || "N/A",
        days: Math.ceil((new Date(c.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        isAgencyContract: !isBrandDeal(c.contract_type),
      }))
      .filter((c: any) => c.days >= 0 && c.days <= 120)
      .sort((a: any, b: any) => (a.isAgencyContract === b.isAgencyContract ? a.days - b.days : a.isAgencyContract ? -1 : 1))
      .slice(0, 5);
    setDeadlines(dl);

    // Pipeline widget: deal CRM in corso (non firmati)
    setDeals(periodPipelineDeals.slice(0, 4).map((d: any) => ({ ...d, athlete_name: d.athletes?.full_name || "N/A" })));

    const br: any[] = [];
    conflicts.slice(0, 2).forEach((c: any) => {
      br.push({ icon: "🛡", text: c.description, sev: c.severity === "high" ? "ALTO" : c.severity === "medium" ? "MEDIO" : "BASSO", link: "/alerts" });
    });
    dl.slice(0, 2).forEach((d: any) => {
      br.push({ icon: "⏰", text: `${d.athlete_name}/${d.brand} — mancano ${d.days}gg alla chiusura`, sev: d.days <= 14 ? "ALTO" : "MEDIO", link: "/deadlines" });
    });
    notifications.filter((n: any) => n.type === "deal" || n.type === "campaign").slice(0, 2).forEach((n: any) => {
      br.push({ icon: n.type === "deal" ? "💰" : "📊", text: n.message, link: n.related_entity_type === "deal" ? "/contracts" : "/campaigns" });
    });
    setBriefings(br.slice(0, 4));

    const { data: activityData } = await supabase.from("activities").select("id, activity_type, description, created_at").order("created_at", { ascending: false }).limit(8);
    if (activityData) setActivities(activityData);

    const chatMsgsRes = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("role", "user");
    const { data: profilesData } = await supabase.from("profiles").select("id, agency_id");
    const agencyProfiles = profilesData?.filter((p: any) => p.agency_id) || [];
    setChecklist({
      contract: allContracts.length > 0,
      athlete: (athletesRes.data?.length ?? 0) > 0,
      threeContracts: allContracts.length >= 3,
      colleague: agencyProfiles.length > 1,
      chatMsg: (chatMsgsRes.count ?? 0) > 0,
    });

    setLoading(false);
  };

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (n >= 1_000) return `€${Math.round(n / 1_000).toLocaleString("it-IT")}k`;
    return `€${n.toLocaleString("it-IT")}`;
  };

  const maxRev = Math.max(...monthlyRevenue.map(m => m.value), 1);

  const calcTrend = (curr: number, prev: number): { pct: number; up: boolean } | null => {
    if (prev === 0) return null;
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
  };

  const revTrend = calcTrend(stats.revenue, prevStats.revenue);
  const dealTrend = calcTrend(stats.dealCount, prevStats.dealCount);
  const pipelineTrend = calcTrend(stats.pipeline, prevStats.pipeline);
  const rosterTrend = calcTrend(stats.roster, prevStats.roster);
  const commTrend = calcTrend(stats.commissions, prevStats.commissions);

  const statCards = [
    {
      label: `MONTE DEAL ${period}`,
      value: fmt(stats.revenue),
      subLabel: `${stats.dealCount} deal firmati`,
      delta: revTrend ? (revTrend.up ? revTrend.pct : -revTrend.pct) : undefined,
    },
    {
      label: "PIPELINE",
      value: fmt(stats.pipeline),
      subLabel: `${stats.pipelineDeals} deal in corso`,
      delta: pipelineTrend ? (pipelineTrend.up ? pipelineTrend.pct : -pipelineTrend.pct) : undefined,
    },
    {
      label: "ROSTER",
      value: String(stats.roster),
      subLabel: `${stats.underContract} sotto mandato`,
      delta: rosterTrend ? (rosterTrend.up ? rosterTrend.pct : -rosterTrend.pct) : undefined,
    },
    {
      label: "COMMISSIONI",
      value: fmt(stats.commissions),
      subLabel: `${stats.dealCount} deal · ${period}`,
      delta: commTrend ? (commTrend.up ? commTrend.pct : -commTrend.pct) : undefined,
    },
  ];

  const [checklistOpen, setChecklistOpen] = useState(false);
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const hasActivity = stats.athletes > 0 || stats.contracts > 0;

  const stageLabels: Record<string, string> = { inbound: "Inbound", proposal: "Proposta", negotiation: "Negoziazione", closing: "Closing" };

  const formattedDate = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="flex-1 overflow-y-auto bg-background" style={{ paddingBottom: 40 }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "hsl(var(--foreground))",
            lineHeight: 1.15,
          }}>
            Command Center
          </h1>
          <p style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", marginTop: 2, fontFamily: "var(--font-mono)" }}>
            {formattedDate} · Dati live
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {stats.conflicts > 0 && (
            <button
              onClick={() => navigate("/alerts")}
              style={{
                height: 28,
                padding: "0 10px",
                borderRadius: 4,
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                border: "1px solid hsl(var(--destructive) / 0.4)",
                background: "hsl(var(--destructive) / 0.08)",
                color: "hsl(var(--destructive))",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(var(--destructive))", display: "inline-block" }} />
              {stats.conflicts} conflitti
            </button>
          )}
          <div style={{ display: "flex", gap: 3 }}>
            {(["Q1", "Q2", "Q3", "Q4", "YTD"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 4,
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  border: "1px solid",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: period === p ? "hsl(var(--primary))" : "transparent",
                  color: period === p ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                  borderColor: period === p ? "hsl(var(--primary))" : "hsl(var(--border) / 0.7)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards — no sparklines */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {statCards.map((s, i) => (
          <div key={i} className="taura-card" style={{ padding: "18px 20px" }}>
            <div className="label-overline" style={{ marginBottom: 10 }}>{s.label}</div>
            <div className="stat-value" style={{ color: "hsl(var(--foreground))", marginBottom: 6 }}>
              {s.value}
            </div>
            {s.delta !== undefined && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                fontFamily: "var(--font-mono)",
                color: s.delta >= 0 ? "hsl(var(--taura-green))" : "hsl(var(--taura-red))",
              }}>
                <span>{s.delta >= 0 ? "↑" : "↓"}</span>
                <span>{Math.abs(s.delta)}%</span>
                <span style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-sans)" }}>
                  vs prev.
                </span>
              </div>
            )}
            {s.subLabel && s.delta === undefined && (
              <div style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                {s.subLabel}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions bar */}
      <div style={{
        display: "flex",
        gap: 20,
        padding: "10px 0",
        borderTop: "1px solid hsl(var(--border) / 0.7)",
        borderBottom: "1px solid hsl(var(--border) / 0.7)",
        marginBottom: 16,
      }}>
        {[
          { icon: FileText, label: "Carica contratto", action: () => navigate("/contracts") },
          { icon: UserPlus, label: `Aggiungi ${labels.personLabel.toLowerCase()}`, action: () => navigate("/athletes") },
          { icon: Megaphone, label: "Campagne", action: () => navigate("/campaigns") },
          { icon: MessageSquare, label: "Chiedi all'AI", action: () => { document.querySelector<HTMLButtonElement>('[data-chat-toggle]')?.click(); } },
        ].map((qa, i) => (
          <button
            key={i}
            onClick={qa.action}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: "hsl(var(--muted-foreground))",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "hsl(var(--foreground))"}
            onMouseLeave={e => e.currentTarget.style.color = "hsl(var(--muted-foreground))"}
          >
            <qa.icon size={13} />
            {qa.label}
            <span style={{ fontSize: 10, opacity: 0.5 }}>→</span>
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

        {/* Monte Contratti bar chart */}
        <div
          className="taura-card"
          style={{ padding: 16, cursor: "pointer" }}
          onClick={() => navigate("/reports/monte-contratti")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}>
                Monte Deal
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                {fmt(stats.revenue)}
              </div>
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--primary))", fontWeight: 500 }}>Dettagli →</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
            {monthlyRevenue.map((m, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: "100%",
                    borderRadius: "2px 2px 0 0",
                    background: i === monthlyRevenue.length - 1 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)",
                    height: Math.max((m.value / maxRev) * 68, 2),
                    transition: "height 0.3s ease",
                  }}
                />
                <span style={{ fontSize: 8, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Briefing */}
        <div className="taura-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              background: "hsl(var(--primary) / 0.1)",
              color: "hsl(var(--primary))",
            }}>◈</div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              AI Briefing
            </span>
          </div>
          {briefings.length === 0 && !loading ? (
            <p style={{ fontSize: "var(--text-sm)", color: "hsl(var(--muted-foreground))", padding: "12px 0" }}>
              Nessun alert attivo. Tutto sotto controllo.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {briefings.map((b, i) => (
                <div
                  key={i}
                  onClick={() => b.link && navigate(b.link)}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "7px 10px",
                    background: "hsl(var(--muted))",
                    border: "1px solid hsl(var(--border) / 0.7)",
                    borderRadius: 4,
                    alignItems: "flex-start",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.3)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(var(--border) / 0.7)")}
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{b.icon}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--foreground))", lineHeight: "var(--leading-snug)", flex: 1 }}>
                    {b.text}
                  </span>
                  {b.sev && <SeverityBadge level={b.sev} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scadenze — data-row pattern */}
        <div className="taura-card">
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: deadlines.length > 0 ? "1px solid hsl(var(--border) / 0.7)" : "none",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Scadenze
            </span>
            <span
              onClick={() => navigate("/deadlines")}
              style={{ fontSize: "var(--text-xs)", color: "hsl(var(--primary))", cursor: "pointer", fontWeight: 500 }}
            >
              Vedi tutte →
            </span>
          </div>
          {deadlines.length === 0 && !loading ? (
            <div style={{ padding: "16px", fontSize: "var(--text-sm)", color: "hsl(var(--muted-foreground))", textAlign: "center" }}>
              Nessuna scadenza imminente
            </div>
          ) : (
            deadlines.map((s, i) => (
              <div key={i} className="data-row" onClick={() => navigate("/deadlines")}>
                <span style={{ flex: 1, fontWeight: 500, fontSize: "var(--text-sm)" }}>{s.athlete_name}</span>
                <span style={{ color: "hsl(var(--muted-foreground))", marginRight: 12, fontSize: "var(--text-xs)" }}>{s.brand}</span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: s.days <= 14 ? "hsl(var(--taura-red))" : s.days <= 30 ? "hsl(var(--taura-amber))" : "hsl(var(--muted-foreground))",
                }}>
                  {s.days}g
                </span>
              </div>
            ))
          )}
        </div>

        {/* Pipeline deals */}
        <div className="taura-card">
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: deals.length > 0 ? "1px solid hsl(var(--border) / 0.7)" : "none",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Pipeline CRM
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
              {stats.pipelineDeals} deal · atteso {fmt(stats.pipeline)}
            </span>
          </div>
          {deals.length === 0 && !loading ? (
            <div style={{ padding: "16px", fontSize: "var(--text-sm)", color: "hsl(var(--muted-foreground))", textAlign: "center" }}>
              Nessun deal in pipeline
            </div>
          ) : (
            deals.map((d, i) => (
              <div key={i} className="data-row">
                <span style={{ flex: 1, fontWeight: 500, fontSize: "var(--text-sm)" }}>
                  {d.brand}
                  <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 400 }}> · {d.athlete_name}</span>
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", marginRight: 12 }}>
                  {stageLabels[d.stage] || d.stage}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 600, color: "hsl(var(--foreground))" }}>
                  {d.value ? fmt(d.value) : "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Analytics */}
      <DashboardAnalytics periodStart={getPeriodRange(period).start} periodEnd={getPeriodRange(period).end} />

      {/* Activity Feed */}
      {activities.length > 0 && (
        <div className="taura-card" style={{ marginTop: 10, padding: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 12 }}>
            Attività recenti
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {activities.map((a: any) => {
              const icons: Record<string, string> = { contract_uploaded: "📄", deal_created: "💰", deal_stage_changed: "🔄", conflict_detected: "⚠️", campaign_created: "📢", note_added: "📝" };
              const timeAgo = (date: string) => { const diff = Date.now() - new Date(date).getTime(); const h = Math.floor(diff / 3600000); if (h < 1) return "Poco fa"; if (h < 24) return `${h}h fa`; const d = Math.floor(h / 24); if (d < 7) return `${d}gg fa`; return new Date(date).toLocaleDateString("it-IT"); };
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingTop: 4, paddingBottom: 4 }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{icons[a.activity_type] || "📌"}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--foreground))", flex: 1 }}>{a.description}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Setup Checklist — collapsible, hidden by default when there's activity */}
      {!Object.values(checklist).every(Boolean) && !loading && (
        <div className="taura-card" style={{ marginTop: 10 }}>
          <button
            onClick={() => setChecklistOpen(!checklistOpen)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "hsl(var(--foreground))",
            }}
          >
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Setup checklist
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
                {completedCount}/5
              </span>
              {checklistOpen ? <ChevronUp size={14} color="hsl(var(--muted-foreground))" /> : <ChevronDown size={14} color="hsl(var(--muted-foreground))" />}
            </div>
          </button>
          {checklistOpen && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ width: "100%", height: 2, background: "hsl(var(--muted))", borderRadius: 99, marginBottom: 12 }}>
                <div style={{ height: 2, borderRadius: 99, background: "hsl(var(--primary))", width: `${(completedCount / 5) * 100}%`, transition: "width 0.3s ease" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  { done: checklist.contract, label: "Primo contratto", action: () => navigate("/contracts") },
                  { done: checklist.athlete, label: `Aggiungi ${labels.personLabel.toLowerCase()}`, action: () => navigate("/athletes") },
                  { done: checklist.threeContracts, label: "3 contratti caricati", action: () => navigate("/contracts") },
                  { done: checklist.colleague, label: "Invita collega", action: () => navigate("/settings") },
                  { done: checklist.chatMsg, label: "Chiedi all'AI", action: () => {} },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 4,
                      fontSize: "var(--text-xs)",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      border: "1px solid",
                      background: item.done ? "hsl(var(--primary) / 0.08)" : "transparent",
                      color: item.done ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      borderColor: item.done ? "hsl(var(--primary) / 0.3)" : "hsl(var(--border) / 0.7)",
                    }}
                  >
                    {item.done ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
