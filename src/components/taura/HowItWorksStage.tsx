import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FileText, Zap, TrendingUp, Check, AlertTriangle, Send } from "lucide-react";
import { MiniChart } from "@/components/taura/ui-primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

type Step = {
  n: string;
  title: string;
  desc: string;
  Icon: typeof FileText;
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Carichi un contratto",
    desc: "PDF, DOCX, immagine - qualsiasi formato. L'AI legge e struttura in 45 secondi.",
    Icon: FileText,
  },
  {
    n: "02",
    title: "Taura connette il roster",
    desc: "Clausole, deal, scadenze e conflitti appaiono automaticamente nel tuo Command Center.",
    Icon: Zap,
  },
  {
    n: "03",
    title: "Chiudi più deal",
    desc: "Genera Proof Package sponsor, previsioni revenue, report in 30 secondi.",
    Icon: TrendingUp,
  },
];

const AUTO_MS = 4800;

export default function HowItWorksStage() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!stageRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0.3 },
    );
    obs.observe(stageRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || paused || !inView) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), AUTO_MS);
    return () => clearTimeout(t);
  }, [active, paused, reduced, inView]);

  return (
    <div
      ref={stageRef}
      className="grid md:grid-cols-[0.9fr_1.3fr] gap-8 items-start"
      onMouseLeave={() => setPaused(false)}
    >
      {/* LEFT - step cards */}
      <div className="flex flex-col gap-3">
        {STEPS.map((s, i) => {
          const isActive = i === active;
          const Icon = s.Icon;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => {
                setActive(i);
                setPaused(true);
              }}
              onFocus={() => {
                setActive(i);
                setPaused(true);
              }}
              onClick={() => {
                setActive(i);
                setPaused(true);
              }}
              aria-pressed={isActive}
              aria-label={`Step ${s.n}: ${s.title}`}
              className={`group relative text-left rounded-2xl p-6 border transition-all duration-300 cursor-pointer ${
                isActive
                  ? "bg-card border-primary/50 shadow-lg shadow-primary/5"
                  : "bg-card/40 border-border/50 hover:border-border hover:bg-card/60"
              }`}
            >
              <div className="absolute top-4 right-5 text-[40px] font-bold text-foreground/5 tracking-tighter leading-none">
                {s.n}
              </div>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                  isActive ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary/80"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-[16px] font-semibold tracking-tight mb-1.5">{s.title}</h3>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">{s.desc}</p>
              {isActive && (
                <motion.div
                  layoutId="step-active-bar"
                  className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full bg-primary"
                  transition={{ duration: 0.35, ease: EASE }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* RIGHT - animated stage */}
      <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl overflow-hidden min-h-[420px] md:min-h-[460px]">
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 60% 30%, hsl(var(--primary) / 0.10) 0%, transparent 60%)",
          }}
        />
        {/* chrome */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/40 bg-secondary/50">
          <div className="w-2 h-2 rounded-full bg-taura-red/50" />
          <div className="w-2 h-2 rounded-full bg-taura-orange/50" />
          <div className="w-2 h-2 rounded-full bg-taura-green/50" />
          <span className="ml-auto text-[9px] text-muted-foreground font-mono">
            {active === 0 && "taura.app/contracts/upload"}
            {active === 1 && "taura.app/roster/graph"}
            {active === 2 && "taura.app/deals/proof-package"}
          </span>
        </div>

        <div className="relative p-6 md:p-8">
          <AnimatePresence mode="wait">
            {active === 0 && <StageUpload key="s1" />}
            {active === 1 && <StageConnect key="s2" />}
            {active === 2 && <StageDeal key="s3" />}
          </AnimatePresence>
        </div>

        {/* progress dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setActive(i);
                setPaused(true);
              }}
              aria-label={`Vai allo step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-border/80"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- STAGES ---------------- */

function InlineHL({
  children,
  tint,
  delay,
}: {
  children: React.ReactNode;
  tint: "primary" | "orange" | "blue";
  delay: number;
}) {
  const tints: Record<string, string> = {
    primary: "bg-primary/15 border-primary/40 text-primary",
    orange: "bg-taura-orange/15 border-taura-orange/40 text-taura-orange",
    blue: "bg-taura-blue/15 border-taura-blue/40 text-taura-blue",
  };
  return (
    <motion.span
      initial={{ backgroundColor: "transparent", color: "inherit" }}
      animate={{}}
      transition={{ delay, duration: 0.3 }}
      className={`inline-block rounded px-1.5 py-0.5 mx-0.5 border font-semibold text-[10.5px] leading-none align-middle ${tints[tint]}`}
      style={{ transform: "translateY(-1px)" }}
    >
      {children}
    </motion.span>
  );
}

function StageUpload() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="relative"
    >
      <div className="flex items-center gap-2 mb-4">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="w-1.5 h-1.5 rounded-full bg-primary"
          style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.8)" }}
        />
        <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
          Estrazione AI · in corso
        </span>
      </div>

      {/* PDF card + scanner */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
        className="relative bg-background/80 rounded-xl border border-border/60 overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/40 bg-secondary/40">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">contratto_rossi_adidas_2025.pdf</span>
          <span className="ml-auto text-[9px] font-mono text-muted-foreground">2.4 MB · 8 pag</span>
        </div>
        <div className="relative px-5 py-5 min-h-[220px]">
          <div className="text-[11px] font-bold tracking-[0.15em] uppercase text-foreground/70 mb-3">
            Contratto di sponsorizzazione
          </div>

          <div className="space-y-2.5 text-[11.5px] leading-relaxed text-foreground/85">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              <span className="text-muted-foreground">Tra:</span>{" "}
              <span className="font-semibold text-foreground">Adidas Italia S.p.A.</span>{" "}
              <span className="text-muted-foreground">("Sponsor")</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <span className="text-muted-foreground">E:</span>{" "}
              <span className="font-semibold text-foreground">Marco Rossi</span>{" "}
              <span className="text-muted-foreground">("Atleta")</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
              className="pt-2"
            >
              <span className="font-semibold text-foreground">Art. 2 – Durata.</span>{" "}
              Il presente accordo ha validità in regime di{" "}
              <InlineHL tint="blue" delay={1.0}>esclusiva 12 mesi</InlineHL>{" "}
              a decorrere dal 01/06/2025.
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.3 }}
            >
              <span className="font-semibold text-foreground">Art. 3 – Corrispettivo.</span>{" "}
              All'Atleta sarà corrisposto un importo pari a{" "}
              <InlineHL tint="orange" delay={1.3}>€50.000</InlineHL>{" "}
              lordi annui.
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.3 }}
            >
              <InlineHL tint="primary" delay={1.6}>Art. 3.1</InlineHL>{" "}
              <span className="text-foreground/85">
                Clausola di riservatezza vincolante per l'intera durata contrattuale e per 24 mesi successivi.
              </span>
            </motion.div>
          </div>

          {/* scanner line */}
          <motion.div
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: 200, opacity: [0, 1, 1, 0] }}
            transition={{ delay: 0.3, duration: 2.0, ease: "easeInOut" }}
            className="absolute left-0 right-0 top-0 h-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, hsl(var(--primary) / 0.14) 50%, transparent 100%)",
              boxShadow: "0 0 24px hsl(var(--primary) / 0.5)",
            }}
          />
        </div>
      </motion.div>

      {/* success row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.0, duration: 0.4 }}
        className="mt-4 flex items-center justify-between gap-3 flex-wrap"
      >
        <div className="inline-flex items-center gap-2 bg-taura-green/15 border border-taura-green/30 text-taura-green rounded-full px-3 py-1.5">
          <Check className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">47 campi estratti in 45s</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          3 clausole critiche identificate automaticamente
        </span>
      </motion.div>
    </motion.div>
  );
}

function StageConnect() {
  // Percent-based layout (container 100% x 100%, SVG viewBox "0 0 100 100")
  // Athletes on left (x: 0-14), contracts on right (x: 84-100)
  const athletes = [
    { init: "MR", name: "M. Rossi", y: 16, color: "hsl(220, 90%, 62%)" },
    { init: "LF", name: "L. Ferrari", y: 50, color: "hsl(258, 82%, 65%)" },
    { init: "SB", name: "S. Bianchi", y: 84, color: "hsl(335, 80%, 62%)" },
  ];
  const contracts = [
    { label: "Adidas", y: 16 },
    { label: "Puma", y: 50, conflict: true },
    { label: "Nike", y: 84 },
  ];
  // Connections: athlete index -> contract index
  const links = [
    { a: 0, c: 0, delay: 0.5 },                    // MR -> Adidas OK
    { a: 0, c: 1, delay: 0.8, conflict: true },    // MR -> Puma CONFLICT (viola esclusiva)
    { a: 1, c: 1, delay: 1.1 },                    // LF -> Puma OK
    { a: 2, c: 2, delay: 1.4 },                    // SB -> Nike OK
  ];

  // Endpoints in % (edge-of-node, not center)
  const L_EDGE = 14; // right edge of athlete avatar
  const R_EDGE = 84; // left edge of contract pill

  // Conflict tooltip sits at midpoint of link MR -> Puma
  // midpoint: x = (14+84)/2 = 49, y = (16+50)/2 = 33
  const tipX = 49;
  const tipY = 33;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* Background AI monitoring banner */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex items-center gap-2 mb-4 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2"
      >
        <span className="relative flex w-2 h-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-50 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
          AI in background · 24/7
        </span>
        <span className="text-[10.5px] text-muted-foreground ml-0.5">
          monitora roster, contratti e clausole in automatico
        </span>
      </motion.div>

      <div className="relative h-[280px] w-full">
        {/* SVG connection lines */}
        <svg
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="conflictGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          </defs>
          {links.map((l, i) => {
            const a = athletes[l.a];
            const c = contracts[l.c];
            const mid = (L_EDGE + R_EDGE) / 2;
            const d = `M ${L_EDGE} ${a.y} C ${mid} ${a.y}, ${mid} ${c.y}, ${R_EDGE} ${c.y}`;
            return (
              <motion.path
                key={i}
                d={d}
                fill="none"
                stroke={l.conflict ? "hsl(4, 85%, 60%)" : "hsl(var(--primary))"}
                strokeOpacity={l.conflict ? 1 : 0.55}
                strokeWidth={l.conflict ? "0.55" : "0.3"}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: l.delay, duration: 0.7, ease: EASE }}
              />
            );
          })}
        </svg>

        {/* Athletes - absolute by y% */}
        {athletes.map((a, i) => (
          <motion.div
            key={`a${i}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
            className="absolute left-0 flex items-center gap-2.5 -translate-y-1/2"
            style={{ top: `${a.y}%` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shadow-md"
              style={{ background: a.color }}
            >
              {a.init}
            </div>
            <span className="text-[11px] font-medium text-foreground hidden lg:inline">{a.name}</span>
          </motion.div>
        ))}

        {/* Contracts - absolute by y% */}
        {contracts.map((c, i) => (
          <motion.div
            key={`c${i}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.1, duration: 0.4 }}
            className={`absolute right-0 w-24 h-10 rounded-xl border flex items-center justify-center text-[11px] font-semibold -translate-y-1/2 ${
              c.conflict
                ? "bg-taura-red/10 border-taura-red/40 text-taura-red"
                : "bg-secondary/80 border-border/60 text-foreground"
            }`}
            style={{ top: `${c.y}%` }}
          >
            {c.label}
          </motion.div>
        ))}

        {/* Conflict tooltip - positioned exactly on the MR->Puma line midpoint */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.7, duration: 0.35 }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ top: `${tipY}%`, left: `${tipX}%` }}
        >
          <div className="bg-card border border-taura-red/45 rounded-xl px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)] flex items-center gap-2 whitespace-nowrap">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="w-1.5 h-1.5 rounded-full bg-taura-red shrink-0"
              style={{ boxShadow: "0 0 10px hsl(4, 78%, 60%)" }}
            />
            <AlertTriangle className="w-3.5 h-3.5 text-taura-red shrink-0" />
            <span className="text-[10.5px] font-semibold text-foreground">
              M. Rossi · Adidas + Puma viola esclusiva Art. 3.1
            </span>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.0, duration: 0.4 }}
        className="mt-3 text-[11px] text-muted-foreground leading-relaxed"
      >
        <span className="font-semibold text-foreground">4 relazioni mappate</span> · 1 conflitto di esclusiva segnalato senza intervento umano
      </motion.div>
    </motion.div>
  );
}

