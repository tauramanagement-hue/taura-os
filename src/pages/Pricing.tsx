import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TauraLogo } from "@/components/taura/ui-primitives";
import PlansGrid, { PLANS, type Plan, type PlanId } from "@/components/taura/PlansGrid";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ShieldAlert, Package, Check, ArrowRight, X } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EASE = [0.22, 1, 0.36, 1] as const;

const PricingPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialPlan = (params.get("plan") as PlanId | null) || null;

  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(initialPlan);
  const [activePlan, setActivePlan] = useState<Plan | null>(
    initialPlan ? PLANS.find(p => p.id === initialPlan) ?? null : null
  );
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const prev = document.title;
    document.title = "Taura OS — Prezzi";
    return () => { document.title = prev; };
  }, []);

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan.id);
    setActivePlan(plan);
    // Scroll the access form into view
    setTimeout(() => {
      document.getElementById("access-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      setStatus("error");
      setErrorMsg("Inserisci un'email valida.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");
    const { error } = await supabase.rpc("join_waitlist", {
      p_email: normalized,
      p_plan_interest: selectedPlan,
      p_source: "pricing_page",
    });
    if (error) {
      setStatus("error");
      setErrorMsg("Qualcosa è andato storto. Riprova tra poco.");
      return;
    }
    setStatus("success");
  };

  const values = [
    { icon: FileText, text: "Analisi contratti in <30 secondi" },
    { icon: ShieldAlert, text: "Conflict Scanner automatico su tutto il roster" },
    { icon: Package, text: "Proof Package sponsor in un click" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-30%] right-[-10%] w-[800px] h-[800px] rounded-full blur-3xl opacity-[0.14]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 60%)" }} />
        <div className="absolute bottom-[-30%] left-[-10%] w-[700px] h-[700px] rounded-full blur-3xl opacity-[0.1]"
          style={{ background: "radial-gradient(circle, hsl(220, 90%, 60%) 0%, transparent 60%)" }} />
      </div>

      {/* Sticky glass nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-[1180px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/landing")}>
            <TauraLogo size={28} />
            <span className="font-bold text-[15px] tracking-tight">TAURA</span>
            <span className="text-[9px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">OS</span>
          </div>
          <div className="flex items-center gap-4">
            <span onClick={() => navigate("/login")} className="text-[12px] font-semibold cursor-pointer hover:text-primary transition-colors">
              Accedi
            </span>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative max-w-[1180px] mx-auto px-8 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="inline-flex items-center gap-2 bg-card/60 backdrop-blur border border-border/60 rounded-full px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-taura-green" style={{ boxShadow: "0 0 10px hsl(160, 67%, 52%, 0.8)" }} />
            <span className="text-[11px] font-medium text-muted-foreground">Early Access · Beta privata</span>
          </div>
          <h1 className="text-[52px] md:text-[64px] font-bold tracking-[-0.035em] leading-[1.03] mb-5">
            Taura OS — <span className="bg-gradient-to-r from-primary to-taura-accent bg-clip-text text-transparent">Early Access</span>
          </h1>
          <p className="text-[17px] text-muted-foreground leading-relaxed max-w-[560px] mx-auto">
            Stiamo selezionando le prime agenzie in beta.<br />
            Accesso gratuito per i primi 5 team.
          </p>
        </motion.div>
      </section>

      {/* PLANS */}
      <section className="relative max-w-[1180px] mx-auto px-8 pb-16">
        <PlansGrid onSelectPlan={handleSelectPlan} selectedPlan={selectedPlan ?? undefined} />
      </section>

      {/* ACCESS FORM */}
      <section id="access-form" className="relative max-w-[720px] mx-auto px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative rounded-[28px] border border-border/50 bg-card/70 backdrop-blur-xl p-8 md:p-12 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-[320px] h-[320px] rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }} />

          <AnimatePresence mode="wait">
            {status === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="relative text-center py-6"
              >
                <div className="inline-flex w-14 h-14 rounded-full bg-primary/15 text-primary items-center justify-center mb-4">
                  <Check className="w-7 h-7" strokeWidth={2.5} />
                </div>
                <div className="text-[22px] font-semibold tracking-tight mb-1">Richiesta ricevuta</div>
                <div className="text-[14px] text-muted-foreground mb-2">Ti contatteremo entro 48 ore.</div>
                {activePlan && (
                  <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-[11px]">
                    Piano richiesto: <span className="font-semibold text-foreground">{activePlan.name}</span>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-3 text-center">
                  {activePlan ? "Piano selezionato" : "Richiedi il tuo accesso"}
                </div>

                {activePlan && (
                  <motion.div
                    layout
                    className="flex items-center justify-between gap-3 p-4 mb-6 rounded-2xl bg-primary/5 border border-primary/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-[13px]">
                        {activePlan.name[0]}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold">{activePlan.name}</div>
                        <div className="text-[11px] text-muted-foreground">{activePlan.price}{activePlan.period && ` · ${activePlan.period}`}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setActivePlan(null); setSelectedPlan(null); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                      aria-label="Rimuovi piano"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}

                {!activePlan && (
                  <h2 className="text-center text-[26px] md:text-[32px] font-bold tracking-[-0.025em] leading-tight mb-6">
                    Un'email è tutto ciò che serve.
                  </h2>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                    placeholder="nome@agenzia.com"
                    disabled={status === "submitting"}
                    className="flex-1 bg-background/60 border border-border rounded-xl px-4 py-3.5 text-[14px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="group bg-primary text-primary-foreground px-6 py-3.5 rounded-xl text-[13px] font-semibold cursor-pointer hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {status === "submitting" ? "Invio..." : (
                      <>
                        Richiedi accesso
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                {status === "error" && errorMsg && (
                  <div className="mt-3 text-[12px] text-destructive text-center">{errorMsg}</div>
                )}

                <p className="mt-3 text-[11px] text-muted-foreground text-center leading-relaxed">
                  Inviando l'email accetti i nostri{" "}
                  <span onClick={() => navigate("/terms")} className="underline cursor-pointer hover:text-foreground transition-colors">Termini</span>{" "}
                  e la{" "}
                  <span onClick={() => navigate("/privacy")} className="underline cursor-pointer hover:text-foreground transition-colors">Privacy Policy</span>.
                  Usiamo la tua email solo per contattarti sull'accesso — niente spam.
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {values.map((v, i) => {
                    const Icon = v.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/40 border border-border/40"
                      >
                        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[11px] text-foreground/90 font-medium leading-tight">{v.text}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="relative max-w-[1180px] mx-auto px-8 py-10 border-t border-border/40">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <TauraLogo size={18} />
            <span className="font-bold">TAURA OS</span>
            <span className="text-[10px]">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <span onClick={() => navigate("/landing")} className="cursor-pointer hover:text-foreground transition-colors">Landing</span>
            <a href="mailto:os@tauramanagement.com" className="cursor-pointer hover:text-foreground transition-colors">Contatti</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
