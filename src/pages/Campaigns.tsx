import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgencyContext } from "@/hooks/useAgencyContext";
import { Pill } from "@/components/taura/ui-primitives";
import { sha256Hex, getFileExt } from "@/lib/fileHash";
import { Upload, Plus, Search, Check, Clock, FileText, ChevronRight, Trash2, Pencil, Copy, Mail, ChevronDown, ChevronUp, Send, Megaphone } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/taura/EmptyState";

interface Campaign {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  brief_file_url: string | null;
  deliverables_count?: number;
  approved_count?: number;
  posted_count?: number;
}

interface Deliverable {
  id: string;
  campaign_id: string;
  athlete_id: string | null;
  athlete_name?: string;
  content_type: string;
  scheduled_date: string | null;
  description: string | null;
  ai_overview: string | null;
  content_approved: boolean;
  post_confirmed: boolean;
  notes: string | null;
}

const contentTypeLabels: Record<string, { label: string; emoji: string }> = {
  post: { label: "Post", emoji: "📸" },
  reel: { label: "Reel", emoji: "🎬" },
  tiktok: { label: "TikTok", emoji: "📱" },
  story: { label: "Story", emoji: "⏳" },
  youtube: { label: "YouTube", emoji: "▶️" },
};

const CampaignsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agencyId } = useAgencyContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const briefDeliverableRef = useRef<HTMLInputElement>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [delLoading, setDelLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", brand: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadingBriefForDel, setUploadingBriefForDel] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{ cache_key: string; new_athletes: any[]; existing_athletes: any[]; deliverables_count: number; campaign_id: string } | null>(null);
  const [editingAthletes, setEditingAthletes] = useState<any[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [delFilter, setDelFilter] = useState<"all" | "pending" | "to_publish" | "done">("all");
  const [expandedOverview, setExpandedOverview] = useState<string | null>(null);

  useEffect(() => { if (agencyId) fetchCampaigns(); }, [agencyId]);

  // Realtime: aggiorna deliverable quando l'AI (o chiunque) li modifica nel DB
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel("campaign_deliverables_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "campaign_deliverables" }, (payload) => {
        setDeliverables(prev => prev.map(d =>
          d.id === payload.new.id
            ? { ...d, content_approved: Boolean(payload.new.content_approved), post_confirmed: Boolean(payload.new.post_confirmed) }
            : d
        ));
        // Debounce campaign refetch to avoid N+1 on rapid updates
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchCampaigns(), 1000);
      })
      .subscribe();
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCampaigns = async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data, error } = await supabase.from("campaigns").select("*").eq("agency_id", agencyId).order("created_at", { ascending: false });
    if (!error && data) {
      const ids = data.map((c: any) => c.id);
      if (ids.length > 0) {
        const { data: dels } = await supabase.from("campaign_deliverables").select("campaign_id, content_approved, post_confirmed").eq("agency_id", agencyId).in("campaign_id", ids);
        const countsMap: Record<string, { total: number; approved: number; posted: number }> = {};
        (dels || []).forEach((d: any) => {
          if (!countsMap[d.campaign_id]) countsMap[d.campaign_id] = { total: 0, approved: 0, posted: 0 };
          countsMap[d.campaign_id].total++;
          if (d.content_approved) countsMap[d.campaign_id].approved++;
          if (d.post_confirmed) countsMap[d.campaign_id].posted++;
        });
        setCampaigns(data.map((c: any) => ({ ...c, deliverables_count: countsMap[c.id]?.total || 0, approved_count: countsMap[c.id]?.approved || 0, posted_count: countsMap[c.id]?.posted || 0 })));
      } else {
        setCampaigns(data);
      }
    }
    setLoading(false);
  };

  const fetchDeliverables = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDelLoading(true);
    const { data, error } = await supabase.from("campaign_deliverables").select("*, athletes(full_name)").eq("campaign_id", campaign.id).order("scheduled_date", { ascending: true });
    if (!error && data) {
      setDeliverables(data.map((d: any) => ({ ...d, athlete_name: d.athletes?.full_name || "Non assegnato", content_approved: Boolean(d.content_approved), post_confirmed: Boolean(d.post_confirmed) })));
    }
    setDelLoading(false);
  };

  const toggleApproval = async (del: Deliverable) => {
    if (!agencyId) return;
    const { error } = await supabase.from("campaign_deliverables").update({ content_approved: !del.content_approved }).eq("id", del.id).eq("agency_id", agencyId);
    if (error) {
      toast.error(error.message || "Errore aggiornamento approvazione");
      return;
    }
    if (selectedCampaign) {
      fetchDeliverables(selectedCampaign);
      fetchCampaigns();
    }
  };

  const togglePosted = async (del: Deliverable) => {
    if (!agencyId) return;
    const { error } = await supabase.from("campaign_deliverables").update({ post_confirmed: !del.post_confirmed }).eq("id", del.id).eq("agency_id", agencyId);
    if (error) {
      toast.error(error.message || "Errore aggiornamento pubblicazione");
      return;
    }
    if (selectedCampaign) {
      fetchDeliverables(selectedCampaign);
      fetchCampaigns();
    }
  };

  const handleCreate = async () => {
    if (!newCampaign.name.trim() || !newCampaign.brand.trim() || !user) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (!profile?.agency_id) { toast.error("Completa l'onboarding."); return; }
      const { error } = await supabase.from("campaigns").insert({ agency_id: profile.agency_id, name: newCampaign.name.trim(), brand: newCampaign.brand.trim(), description: newCampaign.description.trim() || null });
      if (error) throw error;
      toast.success("Campagna creata!");
      setNewCampaign({ name: "", brand: "", description: "" });
      setShowCreate(false);
      fetchCampaigns();
    } catch (err: any) { toast.error(err.message || "Errore"); }
    setSaving(false);
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!agencyId) return;
    if (!confirm("Eliminare questa campagna e tutti i suoi deliverable?")) return;
    try {
      await supabase.from("campaign_deliverables").delete().eq("campaign_id", campaignId).eq("agency_id", agencyId);
      const { error } = await supabase.from("campaigns").delete().eq("id", campaignId).eq("agency_id", agencyId);
      if (error) throw error;
      toast.success("Campagna eliminata");
      if (selectedCampaign?.id === campaignId) { setSelectedCampaign(null); setDeliverables([]); }
      fetchCampaigns();
    } catch (err: any) { toast.error(err.message || "Errore eliminazione"); }
  };

  const renameCampaign = async (campaign: Campaign) => {
    if (!agencyId) return;
    const nextName = prompt("Nuovo nome campagna", campaign.name)?.trim();
    if (!nextName || nextName === campaign.name) return;
    try {
      const { error } = await supabase.from("campaigns").update({ name: nextName }).eq("id", campaign.id).eq("agency_id", agencyId);
      if (error) throw error;
      toast.success("Nome campagna aggiornato");
      if (selectedCampaign?.id === campaign.id) {
        setSelectedCampaign({ ...campaign, name: nextName });
      }
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || "Errore rinomina campagna");
    }
  };

  const handleBriefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedCampaign) return;
    try {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (!profile?.agency_id) return;
      const hash = await sha256Hex(file);
      const ext = getFileExt(file.name) || "pdf";
      const fileName = `${profile.agency_id}/briefs/${hash}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("contracts").upload(fileName, file);
      if (uploadError) {
        const msg = String((uploadError as any).message || "").toLowerCase();
        if (msg.includes("exists") || (uploadError as any).statusCode === 409) { toast.error("Brief gia caricato."); return; }
        throw uploadError;
      }
      await supabase.from("campaigns").update({ brief_file_url: fileName }).eq("id", selectedCampaign.id).eq("agency_id", profile.agency_id);
      toast.success("Brief caricato! Estrazione AI in corso...");
      setParsing(true);
      try {
        const { data: result, error: parseErr } = await supabase.functions.invoke("parse-brief", { body: { campaign_id: selectedCampaign.id, dry_run: true } });
        if (parseErr) throw parseErr;
        if (result?.needs_confirmation && result.new_athletes?.length > 0) {
          setConfirmData({ cache_key: result.cache_key, new_athletes: result.new_athletes, existing_athletes: result.existing_athletes || [], deliverables_count: result.deliverables_count, campaign_id: selectedCampaign.id });
          setEditingAthletes(result.new_athletes.map((a: any) => ({ ...a })));
          setParsing(false);
        } else {
          const { data: finalResult, error: finalErr } = await supabase.functions.invoke("parse-brief", { body: { campaign_id: selectedCampaign.id, cache_key: result.cache_key } });
          if (finalErr) throw finalErr;
          if (finalResult?.success) { toast.success(`${finalResult.count} deliverable estratti!`); fetchDeliverables(selectedCampaign); }
          else toast.error(finalResult?.error || "Errore parsing brief");
          setParsing(false);
          fetchCampaigns();
        }
      } catch (parseErr: any) { toast.error("Errore parsing: " + (parseErr.message || "sconosciuto")); setParsing(false); }
    } catch (err: any) { toast.error(err.message || "Errore upload"); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmAthletes = async () => {
    if (!confirmData || !selectedCampaign) return;
    setConfirming(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("parse-brief", {
        body: { campaign_id: confirmData.campaign_id, cache_key: confirmData.cache_key, confirmed_athletes: editingAthletes },
      });
      if (error) throw error;
      if (result?.success) {
        toast.success(`${result.count} deliverable estratti! ${result.athletes_created || 0} nuovi talent creati.`);
        fetchDeliverables(selectedCampaign);
        fetchCampaigns();
      } else {
        toast.error(result?.error || "Errore");
      }
    } catch (err: any) { toast.error(err.message || "Errore conferma"); }
    setConfirmData(null);
    setEditingAthletes([]);
    setConfirming(false);
  };

  const bulkApprove = async () => {
    if (selectedIds.length === 0 || !agencyId) return;
    const { error } = await supabase.from("campaign_deliverables").update({ content_approved: true }).in("id", selectedIds).eq("agency_id", agencyId);
    if (error) { toast.error("Errore approvazione"); return; }
    toast.success(`${selectedIds.length} deliverable approvati`);
    setSelectedIds([]);
    if (selectedCampaign) { fetchDeliverables(selectedCampaign); fetchCampaigns(); }
  };

  const bulkPublish = async () => {
    if (selectedIds.length === 0 || !agencyId) return;
    const { error } = await supabase.from("campaign_deliverables").update({ post_confirmed: true }).in("id", selectedIds).eq("agency_id", agencyId);
    if (error) { toast.error("Errore pubblicazione"); return; }
    toast.success(`${selectedIds.length} deliverable segnati come pubblicati`);
    setSelectedIds([]);
    if (selectedCampaign) { fetchDeliverables(selectedCampaign); fetchCampaigns(); }
  };

  const copyBriefForTalent = (talentName: string, talentDels: Deliverable[]) => {
    if (!selectedCampaign) return;
    const lines = [`BRIEF PER ${talentName.toUpperCase()} — Campagna ${selectedCampaign.name} (${selectedCampaign.brand})`, ""];
    talentDels.forEach((d, i) => {
      const ct = contentTypeLabels[d.content_type] || { label: d.content_type, emoji: "" };
      lines.push(`Deliverable ${i + 1}: ${ct.emoji} ${ct.label} — ${d.scheduled_date ? new Date(d.scheduled_date).toLocaleDateString("it-IT") : "Data TBD"}`);
      if (d.ai_overview) lines.push(`Istruzioni: ${d.ai_overview}`);
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`Brief per ${talentName} copiato!`);
  };

  const sendBriefEmail = (talentName: string, talentDels: Deliverable[]) => {
    if (!selectedCampaign) return;
    const lines = [`BRIEF PER ${talentName.toUpperCase()} — Campagna ${selectedCampaign.name} (${selectedCampaign.brand})`, ""];
    talentDels.forEach((d, i) => {
      const ct = contentTypeLabels[d.content_type] || { label: d.content_type, emoji: "" };
      lines.push(`Deliverable ${i + 1}: ${ct.label} — ${d.scheduled_date ? new Date(d.scheduled_date).toLocaleDateString("it-IT") : "Data TBD"}`);
      if (d.ai_overview) lines.push(`Istruzioni: ${d.ai_overview}`);
      lines.push("");
    });
    const subject = encodeURIComponent(`Brief ${selectedCampaign.name} - ${talentName}`);
    const body = encodeURIComponent(lines.join("\n"));
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleDeliverableBriefUpload = async (e: React.ChangeEvent<HTMLInputElement>, deliverable: Deliverable) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (!profile?.agency_id) return;
      setUploadingBriefForDel(deliverable.id);
      const hash = await sha256Hex(file);
      const ext = getFileExt(file.name) || "pdf";
      const fileName = `${profile.agency_id}/del-briefs/${hash}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("contracts").upload(fileName, file);
      if (uploadError) {
        const msg = String((uploadError as any).message || "").toLowerCase();
        if (msg.includes("exists") || (uploadError as any).statusCode === 409) { toast.error("Brief già caricato."); setUploadingBriefForDel(null); return; }
        throw uploadError;
      }
      // Parse the brief with AI scoped to this deliverable
      const { data: result, error: parseErr } = await supabase.functions.invoke("parse-contract", {
        body: { file_url: fileName, original_name: file.name, source: "deliverable_brief" },
      });
      if (!parseErr && result?.success) {
        // Update deliverable ai_overview with parsed obligations
        const overview = result.extracted_data?.social_obligations || result.extracted_data?.obligations || `Brief ${file.name} caricato`;
        await supabase.from("campaign_deliverables").update({ ai_overview: overview, notes: `Brief: ${fileName}` }).eq("id", deliverable.id).eq("agency_id", profile.agency_id);
        toast.success("Brief caricato e analizzato!");
      } else {
        await supabase.from("campaign_deliverables").update({ notes: `Brief: ${fileName}` }).eq("id", deliverable.id).eq("agency_id", profile.agency_id);
        toast.success("Brief caricato.");
      }
      if (selectedCampaign) fetchDeliverables(selectedCampaign);
    } catch (err: any) { toast.error(err.message || "Errore upload brief"); }
    setUploadingBriefForDel(null);
    if (briefDeliverableRef.current) briefDeliverableRef.current.value = "";
  };

  const [generatingProof, setGeneratingProof] = useState(false);

  const generateProofPackage = async () => {
    if (!selectedCampaign || !user) return;
    setGeneratingProof(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("agency_id, agencies(name)").eq("id", user.id).single();
      if (!profile?.agency_id) { toast.error("Completa l'onboarding."); setGeneratingProof(false); return; }

      // Gather campaign metrics from deliverables
      const { data: delsData } = await supabase.from("campaign_deliverables").select("*, athletes(full_name)").eq("campaign_id", selectedCampaign.id);
      const dels = delsData || [];
      const totalDels = dels.length;
      const approved = dels.filter((d: any) => d.content_approved).length;
      const posted = dels.filter((d: any) => d.post_confirmed).length;
      const totalImpressions = dels.reduce((s: number, d: any) => s + (d.impressions || 0), 0);
      const totalReach = dels.reduce((s: number, d: any) => s + (d.reach || 0), 0);
      const avgEngagement = dels.length > 0 ? (dels.reduce((s: number, d: any) => s + (d.engagement_rate || 0), 0) / dels.length) : 0;
      const totalClicks = dels.reduce((s: number, d: any) => s + (d.link_clicks || 0), 0);

      const agencyName = (profile.agencies as any)?.name || "Taura Agency";

      // Save report
      const reportContent = JSON.stringify({
          campaign_name: selectedCampaign.name,
          brand: selectedCampaign.brand,
          agency: agencyName,
          generated_at: new Date().toISOString(),
          total_deliverables: totalDels,
          approved: approved,
          posted: posted,
          impressions: totalImpressions,
          reach: totalReach,
          avg_engagement_rate: parseFloat(avgEngagement.toFixed(2)),
          link_clicks: totalClicks,
          deliverables: dels.map((d: any) => ({
            athlete: d.athletes?.full_name || "N/A",
            type: d.content_type,
            date: d.scheduled_date,
            approved: d.content_approved,
            posted: d.post_confirmed,
            impressions: d.impressions || 0,
            engagement_rate: d.engagement_rate || 0,
            reach: d.reach || 0,
            link_clicks: d.link_clicks || 0,
          })),
          recommendations: [
            totalImpressions > 0 ? `La campagna ha generato ${totalImpressions.toLocaleString("it-IT")} impressioni totali.` : "Inserisci le metriche per un report completo.",
            avgEngagement > 3 ? "Engagement rate sopra la media di settore (2-3%)." : "Valuta strategie per migliorare l'engagement.",
            posted === totalDels ? "Tutti i contenuti sono stati pubblicati come da brief." : `${totalDels - posted} contenuti ancora da pubblicare.`,
          ],
      });

      const { data: report, error: reportError } = await supabase.from("reports").insert({
        agency_id: profile.agency_id,
        campaign_id: selectedCampaign.id,
        report_type: "proof_package",
        title: `Proof Package — ${selectedCampaign.name} (${selectedCampaign.brand})`,
        content: reportContent,
      }).select("id").single();

      if (reportError) throw reportError;
      toast.success("Proof Package generato! Vai ai Report per scaricarlo.");
      navigate(`/reports`);
    } catch (err: any) {
      toast.error(err.message || "Errore generazione report");
    }
    setGeneratingProof(false);
  };

  const filtered = campaigns.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q);
  });

  const statusVariant = (s: string | null): "green" | "orange" | "muted" => {
    if (s === "active") return "green";
    if (s === "draft") return "orange";
    return "muted";
  };

  return (
    <div className="p-5 pb-10">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Campagne</h1>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{campaigns.length} campagne</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[12px] font-bold cursor-pointer glow-accent-sm hover:opacity-90 transition-opacity flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          Nuova campagna
        </button>
      </div>

      <div className="flex items-center gap-2 bg-secondary rounded-lg border border-border px-3 py-2 mb-4 max-w-sm">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca campagna, brand..." className="bg-transparent text-[12px] text-foreground outline-none flex-1 placeholder:text-muted-foreground" />
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-card rounded-xl border border-border p-6 w-[460px]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Nuova Campagna</h2>
            <div className="flex flex-col gap-3">
              <input value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} placeholder="Nome campagna" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              <input value={newCampaign.brand} onChange={e => setNewCampaign({ ...newCampaign, brand: e.target.value })} placeholder="Brand" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              <textarea value={newCampaign.description} onChange={e => setNewCampaign({ ...newCampaign, description: e.target.value })} placeholder="Descrizione (opzionale)" rows={3} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 bg-secondary text-foreground py-2 rounded-lg text-sm font-semibold cursor-pointer border border-border">Annulla</button>
                <button onClick={handleCreate} disabled={saving || !newCampaign.name.trim() || !newCampaign.brand.trim()} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-40">{saving ? "Creazione..." : "Crea"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <div className={selectedCampaign ? "flex-1" : "w-full"}>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Caricamento...</div>
          ) : filtered.length === 0 ? (
            search ? (
              <div className="text-center py-16">
                <div className="text-foreground font-bold mb-1">Nessun risultato</div>
                <div className="text-muted-foreground text-sm">Prova con un'altra ricerca.</div>
              </div>
            ) : (
              <EmptyState
                icon={Megaphone}
                title="Nessuna campagna attiva"
                description="Crea la prima campagna per generare Proof Package automatici per i tuoi sponsor"
                ctaLabel="Nuova campagna"
                onCta={() => setShowCreate(true)}
              />
            )
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(c => {
                const total = c.deliverables_count || 0;
                const approved = c.approved_count || 0;
                const posted = c.posted_count || 0;
                const missing = Math.max(0, total - approved);
                const approvedPct = total > 0 ? (approved / total) * 100 : 0;
                const postedPct = total > 0 ? (posted / total) * 100 : 0;
                const missingPct = total > 0 ? (missing / total) * 100 : 100;
                return (
                <div key={c.id} onClick={() => { fetchDeliverables(c); setSelectedIds([]); setDelFilter("all"); }} className={`bg-card rounded-xl p-4 border cursor-pointer transition-all hover:border-primary/30 ${selectedCampaign?.id === c.id ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-bold text-foreground">{c.name}</span>
                        <Pill variant={statusVariant(c.status)}>{c.status === "active" ? "Attiva" : c.status === "draft" ? "Bozza" : c.status || "—"}</Pill>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
                        <span className="font-semibold">{c.brand}</span>
                        {c.brief_file_url && <span className="text-taura-blue">Brief</span>}
                      </div>
                      {total > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground w-[64px] shrink-0">Approvaz.</span>
                            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-taura-green rounded-full transition-all" style={{ width: `${approvedPct}%` }} />
                            </div>
                            <span className="text-[9px] font-bold font-mono text-foreground w-7 text-right shrink-0">{Math.round(approvedPct)}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground w-[64px] shrink-0">Pubbl.</span>
                            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${postedPct}%` }} />
                            </div>
                            <span className="text-[9px] font-bold font-mono text-foreground w-7 text-right shrink-0">{Math.round(postedPct)}%</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground">{posted}/{total} post · {approved} approvati · {missing} da fare</div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); renameCampaign(c); }}
                      className="p-1.5 rounded-md bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors shrink-0"
                      title="Rinomina campagna"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }}
                      className="p-1.5 rounded-md bg-secondary border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors shrink-0"
                      title="Elimina campagna"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedCampaign && (() => {
          const filteredDels = deliverables.filter(d => {
            if (delFilter === "pending") return !d.content_approved;
            if (delFilter === "to_publish") return d.content_approved && !d.post_confirmed;
            if (delFilter === "done") return d.post_confirmed;
            return true;
          });

          const grouped = filteredDels.reduce<Record<string, Deliverable[]>>((acc, d) => {
            const key = d.athlete_name || "Non assegnato";
            if (!acc[key]) acc[key] = [];
            acc[key].push(d);
            return acc;
          }, {});

          const allFilteredIds = filteredDels.map(d => d.id);
          const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));

          const formatDate = (dateStr: string | null) => {
            if (!dateStr) return "—";
            const d = new Date(dateStr);
            const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
            const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
            return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
          };

          const ctColors: Record<string, string> = {
            reel: "bg-taura-purple/15 text-taura-purple border-taura-purple/30",
            post: "bg-taura-blue/15 text-taura-blue border-taura-blue/30",
            story: "bg-taura-orange/15 text-taura-orange border-taura-orange/30",
            tiktok: "bg-secondary text-foreground border-border",
            youtube: "bg-taura-red/15 text-taura-red border-taura-red/30",
          };

          return (
          <div className="w-[480px] shrink-0">
            <div className="bg-card rounded-xl border border-border p-5 sticky top-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-foreground">{selectedCampaign.name}</div>
                  <div className="text-[11px] text-muted-foreground">{selectedCampaign.brand}</div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => fileInputRef.current?.click()} className="text-[11px] bg-secondary border border-border px-3 py-1.5 rounded-lg text-foreground font-semibold cursor-pointer hover:border-primary/30 flex items-center gap-1.5">
                    <Upload className="w-3 h-3" />
                    Brief
                  </button>
                  <button onClick={generateProofPackage} disabled={generatingProof || deliverables.length === 0} className="text-[11px] bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-bold cursor-pointer hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5">
                    {generatingProof ? "..." : "Proof"}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.pptx,.docx,.doc" onChange={handleBriefUpload} />
              </div>

              {selectedCampaign.description && (
                <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">{selectedCampaign.description}</p>
              )}

              <input ref={briefDeliverableRef} type="file" className="hidden" accept=".pdf,.pptx,.docx,.doc" onChange={(e) => {
                const del = deliverables.find(d => d.id === uploadingBriefForDel);
                if (del) handleDeliverableBriefUpload(e, del);
              }} />

              <div className="flex gap-1 mb-3 border-b border-border pb-2">
                {([["all", "Tutti"], ["pending", "Da approvare"], ["to_publish", "Da pubblicare"], ["done", "Completati"]] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setDelFilter(key)} className={`px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer transition-all ${delFilter === key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
                ))}
              </div>

              {deliverables.length > 0 && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-secondary/50 border border-border">
                  <input type="checkbox" checked={allSelected} onChange={() => {
                    if (allSelected) setSelectedIds([]);
                    else setSelectedIds(allFilteredIds);
                  }} className="accent-primary w-3.5 h-3.5 cursor-pointer" />
                  <span className="text-[10px] text-muted-foreground flex-1">{selectedIds.length > 0 ? `${selectedIds.length} selezionati` : "Seleziona tutti"}</span>
                  {selectedIds.length > 0 && (
                    <>
                      <button onClick={bulkApprove} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-taura-green/15 text-taura-green border border-taura-green/30 cursor-pointer hover:bg-taura-green/25 transition-colors">
                        <Check className="w-3 h-3" /> Approva
                      </button>
                      <button onClick={bulkPublish} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30 cursor-pointer hover:bg-primary/25 transition-colors">
                        <Send className="w-3 h-3" /> Pubblica
                      </button>
                    </>
                  )}
                </div>
              )}

              {parsing ? (
                <div className="text-center py-6">
                  <div className="inline-flex items-center gap-2 text-primary text-[12px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    AI sta analizzando il brief...
                  </div>
                </div>
              ) : delLoading ? (
                <div className="text-center py-6 text-muted-foreground text-[12px]">Caricamento...</div>
              ) : deliverables.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-[12px]">
                  Nessun contenuto. Carica un brief per generarli automaticamente via AI.
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
                  {Object.entries(grouped).map(([talentName, talentDels]) => (
                    <div key={talentName}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-md bg-secondary border border-border flex items-center justify-center">
                          <span className="text-[8px] font-bold text-muted-foreground">{talentName.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
                        </div>
                        <span className="text-[12px] font-bold text-foreground flex-1">{talentName}</span>
                        <button onClick={() => copyBriefForTalent(talentName, talentDels)} className="p-1 rounded text-muted-foreground hover:text-primary transition-colors" title="Copia brief">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => sendBriefEmail(talentName, talentDels)} className="p-1 rounded text-muted-foreground hover:text-primary transition-colors" title="Invia via email">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1.5 ml-8">
                        {talentDels.map(d => {
                          const ct = contentTypeLabels[d.content_type] || { label: d.content_type, emoji: "" };
                          const isSelected = selectedIds.includes(d.id);
                          const ctColor = ctColors[d.content_type] || "bg-secondary text-muted-foreground border-border";
                          return (
                            <div key={d.id} className="bg-secondary rounded-lg border border-border p-2.5 transition-all hover:border-primary/20">
                              <div className="flex items-center gap-2 mb-1">
                                <input type="checkbox" checked={isSelected} onChange={() => {
                                  setSelectedIds(prev => isSelected ? prev.filter(id => id !== d.id) : [...prev, d.id]);
                                }} className="accent-primary w-3.5 h-3.5 cursor-pointer shrink-0" />
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${ctColor}`}>
                                  {ct.emoji} {ct.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono flex-1 text-right">{formatDate(d.scheduled_date)}</span>
                              </div>

                              {d.ai_overview && (
                                <div className="ml-6">
                                  <button onClick={() => setExpandedOverview(expandedOverview === d.id ? null : d.id)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-1">
                                    {expandedOverview === d.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    Istruzioni
                                  </button>
                                  {expandedOverview === d.id && (
                                    <div className="text-[11px] text-foreground bg-card rounded-md p-2 border border-border leading-relaxed mb-1.5">
                                      {d.ai_overview}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-1.5 ml-6">
                                <button onClick={() => toggleApproval(d)} className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors ${d.content_approved ? "bg-taura-green" : "bg-muted"}`}>
                                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${d.content_approved ? "translate-x-4" : "translate-x-0.5"}`} />
                                </button>
                                <span className="text-[10px] text-muted-foreground">{d.content_approved ? "Approvato" : "Approva"}</span>
                                <button onClick={() => togglePosted(d)} className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors ml-2 ${d.post_confirmed ? "bg-primary" : "bg-muted"}`}>
                                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${d.post_confirmed ? "translate-x-4" : "translate-x-0.5"}`} />
                                </button>
                                <span className="text-[10px] text-muted-foreground">{d.post_confirmed ? "Pubblicato" : "Pubblica"}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </div>

      {confirmData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => { setConfirmData(null); setEditingAthletes([]); }}>
          <div className="bg-card rounded-xl border border-border p-6 w-[520px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-1">Conferma talent rilevati</h2>
            <p className="text-[12px] text-muted-foreground mb-4">
              L'AI ha trovato {confirmData.deliverables_count} deliverable. {confirmData.existing_athletes.length > 0 && `${confirmData.existing_athletes.length} talent gia nel roster.`} {editingAthletes.length > 0 && `${editingAthletes.length} nuovi talent da confermare:`}
            </p>

            {confirmData.existing_athletes.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Nel roster</div>
                <div className="flex flex-wrap gap-1.5">
                  {confirmData.existing_athletes.map((a: any, i: number) => (
                    <Pill key={i} variant="green">{a.name}</Pill>
                  ))}
                </div>
              </div>
            )}

            {editingAthletes.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Nuovi talent</div>
                <div className="flex flex-col gap-3">
                  {editingAthletes.map((a: any, i: number) => (
                    <div key={i} className="bg-secondary rounded-lg border border-border p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input value={a.name} onChange={e => { const next = [...editingAthletes]; next[i] = { ...next[i], name: e.target.value }; setEditingAthletes(next); }} placeholder="Nome" className="bg-card border border-border rounded px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary" />
                        <input value={a.sport} onChange={e => { const next = [...editingAthletes]; next[i] = { ...next[i], sport: e.target.value }; setEditingAthletes(next); }} placeholder="Sport" className="bg-card border border-border rounded px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary" />
                        <input value={a.instagram_handle || ""} onChange={e => { const next = [...editingAthletes]; next[i] = { ...next[i], instagram_handle: e.target.value }; setEditingAthletes(next); }} placeholder="@instagram" className="bg-card border border-border rounded px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary" />
                        <input value={a.tiktok_handle || ""} onChange={e => { const next = [...editingAthletes]; next[i] = { ...next[i], tiktok_handle: e.target.value }; setEditingAthletes(next); }} placeholder="@tiktok" className="bg-card border border-border rounded px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => { setConfirmData(null); setEditingAthletes([]); }} className="flex-1 bg-secondary text-foreground py-2 rounded-lg text-sm font-semibold cursor-pointer border border-border">Annulla</button>
              <button onClick={handleConfirmAthletes} disabled={confirming} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-40">
                {confirming ? "Elaborazione..." : "Conferma e crea"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
