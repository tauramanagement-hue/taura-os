import { useState } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AIChatPanel } from "./AIChatPanel";
import { ChatErrorBoundary } from "./ChatErrorBoundary";
import { GlobalSearch } from "./GlobalSearch";
import { MorningBriefing } from "./MorningBriefing";

export const DashboardLayout = () => {
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main id="main-content" className="flex-1 overflow-y-auto flex flex-col" style={{ padding: "16px 24px" }}>
        <div key={location.pathname} className="page-transition flex-1">
          <Outlet />
        </div>
        <footer className="mt-8 pt-4 border-t border-border/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Taura OS</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Termini</Link>
          <Link to="/cookies" className="hover:text-foreground transition-colors">Cookie</Link>
          <Link to="/ai-disclosure" className="hover:text-foreground transition-colors">AI</Link>
          <Link to="/legal" className="hover:text-foreground transition-colors">Centro legale</Link>
        </footer>
      </main>
      <ChatErrorBoundary>
        <AIChatPanel collapsed={chatCollapsed} onToggle={() => setChatCollapsed(!chatCollapsed)} />
      </ChatErrorBoundary>
      <GlobalSearch />
      <MorningBriefing />
    </div>
  );
};
