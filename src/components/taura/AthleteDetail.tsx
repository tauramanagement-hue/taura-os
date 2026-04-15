import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Pencil, Check, X, ChevronUp, ChevronDown, FileText, TrendingUp, Megaphone, Clock, BarChart3, StickyNote, RefreshCw, Loader2 } from "lucide-react";
import { InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/taura/SocialIcons";
import { Pill } from "@/components/taura/ui-primitives";
import { toast } from "sonner";
import { sportEmoji } from "./AthleteCard";
import MediaKitModal from "./MediaKitModal";

interface AthleteFullRow {
  id: string; full_name: string; sport: string; category: string | null; status: string | null;
  instagram_followers: number | null; tiktok_followers: number | null; youtube_followers: number | null;
  instagram_handle: string | null; tiktok_handle: string | null; youtube_handle: string | null;
  photo_url: string | null; nationality: string | null; notes: string | null; date_of_birth: string | null;
}

const ICON_SIZE = 18;
const tabDefs = [
  { key: "overview", label: "Panoramica", icon: BarChart3 },
  { key: "contracts", label: "Contratti", icon: FileText },
  { key: "deals", label: "Deal", icon: TrendingUp },
  { key: "campaigns", label: "Campagne", icon: Megaphone },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "notes", label: "Note", icon: StickyNote },
];

