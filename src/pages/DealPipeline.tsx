import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgencyContext } from "@/hooks/useAgencyContext";
import { Pill } from "@/components/taura/ui-primitives";
import { Plus, TrendingUp, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Deal {
  id: string;
  brand: string;
  athlete_id: string;
  athlete_name: string;
  value: number | null;
  stage: string;
  probability: number | null;
  deal_type: string | null;
  notes: string | null;
  expected_close_date: string | null;
  last_activity_date: string | null;
}

const STAGES = [
  { key: "inbound", label: "Inbound", prob: 10, color: "hsl(220, 100%, 65%)" },
  { key: "qualified", label: "Qualificato", prob: 25, color: "hsl(263, 100%, 68%)" },
  { key: "proposal", label: "Proposta", prob: 50, color: "hsl(170, 100%, 45%)" },
  { key: "negotiation", label: "Negoziazione", prob: 75, color: "hsl(40, 100%, 60%)" },
  { key: "signed", label: "Firmato", prob: 100, color: "hsl(160, 67%, 52%)" },
];

const DealPipeline = () => {
  const { user } = useAuth();
  const { labels } = useAgencyContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [athletes, setAthletes] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [filterAthlete, setFilterAthlete] = useState("all");
  const [newDeal, setNewDeal] = useState({ brand: "", athlete_id: "", value: "", deal_type: "", notes: "", expected_close_date: "" });
  const [saving, setSaving] = useState(false);
  const dragItem = useRef<string | null>(null);
  const dragOverStage = useRef<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [dealsRes, athletesRes] = await Promise.all([
      supabase.from("deals").select("id, brand, athlete_id, value, stage, probability, deal_type, notes, expected_close_date, last_activity_date, athletes(full_name)").order("created_at", { ascending: false }),
      supabase.from("athletes").select("id, full_name").order("full_name"),
    ]);
    if (dealsRes.data) {
      setDeals(dealsRes.data.map((d: any) => ({ ...d, athlete_name: d.athletes?.full_name || "N/A" })));
    }
    if (athletesRes.data) setAthletes(athletesRes.data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newDeal.brand.trim() || !newDeal.athlete_id || !user) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (!profile?.agency_id) { toast.error("Completa l'onboarding."); return; }
      const { error } = await supabase.from("deals").insert({
        agency_id: profile.agency_id,
        brand: newDeal.brand.trim(),
        athlete_id: newDeal.athlete_id,
        value: newDeal.value ? Number(newDeal.value) : null,
        deal_type: newDeal.deal_type || null,
        notes: newDeal.notes || null,
        stage: "inbound",
        probability: 10,
        expected_close_date: newDeal.expected_close_date || null,
      });
      if (error) throw error;
      toast.success("Deal creato!");
      setNewDeal({ brand: "", athlete_id: "", value: "", deal_type: "", notes: "", expected_close_date: "" });
      setShowNew(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Errore");
    }
    setSaving(false);
  };

  const moveDeal = async (dealId: string, newStage: string) => {
    const stageConf = STAGES.find(s => s.key === newStage);
    if (!stageConf) return;
    try {
      const { error } = await supabase.from("deals").update({
        stage: newStage,
        probability: stageConf.prob,
        last_activity_date: new Date().toISOString().split("T")[0],
      }).eq("id", dealId);
      if (error) throw error;
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage, probability: stageConf.prob } : d));
      toast.success(`Deal spostato in ${stageConf.label}`);
    } catch (err: any) {
      toast.error(err.message || "Errore");
    }
  };

  const handleDragStart = (dealId: string) => { dragItem.current = dealId; };
  const handleDragOver = (e: React.DragEvent, stageKey: string) => { e.preventDefault(); dragOverStage.current = stageKey; };
  const handleDrop = (stageKey: string) => {
    if (dragItem.current && dragItem.current !== stageKey) {
      moveDeal(dragItem.current, stageKey);
    }
    dragItem.current = null;
    dragOverStage.current = null;
  };

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (n >= 1_000) return `€${Math.round(n / 1_000).toLocaleString("it-IT")}k`;
    return `€${n.toLocaleString("it-IT")}`;
  };

  const filteredDeals = filterAthlete === "all" ? deals : deals.filter(d => d.athlete_id === filterAthlete);
  const activeDeals = filteredDeals.filter(d => d.stage !== "lost");
  const lostDeals = filteredDeals.filter(d => d.stage === "lost");

  const pipelineWeighted = activeDeals.reduce((sum, d) => sum + ((d.value || 0) * ((d.probability || 0) / 100)), 0);
  const pipelineTotal = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);

  const daysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="p-5 pb-10">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground tracking-tight">Deal Flow</h1>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {activeDeals.length} deal attivi • Pipeline pesata {fmt(pipelineWeighted)} • Totale {fmt(pipelineTotal)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterAthlete}
            onChange={e => setFilterAthlete(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-[11px] text-foreground outline-none"
          >
            <option value="all">Tutti i {labels.personLabelPlural.toLowerCase()}</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
          <button onClick={() => setShowNew(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[12px] font-bold cursor-pointer glow-accent-sm hover:opacity-90 transition-opacity flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            Nuovo deal
          </button>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Caricamento...</div>
      ) : activeDeals.length === 0 && lostDeals.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">💰</div>
          <div className="text-foreground font-bold mb-1">Nessun deal in pipeline</div>
          <div className="text-muted-foreground text-sm mb-4">Crea il primo deal per tracciare le opportunità.</div>
          <button onClick={() => setShowNew(true)} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold cursor-pointer">Nuovo deal</button>
        </div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageDeals = activeDeals.filter(d => d.stage === stage.key);
            const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
            return (
              <div
                key={stage.key}
                className="flex-1 min-w-[200px] max-w-[260px]"
                onDragOver={e => handleDragOver(e, stage.key)}
                onDrop={() => handleDrop(stage.key)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-[11px] font-bold text-foreground">{stage.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{stageDeals.length}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono">{fmt(stageValue)}</span>
                </div>

                {/* Cards */}
                <div className="bg-secondary/30 rounded-lg border border-border/50 min-h-[300px] p-1.5 space-y-1.5">
                  {stageDeals.map(deal => {
                    const days = daysSince(deal.last_activity_date);
                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => handleDragStart(deal.id)}
                        className="bg-card rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors group"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="text-[13px] font-bold text-foreground leading-tight">{deal.brand}</div>
                          <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="text-[11px] text-muted-foreground mb-2">{deal.athlete_name}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold font-mono text-foreground">{deal.value ? fmt(deal.value) : "—"}</span>
                          <div className="flex items-center gap-1.5">
                            {days !== null && days > 7 && (
                              <span className="text-[9px] text-destructive font-mono">{days}gg</span>
                            )}
                            <div className="w-8 bg-secondary rounded-full h-1">
                              <div className="bg-primary rounded-full h-1" style={{ width: `${deal.probability || 0}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-mono">{deal.probability}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {stageDeals.length === 0 && (
                    <div className="text-center py-8 text-[10px] text-muted-foreground">
                      Trascina qui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lost deals */}
      {lostDeals.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowLost(!showLost)} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            {showLost ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {lostDeals.length} deal persi
          </button>
          {showLost && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {lostDeals.map(d => (
                <div key={d.id} className="bg-card/50 rounded-lg border border-border/50 p-3 opacity-60">
                  <div className="text-[12px] font-bold text-foreground">{d.brand}</div>
                  <div className="text-[10px] text-muted-foreground">{d.athlete_name} • {d.value ? fmt(d.value) : "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New deal modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowNew(false)}>
          <div className="bg-card rounded-xl border border-border p-6 w-[460px]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Nuovo Deal</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Brand *</label>
                <input value={newDeal.brand} onChange={e => setNewDeal({ ...newDeal, brand: e.target.value })} placeholder="Es. Nike, Red Bull..." className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">{labels.personLabel} *</label>
                <select value={newDeal.athlete_id} onChange={e => setNewDeal({ ...newDeal, athlete_id: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                  <option value="">Seleziona {labels.personLabel.toLowerCase()}</option>
                  {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Valore (€)</label>
                  <input type="number" value={newDeal.value} onChange={e => setNewDeal({ ...newDeal, value: e.target.value })} placeholder="50000" className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Tipo deal</label>
                  <select value={newDeal.deal_type} onChange={e => setNewDeal({ ...newDeal, deal_type: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                    <option value="">Seleziona tipo</option>
                    {labels.contractTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Data chiusura prevista</label>
                <input type="date" value={newDeal.expected_close_date} onChange={e => setNewDeal({ ...newDeal, expected_close_date: e.target.value })} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Note</label>
                <textarea value={newDeal.notes} onChange={e => setNewDeal({ ...newDeal, notes: e.target.value })} rows={2} placeholder="Note opzionali..." className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none" />
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setShowNew(false)} className="flex-1 bg-secondary text-foreground py-2 rounded-lg text-sm font-semibold cursor-pointer border border-border">Annulla</button>
                <button onClick={handleCreate} disabled={saving || !newDeal.brand.trim() || !newDeal.athlete_id} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-40">
                  {saving ? "Salvataggio..." : "Crea deal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealPipeline;
