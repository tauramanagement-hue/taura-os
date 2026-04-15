import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TauraLogo } from "@/components/taura/ui-primitives";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in — check onboarding status
  useEffect(() => {
    if (!user) return;
    const checkOnboarding = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .single();
      if (profile?.agency_id) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/onboarding", { replace: true });
      }
    };
    checkOnboarding();
  }, [user, navigate]);

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Inserisci la tua email", description: "Scrivi l'email nel campo sopra, poi clicca 'Password dimenticata'.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email inviata", description: `Controlla la casella di ${email} per il link di reset.` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Errore", description: error.message === "Email not confirmed" ? "Conferma la tua email prima di accedere." : error.message, variant: "destructive" });
      }
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Account creato!", description: "Controlla la tua email per la verifica." });
      }
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Left — Brand */}
      <div className="flex-1 flex flex-col justify-center px-[60px] relative overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] ambient-glow pointer-events-none" />
        <div className="absolute bottom-[10%] right-[5%] w-[300px] h-[300px] ambient-glow-blue pointer-events-none" />

        <div className="flex items-center gap-2.5 mb-12 cursor-pointer" onClick={() => navigate("/")}>
          <TauraLogo size={36} />
          <span className="font-bold text-[19px] text-foreground tracking-tight">TAURA OS</span>
        </div>

        <h2 className="text-4xl font-bold text-foreground leading-tight mb-6 tracking-tight">
          Gestisci l'agenzia.<br />
          <span className="text-muted-foreground">L'AI fa il resto.</span>
        </h2>

        <div className="flex flex-col gap-5 max-w-[380px]">
          {[
            { icon: "⚡", text: "Contratti analizzati in 45 secondi", sub: "non 4 ore" },
            { icon: "🛡", text: "Conflitti rilevati automaticamente", sub: "su tutto il roster" },
            { icon: "📊", text: "Report sponsor generati dall'AI", sub: "non da stagisti" },
          ].map((t, i) => (
            <div key={i} className="flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-base shrink-0">
                {t.icon}
              </div>
              <div>
                <div className="text-sm text-foreground font-semibold">{t.text}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-[0.8] flex items-center justify-center bg-card">
        <div className="w-[380px]">
          <h3 className="text-2xl font-bold text-foreground mb-1.5 text-center">
            {isLogin ? "Bentornato" : "Crea il tuo account"}
          </h3>
          <p className="text-[13px] text-muted-foreground text-center mb-7">
            {isLogin ? "Accedi al tuo account" : "Free forever • No carta richiesta"}
          </p>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-2.5 mb-5">
            <button
              onClick={() => handleOAuth("google")}
              className="w-full py-3 rounded-lg border border-border bg-secondary text-foreground text-[13px] font-semibold cursor-pointer hover:bg-taura-surface-hover transition-colors flex items-center justify-center gap-2.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continua con Google
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground">oppure</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            {!isLogin && (
              <input
                type="text"
                placeholder="Nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-3 rounded-lg border border-border bg-secondary text-foreground text-[13px] outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
              />
            )}
            <input
              type="email"
              placeholder="Email di lavoro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-3 rounded-lg border border-border bg-secondary text-foreground text-[13px] outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
            />
            <input
              type="password"
              placeholder="Password (min. 6 caratteri)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3.5 py-3 rounded-lg border border-border bg-secondary text-foreground text-[13px] outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold cursor-pointer mt-1 glow-accent hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "..." : isLogin ? "Accedi" : "Crea account"}
            </button>
            {isLogin && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer text-center mt-1"
              >
                Password dimenticata?
              </button>
            )}
          </form>

          <p className="text-muted-foreground text-[11px] text-center mt-5">
            {isLogin ? (
              <>Non hai un account?{" "}<span onClick={() => setIsLogin(false)} className="text-primary cursor-pointer font-semibold">Registrati</span></>
            ) : (
              <>Hai già un account?{" "}<span onClick={() => setIsLogin(true)} className="text-primary cursor-pointer font-semibold">Accedi</span></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
