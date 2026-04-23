import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyContext } from "@/hooks/useAgencyContext";
import { SeverityBadge } from "@/components/taura/ui-primitives";
import { ExternalLink, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface ConflictRow {
  id: string;
  severity: string;
  conflict_type: string;
  description: string;
  suggestion: string | null;
  status: string | null;
  resolution_note: string | null;
  contract_a_id: string;
  created_at: string | null;
}

const sevMap: Record<string, "ALTO" | "MEDIO" | "INFO"> = {
  high: "ALTO",
  medium: "MEDIO",
  low: "INFO",
};

const AlertsPage = () => {
  const navigate = useNavigate();
  const { agencyId } = useAgencyContext();
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => { if (agencyId) fetchConflicts(); }, [showResolved, agencyId]);

  const fetchConflicts = async () => {
    if (!agencyId) return;
    setLoading(true);
    let query = supabase
      .from("conflicts")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    if (!showResolved) query = query.eq("status", "open");
    const { data } = await query;
    setConflicts((data as ConflictRow[]) || []);
    setLoading(false);
  };

  const resolveConflict = async (id: string) => {
    const note = resolutionNote.trim();
    if (!note) {
      toast.error("Inserisci una descrizione della risoluzione con le modifiche chiave.");
      return;
    }

    // Richiede almeno un "key point" (numero: importo/delta o date)
    if (!/[0-9]/.test(note)) {
      toast.error("Aggiungi almeno un key point numerico (es. 'tagliando 10k', '+€10.000', 'spostato 15/03 → 22/03').");
      return;
    }
    if (!agencyId) return;
    const { error } = await supabase
      .from("conflicts")
      .update({ status: "resolved", resolution_note: resolutionNote.trim() } as any)
      .eq("id", id)
      .eq("agency_id", agencyId);

    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
    toast.success("Conflitto risolto!");

    // Trigger AI to interpret resolution changes and apply them
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke("apply-resolution", {
        body: { conflict_id: id, resolution_note: resolutionNote.trim() },
      });

      if (invokeError) {
        console.error("Apply resolution error:", invokeError);
        toast.error("Risoluzione salvata, ma update AI non applicato.");
      } else if ((result?.actions_applied || 0) > 0) {
        toast.success(`Aggiornamenti automatici applicati: ${result.actions_applied}`);
      } else {
        toast.error("Nessuna modifica automatica applicata: inserisci key point numerici (+/- importi o date).", { duration: 5000 });
      }
    } catch (err) {
      console.error("Apply resolution error:", err);
    }

    setResolvingId(null);
    setResolutionNote("");
    fetchConflicts();
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Poco fa";
    if (hours < 24) return `${hours} ore fa`;
    return `${Math.floor(hours / 24)} giorni fa`;
  };

  return (
    <div className="p-5 pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Alert & Conflitti</h1>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="bg-secondary border border-border text-muted-foreground px-4 py-2 rounded-lg text-xs cursor-pointer hover:text-foreground transition-colors"
        >
          {showResolved ? "Solo aperti" : "Mostra risolti"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Caricamento...</div>
      ) : conflicts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-foreground font-bold mb-1">Nessun conflitto</div>
          <div className="text-muted-foreground text-sm">Tutto in ordine!</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {conflicts.map((c) => (
            <div
              key={c.id}
              className={`bg-card rounded-xl p-5 border border-border ${c.status === "open" ? "border-l-2 border-l-primary" : "opacity-70"}`}
            >
              <div className="flex items-start gap-3">
                <SeverityBadge level={sevMap[c.severity] || "INFO"} />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-bold text-foreground">{c.description}</h3>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-4">{timeAgo(c.created_at)}</span>
                  </div>
                  {c.suggestion && (
                    <div className="mt-3 p-3 bg-secondary rounded-lg border border-border">
                      <div className="label-caps text-primary mb-1">Suggerimento AI</div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{c.suggestion}</p>
                    </div>
                  )}

                  {c.status === "resolved" && c.resolution_note && (
                    <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="label-caps text-primary mb-1">✅ Risolto</div>
                      <p className="text-[11px] text-foreground leading-relaxed">{c.resolution_note}</p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => navigate(`/contracts/${c.contract_a_id}`)}
                      className="flex items-center gap-1.5 text-[11px] text-primary font-semibold hover:underline cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Vai al contratto
                    </button>

                    {c.status === "open" && resolvingId !== c.id && (
                      <button
                        onClick={() => { setResolvingId(c.id); setResolutionNote(""); }}
                        className="flex items-center gap-1.5 text-[11px] text-primary font-semibold hover:underline cursor-pointer ml-3"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Risolvi
                      </button>
                    )}
                  </div>

                  {resolvingId === c.id && (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder={"Descrivi la risoluzione con le modifiche chiave:\nes. +€10.000 monte contratti, -1 deliverable Q2, spostato post dal 15/03 al 22/03..."}
                        rows={3}
                        className="bg-secondary border border-border rounded-lg px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary transition-colors resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolveConflict(c.id)}
                          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-90"
                        >
                          Conferma risoluzione
                        </button>
                        <button
                          onClick={() => setResolvingId(null)}
                          className="bg-secondary text-muted-foreground px-3 py-1.5 rounded-lg text-[11px] border border-border cursor-pointer hover:text-foreground"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
