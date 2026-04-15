import { useState, useEffect } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/taura/SocialIcons";

interface MediaKitData {
  athlete: { full_name: string; sport: string; category: string | null; nationality: string | null; photo_url: string | null };
  agency_name: string;
  socials: { platform: string; handle: string; followers: number | null }[];
  total_followers: number;
  brands: string[];
  contracts_count: number;
  total_revenue: number;
  deliverables_count: number;
  pitch: string;
  generated_at: string;
}

const formatFollowers = (n: number | null) => {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const platformIcon = (p: string) => {
  if (p === "Instagram") return <InstagramIcon size={16} />;
  if (p === "TikTok") return <TikTokIcon size={16} />;
  if (p === "YouTube") return <YouTubeIcon size={16} />;
  return null;
};

const MediaKitModal = ({ athleteId, onClose }: { athleteId: string; onClose: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MediaKitData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: result, error } = await supabase.functions.invoke("generate-media-kit", {
          body: { athlete_id: athleteId },
        });
        if (cancelled) return;
        if (error) throw error;
        if (result?.success) setData(result);
        else throw new Error(result?.error || "Errore generazione");
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e.message || "Errore media kit");
          onClose();
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [athleteId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-card rounded-xl border border-border p-8 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Generazione Media Kit...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border w-[600px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border print:hidden">
          <span className="text-sm font-bold text-foreground">Media Kit</span>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Stampa / PDF
            </button>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6" id="media-kit-content">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{data.athlete.full_name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.athlete.sport}
                {data.athlete.category ? ` — ${data.athlete.category}` : ""}
                {data.athlete.nationality ? ` — ${data.athlete.nationality}` : ""}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{data.agency_name}</div>
              <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                {new Date(data.generated_at).toLocaleDateString("it-IT")}
              </div>
            </div>
          </div>

          {data.pitch && (
            <div className="bg-secondary/50 rounded-xl p-4 mb-5 border border-border">
              <p className="text-[13px] text-foreground leading-relaxed italic">{data.pitch}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-secondary rounded-xl p-3 border border-border text-center">
              <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Follower Totali</div>
              <div className="text-xl font-bold text-foreground">{formatFollowers(data.total_followers)}</div>
            </div>
            <div className="bg-secondary rounded-xl p-3 border border-border text-center">
              <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Collaborazioni</div>
              <div className="text-xl font-bold text-foreground">{data.brands.length}</div>
            </div>
            <div className="bg-secondary rounded-xl p-3 border border-border text-center">
              <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Contenuti</div>
              <div className="text-xl font-bold text-foreground">{data.deliverables_count}</div>
            </div>
          </div>

          {data.socials.length > 0 && (
            <div className="mb-5">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Social Media</h3>
              <div className="grid grid-cols-3 gap-3">
                {data.socials.map((s: any) => (
                  <div key={s.platform} className="bg-secondary rounded-xl p-3 border border-border flex flex-col items-center gap-2">
                    {platformIcon(s.platform)}
                    <div className="text-[11px] text-muted-foreground">{s.handle}</div>
                    <div className="text-lg font-bold text-foreground">{formatFollowers(s.followers)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.brands.length > 0 && (
            <div className="mb-5">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Brand Partners</h3>
              <div className="flex flex-wrap gap-2">
                {data.brands.map(b => (
                  <span key={b} className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-[12px] font-semibold text-foreground">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4 mt-4">
            <p className="text-[10px] text-muted-foreground text-center font-mono">
              {data.agency_name} — Media Kit generato il {new Date(data.generated_at).toLocaleDateString("it-IT")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaKitModal;
