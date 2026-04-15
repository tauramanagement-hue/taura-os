import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/taura/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Mandate {
  id: string;
  athlete_id: string;
  federation: string;
  mandate_type: string;
  start_date: string;
  end_date: string;
  deposited: boolean;
  status: string;
  athletes?: { full_name: string };
}

export default function Mandates() {
  const { user } = useAuth();
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchMandates();
  }, [user]);

  const fetchMandates = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
    if (!profile?.agency_id) return;

    const { data } = await supabase
      .from("mandates")
      .select("*, athletes(full_name)")
      .eq("agency_id", profile.agency_id)
      .order("end_date", { ascending: true });

    if (data) setMandates(data);
    setLoading(false);
  };

  const daysBetween = (from: string, to: string) => {
    return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
  };

  const daysToExpiry = (endDate: string) => {
    return daysBetween(new Date().toISOString().split("T")[0], endDate);
  };

  const getStatusColor = (days: number) => {
    if (days < 0) return "text-red-400";
    if (days <= 30) return "text-red-400";
    if (days <= 90) return "text-amber-400";
    return "text-emerald-400";
  };

  const activeCount = mandates.filter((m) => m.status === "active").length;
  const expiringCount = mandates.filter((m) => {
    const days = daysToExpiry(m.end_date);
    return days >= 0 && days <= 90;
  }).length;
  const expiredCount = mandates.filter((m) => daysToExpiry(m.end_date) < 0).length;
  const toDepositCount = mandates.filter((m) => !m.deposited && m.status === "active").length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground">Gestione Mandati</h1>
            <p className="text-sm text-muted-foreground">Mandati FIGC/FIFA con scadenze e alert</p>
          </div>
          <button disabled title="Coming soon" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed">
            <Plus className="w-4 h-4" />
            Nuovo mandato
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Mandati attivi</div>
            <div className="text-2xl font-black text-emerald-400">{activeCount}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">In scadenza (90gg)</div>
            <div className="text-2xl font-black text-amber-400">{expiringCount}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Scaduti</div>
            <div className="text-2xl font-black text-red-400">{expiredCount}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Da depositare</div>
            <div className="text-2xl font-black text-primary">{toDepositCount}</div>
          </div>
        </div>

        {expiredCount > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-red-400">Mandati scaduti</div>
              <div className="text-xs text-red-400/80 mt-1">
                {expiredCount} mandato/i scaduto/i. Non puoi operare per questi atleti fino al rinnovo.
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Atleta</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Federazione</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Tipo</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Scadenza</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Giorni rimasti</th>
                <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Depositato</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {mandates.map((mandate) => {
                const days = daysToExpiry(mandate.end_date);
                const statusColor = getStatusColor(days);

                return (
                  <tr key={mandate.id} className="border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{mandate.athletes?.full_name || "N/D"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{mandate.federation}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{mandate.mandate_type.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{new Date(mandate.end_date).toLocaleDateString("it-IT")}</td>
                    <td className={`px-4 py-3 text-sm font-bold ${statusColor}`}>
                      {days < 0 ? `Scaduto da ${Math.abs(days)}gg` : `${days}gg`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {mandate.deposited ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400 inline" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-md ${
                          mandate.status === "active"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {mandate.status === "active" ? "Attivo" : mandate.status === "expired" ? "Scaduto" : "Terminato"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {mandates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nessun mandato presente. Creane uno per iniziare.
            </div>
          )}
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-400/90">
          ⚠️ <strong>Disclaimer legale:</strong> Questo sistema fornisce promemoria e tracking delle scadenze. Non sostituisce la consulenza legale. L'agenzia è responsabile della compliance con le normative FIGC/FIFA/CONI.
        </div>
      </div>
    </DashboardLayout>
  );
}
