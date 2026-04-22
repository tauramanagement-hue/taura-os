import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PlansGrid, { type Plan, type PlanId } from "@/components/taura/PlansGrid";
import { TauraLogo } from "@/components/taura/ui-primitives";
import PrivacyCheckbox from "@/components/taura/PrivacyCheckbox";
import { ArrowRight, ArrowLeft, Sparkles, Zap, Clock, Package, ShieldAlert, FileText } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const agencyTypes = [
  {
    type: "talent",
    icon: "📱",
    title: "Talent & Influencer",
    subtitle: "Gestisci creator, influencer e talent digitali",
    features: ["Campagne & deliverable", "Proof package sponsor", "Calendario pubblicazioni", "Media kit automatici"],
    gradient: "from-violet-500/15 to-pink-500/10",
  },
  {
    type: "sport",
    icon: "⚽",
    title: "Agenzia Sportiva",
    subtitle: "Gestisci atleti e procure sportive",
    features: ["Transfer tracker multi-paese", "Mandati FIGC/FIFA", "Scouting pipeline", "Commissioni & FFAR"],
    gradient: "from-emerald-500/15 to-cyan-500/10",
  },
];

const talentVerticals = [
  { icon: "🎮", label: "Gaming", sub: "Streamer, esports" },
  { icon: "💄", label: "Beauty", sub: "Makeup, skincare" },
  { icon: "🍕", label: "Food", sub: "Chef, food creator" },
  { icon: "💪", label: "Fitness", sub: "Trainer, wellness" },
  { icon: "✈️", label: "Lifestyle", sub: "Travel, fashion" },
  { icon: "🎵", label: "Music", sub: "Artisti, producer" },
];

const sports = [
  { icon: "⚽", label: "Calcio", sub: "Serie A-C, giovanili" },
  { icon: "🏀", label: "Basket", sub: "Serie A, europeo" },
  { icon: "🎾", label: "Tennis", sub: "ATP, WTA, ITF" },
  { icon: "🏎️", label: "Motorsport", sub: "F1-F4, GT, rally" },
  { icon: "🏊", label: "Nuoto", sub: "FIN, olimpico" },
  { icon: "⛷️", label: "Sport invernali", sub: "Sci, snowboard" },
];

const welcomeSlides = [
  {
    icon: FileText,
    title: "Carichi un contratto",
    body: "L'AI estrae clausole, valori, scadenze e conflitti in 45 secondi. Tutto indicizzato, cercabile in linguaggio naturale.",
    stat: "45s",
    statLabel: "per contratto",
  },
  {
    icon: ShieldAlert,
    title: "Connetti il roster",
    body: "Taura intreccia contratti, talent, deal e campagne. Vedi conflitti di sponsor prima che diventino penali economiche.",
    stat: "€15k",
    statLabel: "conflitti evitati in media",
  },
  {
    icon: Package,
    title: "Chiudi più deal",
    body: "Proof Package sponsor in un click. Report ROI, pricing suggerito, scenari negoziali — generati dall'AI.",
    stat: "30s",
    statLabel: "per un report sponsor",
  },
];

// Estimate weekly hours saved based on roster size bucket.
const savingsBySize: Record<string, { hours: number; money: string }> = {
  "1-5": { hours: 4, money: "€600" },
  "5-15": { hours: 12, money: "€1.8k" },
  "15-50": { hours: 28, money: "€4.2k" },
  "50+": { hours: 60, money: "€9k+" },
};

