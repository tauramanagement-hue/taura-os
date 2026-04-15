import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Pill } from "@/components/taura/ui-primitives";
import { sha256Hex, getFileExt } from "@/lib/fileHash";
import { Upload, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/taura/SocialIcons";

interface ContractRow {
  id: string;
  athlete_name: string;
  athlete_id: string;
  brand: string;
  contract_type: string;
  value: number | null;
  status: string | null;
  end_date: string;
  start_date: string;
  conflicts_count: number;
}

interface NewAthleteConfirm {
  filePath: string;
  fileName: string;
  cacheKey: string;
  newAthletes: {
    name: string; sport: string; original_name?: string;
    category?: string; nationality?: string;
    instagram_handle?: string; instagram_followers?: number;
    tiktok_handle?: string; tiktok_followers?: number;
    youtube_handle?: string; youtube_followers?: number;
  }[];
  existingAthletes: { name: string; id: string }[];
}

const AGREEMENT_TYPES = ["esclusiva", "accordo", "mandato", "rappresentanza", "agenzia", "gestione"];

const getStatusLabel = (status: string | null, contractType: string): { text: string; variant: "green" | "orange" | "red" } => {
  const s = status || "active";
  if (s === "active") return { text: "Attivo", variant: "green" };
  if (s === "renewing") return { text: "Rinnovo", variant: "orange" };
  // "expired": "Scaduto" solo per accordi/esclusiva, "Concluso" per deal talent
  const isAgreement = AGREEMENT_TYPES.some(t => contractType.toLowerCase().includes(t));
  return { text: isAgreement ? "Scaduto" : "Concluso", variant: "red" };
};

const capitalizeType = (type: string) =>
  type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : "—";

const ContractsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState<string>("end_date");
  const [sortAsc, setSortAsc] = useState(true);
  const [confirmation, setConfirmation] = useState<NewAthleteConfirm | null>(null);
  const [selectedNewAthletes, setSelectedNewAthletes] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchContracts(); }, []);

  const fetchContracts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contracts")
      .select("id, brand, contract_type, value, status, end_date, start_date, athlete_id, ai_extracted_clauses, athletes(full_name)")
      .order("end_date", { ascending: true });

    if (!error && data) {
      // Fetch conflict counts
      const ids = data.map((c: any) => c.id);
      let conflictsMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: conf1 } = await supabase.from("conflicts").select("contract_a_id").in("contract_a_id", ids).eq("status", "open");
        const { data: conf2 } = await supabase.from("conflicts").select("contract_b_id").in("contract_b_id", ids).eq("status", "open");
        (conf1 || []).forEach((c: any) => { conflictsMap[c.contract_a_id] = (conflictsMap[c.contract_a_id] || 0) + 1; });
        (conf2 || []).forEach((c: any) => { if (c.contract_b_id) conflictsMap[c.contract_b_id] = (conflictsMap[c.contract_b_id] || 0) + 1; });
      }
      setContracts(data.map((c: any) => ({
        id: c.id,
        athlete_name: c.ai_extracted_clauses?.is_group_contract ? "Group" : (c.athletes?.full_name || "N/A"),
        athlete_id: c.athlete_id,
        brand: c.brand,
        contract_type: c.contract_type,
        value: c.value,
        status: c.status,
        end_date: c.end_date,
        start_date: c.start_date,
        conflicts_count: conflictsMap[c.id] || 0,
      })));
    }
    setLoading(false);
  };

  const filtered = contracts.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.athlete_name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q) || c.contract_type.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    let va: any, vb: any;
    if (sortCol === "end_date") { va = a.end_date; vb = b.end_date; }
    else if (sortCol === "value") { va = a.value || 0; vb = b.value || 0; }
    else if (sortCol === "brand") { va = a.brand; vb = b.brand; }
    else if (sortCol === "athlete") { va = a.athlete_name; vb = b.athlete_name; }
    else if (sortCol === "conflicts") { va = a.conflicts_count; vb = b.conflicts_count; }
    else { va = a.end_date; vb = b.end_date; }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (!profile?.agency_id) { toast.error("Completa l'onboarding."); navigate("/onboarding"); setUploading(false); return; }

      const hash = await sha256Hex(file);
      const ext = getFileExt(file.name) || "pdf";
      const filePath = `${profile.agency_id}/${hash}.${ext}`;

      let reuseExistingUpload = false;
      const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, file);
      if (uploadError) {
        const rawMessage = String((uploadError as any).message || "").toLowerCase();
        const statusCode = String((uploadError as any).statusCode || "");
        const isDuplicate = rawMessage.includes("exists") || rawMessage.includes("duplicate") || statusCode === "409";

        if (isDuplicate) {
          reuseExistingUpload = true;
          toast.info("File già presente: riuso il file esistente.");
        } else {
          throw uploadError;
        }
      }

      toast.success(reuseExistingUpload ? "Analisi AI in corso sul file già presente..." : "File caricato! Analisi AI in corso...");

      // Step 1: dry run
      const { data: dryResult, error: dryErr } = await supabase.functions.invoke("parse-contract", {
        body: { file_url: filePath, original_name: file.name, source: "contracts_upload", dry_run: true },
      });

      if (dryErr) { toast.error("Errore AI: " + dryErr.message); setUploading(false); return; }

      if (dryResult?.needs_confirmation && dryResult.new_athletes?.length > 0) {
        const sel: Record<string, boolean> = {};
        dryResult.new_athletes.forEach((a: any) => { sel[a.name] = true; });
        setSelectedNewAthletes(sel);
        setConfirmation({
          filePath,
          fileName: file.name,
          cacheKey: dryResult.cache_key,
          newAthletes: dryResult.new_athletes,
          existingAthletes: dryResult.existing_athletes || [],
        });
        setUploading(false);
        return;
      }

      // No new athletes, proceed directly
      await finalizeUpload(filePath, file.name, dryResult?.cache_key);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore nel caricamento");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const finalizeUpload = async (filePath: string, fileName: string, cacheKey?: string, confirmedAthletes?: { name: string; sport: string }[]) => {
    setUploading(true);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke("parse-contract", {
        body: {
          file_url: filePath,
          original_name: fileName,
          source: "contracts_upload",
          ...(cacheKey ? { cache_key: cacheKey } : {}),
          ...(confirmedAthletes ? { confirmed_athletes: confirmedAthletes } : {}),
        },
      });

      if (invokeError) {
        toast.error("AI: " + invokeError.message);
      } else if (result?.success) {
        toast.success(`✅ ${result.contracts_created || 1} contratti • campagna "${result.campaign_name}" • ${result.deliverables_count || 0} deliverable${result.athletes_created ? ` • ${result.athletes_created} nuovi talent` : ""}`);
        if (result.conflicts_count > 0) toast.success(`⚠️ ${result.conflicts_count} conflitti rilevati.`);
      } else {
        toast.error("AI: " + (result?.error || "errore"));
      }
      fetchContracts();
    } catch (err: any) {
      toast.error(err.message || "Errore");
    }
    setUploading(false);
  };

  const cancelPendingUpload = async () => {
    if (!confirmation) return;
    const filePath = confirmation.filePath;
    setConfirmation(null);
    setSelectedNewAthletes({});
    if (fileInputRef.current) fileInputRef.current.value = "";
    const { error } = await supabase.storage.from("contracts").remove([filePath]);
    if (error) {
      toast.warning("Upload annullato, ma il file temporaneo non è stato rimosso.");
      return;
    }
    toast.success("Upload annullato: file temporaneo rimosso.");
  };

  const handleConfirm = () => {
    if (!confirmation) return;
    const confirmed = confirmation.newAthletes.filter(a => a.name && selectedNewAthletes[a.name]);
    finalizeUpload(confirmation.filePath, confirmation.fileName, confirmation.cacheKey, confirmed);
    setConfirmation(null);
  };

  const daysRemaining = (endDate: string) => Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="p-5 pb-10">
      {/* Confirmation popup */}
      {confirmation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={cancelPendingUpload}>
          <div className="bg-card rounded-xl border border-border p-6 w-[480px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-2">Nuovi talent rilevati</h2>
            <p className="text-[12px] text-muted-foreground mb-4">L'AI ha rilevato questi nomi nel documento. Seleziona quali vuoi aggiungere al roster:</p>

            {confirmation.existingAthletes.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Già nel roster</div>
                {confirmation.existingAthletes.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 text-[12px] text-foreground">
                    <span className="w-5 h-5 rounded-md bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">✓</span>
                    {a.name}
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Nuovi talent (modifica prima di confermare)</div>
              {confirmation.newAthletes.map((a, i) => {
                const updateField = (field: string, value: any) => {
                  const updated = [...confirmation.newAthletes];
                  updated[i] = { ...updated[i], [field]: value };
                  setConfirmation({ ...confirmation, newAthletes: updated });
                };
                return (
                <div key={i} className="mb-2 p-2.5 rounded-lg bg-secondary border border-border">
                  <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer mb-2">
                    <input type="checkbox" checked={selectedNewAthletes[a.name] ?? true} onChange={(e) => setSelectedNewAthletes(prev => ({ ...prev, [a.name]: e.target.checked }))} className="accent-primary w-4 h-4" />
                    <input value={a.name} onChange={(e) => updateField("name", e.target.value)} className="font-bold bg-transparent border-b border-border/50 focus:border-primary outline-none text-foreground px-1 flex-1" />
                    <input value={a.sport} onChange={(e) => updateField("sport", e.target.value)} className="text-muted-foreground bg-transparent border-b border-border/50 focus:border-primary outline-none px-1 w-24 text-[11px]" />
                  </label>
                  <div className="ml-6 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span>🌍</span>
                      <input value={a.nationality || ""} onChange={(e) => updateField("nationality", e.target.value || undefined)} placeholder="Nazionalità" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-full px-0.5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>🏷️</span>
                      <input value={a.category || ""} onChange={(e) => updateField("category", e.target.value || undefined)} placeholder="Categoria" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-full px-0.5" />
                    </div>
                    {(a.instagram_handle || a.instagram_followers) && (
                     <div className="flex items-center gap-1.5">
                       <InstagramIcon size={12} />
                       <input value={a.instagram_handle || ""} onChange={(e) => updateField("instagram_handle", e.target.value || undefined)} placeholder="@handle" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground flex-1 px-0.5" />
                       <input type="number" value={a.instagram_followers || ""} onChange={(e) => updateField("instagram_followers", Number(e.target.value) || undefined)} placeholder="Followers" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-16 px-0.5" />
                     </div>
                    )}
                    {(a.tiktok_handle || a.tiktok_followers) && (
                     <div className="flex items-center gap-1.5">
                       <TikTokIcon size={12} />
                       <input value={a.tiktok_handle || ""} onChange={(e) => updateField("tiktok_handle", e.target.value || undefined)} placeholder="@handle" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground flex-1 px-0.5" />
                       <input type="number" value={a.tiktok_followers || ""} onChange={(e) => updateField("tiktok_followers", Number(e.target.value) || undefined)} placeholder="Followers" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-16 px-0.5" />
                     </div>
                    )}
                    {(a.youtube_handle || a.youtube_followers) && (
                     <div className="flex items-center gap-1.5 col-span-2">
                       <YouTubeIcon size={12} />
                       <input value={a.youtube_handle || ""} onChange={(e) => updateField("youtube_handle", e.target.value || undefined)} placeholder="handle" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground flex-1 px-0.5" />
                       <input type="number" value={a.youtube_followers || ""} onChange={(e) => updateField("youtube_followers", Number(e.target.value) || undefined)} placeholder="Followers" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-16 px-0.5" />
                     </div>
                    )}
                  </div>
                </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const newAthlete = {
                    name: "", sport: "", original_name: "",
                    category: undefined, nationality: undefined,
                    instagram_handle: undefined, instagram_followers: undefined,
                    tiktok_handle: undefined, tiktok_followers: undefined,
                    youtube_handle: undefined, youtube_followers: undefined,
                  };
                  setConfirmation({
                    ...confirmation,
                    newAthletes: [...confirmation.newAthletes, newAthlete],
                  });
                  setSelectedNewAthletes(prev => ({ ...prev, [""]: true }));
                }}
                className="w-full py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                + Aggiungi talent manualmente
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={cancelPendingUpload} className="flex-1 bg-secondary text-foreground py-2 rounded-lg text-sm font-semibold cursor-pointer border border-border">Annulla</button>
              <button onClick={handleConfirm} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold cursor-pointer">
                Conferma e indicizza
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Contract Vault</h1>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[12px] font-bold cursor-pointer glow-accent-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50">
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Caricamento..." : "Carica contratto"}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.csv,.xls,.xlsx" onChange={handleUpload} />
      </div>

      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <div className="flex items-center gap-2 bg-secondary rounded-lg border border-border px-3 py-1.5 flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cerca contratto, brand, atleta..." className="bg-transparent text-[12px] text-foreground outline-none flex-1 placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1.5">
          {[{ k: "all", l: "Tutti" }, { k: "active", l: "Attivi" }, { k: "renewing", l: "Rinnovo" }, { k: "expired", l: "Conclusi" }].map(s => (
            <button key={s.k} onClick={() => setFilterStatus(s.k)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${filterStatus === s.k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground border border-border hover:text-foreground"}`}>{s.l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr_0.5fr_0.5fr_0.8fr] gap-3 px-5 py-3 bg-secondary border-b border-border">
            {["Atleta","Brand","Tipo","Valore","Stato","Conflitti","Scadenza"].map(h => <span key={h} className="label-caps text-muted-foreground">{h}</span>)}
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr_0.5fr_0.5fr_0.8fr] gap-3 px-5 py-3 border-b border-border animate-pulse">
              <div className="h-3 w-20 bg-secondary rounded" /><div className="h-3 w-16 bg-secondary rounded" /><div className="h-3 w-14 bg-secondary rounded" /><div className="h-3 w-12 bg-secondary rounded" /><div className="h-3 w-10 bg-secondary rounded" /><div className="h-3 w-6 bg-secondary rounded" /><div className="h-3 w-14 bg-secondary rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📄</div>
          <div className="text-foreground font-bold mb-1">{searchQuery ? "Nessun risultato" : "Nessun contratto"}</div>
          <div className="text-muted-foreground text-sm mb-4">{searchQuery ? "Prova con un'altra ricerca." : "Carica il primo contratto e l'AI lo analizzerà automaticamente."}</div>
          {!searchQuery && <button onClick={() => fileInputRef.current?.click()} className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"><Upload className="w-3.5 h-3.5" /> Carica contratto</button>}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr_0.5fr_0.5fr_0.8fr] gap-3 px-5 py-3 bg-secondary border-b border-border items-center">
            {[
              { k: "athlete", l: "Atleta" }, { k: "brand", l: "Brand" }, { k: "", l: "Tipo" },
              { k: "value", l: "Valore" }, { k: "", l: "Stato" }, { k: "conflicts", l: "Conflitti" }, { k: "end_date", l: "Scadenza" },
            ].map(h => (
              <span key={h.l} onClick={h.k ? () => toggleSort(h.k) : undefined} className={`label-caps text-muted-foreground ${h.k ? "cursor-pointer hover:text-foreground" : ""}`}>
                {h.l} {sortCol === h.k ? (sortAsc ? "↑" : "↓") : ""}
              </span>
            ))}
          </div>
          {filtered.map(c => {
            const st = getStatusLabel(c.status, c.contract_type);
            const days = daysRemaining(c.end_date);
            return (
              <div key={c.id} onClick={() => navigate(`/contracts/${c.id}`)} className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr_0.5fr_0.5fr_0.8fr] gap-3 px-5 py-3 border-b border-border last:border-b-0 hover:bg-secondary/50 cursor-pointer transition-colors items-center">
                <span className="text-[13px] font-semibold text-foreground truncate">{c.athlete_name}</span>
                <span className="text-[13px] text-foreground truncate">{c.brand}</span>
                <span className="text-[13px] text-muted-foreground truncate">{capitalizeType(c.contract_type)}</span>
                <span className="text-[13px] font-bold text-foreground font-mono">{c.value ? `€${c.value.toLocaleString("it-IT")}` : "—"}</span>
                <Pill variant={st.variant}>{st.text}</Pill>
                <span className="text-[12px] font-mono">
                  {c.conflicts_count > 0 ? <span className="text-destructive font-bold">⚠ {c.conflicts_count}</span> : <span className="text-muted-foreground">—</span>}
                </span>
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-muted-foreground font-mono">{new Date(c.end_date).toLocaleDateString("it-IT")}</span>
                    {days <= 30 && days > 0 && <span className="text-[10px] font-bold text-destructive">{days}gg</span>}
                    {days <= 0 && <span className="text-[10px] font-bold text-muted-foreground">—</span>}
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (!confirm("Eliminare questo contratto?")) return;
                      (async () => {
                        try {
                          const { data: result, error } = await supabase.functions.invoke("delete-contract", { body: { contract_id: c.id } });
                          if (error) throw new Error(error.message);
                          toast.success("Contratto eliminato");
                          fetchContracts();
                        } catch (err: any) { toast.error(err.message || "Errore eliminazione"); }
                      })();
                    }}
                    className="p-1.5 rounded-md bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    title="Elimina contratto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContractsPage;
