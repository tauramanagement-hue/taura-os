import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Pill, SeverityBadge } from "@/components/taura/ui-primitives";
import { Calendar, Filter, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

interface Deadline {
  id: string;
  brand: string;
  athlete_name: string;
  athlete_id: string;
  contract_type: string;
  value: number | null;
  end_date: string;
  status: string | null;
  days_remaining: number;
}

type FilterType = "all" | "sponsor" | "energy" | "equipment" | "media";
type FilterTime = "7d" | "30d" | "90d" | "all";

const DeadlinesPage = () => {
  const navigate = useNavigate();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterTime, setFilterTime] = useState<FilterTime>("all");
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);
  const [aiBrief, setAiBrief] = useState<string>("");
  const [briefLoading, setBriefLoading] = useState(false);

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contracts")
      .select("id, brand, contract_type, value, end_date, status, athlete_id, athletes(full_name)")
      .order("end_date", { ascending: true });

    if (!error && data) {
      const today = new Date();
      const mapped: Deadline[] = data.map((c: any) => ({
        id: c.id,
        brand: c.brand,
        athlete_name: c.athletes?.full_name || "N/A",
        athlete_id: c.athlete_id,
        contract_type: c.contract_type,
        value: c.value,
        end_date: c.end_date,
        status: c.status,
        days_remaining: Math.ceil((new Date(c.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      }));
      setDeadlines(mapped);
    }
    setLoading(false);
  };

  const fetchBrief = async (deadline: Deadline) => {
    setSelectedDeadline(deadline);
    setBriefLoading(true);
    setAiBrief("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAiBrief("Effettua l'accesso per generare il brief con l'AI.");
        setBriefLoading(false);
        return;
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Genera un brief operativo conciso per questa scadenza contrattuale:
- Atleta: ${deadline.athlete_name}
- Brand: ${deadline.brand}
- Tipo: ${deadline.contract_type}
- Valore: €${deadline.value?.toLocaleString("it-IT") || "N/D"}
- Scadenza: ${new Date(deadline.end_date).toLocaleDateString("it-IT")}
- Giorni rimanenti: ${deadline.days_remaining}
- Stato: ${deadline.status}

Rispondi con: 1) Cosa è richiesto 2) Criticità eventuali 3) Consigli operativi. Sii conciso e diretto.`,
            },
          ],
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Errore");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      const STREAM_TIMEOUT = 30000;
      const MAX_BUFFER = 100 * 1024;

      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await Promise.race([
            reader.read(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), STREAM_TIMEOUT)),
          ]);
        } catch {
          reader.cancel();
          if (!full) throw new Error("Timeout");
          break;
        }
        const { done, value } = result;
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > MAX_BUFFER) { reader.cancel(); break; }

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              full += c;
              setAiBrief(full);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch {
      setAiBrief("⚠️ Errore nel generare il brief. Riprova.");
    }
    setBriefLoading(false);
  };

  const filtered = deadlines.filter((d) => {
    if (filterType !== "all" && d.contract_type.toLowerCase() !== filterType) return false;
    if (filterTime === "7d" && d.days_remaining > 7) return false;
    if (filterTime === "30d" && d.days_remaining > 30) return false;
    if (filterTime === "90d" && d.days_remaining > 90) return false;
    return true;
  });

  const urgencyColor = (days: number) => {
    if (days <= 0) return "text-taura-red";
    if (days <= 30) return "text-taura-red";
    if (days <= 90) return "text-taura-orange";
    return "text-taura-green";
  };

  return (
    <div className="p-5 pb-10">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Scadenze</h1>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {filtered.length} scadenze • {filtered.filter((d) => d.days_remaining <= 30).length} urgenti
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex bg-secondary rounded-lg border border-border overflow-hidden">
          {(["all", "7d", "30d", "90d"] as FilterTime[]).map((t) => (
            <button
              key={t}
              onClick={() => setFilterTime(t)}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
                filterTime === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "Tutte" : t}
            </button>
          ))}
        </div>
        <div className="flex bg-secondary rounded-lg border border-border overflow-hidden">
          {([
            { k: "all", l: "Tutti" },
            { k: "sponsor", l: "Sponsor" },
            { k: "energy", l: "Energy" },
            { k: "equipment", l: "Equipment" },
            { k: "media", l: "Media" },
          ] as { k: FilterType; l: string }[]).map((t) => (
            <button
              key={t.k}
              onClick={() => setFilterType(t.k)}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
                filterType === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Deadlines list */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Caricamento...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nessuna scadenza trovata. I contratti appariranno qui una volta caricati.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((d) => (
                <div
                  key={d.id}
                  onClick={() => fetchBrief(d)}
                  className={`bg-card rounded-xl p-4 border cursor-pointer transition-all hover:border-primary/30 ${
                    selectedDeadline?.id === d.id ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-bold text-foreground">{d.athlete_name}</span>
                        <span className="text-[11px] text-muted-foreground">•</span>
                        <span className="text-[13px] text-foreground">{d.brand}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{d.contract_type}</span>
                        {d.value && (
                          <span className="text-[11px] font-semibold text-foreground font-mono">
                            €{d.value.toLocaleString("it-IT")}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {new Date(d.end_date).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                    </div>
                    <div className={`text-base font-bold font-mono ${urgencyColor(d.days_remaining)}`}>
                      {d.days_remaining <= 0 ? "Concluso" : `${d.days_remaining}gg`}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Brief panel */}
        {selectedDeadline && (
          <div className="w-[380px] shrink-0">
            <div className="bg-card rounded-xl border border-border p-5 sticky top-5">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[10px]"
                  style={{ background: "linear-gradient(135deg, hsl(170, 100%, 45%, 0.15), hsl(220, 100%, 65%, 0.15))" }}
                >
                  ◈
                </div>
                <span className="text-[13px] font-bold text-foreground">AI Brief</span>
              </div>

              <div className="mb-4">
                <div className="text-sm font-bold text-foreground mb-1">
                  {selectedDeadline.athlete_name} × {selectedDeadline.brand}
                </div>
                <div className="flex gap-2 items-center">
                  <Pill variant={selectedDeadline.days_remaining <= 30 ? "red" : selectedDeadline.days_remaining <= 90 ? "orange" : "green"}>
                    {selectedDeadline.days_remaining <= 0 ? "Concluso" : `${selectedDeadline.days_remaining}gg`}
                  </Pill>
                  {selectedDeadline.value && (
                    <span className="text-[12px] font-bold font-mono text-foreground">
                      €{selectedDeadline.value.toLocaleString("it-IT")}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-[12px] text-muted-foreground leading-relaxed">
                {briefLoading && !aiBrief ? (
                  <div className="flex gap-1 py-4 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                ) : aiBrief ? (
                  <div className="[&_strong]:text-foreground [&_strong]:font-semibold [&_h1]:text-foreground [&_h1]:font-bold [&_h1]:text-sm [&_h1]:mb-2 [&_h2]:text-foreground [&_h2]:font-semibold [&_h2]:text-[12px] [&_h2]:mb-1.5 [&_h3]:text-foreground [&_h3]:font-semibold [&_h3]:text-[11px] [&_h3]:mb-1 [&_ul]:pl-3 [&_ul]:space-y-0.5 [&_ol]:pl-3 [&_ol]:space-y-0.5 [&_li]:leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{aiBrief}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-muted-foreground/60">Clicca una scadenza per generare il brief AI.</span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => navigate(`/contracts/${selectedDeadline.id}`)}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-[12px] font-bold cursor-pointer hover:opacity-90 transition-opacity"
                >
                  Vai al contratto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeadlinesPage;
