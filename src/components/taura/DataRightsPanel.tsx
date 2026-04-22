import { useEffect, useState } from "react";
import { Download, Trash2, ShieldAlert, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DsrRequest {
  id: string;
  request_type: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  export_url: string | null;
  export_expires_at: string | null;
}

const DataRightsPanel = () => {
  const { user, signOut } = useAuth();
  const [requests, setRequests] = useState<DsrRequest[]>([]);
  const [exporting, setExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("dsr_requests")
      .select("id, request_type, status, requested_at, completed_at, export_url, export_expires_at")
      .eq("user_id", user!.id)
      .order("requested_at", { ascending: false })
      .limit(10);
    setRequests((data as DsrRequest[]) ?? []);
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("export-user-data", { body: {} });
      if (error) throw error;
      await loadRequests();
      if (data?.download_url) {
        window.open(data.download_url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'export");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { confirm: true },
      });
      if (error) throw error;
      await signOut();
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'eliminazione");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Download className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Esporta i tuoi dati</h3>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              Art. 15 e 20 GDPR — ricevi una copia in formato JSON di tutti i dati associati al tuo account.
              Il link di download è valido per 7 giorni.
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-60"
        >
          {exporting ? "Generazione in corso..." : "Genera export"}
        </button>
      </section>

      <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Elimina il tuo account</h3>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              Art. 17 GDPR — i tuoi dati saranno disattivati immediatamente e cancellati
              definitivamente entro 30 giorni. L'operazione non è reversibile.
            </p>
          </div>
        </div>

        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500/25 transition-colors"
          >
            Elimina account
          </button>
        ) : (
          <div className="space-y-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="flex items-start gap-2 text-[12px] text-red-500">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Confermi l'eliminazione? Dopo 30 giorni i dati saranno irrecuperabili.</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 text-[12px] font-semibold px-3 py-2 rounded-lg bg-secondary text-foreground border border-border"
              >
                Annulla
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 text-[12px] font-semibold px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? "Eliminazione..." : "Confermo, elimina"}
              </button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-500">
          {error}
        </div>
      )}

      {requests.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-[14px] font-semibold text-foreground tracking-tight mb-3">
            Storico richieste
          </h3>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/20">
                <div className="flex items-center gap-3">
                  {r.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="text-[12px] font-medium text-foreground capitalize">
                      {r.request_type === "export" ? "Export dati" : r.request_type === "erasure" ? "Eliminazione" : r.request_type}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(r.requested_at).toLocaleString("it-IT")} · {r.status}
                    </div>
                  </div>
                </div>
                {r.export_url && r.export_expires_at && new Date(r.export_expires_at) > new Date() && (
                  <a
                    href={r.export_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Scarica <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default DataRightsPanel;
