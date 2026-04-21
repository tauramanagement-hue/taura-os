import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/taura/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Lock } from "lucide-react";
import { toast } from "sonner";

interface Prospect {
  id: string;
  full_name: string;
  current_club: string | null;
  position: string | null;
  sport: string;
  stage: string;
  priority: string;
  contract_expires: string | null;
  estimated_value: number | null;
}

const STAGES = [
  { id: "observed", label: "Osservato", color: "bg-slate-500/20 border-slate-500/30" },
  { id: "contacted", label: "Contattato", color: "bg-blue-500/20 border-blue-500/30" },
  { id: "meeting", label: "Incontro", color: "bg-violet-500/20 border-violet-500/30" },
  { id: "negotiation", label: "Trattativa", color: "bg-amber-500/20 border-amber-500/30" },
  { id: "signed", label: "Firmato", color: "bg-emerald-500/20 border-emerald-500/30" },
];

const PRIORITIES = {
  high: { label: "Alta", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  medium: { label: "Media", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  low: { label: "Bassa", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

export default function Scouting() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchProspects();
  }, [user]);

  const fetchProspects = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
    if (!profile?.agency_id) return;

    const { data } = await supabase
      .from("scouting_prospects")
      .select("*")
      .eq("agency_id", profile.agency_id)
      .order("created_at", { ascending: false });

    if (data) setProspects(data);
    setLoading(false);
  };

  const isFreeAgentSoon = (contractExpires: string | null) => {
    if (!contractExpires) return false;
    const monthsUntil = Math.ceil(
      (new Date(contractExpires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    return monthsUntil <= 6 && monthsUntil >= 0;
  };

  const stats = {
    total: prospects.length,
    signed: prospects.filter((p) => p.stage === "signed").length,
    active: prospects.filter((p) => p.stage !== "signed" && p.stage !== "passed").length,
    freeAgentSoon: prospects.filter((p) => isFreeAgentSoon(p.contract_expires)).length,
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground">Scouting Pipeline</h1>
            <p className="text-sm text-muted-foreground">Traccia e gestisci i prospect in pipeline</p>
          </div>
          <a
            href="mailto:os@tauramanagement.com?subject=Early%20access:%20Scouting%20Pipeline"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            Richiedi accesso
          </a>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Tot. in pipeline</div>
            <div className="text-2xl font-black text-foreground">{stats.total}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">In lavorazione</div>
            <div className="text-2xl font-black text-amber-400">{stats.active}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Firmati</div>
            <div className="text-2xl font-black text-emerald-400">{stats.signed}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">🔓 Free agent presto</div>
            <div className="text-2xl font-black text-primary">{stats.freeAgentSoon}</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Pipeline Kanban</div>

          <div className="grid grid-cols-5 gap-3">
            {STAGES.map((stage) => {
              const stageProspects = prospects.filter((p) => p.stage === stage.id);
              return (
                <div key={stage.id} className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground">{stage.label}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold">{stageProspects.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[300px]">
                    {stageProspects.map((prospect) => {
                      const priority = PRIORITIES[prospect.priority as keyof typeof PRIORITIES] || PRIORITIES.medium;
                      const freeAgentSoon = isFreeAgentSoon(prospect.contract_expires);

                      return (
                        <div
                          key={prospect.id}
                          className={`p-3 rounded-lg border ${stage.color} cursor-pointer hover:scale-[1.02] transition-transform`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="text-xs font-bold text-foreground">{prospect.full_name}</div>
                            {freeAgentSoon && (
                              <div className="shrink-0">
                                <Unlock className="w-3 h-3 text-primary" />
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mb-2">
                            {prospect.current_club || "Svincolato"} {prospect.position && `· ${prospect.position}`}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${priority.color}`}>
                              {priority.label}
                            </span>
                            {prospect.sport && (
                              <span className="text-[9px] text-muted-foreground">{prospect.sport}</span>
                            )}
                          </div>
                          {prospect.contract_expires && (
                            <div className="text-[9px] text-muted-foreground mt-2 border-t border-border/30 pt-2">
                              Contratto: {new Date(prospect.contract_expires).toLocaleDateString("it-IT")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
