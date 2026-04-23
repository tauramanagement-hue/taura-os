import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Rocket, Clock, TrendingUp, Trophy, LucideIcon } from "lucide-react";

export type PlanId = "beta" | "pro" | "business" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: string;
  period: string;
  features: string[];
  featured?: boolean;
  badge?: string;
}

interface MicroCopy {
  icon: LucideIcon;
  hook: string;
  sub: string;
}

const MICRO_COPY: Record<PlanId, MicroCopy> = {
  beta: {
    icon: Rocket,
    hook: "6 mesi gratis per entrare nello standard prima degli altri.",
    sub: "Chi parte ora ha 6 mesi di vantaggio operativo sulle agenzie che arriveranno dopo.",
  },
  pro: {
    icon: Clock,
    hook: "Risparmi ~6 ore a settimana su contratti e ricerche.",
    sub: "Le agenzie che lavorano ancora su PDF e fogli sparsi perdono un contratto ogni trimestre. Tu no.",
  },
  business: {
    icon: TrendingUp,
    hook: "Un deal perso per una clausola nascosta costa piu di 3 anni di Business.",
    sub: "Oltre i 50 atleti, senza Deal Intelligence e Proof Package resti indietro su pitching e negoziazione.",
  },
  enterprise: {
    icon: Trophy,
    hook: "Il livello operativo che le top agency stanno adottando come standard.",
    sub: "Modello AI dedicato, API, data residency UE. Chi non ce l'ha gioca in un altro campionato.",
  },
};

export const PLANS: Plan[] = [
  {
    id: "beta",
    name: "Beta Access",
    tagline: "Per le prime 5 agenzie",
    price: "Gratis",
    period: "primi 6 mesi",
    badge: "Early Access",
    features: [
      "Tutte le funzioni Pro",
      "Onboarding 1-on-1",
      "Feedback diretto al team",
      "Prezzo scontato al rinnovo",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Per agenzie in crescita",
    price: "€99",
    period: "al mese",
    features: [
      "Fino a 30 contratti",
      "40 query AI al giorno",
      "Conflict Scanner automatico",
      "Ricerca semantica nei contratti",
      "3 utenti inclusi",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "Per team strutturati",
    price: "€279",
    period: "al mese",
    featured: true,
    features: [
      "Contratti illimitati",
      "200 query AI al giorno",
      "Deal Intelligence",
      "Proof Package generator",
      "10 utenti inclusi",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Per top agency",
    price: "Custom",
    period: "",
    badge: "Promo",
    features: [
      "Query AI illimitate",
      "Modello AI dedicato",
      "Branding personalizzato",
      "API access",
      "Utenti illimitati",
    ],
  },
];

interface PlansGridProps {
  onSelectPlan: (plan: Plan) => void;
  selectedPlan?: PlanId;
  ctaLabel?: string;
  compact?: boolean;
}

const PlansGrid = ({ onSelectPlan, selectedPlan, ctaLabel = "Richiedi accesso", compact = false }: PlansGridProps) => {
  const [hoveredId, setHoveredId] = useState<PlanId | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <div className={`grid items-start ${compact ? "grid-cols-2 gap-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"}`}>
      {PLANS.map((plan, i) => {
        const isSelected = selectedPlan === plan.id;
        const isFeatured = plan.featured;
        const isHovered = hoveredId === plan.id;
        const isDimmed = !isTouch && hoveredId !== null && !isHovered;
        const showMicro = !compact && (isTouch || isHovered);
        const micro = MICRO_COPY[plan.id];
        const MicroIcon = micro.icon;

        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            whileHover={!isTouch ? { y: -8, scale: 1.015 } : undefined}
            onHoverStart={() => !isTouch && setHoveredId(plan.id)}
            onHoverEnd={() => !isTouch && setHoveredId(null)}
            animate={{ opacity: isDimmed ? 0.7 : 1 }}
            className={`group relative rounded-[22px] overflow-hidden transition-[box-shadow,border-color] duration-300 ${
              isSelected
                ? "ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_20px_60px_-20px_hsl(var(--primary)/0.5)]"
                : isHovered
                ? "ring-1 ring-primary/50 shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]"
                : isFeatured
                ? "ring-1 ring-primary/30 shadow-[0_20px_50px_-25px_hsl(var(--primary)/0.4)]"
                : "ring-1 ring-border"
            }`}
          >
            {isFeatured && (
              <div
                className="absolute inset-0 opacity-40 pointer-events-none"
                style={{
                  background: "radial-gradient(120% 80% at 50% 0%, hsl(var(--primary) / 0.18), transparent 55%)",
                }}
              />
            )}

            <div className={`relative h-full flex flex-col ${compact ? "p-5" : "p-6"} bg-card/70 backdrop-blur-xl`}>
              {plan.badge && (
                <div className="absolute top-4 right-4 inline-flex items-center gap-1 bg-primary/15 text-primary text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border border-primary/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  {plan.badge}
                </div>
              )}

              <div className="mb-5">
                <div className="text-[13px] font-semibold text-foreground tracking-tight">{plan.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{plan.tagline}</div>
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-1.5">
                  <span className={`${compact ? "text-[28px]" : "text-[36px]"} font-bold text-foreground tracking-tight leading-none`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-[11px] text-muted-foreground">/ {plan.period}</span>
                  )}
                </div>
              </div>

              <ul className={`flex flex-col gap-2 mb-6 flex-1 ${compact ? "text-[11px]" : "text-[12px]"}`}>
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-foreground/85">
                    <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      isFeatured ? "bg-primary/15 text-primary" : "bg-secondary text-foreground/60"
                    }`}>
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                    <span className="leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onSelectPlan(plan)}
                className={`w-full py-3 rounded-xl text-[12px] font-semibold cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : isFeatured
                    ? "bg-primary text-primary-foreground hover:shadow-lg hover:shadow-primary/25"
                    : "bg-secondary text-foreground border border-border hover:border-primary/40 hover:bg-card"
                }`}
              >
                {isSelected ? "✓ Selezionato" : ctaLabel}
              </button>

              {!compact && (
                <AnimatePresence initial={false}>
                  {showMicro && (
                    <motion.div
                      key="micro"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-5 pt-4 border-t border-border/60 flex items-start gap-2.5">
                        <MicroIcon className="w-3.5 h-3.5 text-primary/70 mt-0.5 flex-shrink-0" strokeWidth={2.25} />
                        <div className="min-w-0">
                          <div className="text-[11.5px] font-semibold text-foreground leading-snug">{micro.hook}</div>
                          <div className="text-[11px] text-muted-foreground leading-relaxed mt-1">{micro.sub}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default PlansGrid;
