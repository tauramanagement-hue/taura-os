import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, FileText, Users, TrendingUp, Megaphone, X } from "lucide-react";

interface SearchResult {
  id: string;
  type: "athlete" | "contract" | "deal" | "campaign";
  title: string;
  subtitle: string;
  url: string;
}

const typeConfig = {
  athlete: { icon: Users, label: "Roster", color: "text-primary" },
  contract: { icon: FileText, label: "Contratto", color: "text-taura-blue" },
  deal: { icon: TrendingUp, label: "Deal", color: "text-taura-green" },
  campaign: { icon: Megaphone, label: "Campagna", color: "text-taura-orange" },
};

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") { setOpen(false); setQuery(""); setResults([]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const term = `%${q}%`;
    const all: SearchResult[] = [];

    const [athletes, contracts, deals, campaigns] = await Promise.all([
      supabase.from("athletes").select("id, full_name, sport, category").ilike("full_name", term).limit(15),
      supabase.from("contracts").select("id, brand, contract_type, athletes(full_name)").or(`brand.ilike.${term},contract_type.ilike.${term}`).limit(10),
      supabase.from("deals").select("id, brand, athletes(full_name), stage").ilike("brand", term).limit(10),
      supabase.from("campaigns").select("id, name, brand").or(`name.ilike.${term},brand.ilike.${term}`).limit(10),
    ]);

    (athletes.data || []).forEach((a: any) => all.push({ id: a.id, type: "athlete", title: a.full_name, subtitle: [a.sport, a.category].filter(Boolean).join(" · "), url: `/athletes/${a.id}` }));
    (contracts.data || []).forEach((c: any) => all.push({ id: c.id, type: "contract", title: c.brand, subtitle: `${c.contract_type} — ${(c.athletes as any)?.full_name || "N/A"}`, url: `/contracts/${c.id}` }));
    (deals.data || []).forEach((d: any) => all.push({ id: d.id, type: "deal", title: d.brand, subtitle: `${d.stage} — ${(d.athletes as any)?.full_name || "N/A"}`, url: `/deals` }));
    (campaigns.data || []).forEach((c: any) => all.push({ id: c.id, type: "campaign", title: c.name, subtitle: c.brand, url: `/campaigns` }));

    setResults(all);
    setSelected(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  const go = (r: SearchResult) => { navigate(r.url); setOpen(false); setQuery(""); setResults([]); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) { go(results[selected]); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center pt-[15vh]" onClick={() => { setOpen(false); setQuery(""); setResults([]); }}>
      <div className="bg-card rounded-xl border border-border w-[540px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Cerca atleti, contratti, deal, campagne..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          <kbd className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border font-mono">ESC</kbd>
        </div>
        {loading && <div className="px-4 py-3 text-[11px] text-muted-foreground">Ricerca...</div>}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">Nessun risultato per "{query}"</div>
        )}
        {results.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto py-1">
            {results.map((r, i) => {
              const cfg = typeConfig[r.type];
              return (
                <div key={`${r.type}-${r.id}`} onClick={() => go(r)} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${i === selected ? "bg-secondary" : "hover:bg-secondary/50"}`}>
                  <cfg.icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-foreground truncate">{r.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{r.subtitle}</div>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono shrink-0">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
        {query.length < 2 && !loading && (
          <div className="px-4 py-4 text-center text-[11px] text-muted-foreground">Scrivi almeno 2 caratteri per cercare</div>
        )}
      </div>
    </div>
  );
};
