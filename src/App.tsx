import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AgencyProvider } from "@/hooks/useAgencyContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RootRedirect } from "@/components/RootRedirect";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Pricing from "./pages/Pricing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Athletes from "./pages/Athletes";
import Campaigns from "./pages/Campaigns";
import Contracts from "./pages/Contracts";
import ContractDetail from "./pages/ContractDetail";
import Deadlines from "./pages/Deadlines";
import Calendar from "./pages/Calendar";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import ReportMonteContratti from "./pages/ReportMonteContratti";
import ProofPackage from "./pages/ProofPackage";
import Settings from "./pages/Settings";
import Transfers from "./pages/Transfers";
import Mandates from "./pages/Mandates";
import Scouting from "./pages/Scouting";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "./components/taura/DashboardLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AgencyProvider>
          <Routes>
            {/* Root: redirect to /dashboard if authenticated, else /auth */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public routes (no guard) */}
            <Route path="/landing" element={<Landing />} />
            <Route path="/auth" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* INTERNAL routes — removed from router, redirect to dashboard */}
            <Route path="/ai-lab" element={<Navigate to="/dashboard" replace />} />

            {/* Protected routes: sidebar + AI panel — require auth */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/mandates" element={<Mandates />} />
              <Route path="/scouting" element={<Scouting />} />
              <Route path="/athletes" element={<Athletes />} />
              <Route path="/athletes/:id" element={<Athletes />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/contracts/upload" element={<Contracts />} />
              <Route path="/contracts/:id" element={<ContractDetail />} />
              <Route path="/deadlines" element={<Deadlines />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/monte-contratti" element={<ReportMonteContratti />} />
              <Route path="/portfolio" element={<ReportMonteContratti />} />
              <Route path="/proof-package" element={<ProofPackage />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </AgencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
