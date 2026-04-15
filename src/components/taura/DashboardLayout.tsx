import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AIChatPanel } from "./AIChatPanel";
import { GlobalSearch } from "./GlobalSearch";
import { MorningBriefing } from "./MorningBriefing";

export const DashboardLayout = () => {
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto" style={{ padding: "16px 24px" }}>
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
      <AIChatPanel collapsed={chatCollapsed} onToggle={() => setChatCollapsed(!chatCollapsed)} />
      <GlobalSearch />
      <MorningBriefing />
    </div>
  );
};
