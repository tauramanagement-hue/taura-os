import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Pencil, Check, X, UserPlus, Download, Lock } from "lucide-react";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [agency, setAgency] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  // Edits
  const [editingAgencyName, setEditingAgencyName] = useState(false);
  const [agencyNameValue, setAgencyNameValue] = useState("");
  const [editingUserName, setEditingUserName] = useState(false);
  const [userNameValue, setUserNameValue] = useState("");
  // Password
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Invite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  // Commissioni
  const [commType, setCommType] = useState<"pct" | "fixed">("pct");
  const [commValue, setCommValue] = useState<string>("15");
  const [savingComm, setSavingComm] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase.from("profiles").select("full_name, email, role, agency_id, agencies(id, name, sport_sector, plan, default_commission_type, default_commission_value)").eq("id", user.id).single();
      if (p) {
        setProfile(p);
        const ag = (p as any).agencies;
        setAgency(ag);
        setAgencyNameValue(ag?.name || "");
        setUserNameValue(p.full_name || "");
        if (ag?.default_commission_type) setCommType(ag.default_commission_type === "fixed" ? "fixed" : "pct");
        if (ag?.default_commission_value != null) setCommValue(String(ag.default_commission_value));
        // Fetch team
        if (p.agency_id) {
          const { data: teamData } = await supabase.from("profiles").select("id, full_name, email, role").eq("agency_id", p.agency_id);
          if (teamData) setTeam(teamData);
        }
      }
    };
    load();
  }, [user]);

  const handleLogout = async () => { await signOut(); navigate("/login", { replace: true }); };

  const saveAgencyName = async () => {
    if (!agency?.id || !agencyNameValue.trim()) return;
    const { error } = await supabase.from("agencies").update({ name: agencyNameValue.trim() }).eq("id", agency.id);
    if (error) { toast.error("Errore"); return; }
    toast.success("Nome agenzia aggiornato");
    setAgency({ ...agency, name: agencyNameValue.trim() });
    setEditingAgencyName(false);
  };

  const saveUserName = async () => {
    if (!user || !userNameValue.trim()) return;
    const { error } = await supabase.from("profiles").update({ full_name: userNameValue.trim() }).eq("id", user.id);
    if (error) { toast.error("Errore"); return; }
    toast.success("Nome aggiornato");
    setProfile({ ...profile, full_name: userNameValue.trim() });
    setEditingUserName(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error("Minimo 6 caratteri"); return; }
    if (newPassword !== confirmPassword) { toast.error("Le password non coincidono"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    toast.success("Password aggiornata");
    setNewPassword(""); setConfirmPassword(""); setShowPassword(false);
  };

  const saveCommission = async () => {
    if (!agency?.id) return;
    const val = parseFloat(commValue);
    if (isNaN(val) || val < 0) { toast.error("Valore commissione non valido"); return; }
    setSavingComm(true);
    const { error } = await supabase.from("agencies").update({
      default_commission_type: commType,
      default_commission_value: val,
    }).eq("id", agency.id);
    setSavingComm(false);
    if (error) { toast.error("Errore salvataggio"); return; }
    setAgency({ ...agency, default_commission_type: commType, default_commission_value: val });
    toast.success(`Commissione default: ${commType === "pct" ? `${val}%` : `€${val.toLocaleString("it-IT")}`}`);
  };

  const exportCSV = async (type: "contracts" | "athletes") => {
    const { data, error } = type === "contracts"
      ? await supabase.from("contracts").select("brand, contract_type, value, status, start_date, end_date, athlete_id, athletes(full_name)").csv()
      : await supabase.from("athletes").select("full_name, sport, category, status, nationality, instagram_handle, instagram_followers, tiktok_handle, tiktok_followers, youtube_handle, youtube_followers").csv();
    if (error || !data) { toast.error("Errore export"); return; }
    const blob = new Blob([data as any], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `taura_${type}_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${type === "contracts" ? "Contratti" : "Roster"} esportati`);
  };

  return (
    <div className="p-5 pb-10 max-w-3xl">
      <h1 className="text-xl font-bold text-foreground tracking-tight mb-6">Impostazioni</h1>

      {/* Agency */}
      <section className="bg-card rounded-xl p-6 border border-border mb-4">
        <h2 className="text-sm font-bold text-foreground mb-4">Agenzia</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="label-caps text-muted-foreground block mb-1.5">Nome agenzia</label>
            {editingAgencyName ? (
              <div className="flex items-center gap-2">
                <input value={agencyNameValue} onChange={e => setAgencyNameValue(e.target.value)} className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-foreground text-sm outline-none focus:border-primary" autoFocus />
                <button onClick={saveAgencyName} className="p-2 text-primary"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setAgencyNameValue(agency?.name || ""); setEditingAgencyName(false); }} className="p-2 text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border bg-secondary group">
                <span className="text-foreground text-sm">{agency?.name || "—"}</span>
                <button onClick={() => setEditingAgencyName(true)} className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
          <div>
            <label className="label-caps text-muted-foreground block mb-1.5">Settore</label>
            <div className="px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-foreground text-sm">{agency?.sport_sector || "—"}</div>
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="bg-card rounded-xl p-6 border border-border mb-4">
        <h2 className="text-sm font-bold text-foreground mb-4">Account</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="label-caps text-muted-foreground block mb-1.5">Nome</label>
            {editingUserName ? (
              <div className="flex items-center gap-2">
                <input value={userNameValue} onChange={e => setUserNameValue(e.target.value)} className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-foreground text-sm outline-none focus:border-primary" autoFocus />
                <button onClick={saveUserName} className="p-2 text-primary"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setUserNameValue(profile?.full_name || ""); setEditingUserName(false); }} className="p-2 text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border bg-secondary group">
                <span className="text-foreground text-sm">{profile?.full_name || user?.email || "—"}</span>
                <button onClick={() => setEditingUserName(true)} className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
          <div>
            <label className="label-caps text-muted-foreground block mb-1.5">Email</label>
            <div className="px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-muted-foreground text-sm">{user?.email || "—"}</div>
          </div>
          <div>
            <label className="label-caps text-muted-foreground block mb-1.5">Password</label>
            {showPassword ? (
              <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-secondary">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nuova password (min. 6 caratteri)" className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-primary" />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Conferma password" className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-primary" />
                <div className="flex gap-2">
                  <button onClick={() => { setShowPassword(false); setNewPassword(""); setConfirmPassword(""); }} className="px-3 py-1.5 bg-secondary border border-border rounded-lg text-[11px] text-foreground font-semibold cursor-pointer">Annulla</button>
                  <button onClick={changePassword} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[11px] font-bold cursor-pointer">Cambia</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowPassword(true)} className="px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-muted-foreground text-sm hover:border-primary/30 transition-colors cursor-pointer w-full text-left">Cambia password →</button>
            )}
          </div>
        </div>
      </section>

      {/* Commissioni */}
      <section className="bg-card rounded-xl p-6 border border-border mb-4">
        <h2 className="text-sm font-bold text-foreground mb-1">Commissioni</h2>
        <p className="text-[11px] text-muted-foreground mb-4">Default applicato a tutti i deal. Puoi sovrascriverlo per singolo contratto dalla chat AI.</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="commType" checked={commType === "pct"} onChange={() => setCommType("pct")} className="accent-primary w-3.5 h-3.5" />
              <span className="text-[12px] text-foreground font-medium">Percentuale (%)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="commType" checked={commType === "fixed"} onChange={() => setCommType("fixed")} className="accent-primary w-3.5 h-3.5" />
              <span className="text-[12px] text-foreground font-medium">Importo fisso (€)</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                step={commType === "pct" ? "0.5" : "100"}
                value={commValue}
                onChange={e => setCommValue(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-foreground text-sm outline-none focus:border-primary pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                {commType === "pct" ? "%" : "€"}
              </span>
            </div>
            <button
              onClick={saveCommission}
              disabled={savingComm}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {savingComm ? "Salvo..." : "Salva"}
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {commType === "pct"
              ? `Su un deal da €100.000, la commissione sarà €${((parseFloat(commValue) || 0) / 100 * 100000).toLocaleString("it-IT")}`
              : `Importo fisso di €${parseFloat(commValue || "0").toLocaleString("it-IT")} per ogni deal`
            }
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-card rounded-xl p-6 border border-border mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground">Team</h2>
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 text-[11px] text-primary font-semibold cursor-pointer"><UserPlus className="w-3.5 h-3.5" /> Invita</button>
        </div>
        <div className="space-y-2">
          {team.map(t => (
            <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-taura-surface border border-border flex items-center justify-center text-xs text-foreground font-bold">
                  {(t.full_name || t.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-foreground">{t.full_name || t.email}</div>
                  <div className="text-[10px] text-muted-foreground">{t.email}</div>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold capitalize">{t.role || "agent"}</span>
            </div>
          ))}
        </div>
        {showInvite && (
          <div className="mt-3 p-3 rounded-lg border border-border bg-secondary flex items-center gap-2">
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@agenzia.com" className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-primary" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="px-2 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none">
              <option value="admin">Admin</option>
              <option value="agent">Agent</option>
              <option value="viewer">Viewer</option>
            </select>
            <button onClick={() => { toast.info("Invito inviato! (funzionalità in sviluppo)"); setShowInvite(false); setInviteEmail(""); }} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-bold cursor-pointer">Invita</button>
            <button onClick={() => { setShowInvite(false); setInviteEmail(""); }} className="p-2 text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        )}
      </section>

      {/* Export */}
      <section className="bg-card rounded-xl p-6 border border-border mb-4">
        <h2 className="text-sm font-bold text-foreground mb-4">Esporta dati</h2>
        <p className="text-xs text-muted-foreground mb-3">Scarica i tuoi dati in formato CSV (conforme GDPR).</p>
        <div className="flex gap-2">
          <button onClick={() => exportCSV("contracts")} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary border border-border text-[11px] text-foreground font-semibold cursor-pointer hover:border-primary/30 transition-colors"><Download className="w-3.5 h-3.5" /> Esporta contratti</button>
          <button onClick={() => exportCSV("athletes")} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary border border-border text-[11px] text-foreground font-semibold cursor-pointer hover:border-primary/30 transition-colors"><Download className="w-3.5 h-3.5" /> Esporta roster</button>
        </div>
      </section>

      {/* Session */}
      <section className="bg-card rounded-xl p-6 border border-border mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Sessione</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Esci dal tuo account</p>
          </div>
          <button onClick={handleLogout} className="bg-secondary border border-border text-foreground px-5 py-2 rounded-lg text-sm font-bold cursor-pointer hover:border-destructive/30 hover:text-destructive transition-colors">Logout</button>
        </div>
      </section>

      {/* Plan */}
      <section className="bg-card rounded-xl p-6 border border-border mb-4">
        <h2 className="text-sm font-bold text-foreground mb-4">Piano</h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13px] font-bold text-foreground capitalize">{agency?.plan || "Free"}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{agency?.plan === "pro" ? "Accesso completo" : "Funzionalità base — upgrade per sbloccare tutto"}</div>
          </div>
          {(!agency?.plan || agency?.plan === "free") && (
            <button onClick={() => navigate("/pricing")} className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold cursor-pointer hover:opacity-90">Upgrade</button>
          )}
        </div>
      </section>

      {/* Danger */}
      <section className="bg-card rounded-xl p-6 border border-destructive/20">
        <h2 className="text-sm font-bold text-destructive mb-2">Danger Zone</h2>
        <p className="text-xs text-muted-foreground mb-4">L'eliminazione dell'account è permanente e irreversibile.</p>
        <a
          href="mailto:os@tauramanagement.com?subject=Early%20access:%20Account%20deletion"
          className="inline-flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 rounded-lg text-xs font-bold hover:bg-destructive/20 transition-colors"
        >
          <Lock className="w-3 h-3" />
          Richiedi accesso
        </a>
      </section>
    </div>
  );
};

export default SettingsPage;
