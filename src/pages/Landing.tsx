import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { TauraLogo, MiniChart } from "@/components/taura/ui-primitives";
import PlansGrid, { type Plan } from "@/components/taura/PlansGrid";
import HowItWorksStage from "@/components/taura/HowItWorksStage";
import InteractiveDemo from "@/components/taura/InteractiveDemo";
import RoiCalculator from "@/components/taura/RoiCalculator";
import {
  FileText,
  Sparkles,
  Users,
  BarChart3,
  MessageSquare,
  ChevronDown,
  ArrowRight,
  Zap,
  Megaphone,
  Bell,
  Bot,
  Check,
  Upload,
  Send,
  Shield,
  Lock,
  Server,
  X,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const features = [
  { icon: BarChart3, title: "Command Center", desc: "Dashboard real-time con revenue, scadenze, pipeline e KPI.", tint: "primary" },
  { icon: FileText, title: "Contract Vault", desc: "Upload PDF → clausole estratte in 45s con accuracy >99%. Conflict Scanner automatico.", tint: "blue" },
  { icon: Sparkles, title: "Deal Intelligence", desc: "Comparabili di mercato, pricing suggerito, scenari negoziali.", tint: "purple" },
  { icon: Megaphone, title: "Campagne AI", desc: "Carica il brief del brand: l'AI struttura la campagna, estrae i deliverable e genera i messaggi per i talent.", tint: "pink" },
  { icon: Users, title: "Roster Management", desc: "Profili talent completi: contratti, deal, social, timeline.", tint: "orange" },
  { icon: Bell, title: "Notifiche Intelligenti", desc: "Alert automatici su conflitti, scadenze e approvazioni. Zero cose che scivolano via.", tint: "green" },
] as const;

const tintBg: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-taura-blue/10 text-taura-blue",
  purple: "bg-taura-purple/10 text-taura-purple",
  pink: "bg-taura-pink/10 text-taura-pink",
  orange: "bg-taura-orange/10 text-taura-orange",
  green: "bg-taura-green/10 text-taura-green",
};

const roiStats = [
  { k: "45s", label: "per analizzare un contratto", vs: "vs 4 ore a mano" },
  { k: "€15k", label: "conflitti evitati in media", vs: "per agenzia nei primi 3 mesi" },
  { k: "30s", label: "per un Proof Package sponsor", vs: "vs 3 giorni di lavoro" },
  { k: "8x", label: "velocità su ricerca clausole", vs: "vs vecchi vault PDF" },
];

