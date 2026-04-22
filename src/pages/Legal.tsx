import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, FileText, Cookie, Handshake, Bot, ChevronRight } from "lucide-react";

const DOCS = [
  {
    to: "/privacy",
    icon: Shield,
    title: "Privacy Policy",
    desc: "Come trattiamo i tuoi dati personali. Art. 13 GDPR.",
  },
  {
    to: "/terms",
    icon: FileText,
    title: "Termini e Condizioni",
    desc: "Regole d'uso del servizio, responsabilità, recesso.",
  },
  {
    to: "/cookies",
    icon: Cookie,
    title: "Cookie Policy",
    desc: "Cookie utilizzati e come gestire le preferenze.",
  },
  {
    to: "/dpa",
    icon: Handshake,
    title: "Data Processing Addendum",
    desc: "Accordo per i Clienti che agiscono come Titolari autonomi.",
  },
  {
    to: "/ai-disclosure",
    icon: Bot,
    title: "Informativa AI",
    desc: "Come usiamo Claude e Gemini, quali garanzie, retention.",
  },
];

const Legal = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Torna al sito
        </Link>
      </div>
    </header>

    <main id="main-content" className="max-w-3xl mx-auto px-5 py-10">
      <div className="mb-10">
        <div className="text-[11px] font-bold tracking-wider uppercase text-primary mb-2">
          Centro documenti legali
        </div>
        <h1 className="text-[36px] font-bold text-foreground tracking-tight leading-tight mb-3">
          Trasparenza e compliance
        </h1>
        <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[580px]">
          Tutti i documenti legali, le policy e le informative di Taura OS. Conformi al GDPR, al Codice
          Privacy italiano, alle Linee Guida del Garante e all'AI Act UE.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DOCS.map((d, i) => {
          const Icon = d.icon;
          return (
            <motion.div
              key={d.to}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={d.to}
                className="group relative flex items-start gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className="text-[14px] font-semibold text-foreground tracking-tight">{d.title}</div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{d.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary absolute right-4 top-1/2 -translate-y-1/2 transition-colors" />
              </Link>
            </motion.div>
          );
        })}
      </div>

      <footer className="mt-12 pt-6 border-t border-border text-[12px] text-muted-foreground leading-relaxed">
        <p>
          <strong>Titolare del trattamento:</strong> Alessandro Martano — P.IVA 17902421001 — Via Rumenia 210,
          00071 Roma — PEC{" "}
          <a href="mailto:alessandromartano@pecprivato.it" className="text-primary hover:underline">
            alessandromartano@pecprivato.it
          </a>{" "}
          — Contatto privacy{" "}
          <a href="mailto:info@tauramanagement.com" className="text-primary hover:underline">
            info@tauramanagement.com
          </a>
        </p>
        <p className="mt-2">
          Per reclami puoi rivolgerti all'Autorità Garante per la Protezione dei Dati Personali:{" "}
          <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            garanteprivacy.it
          </a>
          .
        </p>
      </footer>
    </main>
  </div>
);

export default Legal;
