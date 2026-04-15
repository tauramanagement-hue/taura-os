import { useNavigate } from "react-router-dom";
import { Pill } from "@/components/taura/ui-primitives";
import { Trash2 } from "lucide-react";
import { InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/taura/SocialIcons";

interface Athlete {
  id: string;
  full_name: string;
  sport: string;
  category: string | null;
  status: string | null;
  instagram_followers: number | null;
  tiktok_followers: number | null;
  youtube_followers: number | null;
  photo_url: string | null;
}

const sportEmoji: Record<string, string> = {
  Calcio: "⚽", Tennis: "🎾", Basket: "🏀", Motorsport: "🏎️", Nuoto: "🏊",
  Atletica: "🏃", Sci: "⛷️", Ciclismo: "🚴", Pallavolo: "🏐", Rugby: "🏉",
  MMA: "🥊", Influencer: "📱", Creator: "📱", Musica: "🎵",
};

const formatFollowers = (n: number | null) => {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const ICON_SIZE = 16;

const AthleteCard = ({ athlete, onDelete }: { athlete: Athlete; onDelete: (id: string, name: string) => void }) => {
  const navigate = useNavigate();
  const a = athlete;

  const socials = [
    { key: "instagram", icon: <InstagramIcon size={ICON_SIZE} />, v: formatFollowers(a.instagram_followers) },
    { key: "tiktok", icon: <TikTokIcon size={ICON_SIZE} />, v: formatFollowers(a.tiktok_followers) },
    { key: "youtube", icon: <YouTubeIcon size={ICON_SIZE} />, v: formatFollowers(a.youtube_followers) },
  ].filter(s => s.v !== null);

  return (
    <div
      onClick={() => navigate(`/athletes/${a.id}`)}
      className="bg-card rounded-[14px] p-5 border border-border cursor-pointer hover:border-taura-border-light transition-all group"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-taura-surface border border-border flex items-center justify-center text-xl">
          {sportEmoji[a.sport] || "🏅"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{a.full_name}</div>
          <div className="text-[11px] text-taura-text3 truncate">{a.sport}{a.category ? ` • ${a.category}` : ""}</div>
        </div>
        <div className="flex items-center gap-2">
          <Pill variant={a.status === "active" ? "green" : "muted"}>
            {a.status === "active" ? "Attivo" : a.status || "—"}
          </Pill>
          <button
            onClick={e => { e.stopPropagation(); onDelete(a.id, a.full_name); }}
            className="p-1.5 rounded-md bg-secondary border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors opacity-0 group-hover:opacity-100"
            title="Elimina talent"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {socials.length > 0 && (
        <div className="flex gap-4">
          {socials.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              {s.icon}
              <span className="text-sm font-bold text-foreground">{s.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AthleteCard;
export type { Athlete };
export { formatFollowers, sportEmoji };
