import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyContext } from "@/hooks/useAgencyContext";
import { Pill } from "@/components/taura/ui-primitives";
import { FileText, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ReportsPage = () => {
  const navigate = useNavigate();
  const { agencyId } = useAgencyContext();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { if (agencyId) fetchReports(); }, [agencyId]);

  const fetchReports = async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  const deleteReport = async (id: string) => {
    if (!agencyId) return;
    if (!confirm("Eliminare questo report?")) return;
    await supabase.from("reports").delete().eq("id", id).eq("agency_id", agencyId);
    toast.success("Report eliminato");
    fetchReports();
  };

  const downloadCSV = (report: any) => {
    const d = report.generated_data;
    if (!d) return;
    const rows = [
      ["Proof Package — " + d.campaign_name],
      ["Brand", d.brand],
      ["Agenzia", d.agency],
      ["Data generazione", new Date(d.generated_at).toLocaleDateString("it-IT")],
      [],
      ["METRICHE AGGREGATE"],
      ["Deliverable totali", d.total_deliverables],
      ["Approvati", d.approved],
      ["Pubblicati", d.posted],
      ["Impressioni", d.impressions],
      ["Reach", d.reach],
      ["Engagement rate medio", d.avg_engagement_rate + "%"],
      ["Link clicks", d.link_clicks],
      [],
      ["DETTAGLIO DELIVERABLE"],
      ["Talent", "Tipo", "Data", "Approvato", "Pubblicato", "Impressioni", "Engagement", "Reach", "Clicks"],
      ...(d.deliverables || []).map((dl: any) => [
        dl.athlete, dl.type, dl.date || "—", dl.approved ? "Sì" : "No", dl.posted ? "Sì" : "No",
        dl.impressions, dl.engagement_rate + "%", dl.reach, dl.link_clicks,
      ]),
      [],
      ["RACCOMANDAZIONI"],
      ...(d.recommendations || []).map((r: string) => [r]),
    ];
    const csv = rows.map(r => (r as any[]).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `proof_package_${d.campaign_name?.replace(/\s/g, "_")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV scaricato");
  };

  return (
    <div className="p-5 pb-10">
      <h1 className="text-xl font-bold text-foreground tracking-tight mb-6">Reports</h1>

      {/* Report templates */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <button onClick={() => navigate("/reports/monte-contratti")} className="bg-card rounded-xl p-5 border border-border text-left hover:border-primary/20 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-taura-surface border border-border flex items-center justify-center text-lg mb-3">📊</div>
          <h3 className="text-[13px] font-bold text-foreground mb-1">Monte Contratti</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Breakdown per brand e talent, top ranking e AI overview.</p>
          <div className="text-[11px] text-primary font-semibold mt-2">Apri →</div>
        </button>
        <div className="bg-card rounded-xl p-5 border border-border text-left">
          <div className="w-10 h-10 rounded-xl bg-taura-surface border border-border flex items-center justify-center text-lg mb-3">📦</div>
          <h3 className="text-[13px] font-bold text-foreground mb-1">Proof Package</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Genera dalla pagina Campagne → seleziona campagna → "Proof Package".</p>
        </div>
      </div>

      {/* Generated reports */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-foreground">Report generati</h2>
        <span className="text-[11px] text-muted-foreground font-mono">{reports.length} report</span>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Caricamento...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <div className="text-foreground font-bold mb-1">Nessun report generato</div>
          <div className="text-muted-foreground text-sm">I Proof Package generati dalle campagne appariranno qui.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => {
            const d = r.generated_data || {};
            const expanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div onClick={() => setExpandedId(expanded ? null : r.id)} className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <span className="text-lg">{r.report_type === "proof_package" ? "📦" : "📊"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{r.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(r.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <Pill variant={r.status === "generated" ? "green" : "muted"}>{r.status || "draft"}</Pill>
                  <button onClick={e => { e.stopPropagation(); downloadCSV(r); }} className="p-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors" title="Scarica CSV"><Download className="w-3.5 h-3.5" /></button>
                  <button onClick={e => { e.stopPropagation(); deleteReport(r.id); }} className="p-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors" title="Elimina"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {expanded && d && (
                  <div className="px-5 py-4 border-t border-border bg-secondary/30">
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {[
                        { l: "Impressioni", v: (d.impressions || 0).toLocaleString("it-IT") },
                        { l: "Reach", v: (d.reach || 0).toLocaleString("it-IT") },
                        { l: "Engagement", v: `${d.avg_engagement_rate || 0}%` },
                        { l: "Link clicks", v: (d.link_clicks || 0).toLocaleString("it-IT") },
                      ].map((m, i) => (
                        <div key={i} className="bg-card rounded-lg border border-border p-3 text-center">
                          <div className="text-[16px] font-bold text-foreground">{m.v}</div>
                          <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">{m.l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] font-bold text-foreground mb-2">Deliverable ({d.total_deliverables || 0})</div>
                    <div className="space-y-1 mb-3">
                      {(d.deliverables || []).slice(0, 10).map((dl: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[11px] bg-card rounded-lg px-3 py-2 border border-border">
                          <span className="text-foreground"><span className="font-semibold">{dl.athlete}</span> — {dl.type}</span>
                          <div className="flex items-center gap-2">
                            {dl.posted && <span className="text-primary">✓ Pubblicato</span>}
                            {dl.impressions > 0 && <span className="text-muted-foreground font-mono">{dl.impressions.toLocaleString("it-IT")} impr.</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(d.recommendations || []).length > 0 && (
                      <div>
                        <div className="text-[11px] font-bold text-foreground mb-1.5">Raccomandazioni</div>
                        {d.recommendations.map((rec: string, i: number) => (
                          <div key={i} className="text-[11px] text-muted-foreground mb-1">• {rec}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