const FollowerEditor = ({ label, icon, handle, followers, onSave, platform, athleteId, onEnriched }: { label: string; icon: React.ReactNode; handle: string | null; followers: number | null; onSave: (h: string | null, f: number | null) => void; platform: string; athleteId: string; onEnriched: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [h, setH] = useState(handle || "");
  const [f, setF] = useState(followers || 0);
  const [enriching, setEnriching] = useState(false);
  const hasData = handle || (followers && followers > 0);

  const enrich = async (handleValue: string) => {
    if (!handleValue.trim() || enriching) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-social", {
        body: { athlete_id: athleteId, platform, handle: handleValue },
      });
      if (!error && data?.success) {
        if (data.followers) setF(data.followers);
        toast.success(data.followers ? `${label}: ${data.followers.toLocaleString("it-IT")} follower${data.verified ? " (verificato)" : ""}` : `Handle ${label} salvato`);
        onEnriched();
      }
    } catch {
      toast.error("Errore enrichment");
    }
    setEnriching(false);
  };

  if (!editing && !hasData) return <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-1">{icon}<span>+ Aggiungi {label}</span></button>;
  if (!editing) return (
    <div className="flex items-center gap-2 group/social">
      {icon}
      <div className="flex-1 min-w-0">
        {handle && <span className="text-xs text-muted-foreground">@{handle}</span>}
        {followers && followers > 0 && <span className="text-sm font-bold text-foreground ml-2">{followers.toLocaleString("it-IT")}</span>}
      </div>
      <button onClick={() => handle && enrich(handle)} disabled={enriching || !handle} className="p-1 rounded-md text-muted-foreground hover:text-primary opacity-0 group-hover/social:opacity-100 transition-all disabled:opacity-30" title="Aggiorna follower">
        {enriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      </button>
      <button onClick={() => { setH(handle || ""); setF(followers || 0); setEditing(true); }} className="p-1 rounded-md text-muted-foreground hover:text-foreground opacity-0 group-hover/social:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
    </div>
  );
  return (
    <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2 border border-border">
      {icon}
      <input value={h} onChange={e => setH(e.target.value)} onBlur={() => { if (h.trim() && h.trim() !== (handle || "")) enrich(h.trim()); }} placeholder="handle" className="bg-transparent text-xs text-foreground outline-none w-20 placeholder:text-muted-foreground" />
      <input type="number" value={f} onChange={e => setF(Number(e.target.value))} className="bg-transparent text-sm font-bold text-foreground outline-none w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      {enriching && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
      <button onClick={() => { onSave(h.trim() || null, f || null); setEditing(false); }} className="p-1 text-primary"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={() => { setH(handle || ""); setF(followers || 0); setEditing(false); }} className="p-1 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
};

const AthleteDetail = ({ athleteId }: { athleteId: string }) => {
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<AthleteFullRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [contracts, setContracts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [showMediaKit, setShowMediaKit] = useState(false);

  useEffect(() => { fetchAthlete(); }, [athleteId]);
  useEffect(() => { if (athlete) fetchTabData(); }, [athlete, activeTab]);

  const fetchAthlete = async () => {
    setLoading(true);
    const { data } = await supabase.from("athletes").select("*").eq("id", athleteId).single();
    if (data) { setAthlete(data as AthleteFullRow); setNameValue(data.full_name); setNotesValue(data.notes || ""); }
    setLoading(false);
  };

  const fetchTabData = async () => {
    if (activeTab === "contracts" && contracts.length === 0) {
      const { data } = await supabase.from("contracts").select("id, brand, contract_type, value, status, end_date, start_date").eq("athlete_id", athleteId).order("end_date");
      if (data) setContracts(data);
    }
    if (activeTab === "deals" && deals.length === 0) {
      const { data } = await supabase.from("deals").select("id, brand, value, stage, probability, deal_type").eq("athlete_id", athleteId).order("created_at", { ascending: false });
      if (data) setDeals(data);
    }
    if (activeTab === "campaigns" && campaigns.length === 0) {
      const { data } = await supabase.from("campaign_deliverables").select("id, content_type, scheduled_date, content_approved, post_confirmed, campaigns(id, campaign_name, brand)").eq("athlete_id", athleteId).order("scheduled_date", { ascending: false });
      if (data) setCampaigns(data);
    }
    if (activeTab === "timeline" && activities.length === 0) {
      const { data } = await supabase.from("activities").select("id, activity_type, description, created_at").eq("athlete_id", athleteId).order("created_at", { ascending: false }).limit(30);
      if (data) setActivities(data);
    }
  };

  const updateField = async (fields: Partial<AthleteFullRow>) => {
    const { error } = await supabase.from("athletes").update(fields).eq("id", athleteId);
    if (error) { toast.error("Errore"); return; }
    toast.success("Aggiornato!"); fetchAthlete();
  };

  const fmt = (n: number) => { if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1).replace(".", ",")}M`; if (n >= 1_000) return `€${Math.round(n / 1_000).toLocaleString("it-IT")}k`; return `€${n.toLocaleString("it-IT")}`; };

  if (loading) return <div className="p-5"><div className="animate-pulse space-y-3"><div className="h-6 bg-secondary rounded w-32" /><div className="h-14 bg-secondary rounded-xl w-64" /><div className="h-[300px] bg-secondary rounded-xl" /></div></div>;
  if (!athlete) return <div className="p-5 text-center text-muted-foreground">Talent non trovato</div>;

  const totalFollowers = (athlete.instagram_followers || 0) + (athlete.tiktok_followers || 0) + (athlete.youtube_followers || 0);
  const revenueYTD = contracts.filter(c => c.status === "active").reduce((s: number, c: any) => s + (c.value || 0), 0);
  const activeContracts = contracts.filter(c => c.status === "active");
  const nextDeadline = [...activeContracts].sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())[0];

  const stMap: Record<string, { text: string; variant: "green" | "orange" | "red" }> = { active: { text: "Attivo", variant: "green" }, renewing: { text: "Rinnovo", variant: "orange" }, expired: { text: "Scaduto", variant: "red" } };
  const sgMap: Record<string, { text: string; variant: "blue" | "purple" | "accent" | "orange" | "green" }> = { inbound: { text: "Inbound", variant: "blue" }, qualified: { text: "Qualificato", variant: "purple" }, proposal: { text: "Proposta", variant: "accent" }, negotiation: { text: "Negoziazione", variant: "orange" }, signed: { text: "Firmato", variant: "green" } };

  const timeAgo = (date: string) => { const diff = Date.now() - new Date(date).getTime(); const h = Math.floor(diff / 3600000); if (h < 1) return "Poco fa"; if (h < 24) return `${h}h fa`; const d = Math.floor(h / 24); if (d < 7) return `${d}gg fa`; return new Date(date).toLocaleDateString("it-IT"); };
  const actIcons: Record<string, string> = { contract_uploaded: "📄", deal_created: "💰", deal_stage_changed: "🔄", conflict_detected: "⚠️", campaign_created: "📢", note_added: "📝" };

  return (
    <div className="p-5 pb-10">
      <button onClick={() => navigate("/athletes")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"><ArrowLeft className="w-4 h-4" /> Roster</button>
      <div className="flex gap-5">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl bg-taura-surface border border-border flex items-center justify-center text-2xl">{sportEmoji[athlete.sport] || "🏅"}</div>
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2"><input value={nameValue} onChange={e => setNameValue(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-lg font-bold text-foreground outline-none focus:border-primary" autoFocus /><button onClick={() => { updateField({ full_name: nameValue.trim() }); setEditingName(false); }} className="p-1.5 text-primary"><Check className="w-4 h-4" /></button><button onClick={() => { setNameValue(athlete.full_name); setEditingName(false); }} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button></div>
              ) : (
                <div className="flex items-center gap-2 group"><h1 className="text-xl font-bold text-foreground">{athlete.full_name}</h1><button onClick={() => setEditingName(true)} className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-4 h-4" /></button></div>
              )}
              <div className="text-sm text-muted-foreground mt-0.5">{athlete.sport}{athlete.category ? ` • ${athlete.category}` : ""}{athlete.nationality ? ` • ${athlete.nationality}` : ""}</div>
            </div>
            <button onClick={() => setShowMediaKit(true)} className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer shrink-0">
              Media Kit
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 mb-4 border-b border-border">
            {tabDefs.map(tab => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-all cursor-pointer border-b-2 ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><tab.icon className="w-3.5 h-3.5" />{tab.label}</button>)}
          </div>

          {/* Overview */}
          {activeTab === "overview" && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-bold text-foreground mb-4">Social Media</h2>
              <div className="flex flex-col gap-3">
                <FollowerEditor label="Instagram" icon={<InstagramIcon size={ICON_SIZE} />} handle={athlete.instagram_handle} followers={athlete.instagram_followers} onSave={(h, f) => updateField({ instagram_handle: h, instagram_followers: f })} platform="instagram" athleteId={athleteId} onEnriched={fetchAthlete} />
                <FollowerEditor label="TikTok" icon={<TikTokIcon size={ICON_SIZE} />} handle={athlete.tiktok_handle} followers={athlete.tiktok_followers} onSave={(h, f) => updateField({ tiktok_handle: h, tiktok_followers: f })} platform="tiktok" athleteId={athleteId} onEnriched={fetchAthlete} />
                <FollowerEditor label="YouTube" icon={<YouTubeIcon size={ICON_SIZE} />} handle={athlete.youtube_handle} followers={athlete.youtube_followers} onSave={(h, f) => updateField({ youtube_handle: h, youtube_followers: f })} platform="youtube" athleteId={athleteId} onEnriched={fetchAthlete} />
              </div>
            </div>
          )}

          {/* Contracts */}
          {activeTab === "contracts" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {contracts.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">Nessun contratto</div> : (
                <div className="divide-y divide-border">
                  {contracts.map(c => { const st = stMap[c.status || "active"] || stMap.active; return (
                    <div key={c.id} onClick={() => navigate(`/contracts/${c.id}`)} className="px-4 py-3 hover:bg-secondary/50 cursor-pointer transition-colors flex items-center gap-3">
                      <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-foreground">{c.brand}</div><div className="text-[11px] text-muted-foreground">{c.contract_type} • {c.value ? fmt(c.value) : "—"}</div></div>
                      <Pill variant={st.variant}>{st.text}</Pill>
                      <span className="text-[11px] text-muted-foreground font-mono">{new Date(c.end_date).toLocaleDateString("it-IT")}</span>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          )}

          {/* Deals */}
          {activeTab === "deals" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {deals.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">Nessun deal</div> : (
                <div className="divide-y divide-border">
                  {deals.map(d => { const sg = sgMap[d.stage] || { text: d.stage, variant: "blue" as const }; return (
                    <div key={d.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-foreground">{d.brand}</div><div className="text-[11px] text-muted-foreground">{d.deal_type || "—"} • {d.value ? fmt(d.value) : "—"}</div></div>
                      <Pill variant={sg.variant}>{sg.text}</Pill>
                      <span className="text-[11px] text-muted-foreground font-mono">{d.probability}%</span>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          )}

          {/* Campaigns */}
          {activeTab === "campaigns" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {campaigns.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">Nessuna campagna</div> : (
                <div className="divide-y divide-border">
                  {campaigns.map((cd: any) => (
                    <div key={cd.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-foreground">{cd.campaigns?.campaign_name || "—"}</div><div className="text-[11px] text-muted-foreground">{cd.campaigns?.brand || "—"} • {cd.content_type}</div></div>
                      {cd.content_approved ? <Pill variant="green">Approvato</Pill> : cd.post_confirmed ? <Pill variant="accent">Pubblicato</Pill> : <Pill variant="muted">In attesa</Pill>}
                      {cd.scheduled_date && <span className="text-[11px] text-muted-foreground font-mono">{new Date(cd.scheduled_date).toLocaleDateString("it-IT")}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          {activeTab === "timeline" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {activities.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">Nessuna attività</div> : (
                <div className="divide-y divide-border">
                  {activities.map(a => (
                    <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                      <span className="text-sm shrink-0">{actIcons[a.activity_type] || "📌"}</span>
                      <div className="flex-1 min-w-0"><div className="text-[12px] text-foreground">{a.description}</div></div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{timeAgo(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {activeTab === "notes" && (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-foreground">Note</h2>{!editingNotes && <button onClick={() => setEditingNotes(true)} className="text-[10px] text-primary font-semibold cursor-pointer">Modifica</button>}</div>
              {editingNotes ? (
                <div>
                  <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={8} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none" placeholder="Aggiungi note..." />
                  <div className="flex gap-2 mt-2"><button onClick={() => { setNotesValue(athlete.notes || ""); setEditingNotes(false); }} className="px-3 py-1.5 bg-secondary border border-border rounded-lg text-[11px] text-foreground font-semibold cursor-pointer">Annulla</button><button onClick={() => { updateField({ notes: notesValue }); setEditingNotes(false); }} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[11px] font-bold cursor-pointer">Salva</button></div>
                </div>
              ) : <div className="text-sm text-muted-foreground whitespace-pre-wrap">{athlete.notes || "Nessuna nota. Clicca 'Modifica' per aggiungere."}</div>}
            </div>
          )}
        </div>

        {/* Sidebar stats */}
        <div className="w-[200px] shrink-0">
          <div className="bg-card rounded-xl border border-border p-4 space-y-4 sticky top-5">
            <div><div className="text-[9px] text-muted-foreground font-semibold mb-0.5">REVENUE YTD</div><div className="text-lg font-bold text-foreground">{fmt(revenueYTD)}</div></div>
            <div><div className="text-[9px] text-muted-foreground font-semibold mb-0.5">CONTRATTI ATTIVI</div><div className="text-lg font-bold text-foreground">{activeContracts.length}</div></div>
            <div><div className="text-[9px] text-muted-foreground font-semibold mb-0.5">PROSSIMA SCADENZA</div><div className="text-sm font-bold text-foreground">{nextDeadline ? new Date(nextDeadline.end_date).toLocaleDateString("it-IT") : "—"}</div></div>
            <div><div className="text-[9px] text-muted-foreground font-semibold mb-0.5">FOLLOWER TOTALI</div><div className="text-lg font-bold text-foreground">{totalFollowers > 0 ? totalFollowers.toLocaleString("it-IT") : "—"}</div></div>
          </div>
        </div>
      </div>
      {showMediaKit && <MediaKitModal athleteId={athleteId} onClose={() => setShowMediaKit(false)} />}
    </div>
  );
};

export default AthleteDetail;
