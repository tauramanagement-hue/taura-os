import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "taura:ai_notice_dismissed:v1";

const AIProcessingNotice = () => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-foreground/80">
      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
      <div className="flex-1 leading-relaxed">
        Questa conversazione è elaborata da AI (Claude Anthropic · Gemini Vertex EU), no training sui tuoi dati.{" "}
        <Link to="/ai-disclosure" className="text-primary hover:underline">
          Dettagli
        </Link>
      </div>
      <button
        onClick={close}
        aria-label="Chiudi avviso"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

export default AIProcessingNotice;
