import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TauraLogo, Pill, MiniChart } from "@/components/taura/ui-primitives";
import { motion } from "framer-motion";

const features = [
  { icon: "⬡", title: "Command Center", desc: "Dashboard real-time con revenue, scadenze, pipeline e KPI.", color: "text-taura-accent", bg: "bg-taura-accent/10" },
  { icon: "▤", title: "Contract Vault", desc: "Upload PDF → clausole estratte in 45 sec. Conflict Scanner automatico.", color: "text-taura-blue", bg: "bg-taura-blue/10" },
  { icon: "◇", title: "Deal Intelligence", desc: "Comparabili mercato, pricing suggerito, scenari negoziali.", color: "text-taura-purple", bg: "bg-taura-purple/10" },
  { icon: "▧", title: "Sponsor Proof", desc: "Report ROI in 30 secondi. PDF branded per il rinnovo.", color: "text-taura-pink", bg: "bg-taura-pink/10" },
  { icon: "◎", title: "Roster Management", desc: "Profili atleti con contratti, deal, revenue, social, timeline.", color: "text-taura-orange", bg: "bg-taura-orange/10" },
  { icon: "◈", title: "AI Assistant", desc: "Parla in italiano, l'AI esegue. L'interfaccia primaria del sistema.", color: "text-taura-green", bg: "bg-taura-green/10" },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-y-auto bg-background relative">
      <div className="fixed top-[-200px] right-[-200px] w-[600px] h-[600px] ambient-glow pointer-events-none" />
      <div className="fixed bottom-[-300px] left-[-100px] w-[500px] h-[500px] ambient-glow-blue pointer-events-none" />

      {/* Nav */}
      <nav className="max-w-[1140px] mx-auto px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TauraLogo size={28} />
          <span className="font-bold text-[16px] text-foreground tracking-tight">TAURA</span>
          <span className="text-[10px] text-taura-text4 font-mono bg-taura-surface px-1.5 py-0.5 rounded">OS</span>
        </div>
        <div className="flex items-center gap-5">
          <span onClick={() => navigate("/pricing")} className="text-taura-text2 text-[12px] cursor-pointer font-medium hover:text-foreground transition-colors">Pricing</span>
          <span title="Coming soon" className="text-taura-text2 text-[12px] font-medium opacity-50 cursor-not-allowed transition-colors">Prodotto</span>
          <div className="w-px h-3.5 bg-border" />
          <span onClick={() => navigate("/login")} className="text-foreground text-[12px] cursor-pointer font-semibold">Accedi</span>
          <button onClick={() => navigate("/login")} className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity">
            Inizia gratis
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-[1140px] mx-auto px-10 pt-16 pb-10 flex gap-12 items-center">
        <motion.div className="flex-[1.1]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-1.5 bg-taura-surface border border-border rounded-full px-3 py-0.5 mb-5">
            <div className="w-[6px] h-[6px] rounded-full bg-taura-green" style={{ boxShadow: "0 0 8px hsl(160, 67%, 52%, 0.6)" }} />
            <span className="text-[10px] text-taura-text2 font-medium">Powered by AI</span>
          </div>

          <h1 className="text-[44px] font-bold leading-[1.08] text-foreground mb-4 tracking-tight">
            L'ambiente operativo<br />
            <span className="text-gradient">AI-native</span> per agenzie<br />
            di talent e sport
          </h1>

          <p className="text-[14px] text-taura-text2 leading-relaxed max-w-[440px] mb-7">
            Contratti, talent, deal, campagne, sponsor, revenue — tutto in un unico sistema dove l'AI non è una feature, è il modo in cui lavori.
          </p>

          <div className="flex gap-3 mb-5">
            <button onClick={() => navigate("/login")} className="bg-primary text-primary-foreground px-7 py-3 rounded-lg text-[14px] font-bold cursor-pointer glow-accent hover:opacity-90 transition-opacity">
              Inizia gratis →
            </button>
            <button disabled title="Coming soon" className="bg-taura-surface text-foreground border border-border px-5 py-3 rounded-lg text-[13px] font-semibold opacity-50 cursor-not-allowed transition-colors">
              ▶ Demo
            </button>
          </div>

          <div className="flex gap-5 text-[11px] text-taura-text3">
            <span>✓ Free plan</span>
            <span>✓ Setup 90 sec</span>
            <span>✓ Dati crittografati</span>
          </div>
        </motion.div>

        {/* Hero mockup */}
        <motion.div
          className="flex-1 bg-card rounded-xl border border-border overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{ boxShadow: "0 20px 60px hsl(240, 27%, 5%, 0.8)" }}
        >
          <div className="flex gap-1.5 px-3 py-2 border-b border-border bg-secondary">
            <div className="w-2 h-2 rounded-full bg-taura-red/40" />
            <div className="w-2 h-2 rounded-full bg-taura-orange/40" />
            <div className="w-2 h-2 rounded-full bg-taura-green/40" />
            <span className="ml-auto text-[8px] text-taura-text4 font-mono">taura.app</span>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {[
                { l: "REVENUE YTD", v: "€892k", c: "hsl(160, 67%, 52%)", d: [30, 35, 32, 45, 52, 48, 62, 58, 72, 78, 85, 92] },
                { l: "CONFLITTI", v: "2 attivi", c: "hsl(348, 100%, 65%)", d: [1, 0, 2, 1, 3, 2, 1, 2, 2, 1, 2, 2] },
              ].map((s, i) => (
                <div key={i} className="bg-taura-surface rounded-lg p-2 border border-border">
                  <div className="text-[7px] font-bold text-taura-text4 tracking-wider">{s.l}</div>
                  <div className="text-base font-bold mt-0.5" style={{ color: s.c }}>{s.v}</div>
                  <MiniChart data={s.d} color={s.c} h={22} />
                </div>
              ))}
            </div>
            <div className="bg-taura-surface rounded-lg p-2.5 border border-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-[5px] h-[5px] rounded-full bg-taura-accent" style={{ boxShadow: "0 0 6px hsl(170, 100%, 45%, 0.6)" }} />
                <span className="text-[8px] text-taura-accent font-bold tracking-wider">TAURA AI</span>
              </div>
              <div className="text-[10px] text-taura-text2 leading-relaxed">
                ⚠ Conflitto: deal Puma per Marco Rossi confligge con clausola 3.1 Adidas. Rischio penale €15k.
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-[1140px] mx-auto px-10 pt-14 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-[24px] font-bold text-foreground tracking-tight">Un sistema, non un tool</h2>
          <p className="text-taura-text3 text-[12px] mt-1.5">6 funzioni core che sostituiscono 10 software diversi</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="bg-card rounded-xl p-5 border border-border hover:border-taura-border-light cursor-default transition-all duration-200"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
            >
              <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center text-base ${f.color} mb-3`}>{f.icon}</div>
              <h3 className="text-[13px] font-bold text-foreground mb-1">{f.title}</h3>
              <p className="text-[11px] text-taura-text2 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="max-w-[1140px] mx-auto px-10 pb-10">
        <div className="text-center py-5 border-t border-b border-border">
          <p className="text-taura-text3 text-[12px]">Costruito da chi ha gestito 100+ campagne per brand nazionali</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-[1140px] mx-auto px-10 py-6 flex items-center justify-between text-[11px] text-taura-text4">
        <div className="flex items-center gap-2">
          <TauraLogo size={18} />
          <span className="font-bold text-taura-text3">TAURA OS</span>
        </div>
        <div className="flex gap-5">
          {["Pricing", "Prodotto", "Chi siamo", "Privacy", "Termini"].map(l => (
            <span key={l} className="cursor-pointer hover:text-taura-text2 transition-colors" onClick={() => l === "Pricing" ? navigate("/pricing") : null}>{l}</span>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
