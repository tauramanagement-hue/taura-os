import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useAgencyType = () => {
  const { user } = useAuth();
  const [agencyType, setAgencyType] = useState<"talent" | "sport">("talent");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchAgencyType = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("agency_id, agencies(agency_type)")
        .eq("id", user.id)
        .single();

      if (data?.agencies?.agency_type) {
        setAgencyType(data.agencies.agency_type as "talent" | "sport");
      }
      setLoading(false);
    };

    fetchAgencyType();
  }, [user]);

  return {
    agencyType,
    isTalent: agencyType === "talent",
    isSport: agencyType === "sport",
    loading,
  };
};
