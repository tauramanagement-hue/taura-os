import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface RevenueByTalent {
  id: string;
  name: string;
  revenue: number;
}

interface RevenueByBrand {
  brand: string;
  revenue: number;
}

interface UpcomingDel {
  id: string;
  athlete_name: string;
  brand: string;
  content_type: string;
  scheduled_date: string;
  days_until: number;
}

const contentEmoji: Record<string, string> = {
  post: "📸", reel: "🎬", tiktok: "📱", story: "⏳", youtube: "▶️",
};

const hashColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 55%)`;
};

const fmt = (n: number) => {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000).toLocaleString("it-IT")}k`;
  return `€${n.toLocaleString("it-IT")}`;
};

const DashboardAnalytics = ({ periodStart, periodEnd }: { periodStart: Date; periodEnd: Date }) => {
  const navigate = useNavigate();
  const [talentRevenue, setTalentRevenue] = useState<RevenueByTalent[]>([]);
  const [brandRevenue, setBrandRevenue] = useState<RevenueByBrand[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingDel[]>([]);
  const [showAllTalent, setShowAllTalent] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [periodStart.toISOString(), periodEnd.toISOString()]);

  const fetchAnalytics = async () => {
    const [contractsRes, delsRes] = await Promise.all([
      supabase.from("contracts").select("id, brand, value, start_date, status, athlete_id, athletes(id, full_name)").eq("status", "active"),
      supabase.from("campaign_deliverables").select("id, content_type, scheduled_date, content_approved, post_confirmed, athlete_id, athletes(full_name), campaigns(brand)").eq("content_approved", true).eq("post_confirmed", false).gte("scheduled_date", new Date().toISOString().split("T")[0]).order("scheduled_date").limit(5),
    ]);

    const contracts = contractsRes.data || [];

    const filtered = contracts.filter((c: any) => {
      // Contract is active in period if [start_date, end_date] overlaps [periodStart, periodEnd]
      const cStart = c.start_date ? new Date(c.start_date) : new Date(0);
      const cEnd = c.end_date ? new Date(c.end_date) : new Date(9999, 11, 31);
      return cStart <= periodEnd && cEnd >= periodStart;
    });

    const talentMap: Record<string, { id: string; name: string; revenue: number }> = {};
    const brandMap: Record<string, number> = {};

    filtered.forEach((c: any) => {
      const aid = c.athletes?.id || c.athlete_id;
      const name = c.athletes?.full_name || "Non assegnato";
      const val = c.value || 0;

      if (aid) {
        if (!talentMap[aid]) talentMap[aid] = { id: aid, name, revenue: 0 };
        talentMap[aid].revenue += val;
      }

      const brand = c.brand || "Altro";
      brandMap[brand] = (brandMap[brand] || 0) + val;
    });

    setTalentRevenue(
      Object.values(talentMap).sort((a, b) => b.revenue - a.revenue)
    );

    const brandArr = Object.entries(brandMap).sort((a, b) => b[1] - a[1]);
    const top6 = brandArr.slice(0, 6);
    const othersVal = brandArr.slice(6).reduce((s, [, v]) => s + v, 0);
    const result = top6.map(([brand, revenue]) => ({ brand, revenue }));
    if (othersVal > 0) result.push({ brand: "Altri", revenue: othersVal });
    setBrandRevenue(result);

    const dels = delsRes.data || [];
    const today = new Date();
    setUpcoming(dels.map((d: any) => {
      const sd = new Date(d.scheduled_date);
      return {
        id: d.id,
        athlete_name: d.athletes?.full_name || "N/A",
        brand: d.campaigns?.brand || "—",
        content_type: d.content_type,
        scheduled_date: d.scheduled_date,
        days_until: Math.ceil((sd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      };
    }));
  };

  const maxTalentRev = Math.max(...talentRevenue.map(t => t.revenue), 1);
  const maxBrandRev = Math.max(...brandRevenue.map(b => b.revenue), 1);
  const visibleTalent = showAllTalent ? talentRevenue : talentRevenue.slice(0, 8);

  return (
    <div className="grid grid-cols-2 gap-2.5 mt-2.5">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold text-foreground">Revenue per Talent</div>
          {talentRevenue.length > 8 && (
            <button onClick={() => setShowAllTalent(!showAllTalent)} className="text-[9px] text-primary font-semibold cursor-pointer">
              {showAllTalent ? "Mostra meno" : "Mostra tutti"}
            </button>
          )}
        </div>
        {visibleTalent.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-4 text-center">Nessun dato</div>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleTalent.map(t => (
              <div key={t.id} onClick={() => navigate(`/athletes/${t.id}`)} className="cursor-pointer group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-foreground font-semibold group-hover:text-primary transition-colors truncate flex-1">{t.name}</span>
                  <span className="text-[11px] font-bold text-foreground font-mono ml-2">{fmt(t.revenue)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(t.revenue / maxTalentRev) * 100}%`, background: "linear-gradient(90deg, hsl(170, 100%, 45%), hsl(185, 100%, 50%))" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-[13px] font-bold text-foreground mb-3">Revenue per Brand</div>
        {brandRevenue.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-4 text-center">Nessun dato</div>
        ) : (
          <div className="flex flex-col gap-2">
            {brandRevenue.map(b => (
              <div key={b.brand}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: hashColor(b.brand) }} />
                    <span className="text-[11px] text-foreground font-semibold truncate">{b.brand}</span>
                  </div>
                  <span className="text-[11px] font-bold text-foreground font-mono">{fmt(b.revenue)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(b.revenue / maxBrandRev) * 100}%`, backgroundColor: hashColor(b.brand) }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="bg-card rounded-xl p-4 border border-border col-span-2">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[13px] font-bold text-foreground">Prossime pubblicazioni</div>
            <span onClick={() => navigate("/campaigns")} className="text-[9px] text-primary font-semibold cursor-pointer">Vedi tutte →</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {upcoming.map(d => (
              <div key={d.id} onClick={() => navigate("/campaigns")} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-secondary/50 rounded-md px-1 transition-colors">
                <span className="text-xs shrink-0">{contentEmoji[d.content_type] || "📄"}</span>
                <span className="text-[12px] font-semibold text-foreground flex-1 truncate">{d.athlete_name} <span className="text-muted-foreground font-normal">· {d.brand}</span></span>
                <span className="text-[10px] text-muted-foreground font-mono">{new Date(d.scheduled_date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                <span className={`text-[11px] font-bold font-mono ${d.days_until <= 2 ? "text-taura-orange" : "text-primary"}`}>
                  {d.days_until === 0 ? "Oggi" : d.days_until === 1 ? "Domani" : `Manca ${d.days_until}gg`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAnalytics;
