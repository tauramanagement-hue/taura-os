import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const agencyTypes = [
  {
    type: "talent",
    icon: "📱",
    title: "Talent & Influencer Agency",
    subtitle: "Gestisci creator, influencer e talent",
    features: ["Campagne & deliverable", "Proof package per sponsor", "Calendario pubblicazioni", "Media kit automatici"],
    color: "from-violet-500/20 to-pink-500/20",
    borderColor: "border-violet-500/30",
  },
  {
    type: "sport",
    icon: "⚽",
    title: "Agenzia Sportiva",
    subtitle: "Gestisci atleti e procure sportive",
    features: ["Transfer tracker multi-paese", "Gestione mandati FIGC/FIFA", "Scouting pipeline", "Commissioni & compliance FFAR"],
    color: "from-emerald-500/20 to-cyan-500/20",
    borderColor: "border-emerald-500/30",
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

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"new" | "demo" | null>(null);
  const [agencyType, setAgencyType] = useState<"talent" | "sport" | "">("");
  const [agencyName, setAgencyName] = useState("");
  const [selectedSize, setSelectedSize] = useState("5-15");
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
        return;
      }
    };
    checkExisting();
  }, [user, navigate]);

  const handleFinish = async () => {
    if (!user) {
      toast.error("Devi effettuare il login prima.");
      navigate("/login");
      return;
    }
    if (!agencyName.trim()) {
      toast.error("Inserisci il nome dell'agenzia.");
      return;
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

      toast.success("Agenzia configurata! Benvenuto in Taura OS.");
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante il salvataggio.");
    }
    setSaving(false);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] ambient-glow pointer-events-none" />

      <div className="w-[520px] relative">
        {/* Progress */}
        {step > 0 && (
          <div className="flex gap-2 mb-9">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex-1 h-[3px] rounded-sm transition-all duration-400 ${
                  i <= step ? "bg-primary glow-accent-sm" : "bg-border"
                }`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              className="bg-card rounded-[20px] p-9 border border-border"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-[26px] font-black text-foreground mb-1 tracking-tight">Benvenuto in Taura OS</h2>
              <p className="text-muted-foreground text-[13px] mb-7">Come vuoi iniziare?</p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setMode("new"); setStep(1); }}
                  className="w-full py-5 px-5 rounded-xl border-[1.5px] border-border bg-secondary cursor-pointer transition-all hover:border-primary/50 text-left"
                >
                  <div className="text-[15px] font-bold text-foreground">🆕 Crea nuova agenzia</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Configura da zero la tua agenzia</div>
                </button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              className="bg-card rounded-[20px] p-9 border border-border"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-[22px] font-black text-foreground mb-1">Che tipo di agenzia gestisci?</h2>
              <p className="text-muted-foreground text-[12px] mb-6">Personalizzeremo Taura OS per il tuo workflow</p>

              <div className="grid grid-cols-2 gap-3">
                {agencyTypes.map(t => (
                  <button
                    key={t.type}
                    onClick={() => { setAgencyType(t.type as "talent" | "sport"); setStep(2); }}
                    className={`text-left p-5 rounded-xl border-[1.5px] bg-gradient-to-br ${t.color} cursor-pointer transition-all hover:scale-[1.02] ${agencyType === t.type ? t.borderColor : "border-border"}`}
                  >
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <div className="text-[14px] font-bold text-foreground mb-0.5">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground mb-3">{t.subtitle}</div>
                    <div className="space-y-1">
                      {t.features.map((f, i) => (
                        <div key={i} className="text-[10px] text-foreground/70 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-primary" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 text-center">
                <span className="text-[10px] text-muted-foreground">🔜 Prossimamente: Musica · Cinema · Moda</span>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setStep(0)} className="px-5 py-3.5 rounded-[10px] bg-secondary text-foreground text-sm font-semibold cursor-pointer border border-border">
                  Indietro
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              className="bg-card rounded-[20px] p-9 border border-border"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-[26px] font-black text-foreground mb-1 tracking-tight">{agencyType === "sport" ? "I tuoi sport" : "Le tue verticali"}</h2>
              <p className="text-muted-foreground text-[13px] mb-7">{agencyType === "sport" ? "Seleziona gli sport che gestisci" : "Seleziona i settori in cui operi"}</p>

              <div className="grid grid-cols-3 gap-2.5">
                {(agencyType === "sport" ? sports : talentVerticals).map((s) => {
                  const list = agencyType === "sport" ? selectedSports : selectedVerticals;
                  const sel = list.includes(s.label);
                  return (
                    <button
                      key={s.label}
                      onClick={() => {
                        if (agencyType === "sport") {
                          setSelectedSports(prev => prev.includes(s.label) ? prev.filter(x => x !== s.label) : [...prev, s.label]);
                        } else {
                          setSelectedVerticals(prev => prev.includes(s.label) ? prev.filter(x => x !== s.label) : [...prev, s.label]);
                        }
                      }}
                      className={`py-5 px-3 rounded-[14px] border-[1.5px] cursor-pointer transition-all text-center ${
                        sel ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      <div className="text-[32px] mb-1.5">{s.icon}</div>
                      <div className="text-[13px] font-bold">{s.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setStep(1)} className="px-5 py-3.5 rounded-[10px] bg-secondary text-foreground text-sm font-semibold cursor-pointer border border-border">
                  Indietro
                </button>
                <button
                  onClick={() => {
                    const hasSelection = agencyType === "sport" ? selectedSports.length > 0 : selectedVerticals.length > 0;
                    hasSelection ? setStep(3) : toast.error("Seleziona almeno una opzione");
                  }}
                  className="flex-1 py-3.5 rounded-[10px] bg-primary text-primary-foreground text-[15px] font-extrabold cursor-pointer glow-accent hover:opacity-90 transition-opacity"
                >
                  Continua
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              className="bg-card rounded-[20px] p-9 border border-border"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-[26px] font-black text-foreground mb-1 tracking-tight">La tua agenzia</h2>
              <p className="text-muted-foreground text-[13px] mb-7">Ultimi dettagli</p>

              <label className="text-xs text-muted-foreground font-semibold block mb-2">Nome agenzia</label>
              <input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Es. Taura Management"
                className="w-full px-4 py-3.5 rounded-[10px] border border-border bg-secondary text-foreground text-[15px] outline-none mb-6 focus:border-primary transition-colors placeholder:text-muted-foreground"
              />

              <label className="text-xs text-muted-foreground font-semibold block mb-3">Dimensione roster</label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {["1-5", "5-15", "15-50", "50+"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`py-3.5 rounded-[10px] border-[1.5px] text-[15px] font-bold cursor-pointer transition-all ${
                      selectedSize === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {s}
                    <div className="text-[9px] text-muted-foreground font-medium mt-0.5">{agencyType === "sport" ? "atleti" : "talent"}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setStep(2)} className="px-5 py-3.5 rounded-[10px] bg-secondary text-foreground text-sm font-semibold cursor-pointer border border-border">
                  Indietro
                </button>
                <button
                  onClick={() => agencyName.trim() ? handleFinish() : toast.error("Inserisci il nome dell'agenzia")}
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-[10px] bg-primary text-primary-foreground text-[15px] font-extrabold cursor-pointer glow-accent hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Salvataggio..." : "Inizia ad usare Taura OS"}
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
