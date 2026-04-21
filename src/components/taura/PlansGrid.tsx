import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

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
      "Prezzo bloccato al rinnovo",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Per agenzie in crescita",
    price: "€99",
    period: "al mese",
    featured: true,
    features: [
      "Fino a 50 contratti",
      "100 query AI al giorno",
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
    features: [
      "Contratti illimitati",
      "500 query AI al giorno",
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
  return (
    <div className={`grid ${compact ? "grid-cols-2 gap-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"}`}>
      {PLANS.map((plan, i) => {
        const isSelected = selectedPlan === plan.id;
        const isFeatured = plan.featured;

        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            className={`group relative rounded-[22px] overflow-hidden transition-all duration-300 ${
              isSelected
                ? "ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_20px_60px_-20px_hsl(var(--primary)/0.5)]"
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
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default PlansGrid;