const faqs = [
  {
    q: "I miei dati dei contratti sono al sicuro?",
    a: "Sì. Ogni agenzia è isolata via Row-Level Security a livello database. I documenti sono crittografati at-rest su Supabase Storage. Nessuno (né Taura né altri clienti) può vedere i tuoi file.",
  },
  {
    q: "Quanto tempo serve per iniziare?",
    a: "Setup in 90 secondi: tipo agenzia, verticali, nome. I primi contratti sono utilizzabili dopo il primo upload (<1 minuto).",
  },
  {
    q: "Come si migrano i contratti esistenti?",
    a: "Upload bulk: carichi 50 PDF in una volta, l'AI li processa in parallelo. Per volumi >500 contratti ti affianchiamo 1-on-1.",
  },
  {
    q: "L'AI sostituisce il mio team legale?",
    a: "No. Taura accelera: estrae clausole, segnala conflitti, suggerisce pricing. Le decisioni restano umane. L'obiettivo è farti lavorare su 10 talent come oggi lavori su 1.",
  },
  {
    q: "Posso uscire quando voglio?",
    a: "Sì, e puoi esportare tutti i tuoi dati in JSON e PDF in qualsiasi momento. Zero lock-in.",
  },
  {
    q: "Quando apre la piattaforma?",
    a: "Siamo in beta privata. Le prime 5 agenzie che richiedono accesso entrano gratis per 6 mesi e bloccano il prezzo al rinnovo.",
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.3]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const goPlans = (plan?: Plan) => {
    const q = plan ? `?plan=${plan.id}` : "";
    navigate(`/pricing${q}`);
  };

  useEffect(() => {
    document.title = "Taura OS - L'ambiente operativo AI-native per agenzie";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-30%] right-[-10%] w-[900px] h-[900px] rounded-full blur-3xl opacity-[0.18]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 60%)" }} />
        <div className="absolute top-[40%] left-[-20%] w-[800px] h-[800px] rounded-full blur-3xl opacity-[0.12]"
          style={{ background: "radial-gradient(circle, hsl(220, 90%, 60%) 0%, transparent 60%)" }} />
      </div>

      {/* Sticky glass nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-[1180px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
            <TauraLogo size={28} />
            <span className="font-bold text-[15px] tracking-tight">TAURA</span>
            <span className="text-[9px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">OS</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#come-funziona" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors hidden md:block">Come funziona</a>
            <a href="#roi" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors hidden md:block">Risultati</a>
            <a href="#piani" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors hidden md:block">Piani</a>
            <span onClick={() => navigate("/login")} className="text-[12px] font-semibold cursor-pointer hover:text-primary transition-colors">Accedi</span>
            <button
              onClick={() => navigate("/pricing")}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer hover:shadow-lg hover:shadow-primary/30 transition-all"
            >
              Richiedi accesso
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative max-w-[1180px] mx-auto px-8 pt-24 pb-24">
        {/* Text only - parallax scroll */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="text-center max-w-[840px] mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-card/60 backdrop-blur border border-border/60 rounded-full px-3.5 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-taura-green" style={{ boxShadow: "0 0 10px hsl(160, 67%, 52%, 0.8)" }} />
              <span className="text-[11px] font-medium text-muted-foreground">Beta privata · prime 5 agenzie gratis</span>
            </div>

            <h1 className="text-[56px] md:text-[72px] font-bold leading-[1.02] tracking-[-0.035em] mb-6">
              L'ambiente operativo<br />
              <span className="bg-gradient-to-r from-primary via-taura-accent to-taura-blue bg-clip-text text-transparent">
                AI-native
              </span>{" "}
              per agenzie<br />
              di talent e sport.
            </h1>

            <p className="text-[17px] md:text-[19px] text-muted-foreground leading-relaxed max-w-[640px] mx-auto mb-10">
              Contratti, talent, deal, campagne, sponsor, revenue - tutto in un unico sistema
              dove l'AI non è una feature, è il modo in cui lavori.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button
                onClick={() => navigate("/pricing")}
                className="group bg-primary text-primary-foreground px-7 py-3.5 rounded-xl text-[14px] font-semibold cursor-pointer hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                Richiedi accesso
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => document.getElementById("come-funziona")?.scrollIntoView({ behavior: "smooth" })}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium flex items-center gap-1.5"
              >
                Scopri come funziona
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 justify-center">
              {[
                { Icon: Shield, label: "GDPR compliant", tip: "Dati gestiti secondo Regolamento UE 2016/679" },
                { Icon: Lock, label: "AES-256 at-rest", tip: "Storage crittografato e Row-Level Security per agenzia" },
                { Icon: Server, label: "Hosted in EU", tip: "Infrastruttura Supabase, data residency europea" },
                { Icon: Zap, label: "Setup 90s", tip: "Dal signup al primo contratto caricato" },
              ].map((b, i) => (
                <span
                  key={i}
                  title={b.tip}
                  className="group flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-default"
                >
                  <b.Icon className="w-3 h-3 text-taura-green/80 group-hover:text-taura-green transition-colors" />
                  {b.label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Hero mockup - fuori dal parallax, nessun transform scroll */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          className="mt-16 mx-auto max-w-[920px] relative"
        >
          <div className="absolute inset-0 -bottom-10 blur-3xl opacity-60 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.25) 0%, transparent 70%)" }} />
          <div className="relative rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
            <div className="flex gap-1.5 px-4 py-2.5 border-b border-border/40 bg-secondary/50">
              <div className="w-2.5 h-2.5 rounded-full bg-taura-red/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-taura-orange/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-taura-green/50" />
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">taura.app/dashboard</span>
            </div>
            <div className="p-5 grid grid-cols-3 gap-3">
              {[
                { l: "REVENUE YTD", v: "€892k", c: "hsl(160, 67%, 52%)", d: [30, 45, 52, 48, 62, 72, 78, 85, 92] },
                { l: "CONTRATTI ATTIVI", v: "47", c: "hsl(220, 90%, 62%)", d: [22, 28, 32, 38, 42, 45, 47, 47, 47] },
                { l: "CONFLITTI", v: "2", c: "hsl(348, 100%, 65%)", d: [4, 3, 2, 4, 5, 3, 2, 2, 2] },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                  className="bg-secondary/60 rounded-xl p-3 border border-border/50"
                >
                  <div className="text-[9px] font-bold text-muted-foreground tracking-wider">{s.l}</div>
                  <div className="text-[22px] font-bold mt-1" style={{ color: s.c }}>{s.v}</div>
                  <MiniChart data={s.d} color={s.c} h={28} />
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="mx-5 mb-5 bg-secondary/60 rounded-xl p-3 border border-primary/25"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.8)" }} />
                <span className="text-[10px] text-primary font-bold tracking-wider">TAURA AI</span>
              </div>
              <div className="text-[12px] text-foreground/90 leading-relaxed">
                ⚠ Conflitto rilevato: il deal Puma per Marco Rossi confligge con la clausola 3.1 del contratto Adidas. Rischio penale stimato <strong>€15k</strong>.
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* STATS STRIP */}
      <section className="relative max-w-[1180px] mx-auto px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 rounded-2xl overflow-hidden border border-border/40"
        >
          {roiStats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-card/60 backdrop-blur p-6 md:p-8 text-center"
            >
              <div className="text-[38px] md:text-[44px] font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                {s.k}
              </div>
              <div className="text-[12px] font-semibold text-foreground mt-1">{s.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{s.vs}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* COME FUNZIONA */}
      <section id="come-funziona" className="relative max-w-[1180px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-14"
        >
          <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-3">Come funziona</div>
          <h2 className="text-[40px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.05]">
            Tre passi per<br />
            ridurre il tuo carico operativo.
          </h2>
          <p className="text-[14px] text-muted-foreground mt-4 hidden md:block">
            Passa il mouse su uno step per vederlo in azione.
          </p>
        </motion.div>

        <HowItWorksStage />
      </section>

      {/* FEATURES */}
      <section className="relative max-w-[1180px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-14"
        >
          <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-3">Un sistema, non un tool</div>
          <h2 className="text-[40px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.05] max-w-[760px] mx-auto">
            Sostituisci 10 software con <span className="text-primary">uno solo</span>.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
                whileHover={{ y: -4 }}
                className="bg-card/70 backdrop-blur-xl rounded-2xl p-7 border border-border/50 hover:border-primary/30 transition-all duration-300 cursor-default"
              >
                <div className={`w-10 h-10 rounded-xl ${tintBg[f.tint]} flex items-center justify-center mb-5`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight mb-1.5">{f.title}</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* PRODUCT LANDSCAPE */}
      <section className="relative max-w-[1180px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-14"
        >
          <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-3">Demo interattiva</div>
          <h2 className="text-[40px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.05]">
            Provalo ora,<br />
            senza <span className="text-primary">registrarti</span>.
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-[640px] mx-auto mt-4">
            Naviga dashboard, campagne, roster e calendario. E chiedi a Taura AI quello che vuoi sapere sul prodotto, risponde davvero.
          </p>
        </motion.div>

        <InteractiveDemo />
      </section>

      {/* PRIMA / DOPO */}
      <section className="relative max-w-[1180px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-12"
        >
          <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-3">Il cambio</div>
          <h2 className="text-[40px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.05]">
            La tua settimana,<br />
            prima e dopo <span className="text-primary">Taura</span>.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="relative rounded-2xl border border-border/40 bg-muted/20 p-8"
          >
            <div className="inline-flex items-center gap-2 bg-background/60 border border-border/50 text-muted-foreground text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full mb-6">
              Senza Taura
            </div>
            <ul className="space-y-4">
              {[
                "7 tool diversi: Excel, Drive, DocuSign, Notion, Slack, Calendly, Airtable",
                "12h/settimana di data entry manuale e copia-incolla",
                "Contratti persi in cartelle Drive, ricerca clausole a mano",
                "Conflitti scoperti solo quando arriva la penale (€10-50k)",
                "Brief dei brand letti manualmente, risposta al talent in 3 giorni",
                "Report sponsor costruiti la notte prima del meeting",
              ].map((t, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
                  className="flex items-start gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-taura-red/15 border border-taura-red/25 flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-taura-red" />
                  </span>
                  <span className="text-[13.5px] text-muted-foreground leading-relaxed">{t}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-7 pt-5 border-t border-border/40 text-[12px] text-muted-foreground">
              <strong className="text-foreground">Risultato:</strong> 12h/settimana persi, rischio penali, occasioni mancate.
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="relative rounded-2xl border border-primary/30 bg-primary/5 p-8 overflow-hidden"
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-50"
              style={{
                background:
                  "radial-gradient(ellipse at top right, hsl(var(--primary) / 0.10) 0%, transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-primary/15 border border-primary/30 text-primary text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full mb-6">
                Con Taura
              </div>
              <ul className="space-y-4">
                {[
                  "Un sistema, un login — roster, contratti, deal, campagne, revenue",
                  "90s setup, l'AI fa il data entry al posto tuo",
                  "Tutti i contratti cercabili full-text in 1 click",
                  "Conflitti rilevati in automatico prima che diventino penali",
                  "Brief → deliverable → messaggi talent in 60 secondi",
                  "Proof Package sponsor generato in 30 secondi",
                ].map((t, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
                    className="flex items-start gap-3"
                  >
                    <span className="w-5 h-5 rounded-full bg-taura-green/15 border border-taura-green/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-taura-green" />
                    </span>
                    <span className="text-[13.5px] text-foreground leading-relaxed">{t}</span>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-7 pt-5 border-t border-primary/20 text-[12px] text-foreground">
                <strong>Risultato:</strong> 12h/settimana recuperate, zero penali, roster 2x con stesso team.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CAMPAGNE & BRIEF AI */}
      <section className="relative max-w-[1180px] mx-auto px-8 py-24">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-4">Campagne & Brief AI</div>
            <h2 className="text-[36px] md:text-[46px] font-bold tracking-[-0.025em] leading-[1.06] mb-5">
              Dal brief al talent<br />
              <span className="text-primary">in 60 secondi</span>.
            </h2>
            <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
              Carica il PDF o PPTX del brand. Taura legge il brief, struttura la campagna,
              estrae ogni deliverable e genera un messaggio personalizzato pronto da inviare
              a ciascun talent. Senza digitare una riga.
            </p>

            <div className="space-y-4">
              {[
                { icon: Upload, text: "Brief PDF/PPTX → campagna strutturata automaticamente", accent: false },
                { icon: Bot, text: "Deliverable per talent estratti con accuracy >99%", accent: true },
                { icon: Send, text: "Messaggi personalizzati per ogni talent pronti da inviare", accent: false },
                { icon: Bell, text: "Alert automatici su approvazioni, scadenze e conflitti", accent: false },
              ].map((b, i) => {
                const Icon = b.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.09, ease: EASE }}
                    className="flex items-start gap-3"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${b.accent ? "bg-primary/15 text-primary ring-1 ring-primary/25" : "bg-secondary text-muted-foreground"}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[13.5px] leading-relaxed ${b.accent ? "text-foreground font-medium" : "text-muted-foreground"}`}>{b.text}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Right: animated pipeline mockup */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE }}
            className="relative"
          >
            <div className="absolute inset-0 blur-3xl opacity-30 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 60% 40%, hsl(var(--primary) / 0.4) 0%, transparent 65%)" }} />

            <div className="relative space-y-3">
              {/* Step 1: Upload */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-foreground">brief_puma_estate2025.pdf</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Caricato · 2.4 MB</div>
                </div>
                <div className="text-[10px] bg-taura-green/15 text-taura-green border border-taura-green/25 px-2 py-0.5 rounded-full font-semibold">Ricevuto</div>
              </motion.div>

              {/* AI processing */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.22, ease: EASE }}
                className="bg-card rounded-2xl border border-primary/30 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.8)" }} />
                  <span className="text-[10px] font-bold text-primary tracking-wider">TAURA AI · elaborazione</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">0.8s</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["Campagna", "Deliverable", "Talent"].map((label, i) => (
                    <div key={i} className="bg-secondary rounded-lg px-2.5 py-1.5 text-center">
                      <Check className="w-3 h-3 text-taura-green mx-auto mb-0.5" />
                      <div className="text-[9px] font-semibold text-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Deliverables extracted */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.34, ease: EASE }}
                className="bg-card rounded-2xl border border-border p-4"
              >
                <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-2.5">4 deliverable estratti</div>
                <div className="space-y-1.5">
                  {[
                    { talent: "M. Rossi", type: "Reel", date: "12 Giu" },
                    { talent: "L. Ferrari", type: "Post ×2", date: "15 Giu" },
                    { talent: "M. Rossi", type: "Story", date: "20 Giu" },
                  ].map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <div className="w-5 h-5 rounded-md bg-secondary flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-bold text-muted-foreground">{d.talent.split(" ").map(w => w[0]).join("")}</span>
                      </div>
                      <span className="text-foreground font-medium flex-1">{d.talent}</span>
                      <span className="text-muted-foreground">{d.type}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">{d.date}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Message generated */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.46, ease: EASE }}
                className="bg-card rounded-2xl border border-border p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-semibold text-foreground">Messaggio per M. Rossi</span>
                  <span className="ml-auto text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-semibold">Generato AI</span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  "Ciao Marco! Ti mando il brief Puma per giugno. Hai un Reel il 12 e una Story il 20…"
                </div>
                <div className="flex gap-2 mt-2.5">
                  <div className="flex items-center gap-1 text-[10px] text-primary font-semibold cursor-pointer">
                    <Send className="w-2.5 h-2.5" /> Invia
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold cursor-pointer ml-2">
                    Copia testo
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* NOTIFICHE */}
      <section className="relative max-w-[1180px] mx-auto px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative rounded-3xl border border-border/50 bg-card/60 overflow-hidden p-8 md:p-12"
        >
          <div className="absolute top-0 left-0 w-[500px] h-[300px] pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 0% 0%, hsl(var(--primary) / 0.1) 0%, transparent 60%)" }} />

          <div className="relative grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full border border-primary/20 mb-5">
                <Bell className="w-3 h-3" /> Notifiche intelligenti
              </div>
              <h2 className="text-[30px] md:text-[38px] font-bold tracking-[-0.025em] leading-[1.08] mb-4">
                Nessuna scadenza,<br />nessun conflitto, nessun alert <span className="text-primary">ti sfugge.</span>
              </h2>
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                Taura monitora contratti, campagne e roster in background.
                Ogni evento rilevante - conflitto di clausola, scadenza imminente, deliverable in ritardo -
                genera un alert diretto con il contesto già pronto.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                { icon: "🛡", label: "Conflitto rilevato", msg: "Il deal Nike per Bianchi confligge con la clausola 4.2 di Adidas.", sev: "ALTO", color: "taura-red" },
                { icon: "⏰", label: "Scadenza 14 giorni", msg: "Contratto Rossi/Puma scade il 5 mag. Rinnovo non ancora avviato.", sev: "MEDIO", color: "taura-orange" },
                { icon: "📋", label: "Deliverable in ritardo", msg: "Campagna Nike - Story di M. Rossi non approvata (4 gg fa).", sev: "BASSO", color: "primary" },
              ].map((n, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.1, ease: EASE }}
                  className="flex items-start gap-3 bg-card rounded-xl border border-border p-3.5"
                >
                  <span className="text-base shrink-0 mt-0.5">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-semibold text-foreground">{n.label}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        n.color === "taura-red" ? "bg-red-500/15 text-red-400" :
                        n.color === "taura-orange" ? "bg-orange-500/15 text-orange-400" :
                        "bg-primary/15 text-primary"
                      }`}>{n.sev}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">{n.msg}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ROI SECTION */}
      <section id="roi" className="relative max-w-[1180px] mx-auto px-8 py-24">
        <RoiCalculator />
      </section>

      {/* TESTIMONIAL */}
      <section className="relative max-w-[1180px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="max-w-[820px] mx-auto text-center"
        >
          <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-5">Costruito con chi lavora sul campo</div>
          <p className="text-[28px] md:text-[36px] font-semibold leading-[1.25] tracking-[-0.02em] text-foreground/90">
            "Gestisco 30 talent su tre verticali diverse.
            Taura mi fa risparmiare tre giornate a settimana solo sui contratti."
          </p>
          <div className="mt-8 inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-taura-blue" />
            <div className="text-left">
              <div className="text-[13px] font-semibold">Early beta tester</div>
              <div className="text-[11px] text-muted-foreground">Agenzia sport & talent, Milano</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* PLANS */}
      <section id="piani" className="relative max-w-[1180px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-14"
        >
          <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-3">Piani</div>
          <h2 className="text-[40px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.05] mb-4">
            Prezzi chiari. Valore reale.
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-[560px] mx-auto">
            Siamo in beta privata. Le prime 5 agenzie entrano gratis per 6 mesi
            e bloccano il prezzo al rinnovo.
          </p>
        </motion.div>

        <PlansGrid onSelectPlan={goPlans} />
      </section>

      {/* FAQ */}
      <section className="relative max-w-[760px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-12"
        >
          <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-3">Domande frequenti</div>
          <h2 className="text-[40px] md:text-[48px] font-bold tracking-[-0.025em] leading-[1.05]">
            Tutto quello che vuoi sapere.
          </h2>
        </motion.div>

        <div className="flex flex-col gap-2">
          {faqs.map((f, i) => {
            const open = openFaq === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className={`bg-card/70 backdrop-blur rounded-2xl border overflow-hidden transition-colors ${open ? "border-primary/30" : "border-border/50"}`}
              >
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left cursor-pointer"
                >
                  <span className="text-[14px] font-semibold tracking-tight">{f.q}</span>
                  <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="shrink-0 text-muted-foreground"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-[13px] text-muted-foreground leading-relaxed">
                        {f.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative max-w-[1180px] mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative rounded-[32px] border border-primary/30 bg-gradient-to-br from-card/90 to-card/40 backdrop-blur-xl p-12 md:p-20 text-center overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-25"
              style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)" }} />
          </div>

          <div className="relative">
            <h2 className="text-[44px] md:text-[60px] font-bold tracking-[-0.03em] leading-[1.02] mb-5">
              Sei pronto a<br />
              <span className="bg-gradient-to-r from-primary to-taura-accent bg-clip-text text-transparent">
                moltiplicare il tuo roster
              </span>
              ?
            </h2>
            <p className="text-[16px] text-muted-foreground max-w-[520px] mx-auto mb-8">
              Accesso gratuito per le prime 5 agenzie. Setup in 90 secondi.
            </p>
            <button
              onClick={() => navigate("/pricing")}
              className="group bg-primary text-primary-foreground px-8 py-4 rounded-xl text-[15px] font-semibold cursor-pointer hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
            >
              Richiedi il tuo accesso
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
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
          <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
            <span onClick={() => navigate("/pricing")} className="cursor-pointer hover:text-foreground transition-colors">Piani</span>
            <a href="#come-funziona" className="cursor-pointer hover:text-foreground transition-colors">Come funziona</a>
            <a href="mailto:os@tauramanagement.com" className="cursor-pointer hover:text-foreground transition-colors">Contatti</a>
            <span onClick={() => navigate("/privacy")} className="cursor-pointer hover:text-foreground transition-colors">Privacy</span>
            <span onClick={() => navigate("/terms")} className="cursor-pointer hover:text-foreground transition-colors">Termini</span>
            <span onClick={() => navigate("/cookies")} className="cursor-pointer hover:text-foreground transition-colors">Cookie</span>
            <span onClick={() => navigate("/ai-disclosure")} className="cursor-pointer hover:text-foreground transition-colors">AI Disclosure</span>
            <span onClick={() => navigate("/legal")} className="cursor-pointer hover:text-foreground transition-colors">Legal</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
