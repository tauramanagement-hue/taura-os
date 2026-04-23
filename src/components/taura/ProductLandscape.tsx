import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Users,
  FileText,
  Sparkles,
  MessageSquare,
  Search,
  Bell,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { MiniChart } from "@/components/taura/ui-primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

type Anchor = "left" | "center" | "right";

type Hotspot = {
  id: string;
  label: string;
  tip: string;
  top: string;
  left: string;
  anchor: Anchor;
};

const HOTSPOTS: Hotspot[] = [
  {
    id: "ai-alert",
    label: "AI alert",
    tip: "Conflitti rilevati in automatico, prima che diventino penali.",
    top: "26%",
    left: "86%",
    anchor: "right",
  },
  {
    id: "roster",
    label: "Roster",
    tip: "Tutto il tuo roster in un colpo d'occhio: status, revenue, scadenze.",
    top: "60%",
    left: "38%",
    anchor: "center",
  },
  {
    id: "revenue",
    label: "Revenue",
    tip: "Revenue tracking real-time con trend 12 mesi per talent.",
    top: "33%",
    left: "16%",
    anchor: "left",
  },
];

const athletes = [
  { init: "MR", name: "Marco Rossi", team: "Serie A", rev: "€245k", status: "active", color: "hsl(220, 90%, 62%)" },
  { init: "LF", name: "Luca Ferrari", team: "ATP", rev: "€180k", status: "renewal", color: "hsl(258, 82%, 65%)" },
  { init: "SB", name: "Sara Bianchi", team: "Creator", rev: "€92k", status: "active", color: "hsl(335, 80%, 62%)" },
  { init: "AC", name: "Andrea Conti", team: "Serie B", rev: "€67k", status: "active", color: "hsl(25, 90%, 58%)" },
  { init: "GM", name: "Giulia Marino", team: "Beach V.", rev: "€54k", status: "conflict", color: "hsl(160, 67%, 52%)" },
];

const statusLabel: Record<string, { label: string; cls: string }> = {
  active: { label: "Attivo", cls: "bg-taura-green/15 text-taura-green border-taura-green/30" },
  renewal: { label: "Rinnovo", cls: "bg-taura-orange/15 text-taura-orange border-taura-orange/30" },
  conflict: { label: "Conflitto", cls: "bg-taura-red/15 text-taura-red border-taura-red/30" },
};

