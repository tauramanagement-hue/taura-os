import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, MessageSquare, LayoutDashboard, ArrowRight, X, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TourStep {
  icon: LucideIcon;
  title: string;
  description: string;
  tip: string;
}

const STEPS: TourStep[] = [
  {
    icon: LayoutDashboard,
    title: "Benvenuto nel Command Center",
    description: "Da qui controlli monte deal, pipeline, roster e commissioni in tempo reale. Scadenze e alert sono sempre visibili per non perdere nessuna opportunità.",
    tip: "La sidebar a sinistra è la tua mappa: Atleti, Contratti, Deal, Chat.",
  },
  {
    icon: FileText,
    title: "Carica il primo contratto in 45 secondi",
    description: "Vai su Contratti, trascina un PDF e l'AI estrae brand, valore, scadenza e royalty. Il Conflict Scanner rileva automaticamente sovrapposizioni tra sponsor.",
    tip: "Il primo contratto sblocca il Proof Package e la Deal Intelligence.",
  },
  {
    icon: MessageSquare,
    title: "Chiedi all'AI tutto quello che vuoi",
    description: "L'AI Chat conosce il tuo roster, i contratti, le scadenze. Chiedi in linguaggio naturale: 'Quanto vale il mio top earner?', 'Quali deal scadono in Q3?'",
    tip: "Puoi anche caricare file direttamente in chat.",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

const DashboardTour = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("taura:first_run") === "1") {
      const t = window.setTimeout(() => setOpen(true), 600);
      return () => window.clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.removeItem("taura:first_run");
    } catch {}
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else dismiss();
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
        >
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="relative w-full max-w-[480px] rounded-[24px] overflow-hidden"
            style={{
              background: "hsl(var(--card) / 0.95)",
              backdropFilter: "blur(24px)",
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 30px 80px -20px rgba(0,0,0,0.5), 0 0 0 1px hsl(var(--primary) / 0.1)",
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-[180px] pointer-events-none"
              style={{
                background: "radial-gradient(120% 80% at 50% 0%, hsl(var(--primary) / 0.18), transparent 60%)",
              }}
            />

            <button
              onClick={dismiss}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Chiudi tour"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full border border-primary/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  Tour · {step + 1}/{STEPS.length}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
                className="w-14 h-14 rounded-2xl bg-primary/12 text-primary flex items-center justify-center mb-5 ring-1 ring-primary/20"
              >
                <Icon className="w-6 h-6" strokeWidth={1.8} />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
                className="text-[22px] font-semibold text-foreground tracking-[-0.025em] leading-tight mb-3"
              >
                {current.title}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.15 }}
                className="text-[13.5px] text-muted-foreground leading-relaxed mb-5"
              >
                {current.description}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.2 }}
                className="rounded-xl bg-secondary/60 border border-border px-4 py-3 mb-7"
              >
                <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">
                  Tip
                </div>
                <div className="text-[12.5px] text-foreground/85 leading-relaxed">
                  {current.tip}
                </div>
              </motion.div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === step ? "w-8 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/50"
                      }`}
                      aria-label={`Step ${i + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {!isLast && (
                    <button
                      onClick={dismiss}
                      className="text-[12px] text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
                    >
                      Salta
                    </button>
                  )}
                  <button
                    onClick={next}
                    className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/35 hover:brightness-110 transition-all"
                  >
                    {isLast ? "Iniziamo" : "Avanti"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DashboardTour;
