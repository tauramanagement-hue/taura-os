import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, TrendingUp, FileText, Users, ChevronRight } from "lucide-react";

type ContractRow = {
  id: string;
  brand: string;
  value: number | null;
  contract_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  exclusivity_category: string | null;
  athlete_id: string;
  athletes?: { full_name: string; sport?: string } | null;
};

const euro = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const fmt = (n: number) => {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return euro(n);
};

const daysLeft = (end: string | null) => {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: "Attivo",    color: "hsl(var(--primary))" },
  renewing: { label: "Rinnovo",   color: "hsl(45 90% 55%)" },
  expired:  { label: "Scaduto",   color: "hsl(var(--destructive))" },
  draft:    { label: "Bozza",     color: "hsl(var(--muted-foreground))" },
};

// Hardcoded hex colors — CSS vars don't resolve inside SVG (Recharts)
const COLORS = [
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#f97316", // orange
  "#22c55e", // green
  "#e879f9", // fuchsia
  "#facc15", // yellow
  "#3b82f6", // blue
  "#f43f5e", // rose
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--popover-foreground))",
  fontSize: 11,
};

const ReportsMonteContrattiPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [aiOverview, setAiOverview] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("active");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("contracts")
        .select("id, brand, value, contract_type, status, start_date, end_date, exclusivity_category, athlete_id, athletes(full_name, sport)")
        .order("value", { ascending: false });
      if (!error && data) setContracts(data as ContractRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() =>
    statusFilter === "all" ? contracts : contracts.filter(c => c.status === statusFilter),
    [contracts, statusFilter]);

  // KPIs
  const totalActive  = useMemo(() => contracts.filter(c => c.status === "active").reduce((s, c) => s + (c.value || 0), 0), [contracts]);
  const totalAll     = useMemo(() => contracts.reduce((s, c) => s + (c.value || 0), 0), [contracts]);
  const activeCount  = useMemo(() => contracts.filter(c => c.status === "active").length, [contracts]);
  const expiringCount = useMemo(() => contracts.filter(c => {
    const d = daysLeft(c.end_date);
    return c.status === "active" && d !== null && d >= 0 && d <= 60;
  }).length, [contracts]);
  const avgValue = activeCount > 0 ? Math.round(totalActive / activeCount) : 0;

  // By type (for bar chart)
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of filtered) {
      const t = c.contract_type || "Altro";
      map.set(t, (map.get(t) || 0) + (c.value || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // By talent
  const byTalent = useMemo(() => {
    const map = new Map<string, { value: number; count: number; sport: string }>();
    for (const c of filtered) {
      const name = c.athletes?.full_name || "N/D";
      const existing = map.get(name) || { value: 0, count: 0, sport: c.athletes?.sport || "" };
      map.set(name, { value: existing.value + (c.value || 0), count: existing.count + 1, sport: existing.sport });
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // By brand (pie)
  const byBrand = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of filtered) map.set(c.brand, (map.get(c.brand) || 0) + (c.value || 0));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [filtered]);

  // By status (for pie)
  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contracts) map.set(c.status || "N/D", (map.get(c.status || "N/D") || 0) + (c.value || 0));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [contracts]);

  // Expiring soon (next 60 days, active only)
  const expiringSoon = useMemo(() => contracts
    .filter(c => {
      const d = daysLeft(c.end_date);
      return c.status === "active" && d !== null && d >= 0 && d <= 60;
    })
    .sort((a, b) => (daysLeft(a.end_date) ?? 999) - (daysLeft(b.end_date) ?? 999))
    .slice(0, 6),
  [contracts]);

  // By exclusivity category
  const byExclusivity = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of filtered) {
      const cat = c.exclusivity_category || "N/D";
      map.set(cat, (map.get(cat) || 0) + (c.value || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  const totalFiltered = useMemo(() => filtered.reduce((s, c) => s + (c.value || 0), 0), [filtered]);
  const maxTalentVal  = byTalent[0]?.value || 1;

  const generateAiOverview = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setAiOverview("Effettua l'accesso."); setAiLoading(false); return; }

      const ctx = {
        total_monte_contratti: totalActive,
        contracts_count: activeCount,
        contracts_expiring_60d: expiringCount,
        avg_contract_value: avgValue,
        top_talents: byTalent.slice(0, 8).map(t => ({ name: t.name, value: t.value, contracts: t.count })),
        top_brands: byBrand.slice(0, 6),
        by_type: byType,
        expiring_soon: expiringSoon.map(c => ({
          athlete: c.athletes?.full_name, brand: c.brand, days_left: daysLeft(c.end_date), value: c.value
        })),
      };

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Genera un report operativo sul portfolio contrattuale dell'agenzia. Dati:\n${JSON.stringify(ctx, null, 2)}\n\nIncludere: sintesi valore, contratti in scadenza urgente, top talent e raccomandazioni. Usa **grassetto** per nomi e cifre chiave. Massimo 200 parole.`,
          }],
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Errore generazione");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let out = "";
      let buf = "";
      const STREAM_TIMEOUT = 30000;
      const MAX_BUFFER = 100 * 1024;
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await Promise.race([
            reader.read(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), STREAM_TIMEOUT)),
          ]);
        } catch {
          reader.cancel();
          if (!out) throw new Error("Timeout");
          break;
        }
        const { done, value } = result;
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        if (buf.length > MAX_BUFFER) { reader.cancel(); break; }
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try { const chunk = JSON.parse(payload).choices?.[0]?.delta?.content; if (chunk) { out += chunk; setAiOverview(out); } } catch {}
        }
      }
    } catch (e: any) {
      setAiOverview(`⚠️ ${e.message || "Errore"}`);
    }
    setAiLoading(false);
  };

  const statusTabs = [
    { key: "all",     label: `Tutti (${contracts.length})` },
    { key: "active",  label: `Attivi (${contracts.filter(c => c.status === "active").length})` },
    { key: "renewing",label: `Rinnovo (${contracts.filter(c => c.status === "renewing").length})` },
    { key: "expired", label: `Scaduti (${contracts.filter(c => c.status === "expired").length})` },
  ];

  if (loading) return (
    <div className="p-5 flex items-center justify-center min-h-[400px]">
      <div className="text-muted-foreground text-sm font-mono">Caricamento contratti...</div>
    </div>
  );

  return (
    <div className="p-5 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight">Portfolio Contratti</h1>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Analisi finanziaria del portfolio contrattuale</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { icon: TrendingUp, label: "Valore Attivo", value: fmt(totalActive), sub: `${activeCount} contratti` },
          { icon: FileText,   label: "Valore Totale Portfolio", value: fmt(totalAll), sub: `tutti gli stati` },
          { icon: Users,      label: "Valore Medio Contratto", value: fmt(avgValue), sub: `su contratti attivi` },
          { icon: AlertTriangle, label: "In Scadenza (60gg)", value: String(expiringCount), sub: "richiedono attenzione", alert: expiringCount > 0 },
        ].map((k, i) => (
          <div key={i} className={`bg-card rounded-xl border p-4 ${k.alert ? "border-yellow-500/40" : "border-border"}`}>
            <div className="flex items-center gap-2 mb-2">
              <k.icon size={13} className={k.alert ? "text-yellow-500" : "text-muted-foreground"} />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{k.label}</span>
            </div>
            <div className={`text-[22px] font-black tracking-tight ${k.alert && expiringCount > 0 ? "text-yellow-500" : "text-foreground"}`}>
              {k.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 mb-4">
        {statusTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              statusFilter === t.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto text-[11px] text-muted-foreground font-mono self-center">
          Totale filtrato: <span className="text-foreground font-bold">{fmt(totalFiltered)}</span>
        </div>
      </div>

      {/* Scadenze urgenti */}
      {expiringSoon.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={13} className="text-yellow-500" />
            <span className="text-[12px] font-bold text-yellow-500">Contratti in scadenza — prossimi 60 giorni</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {expiringSoon.map(c => {
              const d = daysLeft(c.end_date);
              const urgent = d !== null && d <= 30;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-card rounded-lg border border-border p-3 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => navigate(`/contracts/${c.id}`)}
                >
                  <div>
                    <div className="text-[12px] font-bold text-foreground">{c.athletes?.full_name || "N/D"}</div>
                    <div className="text-[10px] text-muted-foreground">{c.brand} · {fmt(c.value || 0)}</div>
                  </div>
                  <div className={`text-[11px] font-bold font-mono shrink-0 ml-2 ${urgent ? "text-red-500" : "text-yellow-500"}`}>
                    {d}gg
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main grid: type + talent */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {/* Breakdown per tipo contratto (3/5) */}
        <div className="col-span-3 bg-card rounded-xl border border-border p-4">
          <div className="text-[12px] font-bold text-foreground mb-3">Valore per tipo contratto</div>
          {byType.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">Nessun dato</div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType} layout="vertical" barCategoryGap="25%">
                  <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [euro(Number(v)), "Valore"]} contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--border) / 0.3)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Breakdown per esclusività (2/5) */}
        <div className="col-span-2 bg-card rounded-xl border border-border p-4">
          <div className="text-[12px] font-bold text-foreground mb-3">Categorie di esclusività</div>
          {byExclusivity.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">Nessuna esclusività mappata</div>
          ) : (
            <div className="space-y-2">
              {byExclusivity.map((e, i) => (
                <div key={e.name}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[11px] text-foreground truncate pr-2">{e.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{fmt(e.value)}</span>
                  </div>
                  <div className="h-1 bg-secondary rounded-full">
                    <div
                      className="h-1 rounded-full transition-all"
                      style={{ width: `${Math.round((e.value / (byExclusivity[0]?.value || 1)) * 100)}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Talent + Brand grid */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {/* Top talent (3/5) */}
        <div className="col-span-3 bg-card rounded-xl border border-border p-4">
          <div className="text-[12px] font-bold text-foreground mb-3">Ranking talent per valore contratti</div>
          <div className="space-y-2">
            {byTalent.slice(0, 8).map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <div className="text-[10px] text-muted-foreground font-mono w-4 shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[12px] font-semibold text-foreground truncate">{t.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground">{t.count} contr.</span>
                      <span className="text-[12px] font-bold font-mono text-foreground">{fmt(t.value)}</span>
                    </div>
                  </div>
                  <div className="h-1 bg-secondary rounded-full">
                    <div
                      className="h-1 rounded-full transition-all"
                      style={{ width: `${Math.round((t.value / maxTalentVal) * 100)}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
                <ChevronRight size={12} className="text-muted-foreground/40 shrink-0 cursor-pointer hover:text-foreground" />
              </div>
            ))}
          </div>
        </div>

        {/* Brand breakdown pie (2/5) */}
        <div className="col-span-2 bg-card rounded-xl border border-border p-4 flex flex-col">
          <div className="text-[12px] font-bold text-foreground mb-3">Top brand per valore</div>
          {byBrand.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">Nessun dato</div>
          ) : (
            <>
              <div className="h-[160px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byBrand} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3} stroke="none">
                      {byBrand.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [euro(Number(v)), "Valore"]} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Custom legend */}
              <div className="mt-2 space-y-1 overflow-hidden">
                {byBrand.map((b, i) => (
                  <div key={b.name} className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] text-foreground truncate flex-1">{b.name}</span>
                    <span className="text-[9px] text-muted-foreground font-mono shrink-0">{fmt(b.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status distribution */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {byStatus.map((s, i) => {
          const cfg = STATUS_LABELS[s.name] || { label: s.name, color: "hsl(var(--muted-foreground))" };
          const count = contracts.filter(c => c.status === s.name).length;
          return (
            <div key={s.name} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
              <div className="w-2 h-10 rounded-full shrink-0" style={{ background: cfg.color }} />
              <div>
                <div className="text-[11px] text-muted-foreground">{cfg.label}</div>
                <div className="text-[15px] font-black text-foreground font-mono">{fmt(s.value)}</div>
                <div className="text-[10px] text-muted-foreground">{count} contratti</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI overview — auto-generates */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[13px] font-bold text-foreground">Analisi AI</div>
            <div className="text-[10px] text-muted-foreground font-mono">Sintesi operativa e raccomandazioni</div>
          </div>
          <button
            onClick={generateAiOverview}
            disabled={aiLoading}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[12px] font-bold cursor-pointer glow-accent-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {aiLoading ? "Generazione..." : aiOverview ? "Rigenera" : "Genera"}
          </button>
        </div>
        {aiOverview ? (
          <div className="prose prose-invert prose-sm max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-[hsl(var(--taura-accent))] [&_strong]:font-semibold">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{aiOverview}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-[12px] text-muted-foreground">
            Clicca "Genera" per ottenere una sintesi AI del portfolio contrattuale con raccomandazioni operative.
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsMonteContrattiPage;
