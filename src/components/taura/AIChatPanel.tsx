import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, X, Maximize2, Minimize2, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgencyContext } from "@/hooks/useAgencyContext";
import { sha256Hex, getFileExt } from "@/lib/fileHash";
import { InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/taura/SocialIcons";

type Msg = { role: "user" | "assistant"; content: string; modelTier?: string; modelName?: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const getModelLabel = (tier: string, modelName: string): string => {
  if (tier === "L1") return "Gemini Flash";
  if (tier === "L3") return "Claude Opus";
  // L2: mix — derive from model name
  if (modelName?.includes("gemini")) return "Gemini Pro";
  if (modelName?.includes("sonnet")) return "Claude Sonnet";
  return tier;
};

const quickActions = [
  "Scadenze urgenti",
  "Conflitti attivi",
  "Riepilogo roster",
];

export const AIChatPanel = ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => {
  const { user } = useAuth();
  const { labels } = useAgencyContext();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Ciao! Sono **Taura AI**. Chiedimi qualsiasi cosa su roster, contratti o scadenze." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modelTier, setModelTier] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Persist a message to the chat_messages table
  const persistMessage = async (role: "user" | "assistant", content: string) => {
    try {
      await supabase.from("chat_messages").insert({ role, content });
    } catch { /* best-effort, non-blocking */ }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Persist user message to DB
    persistMessage("user", text.trim());

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session?.access_token) {
        setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Sessione scaduta. Effettua di nuovo il login." }]);
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
          },
          body: JSON.stringify({
            messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          }),
        }
      );

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        const msg = response.status === 401
          ? "⚠️ Sessione scaduta. Effettua di nuovo il login."
          : (errData.error || "Errore di connessione.");
        throw new Error(msg);
      }

      const tier = response.headers.get("X-Model-Tier") ?? "";
      const modelName = response.headers.get("X-Model-Name") ?? "";
      if (tier) setModelTier(tier);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      const STREAM_TIMEOUT = 30000;
      const MAX_BUFFER = 100 * 1024; // 100KB

      while (!streamDone) {
        const readPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), STREAM_TIMEOUT)
        );
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await Promise.race([readPromise, timeoutPromise]);
        } catch {
          reader.cancel();
          if (!assistantSoFar) throw new Error("Timeout: il server non ha risposto entro 30 secondi.");
          break;
        }
        const { done, value } = result;
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        if (textBuffer.length > MAX_BUFFER) {
          reader.cancel();
          break;
        }

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Persist assistant response + attach model info
      if (assistantSoFar) {
        persistMessage("assistant", assistantSoFar);
        if (tier) {
          setMessages(prev => prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant"
              ? { ...m, modelTier: tier, modelName }
              : m
          ));
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Errore"}` }]);
    }
    setIsLoading(false);
  };

  const [pendingConfirmation, setPendingConfirmation] = useState<{
    filePath: string;
    fileName: string;
    cacheKey: string;
    newAthletes: {
      name: string; sport: string; original_name?: string;
      category?: string; nationality?: string;
      instagram_handle?: string; instagram_followers?: number;
      tiktok_handle?: string; tiktok_followers?: number;
      youtube_handle?: string; youtube_followers?: number;
    }[];
  } | null>(null);
  const [selectedAthletes, setSelectedAthletes] = useState<Record<string, boolean>>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsLoading(true);
    const userMsg: Msg = { role: "user", content: `📎 Carico il file "${file.name}" (${(file.size / 1024).toFixed(0)} KB)` };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data: profile, error: profileError } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (profileError || !profile?.agency_id) throw new Error("Completa l'onboarding prima di caricare file in chat.");

      const hash = await sha256Hex(file);
      const ext = getFileExt(file.name) || "pdf";
      const filePath = `${profile.agency_id}/chat-uploads/${hash}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, file, { upsert: true });
      if (uploadError) {
        throw uploadError;
      }

      // Dry run first
      const { data: dryResult, error: dryErr } = await supabase.functions.invoke("parse-contract", {
        body: { file_url: filePath, original_name: file.name, source: "chat_upload", dry_run: true },
      });

      if (dryErr) throw new Error(dryErr.message || "Errore parsing");

      if (dryResult?.needs_confirmation && dryResult.new_athletes?.length > 0) {
        const sel: Record<string, boolean> = {};
        dryResult.new_athletes.forEach((a: any) => { sel[a.name] = true; });
        setSelectedAthletes(sel);
        setPendingConfirmation({ filePath, fileName: file.name, cacheKey: dryResult.cache_key, newAthletes: dryResult.new_athletes });
        setMessages(prev => [...prev, { role: "assistant", content: `🔍 Rilevati **${dryResult.new_athletes.length}** nuovi talent. Conferma nel popup per indicizzare.` }]);
        setIsLoading(false);
        return;
      }

      await finalizeChatUpload(filePath, file.name, dryResult?.cache_key);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Errore nel caricamento file"}` }]);
    }
    setIsLoading(false);
  };

  const finalizeChatUpload = async (filePath: string, fileName: string, cacheKey?: string, confirmedAthletes?: { name: string; sport: string }[]) => {
    setIsLoading(true);
    try {
      const { data: parsed, error: parseError } = await supabase.functions.invoke("parse-contract", {
        body: {
          file_url: filePath, original_name: fileName, source: "chat_upload",
          ...(cacheKey ? { cache_key: cacheKey } : {}),
          ...(confirmedAthletes ? { confirmed_athletes: confirmedAthletes } : {}),
        },
      });
      if (parseError) throw new Error(parseError.message || "Errore parsing");
      if (!parsed?.success) throw new Error(parsed?.error || "Indicizzazione non completata");

      const summary = parsed.document_type === "brief"
        ? `✅ Brief indicizzato: campagna **${parsed.campaign_name || "N/D"}** creata con **${parsed.deliverables_count || 0}** deliverable.`
        : `✅ Contratto indicizzato: campagna **${parsed.campaign_name || "N/D"}**, contratti **${parsed.contracts_created || 1}**, deliverable **${parsed.deliverables_count || 0}**${parsed.athletes_created ? `, nuovi talent **${parsed.athletes_created}**` : ""}.`;
      setMessages(prev => [...prev, { role: "assistant", content: summary }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Errore"}` }]);
    }
    setIsLoading(false);
  };

  const cancelPendingChatUpload = async () => {
    if (!pendingConfirmation) return;
    const filePath = pendingConfirmation.filePath;
    setPendingConfirmation(null);
    setSelectedAthletes({});
    if (fileInputRef.current) fileInputRef.current.value = "";
    const { error } = await supabase.storage.from("contracts").remove([filePath]);
    if (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Upload annullato, ma non sono riuscito a rimuovere il file temporaneo." }]);
      return;
    }
    setMessages(prev => [...prev, { role: "assistant", content: "✅ Upload annullato: file temporaneo rimosso." }]);
  };

  const handleConfirmAthletes = () => {
    if (!pendingConfirmation) return;
    const confirmed = pendingConfirmation.newAthletes.filter(a => selectedAthletes[a.name]);
    finalizeChatUpload(pendingConfirmation.filePath, pendingConfirmation.fileName, pendingConfirmation.cacheKey, confirmed);
    setPendingConfirmation(null);
  };

  if (collapsed) {
    return (
      <button
        data-chat-toggle
        onClick={onToggle}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
          border: "none",
          cursor: "pointer",
          background: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <Sparkles size={18} />
      </button>
    );
  }

  return (
    <div style={{
      width: expanded ? "100%" : 340,
      position: expanded ? "fixed" : "relative",
      inset: expanded ? 16 : undefined,
      zIndex: expanded ? 50 : undefined,
      flexShrink: 0,
      background: "hsl(var(--background))",
      borderLeft: "1px solid hsl(var(--border) / 0.6)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      {/* New athlete confirmation popup */}
      {pendingConfirmation && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center" onClick={cancelPendingChatUpload}>
          <div
            style={{
              background: "hsl(var(--card))",
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              padding: 20,
              width: 480,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>
              Nuovi talent rilevati
            </h2>
            <p style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
              Modifica i dati e seleziona quali aggiungere al roster:
            </p>
            {pendingConfirmation.newAthletes.map((a, i) => {
              const updateField = (field: string, value: any) => {
                const updated = [...pendingConfirmation.newAthletes];
                updated[i] = { ...updated[i], [field]: value };
                setPendingConfirmation({ ...pendingConfirmation, newAthletes: updated });
              };
              return (
              <div key={i} className="mb-3 p-2.5 rounded-lg bg-secondary border border-border">
                <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer mb-2">
                  <input type="checkbox" checked={selectedAthletes[a.name] ?? true} onChange={(e) => setSelectedAthletes(prev => ({ ...prev, [a.name]: e.target.checked }))} className="accent-primary w-4 h-4" />
                  <input value={a.name} onChange={(e) => updateField("name", e.target.value)} className="font-bold bg-transparent border-b border-border/50 focus:border-primary outline-none text-foreground px-1 flex-1" />
                  <input value={a.sport} onChange={(e) => updateField("sport", e.target.value)} className="text-muted-foreground bg-transparent border-b border-border/50 focus:border-primary outline-none px-1 w-20 text-[11px]" />
                </label>
                <div className="ml-6 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span>🌍</span>
                    <input value={a.nationality || ""} onChange={(e) => updateField("nationality", e.target.value || undefined)} placeholder="Nazionalità" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-full px-0.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🏷️</span>
                    <input value={a.category || ""} onChange={(e) => updateField("category", e.target.value || undefined)} placeholder="Categoria" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-full px-0.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <InstagramIcon size={12} />
                    <input value={a.instagram_handle || ""} onChange={(e) => updateField("instagram_handle", e.target.value || undefined)} placeholder="@handle" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground flex-1 px-0.5" />
                    <input type="number" value={a.instagram_followers || ""} onChange={(e) => updateField("instagram_followers", Number(e.target.value) || undefined)} placeholder="N" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-14 px-0.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TikTokIcon size={12} />
                    <input value={a.tiktok_handle || ""} onChange={(e) => updateField("tiktok_handle", e.target.value || undefined)} placeholder="@handle" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground flex-1 px-0.5" />
                    <input type="number" value={a.tiktok_followers || ""} onChange={(e) => updateField("tiktok_followers", Number(e.target.value) || undefined)} placeholder="N" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-14 px-0.5" />
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <YouTubeIcon size={12} />
                    <input value={a.youtube_handle || ""} onChange={(e) => updateField("youtube_handle", e.target.value || undefined)} placeholder="handle" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground flex-1 px-0.5" />
                    <input type="number" value={a.youtube_followers || ""} onChange={(e) => updateField("youtube_followers", Number(e.target.value) || undefined)} placeholder="N" className="bg-transparent border-b border-border/30 focus:border-primary outline-none text-muted-foreground w-14 px-0.5" />
                  </div>
                </div>
              </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={cancelPendingChatUpload}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 6,
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                  cursor: "pointer",
                  background: "hsl(var(--secondary))",
                  color: "hsl(var(--foreground))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmAthletes}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 6,
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  border: "none",
                }}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "11px 14px",
        borderBottom: "1px solid hsl(var(--border))",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "hsl(var(--primary))",
            boxShadow: "0 0 6px hsl(var(--primary) / 0.6)",
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "hsl(var(--foreground))",
          }}>
            Taura AI
          </span>
          {modelTier && (
            <span style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              padding: "1px 5px",
              borderRadius: 3,
              background: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
              border: "1px solid hsl(var(--border))",
              letterSpacing: "0.05em",
            }}>
              {modelTier}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = "hsl(var(--foreground))"}
            onMouseLeave={e => e.currentTarget.style.color = "hsl(var(--muted-foreground))"}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={onToggle}
            style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = "hsl(var(--foreground))"}
            onMouseLeave={e => e.currentTarget.style.color = "hsl(var(--muted-foreground))"}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "user" ? (
              <div style={{
                maxWidth: "85%",
                background: "hsl(var(--primary) / 0.1)",
                border: "1px solid hsl(var(--primary) / 0.2)",
                borderRadius: "10px 10px 2px 10px",
                padding: "8px 12px",
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-normal)",
                color: "hsl(var(--foreground))",
              }}>
                {m.content}
              </div>
            ) : (
              <div style={{
                maxWidth: "92%",
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-normal)",
                color: "hsl(var(--foreground))",
              }}>
                <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_li]:my-1 [&_strong]:text-foreground [&_strong]:font-semibold [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground">
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{m.content}</ReactMarkdown>
                </div>
                {m.modelTier && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                    <span style={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: m.modelTier === "L3" ? "hsl(var(--primary) / 0.1)" : "hsl(var(--muted))",
                      color: m.modelTier === "L3" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      border: `1px solid ${m.modelTier === "L3" ? "hsl(var(--primary) / 0.3)" : "hsl(var(--border))"}`,
                      letterSpacing: "0.04em",
                    }}>
                      {getModelLabel(m.modelTier, m.modelName ?? "")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div style={{ display: "flex", justifyContent: "flex-start", paddingTop: 2 }}>
            <span style={{ display: "inline-flex", gap: 4 }}>
              {[0, 0.2, 0.4].map((delay, i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "hsl(var(--primary))",
                    display: "inline-block",
                    animation: "pulse 1.2s ease-in-out infinite",
                    animationDelay: `${delay}s`,
                  }}
                />
              ))}
            </span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {messages.length <= 2 && (
        <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {quickActions.map((a, i) => (
            <button
              key={i}
              onClick={() => sendMessage(a)}
              style={{
                fontSize: "var(--text-xs)",
                padding: "4px 10px",
                borderRadius: 4,
                background: "hsl(var(--secondary))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--muted-foreground))",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "hsl(var(--foreground))"; e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "hsl(var(--muted-foreground))"; e.currentTarget.style.borderColor = "hsl(var(--border))"; }}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid hsl(var(--border))",
        background: "hsl(var(--background))",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          background: "hsl(var(--muted))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 6,
          padding: "0 8px",
          transition: "border-color 0.15s",
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.5)"}
          onBlurCapture={e => e.currentTarget.style.borderColor = "hsl(var(--border))"}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "hsl(var(--muted-foreground))",
              flexShrink: 0,
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            title="Carica file"
            onMouseEnter={e => e.currentTarget.style.color = "hsl(var(--foreground))"}
            onMouseLeave={e => e.currentTarget.style.color = "hsl(var(--muted-foreground))"}
          >
            <Plus size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.csv,.xls,.xlsx"
            onChange={handleFileUpload}
          />
          <input
            ref={inputRef}
            data-chat-input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder={labels.chatPlaceholder || "Chiedi a Taura AI..."}
            style={{
              flex: 1,
              height: 36,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "var(--text-sm)",
              color: "hsl(var(--foreground))",
              fontFamily: "var(--font-sans)",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: "none",
              cursor: input.trim() && !isLoading ? "pointer" : "default",
              background: input.trim() && !isLoading ? "hsl(var(--primary))" : "transparent",
              color: input.trim() && !isLoading ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
              flexShrink: 0,
            }}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
