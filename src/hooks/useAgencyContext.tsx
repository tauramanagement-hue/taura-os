import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type SectorType = "sport" | "influencer" | "entertainment" | "multi";

interface AgencyLabels {
  rosterLabel: string;
  sidebarRoster: string;
  personLabel: string;
  personLabelPlural: string;
  contractTypes: string[];
  exclusivityCategories: string[];
  chatPlaceholder: string;
  dashboardTitle: string;
}

interface AgencyContextValue {
  sectorType: SectorType;
  sectorRaw: string;
  agencyName: string;
  agencyId: string | null;
  labels: AgencyLabels;
  loading: boolean;
}

const sectorLabels: Record<SectorType, AgencyLabels> = {
  sport: {
    rosterLabel: "Atleti",
    sidebarRoster: "Roster",
    personLabel: "Atleta",
    personLabelPlural: "Atleti",
    contractTypes: ["Sponsor", "Club", "Equipment", "Energy", "Image Rights", "Media", "Other"],
    exclusivityCategories: ["Sportswear", "Energy Drinks", "Automotive", "Telecomunicazioni", "Food & Beverage", "Finance", "Tech", "Other"],
    chatPlaceholder: "Chiedi di contratti, scadenze, atleti...",
    dashboardTitle: "Agenzia Sportiva",
  },
  influencer: {
    rosterLabel: "Talent",
    sidebarRoster: "Talent",
    personLabel: "Creator",
    personLabelPlural: "Talent",
    contractTypes: ["Sponsor", "Media", "Contenuti", "Brand Ambassador", "Affiliate", "Event", "Other"],
    exclusivityCategories: ["Fashion", "Beauty", "Food & Beverage", "Tech", "Travel", "Fitness", "Gaming", "Finance", "Other"],
    chatPlaceholder: "Chiedi di campagne, brief, talent...",
    dashboardTitle: "Agenzia Talent",
  },
  entertainment: {
    rosterLabel: "Artisti",
    sidebarRoster: "Artisti",
    personLabel: "Artista",
    personLabelPlural: "Artisti",
    contractTypes: ["Produzione", "Sponsor", "Distribuzione", "Live", "Merchandising", "Media", "Other"],
    exclusivityCategories: ["Luxury", "Automotive", "Fashion", "Beverage", "Tech", "Telecomunicazioni", "Other"],
    chatPlaceholder: "Chiedi di contratti, produzioni, artisti...",
    dashboardTitle: "Agenzia Entertainment",
  },
  multi: {
    rosterLabel: "Talent",
    sidebarRoster: "Roster",
    personLabel: "Talent",
    personLabelPlural: "Talent",
    contractTypes: ["Sponsor", "Club", "Media", "Contenuti", "Brand Ambassador", "Equipment", "Produzione", "Event", "Other"],
    exclusivityCategories: ["Sportswear", "Fashion", "Beauty", "Energy Drinks", "Food & Beverage", "Automotive", "Tech", "Travel", "Gaming", "Finance", "Telecomunicazioni", "Luxury", "Other"],
    chatPlaceholder: "Chiedi qualsiasi cosa...",
    dashboardTitle: "Agenzia",
  },
};

function parseSectorType(raw: string | null): SectorType {
  if (!raw) return "multi";
  const lower = raw.toLowerCase();
  if (lower.includes("influencer") || lower.includes("creator")) return "influencer";
  if (lower.includes("entertainment") || lower.includes("attori") || lower.includes("cantanti") || lower.includes("artisti")) return "entertainment";
  if (lower.includes("multi")) return "multi";
  // If it contains sport-specific keywords or is a sport name, it's sport
  if (lower.includes("sport") || lower.includes("calcio") || lower.includes("basket") || lower.includes("tennis") || lower.includes("motorsport") || lower.includes("nuoto")) return "sport";
  return "multi";
}

const defaultContext: AgencyContextValue = {
  sectorType: "multi",
  sectorRaw: "",
  agencyName: "",
  agencyId: null,
  labels: sectorLabels.multi,
  loading: true,
};

const AgencyContext = createContext<AgencyContextValue>(defaultContext);

export const AgencyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [ctx, setCtx] = useState<AgencyContextValue>(defaultContext);

  useEffect(() => {
    if (!user) {
      setCtx(defaultContext);
      return;
    }
    const load = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id, agencies(id, name, sport_sector)")
        .eq("id", user.id)
        .single();

      if (profile?.agencies) {
        const agency = profile.agencies as any;
        const sectorType = parseSectorType(agency.sport_sector);
        setCtx({
          sectorType,
          sectorRaw: agency.sport_sector || "",
          agencyName: agency.name || "",
          agencyId: agency.id || null,
          labels: sectorLabels[sectorType],
          loading: false,
        });
      } else {
        setCtx(prev => ({ ...prev, loading: false }));
      }
    };
    load();
  }, [user]);

  return <AgencyContext.Provider value={ctx}>{children}</AgencyContext.Provider>;
};

export const useAgencyContext = () => useContext(AgencyContext);