function StageDeal() {
  const metrics = [
    { label: "Reach stimata", value: "2.4M" },
    { label: "Engagement rate", value: "8.7%" },
    { label: "ROI atteso", value: "+340%" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="text-[10px] font-bold text-primary tracking-wider uppercase mb-4">
        Proof Package generato
      </div>

      {/* Revenue chart */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="bg-background/80 rounded-xl border border-border/60 p-4 mb-3"
      >
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase">
              Revenue potenziale deal
            </div>
            <div className="text-[24px] font-bold text-foreground mt-0.5 tracking-tight">
              €287k
            </div>
          </div>
          <div className="text-[10px] text-taura-green font-semibold">+12% vs ultimo Q</div>
        </div>
        <MiniChart data={[20, 28, 35, 40, 52, 58, 68, 78, 85]} color="hsl(160, 67%, 52%)" h={48} />
      </motion.div>

      {/* Proof package card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="bg-background/80 rounded-xl border border-primary/30 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">Proof_Package_Nike_2025.pdf</span>
          <span className="ml-auto text-[9px] bg-primary/10 text-primary border border-primary/25 rounded-full px-2 py-0.5 font-semibold">
            AI
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.12, duration: 0.35 }}
              className="bg-secondary/50 rounded-lg p-2.5 text-center"
            >
              <div className="text-[8.5px] font-bold text-muted-foreground tracking-wider uppercase leading-tight">
                {m.label}
              </div>
              <div className="text-[15px] font-bold text-foreground mt-1">{m.value}</div>
            </motion.div>
          ))}
        </div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.4 }}
          className="mt-3 w-full bg-primary text-primary-foreground rounded-lg py-2 text-[11px] font-semibold flex items-center justify-center gap-2 cursor-default hover:shadow-lg hover:shadow-primary/30 transition-shadow"
        >
          <Send className="w-3 h-3" />
          Invia a sponsor
        </motion.button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.7, duration: 0.4 }}
        className="mt-3 text-[11px] text-muted-foreground"
      >
        <span className="font-semibold text-foreground">Generato in 30s</span> · pronto da inviare
      </motion.div>
    </motion.div>
  );
}
