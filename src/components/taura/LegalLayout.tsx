import { Link } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";

interface LegalLayoutProps {
  title: string;
  version: string;
  lastUpdated: string;
  children: React.ReactNode;
}

const LegalLayout = ({ title, version, lastUpdated, children }: LegalLayoutProps) => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Torna al sito
        </Link>
        <Link to="/legal" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
          <Scale className="w-3.5 h-3.5" />
          Indice documenti legali
        </Link>
      </div>
    </header>

    <main id="main-content" className="max-w-3xl mx-auto px-5 py-10">
      <div className="mb-8">
        <div className="text-[11px] font-bold tracking-wider uppercase text-primary mb-2">
          Documento legale
        </div>
        <h1 className="text-[32px] font-bold text-foreground tracking-tight leading-tight mb-3">
          {title}
        </h1>
        <div className="text-[12px] text-muted-foreground">
          Versione {version} · Ultimo aggiornamento: {lastUpdated}
        </div>
      </div>

      <article className="prose prose-sm dark:prose-invert max-w-none
        prose-headings:tracking-tight prose-headings:text-foreground
        prose-h2:text-[20px] prose-h2:font-semibold prose-h2:mt-10 prose-h2:mb-3
        prose-h3:text-[15px] prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-[13.5px] prose-p:leading-relaxed prose-p:text-foreground/85
        prose-li:text-[13.5px] prose-li:text-foreground/85
        prose-strong:text-foreground
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-table:text-[12px]
        prose-th:text-foreground prose-th:font-semibold
        prose-td:text-foreground/85
      ">
        {children}
      </article>

      <footer className="mt-14 pt-6 border-t border-border text-[11px] text-muted-foreground">
        Per qualsiasi domanda sul trattamento dei tuoi dati personali scrivi a{" "}
        <a href="mailto:info@tauramanagement.com" className="text-primary hover:underline">
          info@tauramanagement.com
        </a>
        . Puoi proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali (
        <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          garanteprivacy.it
        </a>
        ).
      </footer>
    </main>
  </div>
);

export default LegalLayout;
