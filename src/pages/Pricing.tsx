import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TauraLogo, Pill } from "@/components/taura/ui-primitives";

const plans = [
  {
    name: "Free", price: "€0", period: "per sempre", desc: "Per esplorare",
    features: ["5 contratti nel vault", "10 query AI / giorno", "1 utente", "Dashboard base"],
    cta: "Inizia gratis",
  },
  {
    name: "Pro", price: "€99", period: "/mese", desc: "Per agenzie attive", rec: true,
    features: ["50 contratti", "100 query AI / giorno", "Conflict Scanner", "Ricerca semantica", "Alert proattivi", "3 utenti inclusi"],
    cta: "Prova gratis 14gg",
  },
  {
    name: "Business", price: "€279", period: "/mese", desc: "Per team in crescita",
    features: ["Contratti illimitati", "500 query AI / giorno", "Deal Intelligence", "Proof Package Gen", "Priority support", "10 utenti inclusi"],
    cta: "Prova gratis 14gg",
  },
  {
    name: "Enterprise+", price: "Custom", period: "", desc: "Per top agency",
    features: ["Query illimitate", "Modello AI dedicato", "Branding custom", "API access", "Onboarding 1-on-1", "Utenti illimitati"],
    cta: "Parla con noi",
  },
];

const PricingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <nav className="max-w-[1140px] mx-auto px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
          <TauraLogo size={32} />
          <span className="font-extrabold text-[17px] text-foreground tracking-tight">TAURA</span>
          <Pill variant="muted">OS</Pill>
        </div>
        <div className="flex items-center gap-4">
          <span onClick={() => navigate("/login")} className="text-foreground text-[13px] cursor-pointer font-semibold">Accedi</span>
          <button onClick={() => navigate("/login")} className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-[13px] font-bold cursor-pointer">
            Inizia gratis
          </button>
        </div>
      </nav>

      <div className="text-center max-w-[1100px] mx-auto px-10 pt-12 pb-20">
        <h1 className="text-[34px] font-black text-foreground tracking-tight mb-2">Prezzi chiari, valore reale</h1>
        <p className="text-taura-text3 text-sm mb-10">Inizia gratis. Scala quando sei pronto.</p>

        <div className="grid grid-cols-4 gap-3.5">
          {plans.map((p, i) => (
            <motion.div
              key={i}
              className={`bg-card rounded-2xl p-7 relative ${p.rec ? "border-2 border-primary" : "border border-border"}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * i }}
            >
              {p.rec && (
                <div className="absolute -top-[11px] left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3.5 py-0.5 rounded-full text-[10px] font-extrabold">
                  CONSIGLIATO
                </div>
              )}
              <div className="text-base font-extrabold text-foreground mb-0.5">{p.name}</div>
              <div className="text-[11px] text-taura-text3 mb-4">{p.desc}</div>
              <div className="mb-5">
                <span className="text-4xl font-black text-foreground">{p.price}</span>
                <span className="text-xs text-taura-text3">{p.period}</span>
              </div>
              {p.features.map((f, j) => (
                <div key={j} className="flex items-center gap-2 py-1 text-xs text-taura-text2">
                  <span className="text-taura-green text-[10px]">✓</span>{f}
                </div>
              ))}
              <button
                onClick={() => navigate("/login")}
                className={`w-full py-3 rounded-[10px] text-[13px] font-bold cursor-pointer mt-5 transition-opacity hover:opacity-90 ${
                  p.rec
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent border border-border text-foreground"
                }`}
              >
                {p.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
