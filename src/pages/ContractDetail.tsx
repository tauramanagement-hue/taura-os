import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Pill, SeverityBadge } from "@/components/taura/ui-primitives";
import { ArrowLeft, FileText, Shield, AlertTriangle, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Clause {
  type: string;
  value: string;
  category?: string;
}

interface Conflict {
  id: string;
  description: string;
  severity: string;
  status: string;
  suggestion: string | null;
  contract_a_id: string;
  contract_b_id: string;
  created_at: string;
}

interface ContractFull {
  id: string;
  brand: string;
  contract_type: string;
  value: number | null;
  status: string | null;
  start_date: string;
  end_date: string;
  file_url: string | null;
  notes: string | null;
  athlete_id: string;
  athlete_name: string;
  ai_extracted_clauses: any;
}

const clauseTagColor: Record<string, string> = {
  esclusività: "bg-taura-red/15 text-taura-red border-taura-red/20",
  penale: "bg-taura-red/15 text-taura-red border-taura-red/20",
  penali: "bg-taura-red/15 text-taura-red border-taura-red/20",
  obblighi: "bg-taura-orange/15 text-taura-orange border-taura-orange/20",
  obbligo: "bg-taura-orange/15 text-taura-orange border-taura-orange/20",
  social: "bg-taura-orange/15 text-taura-orange border-taura-orange/20",
  durata: "bg-taura-blue/15 text-taura-blue border-taura-blue/20",
  valore: "bg-taura-blue/15 text-taura-blue border-taura-blue/20",
  parti: "bg-taura-blue/15 text-taura-blue border-taura-blue/20",
  territorio: "bg-taura-blue/15 text-taura-blue border-taura-blue/20",
  diritti: "bg-taura-green/15 text-taura-green border-taura-green/20",
  immagine: "bg-taura-green/15 text-taura-green border-taura-green/20",
  rinnovo: "bg-taura-purple/15 text-taura-purple border-taura-purple/20",
};

function formatClauseValue(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((v) => `• ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
  }
  if (typeof raw === "object" && raw !== null) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n");
  }
  return String(raw);
}

function getClauseColor(type: string): string {
  const lower = type.toLowerCase();
  for (const [key, val] of Object.entries(clauseTagColor)) {
    if (lower.includes(key)) return val;
  }
  return "bg-taura-blue/15 text-taura-blue border-taura-blue/20";
}

const statusLabel: Record<string, { text: string; variant: "green" | "orange" | "red" }> = {
  active: { text: "Attivo", variant: "green" },
  renewing: { text: "Rinnovo", variant: "orange" },
  expired: { text: "Scaduto", variant: "red" },
};

const ContractDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<ContractFull | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchContract(id);
  }, [id]);

  const fetchContract = async (contractId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contracts")
      .select("*, athletes(full_name)")
      .eq("id", contractId)
      .single();

    if (error || !data) {
      toast.error("Contratto non trovato");
      navigate("/contracts");
      return;
    }

    const c: ContractFull = {
      ...(data as any),
      notes: (data as any).notes ?? null,
      athlete_name: (data as any).athletes?.full_name || "N/A",
    };
    setContract(c);

    // Load PDF signed URL
    if (c.file_url) {
      const { data: signedData } = await supabase.storage.from("contracts").createSignedUrl(c.file_url, 3600);
      if (signedData?.signedUrl) setPdfUrl(signedData.signedUrl);
    }

    // Load conflicts
    const { data: conflictsData } = await supabase
      .from("conflicts")
      .select("*")
      .or(`contract_a_id.eq.${contractId},contract_b_id.eq.${contractId}`)
      .order("created_at", { ascending: false });

    if (conflictsData) setConflicts(conflictsData);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!contract) return;
    if (!confirm(`Eliminare il contratto ${contract.brand}? Questa azione è irreversibile.`)) return;
    try {
      const { error } = await supabase.functions.invoke("delete-contract", { body: { contract_id: contract.id } });
      if (error) throw error;
      toast.success("Contratto eliminato");
      navigate("/contracts");
    } catch (err: any) {
      toast.error(err.message || "Errore");
    }
  };

  // Parse clauses from ai_extracted_clauses
  const parseClauses = (): Clause[] => {
    if (!contract?.ai_extracted_clauses) return [];
    const raw = contract.ai_extracted_clauses;

    // Handle different formats the AI might return
    if (raw.clauses && Array.isArray(raw.clauses)) {
      return raw.clauses.map((c: any) => ({
        type: c.type || c.label || "Clausola",
        value: c.value || c.text || c.description || JSON.stringify(c),
        category: c.category,
      }));
    }

    // If it's a flat object with known keys
    const result: Clause[] = [];
    const keyMap: Record<string, string> = {
      parties: "Parti",
      duration: "Durata",
      value: "Valore",
      exclusivity: "Esclusività",
      obligations: "Obblighi",
      penalties: "Penali",
      territorial_scope: "Territorio",
      image_rights: "Diritti immagine",
      social_obligations: "Obblighi social",
      renewal: "Rinnovo",
      termination: "Rescissione",
    };

    for (const [key, label] of Object.entries(keyMap)) {
      if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") {
        const val = formatClauseValue(raw[key]);
        if (val && val !== "null" && val !== "undefined") result.push({ type: label, value: val });
      }
    }

    // Add any remaining keys not in keyMap
    for (const key of Object.keys(raw)) {
      if (key in keyMap || key === "clauses" || key === "is_group_contract" || key === "athletes_detected" || key === "raw_summary") continue;
      const val = formatClauseValue(raw[key]);
      if (val && val !== "null" && val !== "undefined") {
        result.push({ type: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), value: val });
      }
    }

    return result;
  };

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-secondary rounded w-48" />
          <div className="h-4 bg-secondary rounded w-32" />
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="h-[400px] bg-secondary rounded-xl" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-secondary rounded-lg" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const clauses = parseClauses();
  const st = statusLabel[contract.status || "active"] || statusLabel.active;
  const openConflicts = conflicts.filter(c => c.status === "open");

  return (
    <div className="p-5 pb-10">
      {/* Breadcrumb */}
      <button onClick={() => navigate("/contracts")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Contract Vault
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-foreground">{contract.brand}</h1>
            <Pill variant={st.variant}>{st.text}</Pill>
            {openConflicts.length > 0 && (
              <Pill variant="red">⚠ {openConflicts.length} conflitt{openConflicts.length === 1 ? "o" : "i"}</Pill>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {contract.athlete_name} • {contract.contract_type} • {contract.value ? `€${contract.value.toLocaleString("it-IT")}` : "Valore N/D"}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-1">
            {new Date(contract.start_date).toLocaleDateString("it-IT")} → {new Date(contract.end_date).toLocaleDateString("it-IT")}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDelete} className="bg-secondary border border-border text-muted-foreground px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer hover:text-destructive hover:border-destructive/30 transition-colors flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Elimina
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-4">
        {/* Left: PDF viewer */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-[12px] font-bold text-foreground">Documento</span>
          </div>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-[500px] bg-secondary"
              title="Contract PDF"
            />
          ) : (
            <div className="h-[500px] flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <div>Nessun PDF allegato</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Clauses */}
        <div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-[12px] font-bold text-foreground">Clausole estratte</span>
                <span className="text-[10px] text-muted-foreground font-mono">{clauses.length}</span>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {clauses.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  Nessuna clausola estratta. Prova a rigenerare l'analisi.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {clauses.map((clause, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${getClauseColor(clause.type)}`}>
                          {clause.type}
                        </span>
                      </div>
                      <div className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">
                        {clause.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conflicts section */}
      {conflicts.length > 0 && (
        <div className="mt-5">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-taura-red" />
              <span className="text-[12px] font-bold text-foreground">Conflitti rilevati</span>
              <span className="text-[10px] text-muted-foreground font-mono">{conflicts.length}</span>
            </div>
            <div className="divide-y divide-border">
              {conflicts.map(conflict => {
                const sevLabel = conflict.severity === "high" ? "ALTO" : conflict.severity === "medium" ? "MEDIO" : "BASSO";
                return (
                  <div key={conflict.id} className={`px-4 py-3 ${conflict.status === "open" ? "" : "opacity-50"}`}>
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <SeverityBadge level={sevLabel as any} />
                        {conflict.status !== "open" && <Pill variant="muted">{conflict.status}</Pill>}
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono">{new Date(conflict.created_at).toLocaleDateString("it-IT")}</span>
                    </div>
                    <div className="text-[12px] text-foreground mt-1">{conflict.description}</div>
                    {conflict.suggestion && (
                      <div className="mt-2 p-2 bg-secondary rounded-md border border-border">
                        <div className="text-[9px] text-muted-foreground font-semibold mb-0.5">SUGGERIMENTO AI</div>
                        <div className="text-[11px] text-foreground">{conflict.suggestion}</div>
                      </div>
                    )}
                    {/* Link to other contract */}
                    {conflict.contract_a_id !== contract.id && (
                      <button onClick={() => navigate(`/contracts/${conflict.contract_a_id}`)} className="text-[10px] text-primary hover:underline mt-1 cursor-pointer">
                        Vai al contratto in conflitto →
                      </button>
                    )}
                    {conflict.contract_b_id !== contract.id && (
                      <button onClick={() => navigate(`/contracts/${conflict.contract_b_id}`)} className="text-[10px] text-primary hover:underline mt-1 cursor-pointer">
                        Vai al contratto in conflitto →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {contract.notes && (
        <div className="mt-5 bg-card rounded-xl border border-border p-4">
          <div className="text-[12px] font-bold text-foreground mb-2">Note</div>
          <div className="text-[12px] text-muted-foreground">{contract.notes}</div>
        </div>
      )}
    </div>
  );
};

export default ContractDetail;
