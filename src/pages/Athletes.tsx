import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import AthleteCard, { type Athlete } from "@/components/taura/AthleteCard";
import AthleteDetail from "@/components/taura/AthleteDetail";

const AthletesPage = () => {
  const navigate = useNavigate();
  const { id: athleteId } = useParams();
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newAthlete, setNewAthlete] = useState({ full_name: "", sport: "", category: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!athleteId) fetchAthletes();
  }, [athleteId]);

  const fetchAthletes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("athletes")
      .select("id, full_name, sport, category, status, instagram_followers, tiktok_followers, youtube_followers, photo_url")
      .order("full_name");
    if (!error && data) setAthletes(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newAthlete.full_name.trim() || !newAthlete.sport.trim() || !user) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (!profile?.agency_id) {
        toast.error("Completa l'onboarding prima.");
        navigate("/onboarding");
        return;
      }
      const { error } = await supabase.from("athletes").insert({
        agency_id: profile.agency_id,
        full_name: newAthlete.full_name.trim(),
        sport: newAthlete.sport.trim(),
        category: newAthlete.category.trim() || null,
      });
      if (error) throw error;
      toast.success("Atleta aggiunto!");
      setNewAthlete({ full_name: "", sport: "", category: "" });
      setShowAdd(false);
      fetchAthletes();
    } catch (err: any) {
      toast.error(err.message || "Errore");
    }
    setSaving(false);
  };

  const deleteAthlete = async (athleteId: string, athleteName: string) => {
    if (!confirm(`Eliminare ${athleteName} dal roster? Verranno rimossi anche i deliverable associati.`)) return;
    try {
      await supabase.from("campaign_deliverables").delete().eq("athlete_id", athleteId);
      const { error } = await supabase.from("athletes").delete().eq("id", athleteId);
      if (error) throw error;
      toast.success(`${athleteName} eliminato dal roster`);
      fetchAthletes();
    } catch (err: any) {
      toast.error(err.message || "Errore eliminazione");
    }
  };

  // Detail view
  if (athleteId) {
    return <AthleteDetail athleteId={athleteId} />;
  }

  const filtered = athletes.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.full_name || "").toLowerCase().includes(q) || (a.sport || "").toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q);
  });

  const addBtnStyle: React.CSSProperties = {
    height: 32,
    padding: "0 14px",
    background: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
    border: "none",
    borderRadius: 6,
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "opacity 0.15s",
  };

  const inputStyle: React.CSSProperties = {
    height: 32,
    background: "hsl(var(--muted))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    padding: "0 12px",
    fontSize: "var(--text-sm)",
    color: "hsl(var(--foreground))",
    outline: "none",
    fontFamily: "var(--font-sans)",
    width: "100%",
  };

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "hsl(var(--foreground))",
            lineHeight: 1.15,
          }}>
            Roster
          </h1>
          <p style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", marginTop: 2, fontFamily: "var(--font-mono)" }}>
            {athletes.length} talent
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={addBtnStyle} onMouseEnter={e => e.currentTarget.style.opacity = "0.88"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          <Plus size={14} />
          Aggiungi talent
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, maxWidth: 320, position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))", pointerEvents: "none" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca talent, sport, categoria..."
          style={{ ...inputStyle, paddingLeft: 30 }}
        />
      </div>

      {/* Add athlete modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <div
            style={{
              background: "hsl(var(--card))",
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              padding: 24,
              width: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Nuovo talent
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={newAthlete.full_name} onChange={(e) => setNewAthlete({ ...newAthlete, full_name: e.target.value })} placeholder="Nome completo" style={inputStyle} />
              <input value={newAthlete.sport} onChange={(e) => setNewAthlete({ ...newAthlete, sport: e.target.value })} placeholder="Sport (es. Calcio, Tennis, Creator...)" style={inputStyle} />
              <input value={newAthlete.category} onChange={(e) => setNewAthlete({ ...newAthlete, category: e.target.value })} placeholder="Categoria (es. Serie A, ATP 250...)" style={inputStyle} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => setShowAdd(false)}
                  style={{ flex: 1, height: 36, borderRadius: 6, fontSize: "var(--text-sm)", fontWeight: 500, cursor: "pointer", background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newAthlete.full_name.trim() || !newAthlete.sport.trim()}
                  style={{ flex: 1, height: 36, borderRadius: 6, fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", opacity: saving || !newAthlete.full_name.trim() || !newAthlete.sport.trim() ? 0.4 : 1 }}
                >
                  {saving ? "Salvataggio..." : "Aggiungi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="taura-card animate-shimmer" style={{ height: 120 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 12 }}>
          <p style={{ fontSize: "var(--text-sm)", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
            {search ? "Nessun risultato per questa ricerca" : "Nessun talent nel roster"}
          </p>
          {!search && (
            <button onClick={() => setShowAdd(true)} style={addBtnStyle} onMouseEnter={e => e.currentTarget.style.opacity = "0.88"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              + Aggiungi il primo talent
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {filtered.map((a) => (
            <AthleteCard key={a.id} athlete={a} onDelete={deleteAthlete} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AthletesPage;
