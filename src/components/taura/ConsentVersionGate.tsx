import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface PrivacyVersion {
  doc_type: string;
  version: string;
}

const REQUIRED_DOCS = ["privacy_policy", "terms"] as const;
const CACHE_KEY = "taura:consent-gate:v1";

function getCached(): string[] {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); } catch { return []; }
}
function addCached(versions: PrivacyVersion[]) {
  try {
    const keys = [...new Set([...getCached(), ...versions.map(v => `${v.doc_type}:${v.version}`)])];
    localStorage.setItem(CACHE_KEY, JSON.stringify(keys));
  } catch {}
}

const ConsentVersionGate = () => {
  const { user } = useAuth();
  const [needsConsent, setNeedsConsent] = useState(false);
  const [currentVersions, setCurrentVersions] = useState<PrivacyVersion[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkConsents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const checkConsents = async () => {
    try {
      const { data: versions } = await supabase
        .from("privacy_versions")
        .select("doc_type, version")
        .eq("is_current", true)
        .in("doc_type", [...REQUIRED_DOCS]);

      if (!versions || versions.length === 0) return;

      const cached = getCached();
      // Short-circuit: all versions already accepted locally
      if (versions.every(v => cached.includes(`${v.doc_type}:${v.version}`))) return;

      const { data: consents } = await supabase
        .from("user_consents")
        .select("consent_type, version, granted, revoked_at")
        .eq("user_id", user!.id)
        .in("consent_type", [...REQUIRED_DOCS]);

      const needsAccept = versions.some((v) => {
        if (cached.includes(`${v.doc_type}:${v.version}`)) return false;
        const match = consents?.find((c) =>
          c.consent_type === v.doc_type && c.version === v.version && c.granted && !c.revoked_at,
        );
        return !match;
      });

      if (needsAccept) {
        setCurrentVersions(versions);
        setNeedsConsent(true);
      }
    } catch (e) {
      console.warn("[consent-gate] check failed:", e);
    }
  };

  const accept = async () => {
    setSubmitting(true);
    addCached(currentVersions);
    setNeedsConsent(false);
    try {
      await supabase.functions.invoke("consent-webhook", {
        body: {
          source: "consent_gate",
          consents: currentVersions.map((v) => ({
            type: v.doc_type,
            granted: true,
            version: v.version,
          })),
        },
      });
    } catch (e) {
      console.error("[consent-gate] accept failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {needsConsent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-gate-title"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)" }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-[440px] rounded-2xl bg-card border border-border shadow-2xl p-7"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" strokeWidth={2} />
            </div>
            <h2 id="consent-gate-title" className="text-[20px] font-semibold text-foreground tracking-tight mb-2">
              Abbiamo aggiornato la Privacy Policy
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
              Per continuare ad usare Taura OS, leggi e conferma di accettare le versioni aggiornate dei documenti.
            </p>

            <div className="space-y-2 mb-5">
              {currentVersions.map((v) => (
                <Link
                  key={v.doc_type}
                  to={`/${v.doc_type === "privacy_policy" ? "privacy" : "terms"}`}
                  target="_blank"
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="text-[12.5px] font-semibold text-foreground">
                      {v.doc_type === "privacy_policy" ? "Privacy Policy" : "Termini di Servizio"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Versione {v.version}</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>

            <button
              onClick={accept}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-60"
            >
              {submitting ? "Salvataggio..." : "Accetto e continuo"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConsentVersionGate;
