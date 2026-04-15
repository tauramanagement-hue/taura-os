import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface CalendarDeliverable {
  id: string;
  campaign_id: string;
  campaign_name: string;
  brand: string;
  athlete_name: string;
  content_type: string;
  scheduled_date: string;
  content_approved: boolean;
  post_confirmed: boolean;
  ai_overview: string | null;
  description: string | null;
}

const contentEmoji: Record<string, string> = {
  post: "📸", reel: "🎬", tiktok: "📱", story: "⏳", youtube: "▶️",
};

const hashColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 60%, 55%)`;
};

const DeliverableCalendar = () => {
  const [month, setMonth] = useState(() => new Date());
  const [deliverables, setDeliverables] = useState<CalendarDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CalendarDeliverable | null>(null);

  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDay = new Date(year, mo, 1);
  const lastDay = new Date(year, mo + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const monthStart = `${year}-${String(mo + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(mo + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;

  useEffect(() => {
    fetchDeliverables();
  }, [monthStart, monthEnd]);

  const fetchDeliverables = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("campaign_deliverables")
      .select("id, campaign_id, content_type, scheduled_date, content_approved, post_confirmed, ai_overview, description, athlete_id, athletes(full_name), campaigns(name, brand)")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd)
      .order("scheduled_date");

    if (data) {
      setDeliverables(data.map((d: any) => ({
        id: d.id,
        campaign_id: d.campaign_id,
        campaign_name: d.campaigns?.name || "—",
        brand: d.campaigns?.brand || "—",
        athlete_name: d.athletes?.full_name || "Non assegnato",
        content_type: d.content_type,
        scheduled_date: d.scheduled_date,
        content_approved: Boolean(d.content_approved),
        post_confirmed: Boolean(d.post_confirmed),
        ai_overview: d.ai_overview,
        description: d.description,
      })));
    }
    setLoading(false);
  };

  const toggleField = async (del: CalendarDeliverable, field: "content_approved" | "post_confirmed") => {
    const newVal = field === "content_approved" ? !del.content_approved : !del.post_confirmed;
    await supabase.from("campaign_deliverables").update({ [field]: newVal }).eq("id", del.id);
    setDeliverables(prev => prev.map(d => d.id === del.id ? { ...d, [field]: newVal } : d));
    if (selected?.id === del.id) setSelected({ ...selected, [field]: newVal });
  };

  const byDay = useMemo(() => {
    const map: Record<string, CalendarDeliverable[]> = {};
    deliverables.forEach(d => {
      if (!map[d.scheduled_date]) map[d.scheduled_date] = [];
      map[d.scheduled_date].push(d);
    });
    return map;
  }, [deliverables]);

  const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (isMobile) {
    const sortedDays = Object.keys(byDay).sort();
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setMonth(new Date(year, mo - 1, 1))} className="text-[12px] text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1">←</button>
          <span className="text-sm font-bold text-foreground">{monthNames[mo]} {year}</span>
          <button onClick={() => setMonth(new Date(year, mo + 1, 1))} className="text-[12px] text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1">→</button>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Caricamento...</div>
        ) : sortedDays.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nessun deliverable in {monthNames[mo]}</div>
        ) : (
          sortedDays.map(dayKey => (
            <div key={dayKey}>
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">{new Date(dayKey).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" })}</div>
              <div className="flex flex-col gap-1">
                {byDay[dayKey].map(d => (
                  <div key={d.id} onClick={() => setSelected(d)} className="bg-secondary rounded-lg border border-border p-2 cursor-pointer hover:border-primary/30 flex items-center gap-2">
                    <span className="text-xs">{contentEmoji[d.content_type] || "📄"}</span>
                    <span className="text-[11px] text-foreground font-semibold flex-1">{d.athlete_name}</span>
                    <span className="text-[10px] text-muted-foreground">{d.brand}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(new Date(year, mo - 1, 1))} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1 rounded-lg bg-secondary border border-border">←</button>
        <span className="text-[15px] font-bold text-foreground">{monthNames[mo]} {year}</span>
        <button onClick={() => setMonth(new Date(year, mo + 1, 1))} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1 rounded-lg bg-secondary border border-border">→</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Caricamento...</div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
          {dayNames.map(d => (
            <div key={d} className="bg-card px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="bg-card min-h-[90px]" />;
            const dateStr = `${year}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const dayDels = byDay[dateStr] || [];
            const isPast = new Date(dateStr) < new Date(todayStr);

            return (
              <div key={idx} className={`bg-card min-h-[90px] p-1 relative ${isToday ? "ring-1 ring-primary ring-inset" : ""}`}>
                <div className={`text-[10px] font-semibold mb-0.5 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</div>
                <div className="flex flex-col gap-0.5">
                  {dayDels.slice(0, 3).map(d => {
                    const late = isPast && !d.post_confirmed;
                    return (
                      <div
                        key={d.id}
                        onClick={() => setSelected(d)}
                        className={`rounded px-1 py-0.5 text-[9px] font-semibold truncate cursor-pointer transition-all hover:opacity-80 border ${
                          late ? "border-taura-red/50 text-taura-red" : d.content_approved ? "border-taura-green/40" : "border-transparent"
                        } ${d.post_confirmed ? "opacity-50" : ""}`}
                        style={{ backgroundColor: `${hashColor(d.campaign_id)}20`, color: hashColor(d.campaign_id) }}
                      >
                        {d.athlete_name.split(" ")[0]} {contentEmoji[d.content_type] || ""}
                      </div>
                    );
                  })}
                  {dayDels.length > 3 && (
                    <div className="text-[8px] text-muted-foreground text-center">+{dayDels.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="bg-card rounded-xl border border-border p-5 w-[400px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">{selected.athlete_name}</h3>
              <button onClick={() => setSelected(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
              <span className="text-muted-foreground">{selected.brand}</span>
              <span className="text-muted-foreground">{selected.campaign_name}</span>
              <span>{contentEmoji[selected.content_type] || ""} {selected.content_type}</span>
              <span className="font-mono text-muted-foreground">{new Date(selected.scheduled_date).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>
            {selected.ai_overview && (
              <div className="text-[11px] text-foreground bg-secondary rounded-lg p-3 border border-border leading-relaxed mb-3">{selected.ai_overview}</div>
            )}
            <div className="flex gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => toggleField(selected, "content_approved")} className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors ${selected.content_approved ? "bg-taura-green" : "bg-muted"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${selected.content_approved ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-[11px] text-muted-foreground">{selected.content_approved ? "Approvato" : "Approva"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleField(selected, "post_confirmed")} className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors ${selected.post_confirmed ? "bg-primary" : "bg-muted"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${selected.post_confirmed ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-[11px] text-muted-foreground">{selected.post_confirmed ? "Pubblicato" : "Pubblica"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliverableCalendar;