export default function ProductLandscape() {
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

  return (
    <div className="relative">
      {/* Glow */}
      <div
        className="absolute inset-0 -bottom-16 blur-3xl opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--primary) / 0.18) 0%, transparent 65%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)]"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/40 bg-secondary/50">
          <div className="w-2.5 h-2.5 rounded-full bg-taura-red/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-taura-orange/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-taura-green/50" />
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">taura.app/dashboard</span>
        </div>

        <div className="grid grid-cols-[56px_1fr] md:grid-cols-[64px_1fr_280px]">
          {/* Sidebar */}
          <aside className="border-r border-border/40 bg-secondary/30 flex flex-col items-center py-4 gap-1.5">
            {[
              { Icon: BarChart3, active: true, label: "Dashboard" },
              { Icon: Users, label: "Atleti" },
              { Icon: FileText, label: "Contratti" },
              { Icon: Sparkles, label: "Deal" },
              { Icon: MessageSquare, label: "Chat AI" },
            ].map((i, idx) => (
              <div
                key={idx}
                title={i.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  i.active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`}
              >
                <i.Icon className="w-4 h-4" />
              </div>
            ))}
          </aside>

          {/* Main content */}
          <main className="p-5 md:p-6 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                  Command Center
                </div>
                <h3 className="text-[17px] font-bold tracking-tight truncate">Panoramica · Aprile 2026</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden md:flex items-center gap-2 bg-secondary/60 border border-border/40 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  <Search className="w-3 h-3" />
                  <span>Cerca talent, contratto…</span>
                </div>
                <div className="relative">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-taura-red" />
                </div>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-taura-blue" />
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              {[
                { l: "REVENUE YTD", v: "€892k", d: [30, 45, 52, 48, 62, 72, 78, 85, 92], c: "hsl(160, 67%, 52%)", up: "+18%" },
                { l: "CONTRATTI ATTIVI", v: "47", d: [22, 28, 32, 38, 42, 45, 47, 47, 47], c: "hsl(220, 90%, 62%)", up: "+6" },
                { l: "DELIVERABLE APERTI", v: "23", d: [12, 18, 20, 22, 19, 25, 23, 22, 23], c: "hsl(258, 82%, 65%)", up: "−3" },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                  className="bg-secondary/50 rounded-xl p-3 border border-border/40"
                >
                  <div className="flex items-baseline justify-between">
                    <div className="text-[9px] font-bold text-muted-foreground tracking-wider">{s.l}</div>
                    <div className="text-[9px] font-semibold text-taura-green">{s.up}</div>
                  </div>
                  <div className="text-[20px] font-bold mt-0.5" style={{ color: s.c }}>{s.v}</div>
                  <MiniChart data={s.d} color={s.c} h={24} />
                </motion.div>
              ))}
            </div>

            {/* Roster table */}
            <div className="bg-secondary/40 rounded-xl border border-border/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-semibold text-foreground">Top atleti per revenue</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Vedi tutti ({athletes.length})</span>
              </div>
              <div className="divide-y divide-border/30">
                {athletes.map((a, i) => {
                  const s = statusLabel[a.status];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: 0.3 + i * 0.05 }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: a.color }}
                      >
                        {a.init}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-foreground truncate">{a.name}</div>
                        <div className="text-[10px] text-muted-foreground">{a.team}</div>
                      </div>
                      <div className="hidden md:block text-[12px] font-mono font-semibold text-foreground tabular-nums">
                        {a.rev}
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>
                        {s.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </main>

          {/* Right rail - AI alerts (hidden on mobile) */}
          <aside className="hidden md:block border-l border-border/40 bg-secondary/20 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-1.5 h-1.5 rounded-full bg-primary"
                style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.8)" }}
              />
              <span className="text-[10px] font-bold text-primary tracking-wider">TAURA AI</span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="bg-card rounded-xl p-3 border border-taura-red/30"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-taura-red" />
                <span className="text-[10px] font-bold text-taura-red tracking-wider">CONFLITTO</span>
              </div>
              <div className="text-[11px] text-foreground leading-relaxed">
                Deal Puma per <strong>G. Marino</strong> confligge con clausola 3.1 Adidas.
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                Rischio stimato €15k
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.55 }}
              className="bg-card rounded-xl p-3 border border-taura-orange/30"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Bell className="w-3 h-3 text-taura-orange" />
                <span className="text-[10px] font-bold text-taura-orange tracking-wider">SCADENZA 14gg</span>
              </div>
              <div className="text-[11px] text-foreground leading-relaxed">
                Contratto <strong>L. Ferrari</strong> / Puma scade il 5 mag. Avvia rinnovo?
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.7 }}
              className="bg-card rounded-xl p-3 border border-primary/30"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold text-primary tracking-wider">OPPORTUNITÀ</span>
              </div>
              <div className="text-[11px] text-foreground leading-relaxed">
                Reach <strong>S. Bianchi</strong> +32% questo mese. Pitch a Nike?
              </div>
            </motion.div>
          </aside>
        </div>

        {/* Hotspots */}
        {HOTSPOTS.map((h) => {
          const isActive = activeHotspot === h.id;
          const tipPos =
            h.anchor === "right"
              ? "right-0"
              : h.anchor === "left"
              ? "left-0"
              : "left-1/2 -translate-x-1/2";
          const arrowPos =
            h.anchor === "right"
              ? "right-3"
              : h.anchor === "left"
              ? "left-3"
              : "left-1/2 -translate-x-1/2";
          return (
            <button
              key={h.id}
              type="button"
              onMouseEnter={() => setActiveHotspot(h.id)}
              onMouseLeave={() => setActiveHotspot(null)}
              onFocus={() => setActiveHotspot(h.id)}
              onBlur={() => setActiveHotspot(null)}
              onClick={() => setActiveHotspot(isActive ? null : h.id)}
              aria-label={`Hotspot ${h.label}: ${h.tip}`}
              className="absolute z-20 w-6 h-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ top: h.top, left: h.left }}
            >
              <span
                className="absolute inset-0 rounded-full bg-primary/30 animate-ping"
                style={{ animationDuration: "2.4s" }}
              />
              <span className="relative block w-full h-full rounded-full bg-primary shadow-lg ring-4 ring-primary/20" />
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute ${tipPos} top-full mt-3 w-56 bg-foreground text-background text-[11px] font-medium leading-relaxed rounded-lg px-3 py-2 shadow-xl pointer-events-none z-30`}
                >
                  {h.tip}
                  <span className={`absolute -top-1 ${arrowPos} w-2 h-2 rotate-45 bg-foreground`} />
                </motion.div>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Caption below */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Passa il mouse sui punti evidenziati
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
          Tour completo del prodotto
          <ArrowUpRight className="w-3 h-3" />
        </span>
      </motion.div>
    </div>
  );
}