type StepKey = "welcome" | "type" | "vertical" | "agency" | "plan";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<StepKey>("welcome");
  const [welcomeSlide, setWelcomeSlide] = useState(0);
  const [agencyType, setAgencyType] = useState<"talent" | "sport" | "">("");
  const [agencyName, setAgencyName] = useState("");
  const [selectedSize, setSelectedSize] = useState("5-15");
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [savedAgencyId, setSavedAgencyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkExisting = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .single();
      if (profile?.agency_id) {
        navigate("/dashboard", { replace: true });
      }
    };
    checkExisting();
  }, [user, navigate]);

  const progress = useMemo(() => {
    const map: Record<StepKey, number> = { welcome: 0, type: 1, vertical: 2, agency: 3, plan: 4 };
    return map[step];
  }, [step]);

  const saveAgency = async () => {
    if (!user) return null;
    if (!agencyName.trim()) {
      toast.error("Inserisci il nome dell'agenzia.");
      return null;
    }
    setSaving(true);
    try {
      const sportSector = agencyType === "sport"
        ? selectedSports.join(", ")
        : selectedVerticals.join(", ");

      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .insert({
          name: agencyName.trim(),
          roster_size_range: selectedSize,
          sport_sector: sportSector,
          agency_type: agencyType,
          onboarding_completed: true,
        })
        .select("id")
        .single();

      if (agencyError) throw agencyError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ agency_id: agency.id })
        .eq("id", user.id);

      if (profileError) throw profileError;

      setSavedAgencyId(agency.id);
      return agency.id;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante il salvataggio.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleAgencyContinue = async () => {
    const id = savedAgencyId ?? await saveAgency();
    if (id) setStep("plan");
  };

  const handlePlanSelect = async (plan: Plan) => {
    setSelectedPlan(plan.id);
    if (!user?.email || !savedAgencyId) return;
    await supabase.from("waitlist").upsert(
      {
        email: user.email.toLowerCase(),
        plan_interest: plan.id,
        agency_id: savedAgencyId,
        source: "onboarding",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
  };

  const finishOnboarding = async () => {
    try { localStorage.setItem("taura:first_run", "1"); } catch {}
    // GDPR Art.7 — record consent for OAuth users who skipped Login form
    try {
      await supabase.functions.invoke("consent-webhook", {
        body: {
          source: "onboarding",
          consents: [
            { type: "privacy_policy", granted: true, version: "2026-04-21" },
            { type: "terms", granted: true, version: "2026-04-21" },
            { type: "ai_processing", granted: true, version: "2026-04-21" },
            { type: "cookies_necessary", granted: true, version: "2026-04-21" },
          ],
        },
      });
    } catch {}
    toast.success("Benvenuto in Taura OS!");
    navigate("/dashboard");
  };

  const savings = savingsBySize[selectedSize] || savingsBySize["5-15"];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden p-6">
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-15%] w-[700px] h-[700px] rounded-full blur-3xl opacity-[0.15]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 60%)" }} />
        <div className="absolute bottom-[-20%] left-[-15%] w-[600px] h-[600px] rounded-full blur-3xl opacity-[0.1]"
          style={{ background: "radial-gradient(circle, hsl(220, 90%, 60%) 0%, transparent 60%)" }} />
      </div>

      <div className="relative w-full max-w-[760px]">
        {/* Brand + progress */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <TauraLogo size={24} />
            <span className="text-[13px] font-bold tracking-tight">TAURA OS</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                animate={{
                  backgroundColor: i <= progress ? "hsl(var(--primary))" : "hsl(var(--border))",
                  width: i === progress ? 28 : 18,
                }}
                transition={{ duration: 0.3, ease: EASE }}
                className="h-[3px] rounded-full"
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ===== STEP 0: WELCOME SLIDES ===== */}
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="relative bg-card/70 backdrop-blur-xl rounded-[28px] border border-border/50 p-10 md:p-14 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-3xl opacity-25 pointer-events-none"
                style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }} />

              <div className="relative text-center">
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-6">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-bold text-primary tracking-[0.15em] uppercase">Benvenuto</span>
                </div>

                <h1 className="text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] mb-3">
                  Ecco cosa farai<br />con Taura OS.
                </h1>
                <p className="text-[14px] text-muted-foreground mb-10 max-w-[440px] mx-auto">
                  Tre cose che da oggi non sono più un problema.
                </p>

                {/* Slide carousel */}
                <div className="relative min-h-[260px] flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {welcomeSlides.map((s, i) => {
                      if (i !== welcomeSlide) return null;
                      const Icon = s.icon;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: 40, scale: 0.96 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -40, scale: 0.96 }}
                          transition={{ duration: 0.45, ease: EASE }}
                          className="absolute inset-0 flex flex-col items-center justify-center"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-5">
                            <Icon className="w-7 h-7" />
                          </div>
                          <h3 className="text-[22px] font-semibold tracking-tight mb-3">{s.title}</h3>
                          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[460px] mb-6">{s.body}</p>
                          <div className="inline-flex items-baseline gap-2 px-5 py-2.5 rounded-2xl bg-secondary/60 border border-border/50">
                            <span className="text-[28px] font-bold tracking-tight text-primary leading-none">{s.stat}</span>
                            <span className="text-[11px] text-muted-foreground">{s.statLabel}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Dots */}
                <div className="flex justify-center gap-1.5 mt-8 mb-6">
                  {welcomeSlides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setWelcomeSlide(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                        i === welcomeSlide ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/50"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex gap-2 justify-center">
                  {welcomeSlide < welcomeSlides.length - 1 ? (
                    <>
                      <button
                        onClick={() => setStep("type")}
                        className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-4 py-3 cursor-pointer"
                      >
                        Salta
                      </button>
                      <button
                        onClick={() => setWelcomeSlide(s => s + 1)}
                        className="group bg-primary text-primary-foreground px-7 py-3 rounded-xl text-[13px] font-semibold cursor-pointer hover:shadow-lg hover:shadow-primary/30 transition-all inline-flex items-center gap-2"
                      >
                        Avanti
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setStep("type")}
                      className="group bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-[13px] font-semibold cursor-pointer hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
                    >
                      Iniziamo
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 1: AGENCY TYPE ===== */}
          {step === "type" && (
            <motion.div
              key="type"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="bg-card/70 backdrop-blur-xl rounded-[28px] border border-border/50 p-10"
            >
              <h2 className="text-[30px] font-bold tracking-[-0.025em] mb-2">Che tipo di agenzia gestisci?</h2>
              <p className="text-[13px] text-muted-foreground mb-8">Personalizzeremo Taura OS per il tuo workflow.</p>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {agencyTypes.map(t => (
                  <motion.button
                    key={t.type}
                    whileHover={{ y: -3 }}
                    onClick={() => { setAgencyType(t.type as "talent" | "sport"); setStep("vertical"); }}
                    className={`text-left p-6 rounded-2xl border bg-gradient-to-br ${t.gradient} backdrop-blur cursor-pointer transition-all ${
                      agencyType === t.type ? "border-primary/60" : "border-border/50 hover:border-primary/30"
                    }`}
                  >
                    <div className="text-[32px] mb-3">{t.icon}</div>
                    <div className="text-[16px] font-semibold tracking-tight mb-1">{t.title}</div>
                    <div className="text-[12px] text-muted-foreground mb-4">{t.subtitle}</div>
                    <div className="space-y-1.5">
                      {t.features.map((f, i) => (
                        <div key={i} className="text-[11px] text-foreground/80 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-primary" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="text-center text-[11px] text-muted-foreground">
                🔜 Prossimamente: Musica · Cinema · Moda
              </div>

              <div className="mt-8">
                <button onClick={() => setStep("welcome")} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Indietro
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 2: VERTICALS / SPORTS ===== */}
          {step === "vertical" && (
            <motion.div
              key="vertical"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="bg-card/70 backdrop-blur-xl rounded-[28px] border border-border/50 p-10"
            >
              <h2 className="text-[30px] font-bold tracking-[-0.025em] mb-2">
                {agencyType === "sport" ? "I tuoi sport" : "Le tue verticali"}
              </h2>
              <p className="text-[13px] text-muted-foreground mb-7">
                {agencyType === "sport" ? "Seleziona gli sport che gestisci" : "Seleziona i settori in cui operi"}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {(agencyType === "sport" ? sports : talentVerticals).map(s => {
                  const list = agencyType === "sport" ? selectedSports : selectedVerticals;
                  const sel = list.includes(s.label);
                  return (
                    <motion.button
                      key={s.label}
                      whileHover={{ y: -2 }}
                      onClick={() => {
                        if (agencyType === "sport") {
                          setSelectedSports(prev => prev.includes(s.label) ? prev.filter(x => x !== s.label) : [...prev, s.label]);
                        } else {
                          setSelectedVerticals(prev => prev.includes(s.label) ? prev.filter(x => x !== s.label) : [...prev, s.label]);
                        }
                      }}
                      className={`py-5 px-4 rounded-2xl border text-center cursor-pointer transition-all backdrop-blur ${
                        sel ? "border-primary/60 bg-primary/10" : "border-border/50 bg-secondary/30 hover:border-primary/30"
                      }`}
                    >
                      <div className="text-[28px] mb-1.5">{s.icon}</div>
                      <div className={`text-[13px] font-semibold ${sel ? "text-primary" : "text-foreground"}`}>{s.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => setStep("type")} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Indietro
                </button>
                <button
                  onClick={() => {
                    const hasSelection = agencyType === "sport" ? selectedSports.length > 0 : selectedVerticals.length > 0;
                    hasSelection ? setStep("agency") : toast.error("Seleziona almeno una opzione");
                  }}
                  className="group bg-primary text-primary-foreground px-7 py-3 rounded-xl text-[13px] font-semibold cursor-pointer hover:shadow-lg hover:shadow-primary/30 transition-all inline-flex items-center gap-2"
                >
                  Continua
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 3: AGENCY NAME + SIZE ===== */}
          {step === "agency" && (
            <motion.div
              key="agency"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="bg-card/70 backdrop-blur-xl rounded-[28px] border border-border/50 p-10"
            >
              <h2 className="text-[30px] font-bold tracking-[-0.025em] mb-2">La tua agenzia</h2>
              <p className="text-[13px] text-muted-foreground mb-8">Ultimi dettagli. Li usiamo per personalizzare i tuoi dati di esempio.</p>

              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Nome agenzia</label>
              <input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Es. Taura Management"
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-background/60 text-[15px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground mb-7"
              />

              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-3">Dimensione roster</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {["1-5", "5-15", "15-50", "50+"].map(s => (
                  <motion.button
                    key={s}
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedSize(s)}
                    className={`py-4 rounded-xl border text-[15px] font-semibold cursor-pointer transition-all ${
                      selectedSize === s
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/50 bg-secondary/30 text-foreground hover:border-primary/30"
                    }`}
                  >
                    {s}
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                      {agencyType === "sport" ? "atleti" : "talent"}
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Dynamic savings preview */}
              <motion.div
                key={selectedSize}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-primary/8 to-taura-blue/5 border border-primary/20"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-primary tracking-wider uppercase mb-1">
                      Risparmio stimato per la tua size
                    </div>
                    <div className="text-[15px] text-foreground">
                      <span className="font-bold">{savings.hours}h</span> a settimana ·{" "}
                      <span className="font-bold">{savings.money}</span> al mese recuperati
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Basato su una media di 3 contratti/talent e tariffa oraria tipica agency.
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="flex items-center justify-between mt-8">
                <button onClick={() => setStep("vertical")} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Indietro
                </button>
                <button
                  onClick={() => agencyName.trim() ? handleAgencyContinue() : toast.error("Inserisci il nome dell'agenzia")}
                  disabled={saving}
                  className="group bg-primary text-primary-foreground px-7 py-3 rounded-xl text-[13px] font-semibold cursor-pointer hover:shadow-lg hover:shadow-primary/30 transition-all inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? "Salvataggio..." : "Continua"}
                  {!saving && <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 4: PLAN SELECTION ===== */}
          {step === "plan" && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-5">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-bold text-primary tracking-[0.15em] uppercase">Ultimo step</span>
                </div>
                <h2 className="text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] mb-3">
                  Scegli il piano per {agencyName || "la tua agenzia"}.
                </h2>
                <p className="text-[14px] text-muted-foreground max-w-[520px] mx-auto">
                  Siamo in beta privata. Le prime 5 agenzie entrano gratis per 6 mesi.
                  Nessuna carta richiesta adesso — ti contattiamo entro 48 ore.
                </p>
              </div>

              <PlansGrid
                onSelectPlan={handlePlanSelect}
                selectedPlan={selectedPlan ?? undefined}
                ctaLabel="Richiedi questo piano"
                compact
              />

              <div className="mt-6 mb-1 px-1">
                <PrivacyCheckbox
                  checked={privacyAccepted}
                  onChange={setPrivacyAccepted}
                />
              </div>

              <div className="flex items-center justify-between mt-4">
                <button onClick={() => setStep("agency")} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Indietro
                </button>
                <button
                  onClick={finishOnboarding}
                  disabled={!privacyAccepted}
                  className="group bg-primary text-primary-foreground px-7 py-3.5 rounded-xl text-[13px] font-semibold cursor-pointer hover:shadow-lg hover:shadow-primary/30 transition-all inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                  {selectedPlan ? "Entra in Taura OS" : "Continua senza scegliere"}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingPage;
