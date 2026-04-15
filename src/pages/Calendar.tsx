import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, ArrowUpRight, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type EventType = "deliverable" | "contract";

interface CalEvent {
  id: string;
  type: EventType;
  date: string;
  day: number;
  title: string;
  subtitle: string;
  detail?: string;
  confirmed?: boolean;
  contractId?: string;
  campaignId?: string;
}

const MONTHS     = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const DAYS_SHORT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const DAYS_FULL  = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

const evColor = (e: CalEvent) =>
  e.type === "contract" ? "#f43f5e" : e.confirmed ? "#6b7280" : "#14b8a6";

const CalendarPage = () => {
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents]           = useState<CalEvent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [marking, setMarking]         = useState<string | null>(null);
  const [aiPromptEvent, setAiPromptEvent] = useState<string | null>(null);

  const year        = currentDate.getFullYear();
  const month       = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;
  const today       = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

  /* ── fetch ── */
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const pad   = (n: number) => String(n).padStart(2, "0");
    const start = `${year}-${pad(month + 1)}-01`;
    const end   = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;

    const [delRes, conRes] = await Promise.all([
      supabase
        .from("campaign_deliverables")
        .select("id, scheduled_date, content_type, post_confirmed, athletes(full_name), campaign_id, campaigns(id, brand)")
        .gte("scheduled_date", start).lte("scheduled_date", end).order("scheduled_date"),
      supabase
        .from("contracts")
        .select("id, end_date, brand, athletes(full_name)")
        .gte("end_date", start).lte("end_date", end).order("end_date"),
    ]);

    const all: CalEvent[] = [];

    (delRes.data || []).forEach((d: any) => {
      if (!d.scheduled_date) return;
      all.push({
        id: d.id, type: "deliverable",
        date: d.scheduled_date,
        day: new Date(d.scheduled_date).getDate(),
        title: d.athletes?.full_name || "N/D",
        subtitle: d.campaigns?.brand || "N/D",
        detail: d.content_type || "",
        confirmed: d.post_confirmed ?? false,
        campaignId: d.campaign_id,
      });
    });

    (conRes.data || []).forEach((c: any) => {
      if (!c.end_date) return;
      all.push({
        id: c.id, type: "contract",
        date: c.end_date,
        day: new Date(c.end_date).getDate(),
        title: c.athletes?.full_name || "N/D",
        subtitle: c.brand || "N/D",
        contractId: c.id,
      });
    });

    setEvents(all);
    setLoading(false);
  }, [year, month, daysInMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  /* ── derived ── */
  const byDay = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    events.forEach(e => {
      if (!map.has(e.day)) map.set(e.day, []);
      map.get(e.day)!.push(e);
    });
    return map;
  }, [events]);

  const selectedEvents = useMemo(
    () => selectedDay != null ? (byDay.get(selectedDay) || []) : [],
    [byDay, selectedDay],
  );

  const upcomingEvents = useMemo(() => {
    const fromDay = isThisMonth ? today.getDate() : 1;
    return events
      .filter(e => e.day >= fromDay)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [events, isThisMonth]);

  const selectedDowLabel = useMemo(() => {
    if (selectedDay == null) return "";
    const dow = new Date(year, month, selectedDay).getDay();
    return DAYS_FULL[dow === 0 ? 6 : dow - 1];
  }, [selectedDay, year, month]);

  /* ── actions ── */
  const togglePublished = async (e: CalEvent) => {
    setMarking(e.id);
    const next = !e.confirmed;
    const { error } = await supabase
      .from("campaign_deliverables")
      .update({ post_confirmed: next })
      .eq("id", e.id);
    if (error) {
      toast.error("Errore aggiornamento");
    } else {
      toast.success(next ? "Segnato come pubblicato" : "Rimosso da pubblicati");
      setEvents(prev => prev.map(ev => ev.id === e.id ? { ...ev, confirmed: next } : ev));
    }
    setMarking(null);
  };

  /* ── event row (defined before return) ── */
  const renderEvent = (e: CalEvent, showDayLabel = false) => {
    const color = evColor(e);
    return (
      <div key={e.id} style={{ marginBottom: 14 }}>
        {showDayLabel && (
          <div style={{
            fontSize: 9, color: "hsl(var(--muted-foreground))",
            fontFamily: "var(--font-mono)", marginBottom: 5,
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}>
            {e.day} {MONTHS[month].slice(0, 3)}
          </div>
        )}
        <div style={{ borderLeft: `2px solid ${color}`, paddingLeft: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 1 }}>
            {e.title}
          </div>
          <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
            {e.subtitle}{e.detail && e.type === "deliverable" ? ` · ${e.detail}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
              textTransform: "uppercase", color, fontFamily: "var(--font-mono)",
            }}>
              {e.type === "contract" ? "In scadenza" : e.confirmed ? "Pubblicato" : "Da pubblicare"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {e.type === "deliverable" && (
              <>
                <button
                  onClick={() => togglePublished(e)}
                  disabled={marking === e.id}
                  style={{
                    height: 22, padding: "0 8px", borderRadius: 4,
                    fontSize: 9, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${e.confirmed ? "hsl(var(--border))" : "#14b8a640"}`,
                    background: e.confirmed ? "hsl(var(--secondary))" : "#14b8a612",
                    color: e.confirmed ? "hsl(var(--muted-foreground))" : "#14b8a6",
                    opacity: marking === e.id ? 0.4 : 1,
                    display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  {e.confirmed
                    ? <><CheckCircle2 size={8} /> Fatto</>
                    : <><Clock size={8} /> Segna</>
                  }
                </button>
                <button
                  onClick={() => navigate(`/campaigns`)}
                  style={{
                    height: 22, padding: "0 8px", borderRadius: 4,
                    fontSize: 9, fontWeight: 600, cursor: "pointer",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--secondary))",
                    color: "hsl(var(--muted-foreground))",
                    display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  <ExternalLink size={8} /> Deliverable
                </button>
                <button
                  onClick={() => {
                    const prompt = `Genera un messaggio da inviare a ${e.title} per la campagna ${e.subtitle} riguardo al deliverable ${e.detail || "contenuto"} programmato per il ${e.day} ${MONTHS[month]}. Il messaggio deve includere: recap delle specifiche di pubblicazione, tempistiche, e un reminder cordiale. Tono professionale ma amichevole.`;
                    // Open chat panel with pre-filled prompt
                    const chatToggle = document.querySelector<HTMLButtonElement>('[data-chat-toggle]');
                    if (chatToggle) chatToggle.click();
                    setTimeout(() => {
                      const chatInput = document.querySelector<HTMLInputElement>('[data-chat-input]');
                      if (chatInput) {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                        nativeInputValueSetter?.call(chatInput, prompt);
                        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                        chatInput.focus();
                      }
                    }, 300);
                  }}
                  style={{
                    height: 22, padding: "0 8px", borderRadius: 4,
                    fontSize: 9, fontWeight: 600, cursor: "pointer",
                    border: "1px solid hsl(var(--primary) / 0.3)",
                    background: "hsl(var(--primary) / 0.08)",
                    color: "hsl(var(--primary))",
                    display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  <MessageSquare size={8} /> Chiedi all'AI
                </button>
              </>
            )}
            {e.type === "contract" && (
              <button
                onClick={() => navigate(`/contracts/${e.contractId}`)}
                style={{
                  height: 22, padding: "0 8px", borderRadius: 4,
                  fontSize: 9, fontWeight: 600, cursor: "pointer",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--secondary))",
                  color: "hsl(var(--muted-foreground))",
                  display: "flex", alignItems: "center", gap: 3,
                }}
              >
                Vedi contratto <ArrowUpRight size={8} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ── render ── */
  return (
    <div style={{ padding: "20px 24px 40px" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 600,
          letterSpacing: "-0.03em", color: "hsl(var(--foreground))", lineHeight: 1.15,
        }}>Calendario</h1>
        <p style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", marginTop: 2, fontFamily: "var(--font-mono)" }}>
          {MONTHS[month]} {year} · {events.length} eventi
        </p>
      </div>

      {/* Layout */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* ── GRIGLIA ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Navigazione mese */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button
              onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid hsl(var(--border))", background: "transparent",
                cursor: "pointer", color: "hsl(var(--muted-foreground))",
              }}
            ><ChevronLeft size={14} /></button>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700,
                letterSpacing: "-0.02em", color: "hsl(var(--foreground))",
              }}>
                {MONTHS[month]} {year}
              </span>
              {!isThisMonth && (
                <button
                  onClick={() => { setCurrentDate(new Date()); setSelectedDay(today.getDate()); }}
                  style={{
                    height: 24, padding: "0 10px", borderRadius: 5,
                    fontSize: 10, fontWeight: 600, cursor: "pointer",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--secondary))",
                    color: "hsl(var(--muted-foreground))",
                    fontFamily: "var(--font-mono)",
                  }}
                >Oggi</button>
              )}
            </div>

            <button
              onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid hsl(var(--border))", background: "transparent",
                cursor: "pointer", color: "hsl(var(--muted-foreground))",
              }}
            ><ChevronRight size={14} /></button>
          </div>

          {/* Griglia */}
          <div style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 14, overflow: "hidden",
          }}>
            {/* Intestazioni giorni */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid hsl(var(--border))" }}>
              {DAYS_SHORT.map(d => (
                <div key={d} style={{
                  textAlign: "center", padding: "10px 0 8px",
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "hsl(var(--muted-foreground))",
                  fontFamily: "var(--font-mono)",
                }}>{d}</div>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                Caricamento...
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {/* Offset */}
                {Array.from({ length: offset }).map((_, i) => {
                  const col = i % 7;
                  return (
                    <div key={`gap${i}`} style={{
                      minHeight: 88,
                      borderRight: col < 6 ? "1px solid hsl(var(--border) / 0.4)" : "none",
                      borderBottom: "1px solid hsl(var(--border) / 0.4)",
                      background: "hsl(var(--muted) / 0.25)",
                    }} />
                  );
                })}

                {/* Celle giorno */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day     = i + 1;
                  const dayEvts = byDay.get(day) || [];
                  const isToday = isThisMonth && day === today.getDate();
                  const isSel   = day === selectedDay;
                  const isPast  = isThisMonth && day < today.getDate();
                  const col     = (offset + i) % 7;
                  const totalCells = offset + daysInMonth;
                  const lastRowStart = Math.floor((totalCells - 1) / 7) * 7;
                  const isLastRow = (offset + i) >= lastRowStart;

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(isSel ? null : day)}
                      style={{
                        minHeight: 88, padding: "8px 8px 6px", cursor: "pointer",
                        transition: "background 0.12s",
                        background: isSel
                          ? "hsl(var(--primary) / 0.09)"
                          : isPast
                          ? "hsl(var(--muted) / 0.2)"
                          : "transparent",
                        borderRight: col < 6 ? "1px solid hsl(var(--border) / 0.4)" : "none",
                        borderBottom: !isLastRow ? "1px solid hsl(var(--border) / 0.4)" : "none",
                        boxShadow: isSel ? "inset 0 0 0 1.5px hsl(var(--primary) / 0.35)" : "none",
                      }}
                      onMouseEnter={el => {
                        if (!isSel) el.currentTarget.style.background = "hsl(var(--secondary))";
                      }}
                      onMouseLeave={el => {
                        el.currentTarget.style.background = isSel
                          ? "hsl(var(--primary) / 0.09)"
                          : isPast ? "hsl(var(--muted) / 0.2)" : "transparent";
                      }}
                    >
                      {/* Numero giorno */}
                      <div style={{ marginBottom: 5 }}>
                        {isToday ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 22, height: 22, borderRadius: "50%",
                            background: "hsl(var(--primary))",
                            color: "hsl(var(--primary-foreground))",
                            fontSize: 11, fontWeight: 800, fontFamily: "var(--font-mono)",
                          }}>{day}</span>
                        ) : (
                          <span style={{
                            fontSize: 11,
                            fontWeight: isSel ? 700 : 400,
                            fontFamily: "var(--font-mono)",
                            color: isSel
                              ? "hsl(var(--foreground))"
                              : isPast
                              ? "hsl(var(--muted-foreground) / 0.5)"
                              : "hsl(var(--muted-foreground))",
                          }}>{day}</span>
                        )}
                      </div>

                      {/* Pill eventi */}
                      {dayEvts.slice(0, 3).map((e, j) => {
                        const c = evColor(e);
                        return (
                          <div key={j} style={{
                            fontSize: 9, fontWeight: 600, color: c,
                            background: e.type === "contract" ? "#f43f5e12" : e.confirmed ? "hsl(var(--secondary))" : "#14b8a612",
                            borderRadius: 4, padding: "2px 5px", marginBottom: 2,
                            overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                          }}>
                            {e.title.split(" ")[0]}
                            <span style={{ opacity: 0.55, fontWeight: 400 }}>
                              {" "}{e.subtitle.length > 8 ? e.subtitle.slice(0, 8) + "…" : e.subtitle}
                            </span>
                          </div>
                        );
                      })}
                      {dayEvts.length > 3 && (
                        <div style={{ fontSize: 8, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
                          +{dayEvts.length - 3}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── PANNELLO LATERALE ── */}
        <div style={{ width: 232, flexShrink: 0 }}>

          {selectedDay != null ? (
            <>
              {/* Intestazione giorno */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)", marginBottom: 2 }}>
                  {selectedDowLabel}
                </div>
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 800,
                  color: "hsl(var(--foreground))", lineHeight: 1,
                }}>
                  {selectedDay}
                  <span style={{ fontSize: 14, fontWeight: 400, color: "hsl(var(--muted-foreground))", marginLeft: 8, fontFamily: "var(--font-sans)" }}>
                    {MONTHS[month]}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  style={{
                    marginTop: 8, fontSize: 10, color: "hsl(var(--muted-foreground))",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  <ChevronLeft size={10} /> Tutti gli eventi
                </button>
              </div>

              {selectedEvents.length === 0 ? (
                <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
                  Nessun evento.
                </p>
              ) : (
                selectedEvents.map(e => renderEvent(e))
              )}
            </>
          ) : (
            <>
              {/* Prossimi eventi */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))", letterSpacing: "-0.01em", marginBottom: 2 }}>
                  Prossimi eventi
                </div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
                  {isThisMonth ? "Da oggi" : `${MONTHS[month]} ${year}`}
                </div>
              </div>

              {upcomingEvents.length === 0 ? (
                <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
                  Nessun evento in programma.
                </p>
              ) : (
                upcomingEvents.map(e => renderEvent(e, true))
              )}
            </>
          )}

          {/* Legenda */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid hsl(var(--border))" }}>
            {[
              { color: "#14b8a6", label: "Da pubblicare" },
              { color: "#6b7280", label: "Pubblicato" },
              { color: "#f43f5e", label: "Contratto in scadenza" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
