import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Plus, ArrowRight, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Msg =
  | { role: "assistant"; content: string }
  | { role: "user"; content: string }
  | { role: "error"; content: string }
  | { role: "typing" };

const MAX_CHARS = 280;
const PROMPT_LIMIT = 5;

const QUICK_ACTIONS = [
  "Come funziona la gestione contratti?",
  "Quali alert fa l'AI in automatico?",
  "Supporti brief in PPTX?",
  "Quanto costa il piano Professional?",
];

function getOrCreateFingerprint(): string {
  try {
    const KEY = "taura_demo_fp";
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length >= 16) return existing;
    const seed = [
      crypto.randomUUID(),
      navigator.userAgent,
      navigator.language,
      String(screen.width) + "x" + String(screen.height),
      String(new Date().getTimezoneOffset()),
    ].join("|");
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    const fp = Math.abs(hash).toString(16) + "-" + crypto.randomUUID().slice(0, 12);
    localStorage.setItem(KEY, fp);
    return fp;
  } catch {
    return crypto.randomUUID();
  }
}

export default function DemoChatPanel() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Ciao, sono **Taura AI** in modalità demo. Posso spiegarti come funziona il prodotto - contratti, roster, campagne, alert automatici. Chiedimi quello che vuoi.",
    },
  ]);
  const [input, setInput] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number>(PROMPT_LIMIT);
  const [exhausted, setExhausted] = useState(false);
  const fingerprint = useMemo(() => getOrCreateFingerprint(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(promptText?: string) {
    const prompt = (promptText ?? input).trim();
    if (!prompt || isLoading || exhausted) return;
    if (prompt.length > MAX_CHARS) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: prompt }, { role: "typing" }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("demo-chat", {
        body: { prompt, fingerprint, honeypot },
      });

      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        if (status === 429) {
          setExhausted(true);
          setRemaining(0);
          setMessages((m) => [
            ...m.filter((x) => x.role !== "typing"),
            {
              role: "assistant",
              content:
                "Hai esaurito i prompt disponibili per questa demo. Registrati per sbloccare Taura con i tuoi dati.",
            },
          ]);
        } else {
          setMessages((m) => [
            ...m.filter((x) => x.role !== "typing"),
            { role: "error", content: "Qualcosa è andato storto. Riprova tra poco." },
          ]);
        }
        return;
      }

      const response = (data as { response?: string })?.response;
      const remainingAfter = (data as { remaining?: number })?.remaining;
      const done = (data as { exhausted?: boolean })?.exhausted;

      if (!response) {
        setMessages((m) => [
          ...m.filter((x) => x.role !== "typing"),
          { role: "error", content: "Risposta non disponibile. Riprova." },
        ]);
        return;
      }

      setMessages((m) => [
        ...m.filter((x) => x.role !== "typing"),
        { role: "assistant", content: response },
      ]);
      if (typeof remainingAfter === "number") setRemaining(remainingAfter);
      if (done) setExhausted(true);
    } catch {
      setMessages((m) => [
        ...m.filter((x) => x.role !== "typing"),
        { role: "error", content: "Errore di rete. Controlla la connessione e riprova." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const canSend = input.trim().length > 0 && !isLoading && !exhausted && input.length <= MAX_CHARS;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-primary"
            style={{ boxShadow: "0 0 6px hsl(var(--primary) / 0.6)" }}
          />
          <span className="text-[13px] font-semibold tracking-tight text-foreground font-display">
            Taura AI
          </span>
          <span className="text-[9px] font-mono font-medium tracking-wider px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
            GEMINI FLASH
          </span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
          {exhausted ? "0/5" : `${remaining}/5`}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        aria-live="polite"
        aria-atomic="false"
        className="flex-1 overflow-y-auto px-3.5 py-4 flex flex-col gap-2.5"
      >
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
      </div>

      {/* Quick actions - only when ≤2 messages */}
      {messages.length <= 2 && !exhausted && (
        <div className="px-3.5 pb-2.5 flex flex-wrap gap-1.5 shrink-0">
          {QUICK_ACTIONS.map((a, i) => (
            <button
              key={i}
              onClick={() => sendMessage(a)}
              disabled={isLoading}
              className="text-[11px] px-2.5 py-1 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-50"
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Input or exhausted CTA */}
      <div className="px-3 py-2.5 border-t border-border/60 bg-background shrink-0">
        {exhausted ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed px-1">
              <Lock className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              <span>
                Demo limitata a {PROMPT_LIMIT} prompt. Registrati per Taura con i tuoi dati reali.
              </span>
            </div>
            <button
              onClick={() => navigate("/signup")}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-md py-2 text-[12px] font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all"
            >
              Registrati per continuare
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            {/* Honeypot */}
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute opacity-0 pointer-events-none w-0 h-0"
              name="website"
            />
            <div
              className="flex items-center gap-1.5 bg-muted border border-border rounded-md px-2 focus-within:border-primary/50 transition-colors"
            >
              <button
                type="button"
                disabled
                title="Upload file disponibile nella versione completa"
                className="w-7 h-7 flex items-center justify-center text-muted-foreground/40 cursor-not-allowed shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS + 20))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Chiedi a Taura AI..."
                disabled={isLoading}
                className="flex-1 h-9 bg-transparent border-0 outline-none text-[13px] text-foreground placeholder:text-muted-foreground/70 font-sans disabled:opacity-60"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!canSend}
                className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-all ${
                  canSend
                    ? "bg-primary text-primary-foreground hover:shadow-md hover:shadow-primary/30"
                    : "bg-transparent text-muted-foreground"
                }`}
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-0.5">
              <span className="text-[9px] text-muted-foreground/70">
                Demo - solo Q&A sul prodotto
              </span>
              <span
                className={`text-[9px] font-mono tabular-nums ${
                  MAX_CHARS - input.length < 20 ? "text-taura-orange" : "text-muted-foreground/70"
                }`}
              >
                {MAX_CHARS - input.length}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === "typing") {
    return (
      <div className="flex justify-start">
        <span className="inline-flex items-center gap-1 pt-0.5">
          {[0, 0.2, 0.4].map((delay, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary inline-block"
              style={{
                animation: "pulse 1.2s ease-in-out infinite",
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </span>
      </div>
    );
  }

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] bg-primary/10 border border-primary/20 rounded-[10px] rounded-br-sm px-3 py-2 text-[13px] leading-snug text-foreground"
          style={{ borderBottomRightRadius: 2 }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.role === "error") {
    return (
      <div className="flex justify-start">
        <div
          className="max-w-[92%] flex items-start gap-1.5 px-3 py-2 text-[13px] leading-snug text-foreground border border-taura-orange/40 rounded-[10px] rounded-bl-sm"
          style={{
            background: "hsl(38 92% 50% / 0.08)",
            borderBottomLeftRadius: 2,
          }}
        >
          <span className="text-[13px] shrink-0 mt-0.5">⚠️</span>
          <span>{msg.content}</span>
        </div>
      </div>
    );
  }

  // Assistant - markdown-like simple rendering (no ReactMarkdown to stay demo-light)
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] text-[13px] leading-snug text-foreground">
        <div className="whitespace-pre-wrap [&_strong]:font-semibold">
          {renderBold(msg.content)}
        </div>
      </div>
    </div>
  );
}

function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
