import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, Shield, BarChart3, Megaphone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "taura:cookies:v1";
const VERSION = "2026-04-21";

interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: string;
  timestamp: string;
}

const defaultState: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  version: VERSION,
  timestamp: "",
};

function readLocal(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(state: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

async function persistRemote(state: ConsentState) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.functions.invoke("consent-webhook", {
      body: {
        source: "cookie_banner",
        consents: [
          { type: "cookies_necessary", granted: true, version: VERSION },
          { type: "cookies_analytics", granted: state.analytics, version: VERSION },
          { type: "cookies_marketing", granted: state.marketing, version: VERSION },
        ],
      },
    });
  } catch (e) {
    console.warn("[cookie-banner] remote persist failed:", e);
  }
}

interface CookieConsentBannerProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const CookieConsentBanner = ({ forceOpen = false, onClose }: CookieConsentBannerProps) => {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [state, setState] = useState<ConsentState>(defaultState);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      const existing = readLocal();
      if (existing) setState(existing);
      return;
    }
    const existing = readLocal();
    if (!existing) {
      const t = window.setTimeout(() => setOpen(true), 800);
      return () => window.clearTimeout(t);
    }
  }, [forceOpen]);

  const acceptAll = () => save({ ...state, analytics: true, marketing: true });
  const rejectOptional = () => save({ ...state, analytics: false, marketing: false });
  const saveCustom = () => save(state);

  const save = (next: ConsentState) => {
    const full: ConsentState = { ...next, version: VERSION, timestamp: new Date().toISOString() };
    writeLocal(full);
    persistRemote(full);
    setOpen(false);
    onClose?.();
  };

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop blocks page interaction until user makes a choice (Provv. Garante 10/6/2021) */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[89] bg-black/30 backdrop-blur-sm"
            onClick={(e) => e.preventDefault()}
          />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-desc"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-[460px] z-[90] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl"
        >
          <div className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Cookie className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="cookie-banner-title" className="text-[14px] font-semibold text-foreground tracking-tight">
                  Preferenze cookie
                </h2>
                <p id="cookie-banner-desc" className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                  Usiamo cookie tecnici necessari per il funzionamento. Puoi scegliere se accettare i cookie statistici e di marketing.
                  {" "}
                  <Link to="/cookies" className="text-primary hover:underline">
                    Dettagli
                  </Link>
                </p>
              </div>
              {customize && (
                <button
                  onClick={close}
                  aria-label="Chiudi"
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {customize && (
              <div className="space-y-2 mb-4 mt-3">
                <Row
                  icon={<Shield className="w-3.5 h-3.5" />}
                  label="Necessari"
                  desc="Autenticazione, sessione, preferenze tema. Sempre attivi."
                  checked={true}
                  disabled={true}
                  onChange={() => {}}
                />
                <Row
                  icon={<BarChart3 className="w-3.5 h-3.5" />}
                  label="Statistici"
                  desc="Uso aggregato e anonimizzato per migliorare il servizio."
                  checked={state.analytics}
                  onChange={(v) => setState(s => ({ ...s, analytics: v }))}
                />
                <Row
                  icon={<Megaphone className="w-3.5 h-3.5" />}
                  label="Marketing"
                  desc="Comunicazioni promozionali basate sulle tue preferenze."
                  checked={state.marketing}
                  onChange={(v) => setState(s => ({ ...s, marketing: v }))}
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {!customize ? (
                <>
                  <button
                    onClick={() => setCustomize(true)}
                    className="flex-1 text-[12px] font-semibold px-3 py-2.5 rounded-xl bg-secondary text-foreground border border-border hover:border-primary/40 transition-colors"
                  >
                    Personalizza
                  </button>
                  <button
                    onClick={rejectOptional}
                    className="flex-1 text-[12px] font-semibold px-3 py-2.5 rounded-xl bg-secondary text-foreground border border-border hover:border-primary/40 transition-colors"
                  >
                    Solo necessari
                  </button>
                  <button
                    onClick={acceptAll}
                    className="flex-1 text-[12px] font-semibold px-3 py-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 transition-all"
                  >
                    Accetta tutti
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={rejectOptional}
                    className="flex-1 text-[12px] font-semibold px-3 py-2.5 rounded-xl bg-secondary text-foreground border border-border hover:border-primary/40 transition-colors"
                  >
                    Rifiuta opzionali
                  </button>
                  <button
                    onClick={saveCustom}
                    className="flex-1 text-[12px] font-semibold px-3 py-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 transition-all"
                  >
                    Salva preferenze
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

interface RowProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

const Row = ({ icon, label, desc, checked, disabled, onChange }: RowProps) => (
  <label className={`flex items-start gap-3 p-3 rounded-xl border border-border ${disabled ? "opacity-70" : "hover:border-primary/30 cursor-pointer"} transition-colors`}>
    <div className="w-7 h-7 rounded-lg bg-secondary text-foreground/70 flex items-center justify-center shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[12.5px] font-semibold text-foreground">{label}</div>
      <div className="text-[11px] text-muted-foreground leading-relaxed">{desc}</div>
    </div>
    <input
      type="checkbox"
      className="mt-1 w-4 h-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
    />
  </label>
);

export default CookieConsentBanner;
