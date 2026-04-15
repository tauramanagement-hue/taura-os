import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/taura/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface TransferWindow {
  id: string;
  country: string;
  league: string;
  window_type: string;
  opens_at: string;
  closes_at: string;
  season: string;
}

interface Transfer {
  id: string;
  athlete_id: string;
  from_club: string | null;
  to_club: string | null;
  transfer_type: string;
  status: string;
  estimated_fee: number | null;
  commission_amount: number | null;
  target_window_id: string | null;
  athletes?: { full_name: string };
}

const STATUSES = [
  { id: "scouting", label: "Scouting", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  { id: "contacted", label: "Contattato", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "negotiation", label: "Trattativa", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { id: "agreed", label: "Accordo", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { id: "completed", label: "Completato", color: "bg-primary/20 text-primary border-primary/30" },
];

export default function Transfers() {
  const { user } = useAuth();
  const [windows, setWindows] = useState<TransferWindow[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
    if (!profile?.agency_id) return;

    const [windowsRes, transfersRes] = await Promise.all([
      supabase.from("transfer_windows").select("*").gte("closes_at", today).order("opens_at").limit(3),
      supabase.from("transfers").select("*, athletes(full_name)").eq("agency_id", profile.agency_id),
    ]);

    if (windowsRes.data) setWindows(windowsRes.data);
    if (transfersRes.data) setTransfers(transfersRes.data);
    setLoading(false);
  };

  const daysBetween = (from: string, to: string) => {
    return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
  };

  const isWindowActive = (w: TransferWindow) => {
    const today = new Date().toISOString().split("T")[0];
    return w.opens_at <= today && w.closes_at >= today;
  };

  const TimelineBar = ({ window }: { window: TransferWindow }) => {
    const active = isWindowActive(window);
    const totalDays = daysBetween(window.opens_at, window.closes_at);
    const elapsed = active ? daysBetween(window.opens_at, new Date().toISOString().split("T")[0]) : 0;
    const pct = active ? Math.min((elapsed / totalDays) * 100, 100) : 0;
    const daysLeft = daysBetween(new Date().toISOString().split("T")[0], window.closes_at);

    return (
      <div className="flex-1">
        <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
          <span className="font-semibold">{window.country} · {window.league}</span>
          <span>{active ? `${daysLeft}gg rimasti` : `Apre ${new Date(window.opens_at).toLocaleDateString("it-IT")}`}</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden border border-border">
          <div
            className={`h-full rounded-full transition-all ${active ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  const urgentTransfers = transfers.filter((t) => {
    if (t.status !== "negotiation" || !t.target_window_id) return false;
    const window = windows.find((w) => w.id === t.target_window_id);
    if (!window) return false;
    const daysLeft = daysBetween(new Date().toISOString().split("T")[0], window.closes_at);
    return daysLeft <= 7 && daysLeft >= 0;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground">Transfer Window Tracker</h1>
            <p className="text-sm text-muted-foreground">Gestisci trasferimenti e finestre di mercato</p>
          </div>
          <button disabled title="Coming soon" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed">
            <Plus className="w-4 h-4" />
            Nuova trattativa
          </button>
        </div>

        {urgentTransfers.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-red-400">Attenzione: finestra in chiusura</div>
              <div className="text-xs text-red-400/80 mt-1">
                {urgentTransfers.length} trattativa/e in corso con finestra che chiude entro 7 giorni
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Finestre Aperte / Prossime</div>
          <div className="flex gap-4">
            {windows.slice(0, 3).map((w) => (
              <TimelineBar key={w.id} window={w} />
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Trattative</div>

          <div className="grid grid-cols-5 gap-3">
            {STATUSES.map((status) => {
              const statusTransfers = transfers.filter((t) => t.status === status.id);
              return (
                <div key={status.id} className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground">{status.label}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold">{statusTransfers.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[200px]">
                    {statusTransfers.map((transfer) => {
                      const window = windows.find((w) => w.id === transfer.target_window_id);
                      return (
                        <div
                          key={transfer.id}
                          className={`p-3 rounded-lg border ${status.color} cursor-pointer hover:scale-[1.02] transition-transform`}
                        >
                          <div className="text-xs font-bold text-foreground mb-1">{transfer.athletes?.full_name || "N/D"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {transfer.from_club || "?"} → {transfer.to_club || "?"}
                          </div>
                          {transfer.estimated_fee && (
                            <div className="text-[10px] text-foreground/70 mt-1">€{transfer.estimated_fee.toLocaleString("it-IT")}</div>
                          )}
                          {window && (
                            <div className="text-[9px] text-muted-foreground mt-1.5 border-t border-border/30 pt-1.5">
                              {window.country} · {new Date(window.closes_at).toLocaleDateString("it-IT")}
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
