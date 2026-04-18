/**
 * AI Lab — dedicated chat UI for training/testing the QIE pipeline.
 *
 * Hidden from sidebar. Access via direct URL /ai-lab.
 * Uses qie-router in lab_mode to get full debug payload (domain, score,
 * level, matched rules, pre-computed QIE block, response time).
 *
 * Purpose: iterate on the assistant's behavior in isolation, without
 * being distracted by the rest of the product.
 */

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { supabase } from "@/integrations/supabase/client";

type Debug = {
  query_id: string;
  domain: string;
  domain_confidence: number;
  matched_rules: string[];
  entities: Record<string, unknown>;
  chain: string[];
  score: number;
  level: "L1" | "L2" | "L3";
  model: string;
  reasons: string[];
  override?: string;
  qie_summary: string;
  qie_rendered: string;
  needs_clarification?: string;
  response_ms: number;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  debug?: Debug;
};

const QIE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qie-router`;

const levelColor = (level: string) => {
  if (level === "L3") return "hsl(var(--primary))";
  if (level === "L2") return "hsl(262 83% 58%)";
  return "hsl(var(--muted-foreground))";
};

const presets = [
  "Chi sono i miei top 5 atleti per monte contratti?",
  "Contratti in scadenza nei prossimi 30 giorni",
  "Ho conflitti di esclusiva attivi?",
  "Qual è il monte contratti Q1 2026?",
  "Dammi un riepilogo della pipeline",
  "Quanto ho fatturato di commissioni quest'anno?",
];

const AILab = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId] = useState(() => `lab:${crypto.randomUUID()}`);
  const [showDebug, setShowDebug] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessione scaduta. Rifai il login.");

      const res = await fetch(QIE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({
          thread_id: threadId,
          lab_mode: true,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.response || "(risposta vuota)",
          debug: json.debug as Debug,
        },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: showDebug ? "minmax(0, 1fr) 420px" : "minmax(0, 1fr)",
        gap: 16,
        padding: 20,
        height: "100vh",
        background: "hsl(var(--background))",
      }}
    >
      {/* Chat column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 10,
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={15} style={{ color: "hsl(var(--primary))" }} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "hsl(var(--foreground))",
              }}
            >
              Taura AI Lab
            </span>
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 3,
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
                border: "1px solid hsl(var(--primary) / 0.25)",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              INTERNAL
            </span>
          </div>
          <button
            onClick={() => setShowDebug((v) => !v)}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 4,
              background: showDebug ? "hsl(var(--primary) / 0.1)" : "hsl(var(--muted))",
              color: showDebug ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
              border: `1px solid ${showDebug ? "hsl(var(--primary) / 0.3)" : "hsl(var(--border))"}`,
              cursor: "pointer",
            }}
          >
            Debug {showDebug ? "ON" : "OFF"}
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messages.length === 0 && (
            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
              <p style={{ marginBottom: 10 }}>
                Lab dedicato per testare il router QIE. Scegli un preset o scrivi una query.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {presets.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 4,
                      background: "hsl(var(--muted))",
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--foreground))",
                      cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}
            >
              {m.role === "user" ? (
                <div
                  style={{
                    maxWidth: "75%",
                    background: "hsl(var(--primary) / 0.1)",
                    border: "1px solid hsl(var(--primary) / 0.2)",
                    borderRadius: "10px 10px 2px 10px",
                    padding: "9px 13px",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {m.content}
                </div>
              ) : (
                <div style={{ maxWidth: "92%", fontSize: 13, lineHeight: 1.55, color: "hsl(var(--foreground))" }}>
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_li]:my-1 [&_strong]:text-foreground [&_strong]:font-semibold">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{m.content}</ReactMarkdown>
                  </div>
                  {m.debug && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: "var(--font-mono)",
                          padding: "2px 7px",
                          borderRadius: 3,
                          background: `${levelColor(m.debug.level)} / 0.12`,
                          color: levelColor(m.debug.level),
                          border: `1px solid ${levelColor(m.debug.level)}`,
                          letterSpacing: "0.04em",
                          fontWeight: 600,
                        }}
                      >
                        {m.debug.level} · {m.debug.model}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: "var(--font-mono)",
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: "hsl(var(--muted))",
                          color: "hsl(var(--muted-foreground))",
                          border: "1px solid hsl(var(--border))",
                        }}
                      >
                        {m.debug.domain} · score {m.debug.score} · {m.debug.response_ms}ms
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <span style={{ display: "inline-flex", gap: 4 }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <span
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "hsl(var(--primary))",
                      animation: "pulse 1.2s ease-in-out infinite",
                      animationDelay: `${d}s`,
                    }}
                  />
                ))}
              </span>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid hsl(var(--border))" }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "hsl(var(--muted))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              padding: "0 10px",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              placeholder="Query di test (IT o EN)…"
              style={{
                flex: 1,
                height: 38,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13,
                color: "hsl(var(--foreground))",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: "none",
                cursor: input.trim() && !isLoading ? "pointer" : "default",
                background: input.trim() && !isLoading ? "hsl(var(--primary))" : "transparent",
                color: input.trim() && !isLoading ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Debug column */}
      {showDebug && (
        <div
          style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 10,
            overflow: "auto",
            padding: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.55,
            color: "hsl(var(--foreground))",
          }}
        >
          {(() => {
            const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.debug);
            const d = lastAssistant?.debug;
            if (!d)
              return (
                <div style={{ color: "hsl(var(--muted-foreground))" }}>
                  Invia una query per vedere il routing breakdown.
                </div>
              );
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <DebugBlock label="Query ID" value={d.query_id} />
                <DebugBlock label="Domain" value={`${d.domain}  (confidence ${d.domain_confidence.toFixed(2)})`} />
                <DebugBlock label="Chain" value={d.chain.join(" → ") || "(none)"} />
                <DebugBlock
                  label="Matched rules"
                  value={d.matched_rules.length ? d.matched_rules.map((r) => `• ${r}`).join("\n") : "(none)"}
                />
                <DebugBlock
                  label="Entities"
                  value={JSON.stringify(d.entities, null, 2)}
                />
                <DebugBlock label="Score" value={String(d.score)} />
                <DebugBlock label="Level → Model" value={`${d.level}  →  ${d.model}`} />
                <DebugBlock
                  label="Scoring reasons"
                  value={d.reasons.length ? d.reasons.map((r) => `• ${r}`).join("\n") : "(none)"}
                />
                {d.override && <DebugBlock label="Override" value={d.override} />}
                <DebugBlock label="Response time" value={`${d.response_ms} ms`} />
                <DebugBlock label="QIE summary" value={d.qie_summary || "(empty)"} />
                {d.needs_clarification && (
                  <DebugBlock label="Needs clarification" value={d.needs_clarification} />
                )}
                <DebugBlock
                  label="QIE rendered block (injected to LLM)"
                  value={d.qie_rendered || "(empty)"}
                />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

const DebugBlock = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "hsl(var(--muted-foreground))",
        marginBottom: 4,
      }}
    >
      {label.toUpperCase()}
    </div>
    <pre
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        background: "hsl(var(--muted) / 0.5)",
        border: "1px solid hsl(var(--border))",
        borderRadius: 4,
        padding: "6px 8px",
        fontSize: 10.5,
        color: "hsl(var(--foreground))",
      }}
    >
      {value}
    </pre>
  </div>
);

export default AILab;
