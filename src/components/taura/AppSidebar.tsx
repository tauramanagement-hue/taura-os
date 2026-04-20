import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgencyContext } from "@/hooks/useAgencyContext";
import { useAgencyType } from "@/hooks/useAgencyType";
import { useTheme } from "@/hooks/useTheme";
import {
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  Package,
  Calendar,
  Settings,
  Bell,
  Megaphone,
  ArrowRightLeft,
  FileCheck,
  Eye,
  Sun,
  Moon,
  TrendingUp,
  Handshake,
  MessageSquare,
} from "lucide-react";

const MVP_MODE = true;

export const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { labels } = useAgencyContext();
  const { isTalent, isSport } = useAgencyType();
  const { theme, toggle } = useTheme();
  const [initials, setInitials] = useState("U");
  const [alertCount, setAlertCount] = useState(0);

  const mvpItems = [
    { id: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "/athletes",  icon: Users,           label: "Atleti" },
    { id: "/contracts", icon: FileText,         label: "Contratti" },
    { id: "/deals",     icon: Handshake,        label: "Deal" },
    { id: "/chat",      icon: MessageSquare,    label: "Chat AI" },
  ];

  const navItems = [
    { id: "/dashboard", icon: LayoutDashboard, label: "Command", show: true },
    { id: "/portfolio", icon: TrendingUp, label: "Portfolio", show: true },
    ...(isTalent ? [{ id: "/campaigns", icon: Megaphone, label: "Campagne", show: true }] : []),
    ...(isSport ? [{ id: "/transfers", icon: ArrowRightLeft, label: "Transfer", show: true }] : []),
    ...(isSport ? [{ id: "/mandates", icon: FileCheck, label: "Mandati", show: true }] : []),
    ...(isSport ? [{ id: "/scouting", icon: Eye, label: "Scouting", show: true }] : []),
    { id: "/athletes", icon: Users, label: isSport ? "Atleti" : labels.sidebarRoster, show: true },
    { id: "/contracts", icon: FileText, label: "Contratti", show: true },
    { id: "/deadlines", icon: Clock, label: "Scadenze", show: true },
    { id: "/proof-package", icon: Package, label: "Proof Package", show: true },
    ...(isTalent ? [{ id: "/calendar", icon: Calendar, label: "Calendario", show: true }] : []),
  ];

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
      if (data?.full_name && data.full_name.trim()) {
        setInitials(data.full_name.trim().split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2));
      } else if (data?.email) {
        setInitials(data.email[0].toUpperCase());
      }
    };
    fetchProfile();
    const fetchAlerts = async () => {
      const { count } = await supabase.from("conflicts").select("id", { count: "exact", head: true }).eq("status", "open");
      setAlertCount(count || 0);
    };
    fetchAlerts();
    const channel = supabase.channel("conflicts-sidebar").on("postgres_changes", { event: "*", schema: "public", table: "conflicts" }, () => fetchAlerts()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const iconBtn = (active: boolean) => ({
    width: "100%",
    height: 36,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    border: "none",
    transition: "all 0.15s",
    background: active ? "hsl(var(--primary) / 0.12)" : "transparent",
    color: active ? "hsl(var(--primary))" : "hsl(var(--sidebar-foreground))",
    position: "relative" as const,
  });

  return (
    <div
      style={{
        width: 52,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 8,
        zIndex: 10,
        borderRight: "1px solid hsl(var(--sidebar-border))",
        background: "hsl(var(--sidebar-background))",
      }}
    >
      {/* Logo — dark: teal; light: inverted monogram (foreground/background) */}
      <div
        onClick={() => navigate("/dashboard")}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginBottom: 20,
          userSelect: "none",
          background: theme === "dark" ? "hsl(var(--primary))" : "hsl(var(--foreground))",
          color: theme === "dark" ? "hsl(var(--primary-foreground))" : "hsl(var(--background))",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, lineHeight: 1 }}>T</span>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "0 8px" }}>
        {(MVP_MODE ? mvpItems : navItems).map((item) => {
          const active = location.pathname.startsWith(item.id);
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              title={item.label}
              style={iconBtn(active)}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "hsl(var(--sidebar-accent))"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              {active && (
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  borderRadius: "0 2px 2px 0",
                  background: "hsl(var(--primary))",
                }} />
              )}
              <item.icon size={15} />
            </button>
          );
        })}
      </div>

      {/* Bottom items */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0 8px", width: "100%", marginTop: 4 }}>
        {/* Theme toggle — always inactive style (no highlight/selected state) */}
        <button
          onClick={toggle}
          title={theme === "dark" ? "Modalità chiara" : "Modalità scura"}
          style={{
            width: "100%",
            height: 36,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            border: "none",
            background: "transparent",
            color: "hsl(var(--sidebar-foreground))",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "hsl(var(--sidebar-accent))"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Alerts */}
        <button
          onClick={() => navigate("/alerts")}
          title="Alert"
          style={{ ...iconBtn(location.pathname.startsWith("/alerts")), position: "relative" }}
          onMouseEnter={e => { if (!location.pathname.startsWith("/alerts")) e.currentTarget.style.background = "hsl(var(--sidebar-accent))"; }}
          onMouseLeave={e => { if (!location.pathname.startsWith("/alerts")) e.currentTarget.style.background = "transparent"; }}
        >
          <Bell size={14} />
          {alertCount > 0 && (
            <span style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 14,
              height: 14,
              borderRadius: 99,
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 2px",
              background: "hsl(var(--destructive))",
              color: "#fff",
              fontFamily: "var(--font-mono)",
              lineHeight: 1,
            }}>
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => navigate("/settings")}
          title="Impostazioni"
          style={iconBtn(location.pathname.startsWith("/settings"))}
          onMouseEnter={e => { if (!location.pathname.startsWith("/settings")) e.currentTarget.style.background = "hsl(var(--sidebar-accent))"; }}
          onMouseLeave={e => { if (!location.pathname.startsWith("/settings")) e.currentTarget.style.background = "transparent"; }}
        >
          <Settings size={14} />
        </button>

        {/* Avatar */}
        <div
          onClick={() => navigate("/settings")}
          title={`Account — ${initials}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            marginTop: 4,
            userSelect: "none",
            background: "hsl(var(--muted))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))",
            fontSize: 10,
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      </div>
    </div>
  );
};
