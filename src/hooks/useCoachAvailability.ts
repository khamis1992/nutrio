import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CoachAvailabilityInfo {
  coachId: string;
  isAcceptingClients: boolean;
  activeClientCount: number;
  activeClientRange: string;
  avgResponseHours: number | null;
  responseLabel: string | null;
}

export function useCoachAvailability(coachId: string | undefined) {
  const [availability, setAvailability] = useState<CoachAvailabilityInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAvailability = useCallback(async () => {
    if (!coachId) {
      setLoading(false);
      return;
    }
    try {
      const [{ data: pricingData }, { data: clientData }, { data: msgData }] = await Promise.all([
        supabase.from("coach_pricing").select("is_active").eq("coach_id", coachId).maybeSingle(),
        supabase.from("coach_client_assignments").select("id", { count: "exact" }).eq("coach_id", coachId).eq("status", "active"),
        supabase
          .from("coach_messages")
          .select("created_at, sender_role")
          .eq("coach_id", coachId)
          .eq("sender_role", "client")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const activeCount = (clientData as unknown as { count: number })?.count || 0;
      let responseLabel: string | null = null;
      let avgResponseHours: number | null = null;

      if (msgData?.length) {
        const now = Date.now();
        const delays = msgData.map((m) => {
          const sentAt = new Date(m.created_at).getTime();
          return (now - sentAt) / (1000 * 60 * 60);
        });
        const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
        avgResponseHours = Math.round(avgDelay * 10) / 10;
        if (avgDelay < 2) responseLabel = "Quick responder";
        else if (avgDelay < 8) responseLabel = "Within 8h";
        else if (avgDelay < 24) responseLabel = "Within 24h";
      }

      setAvailability({
        coachId,
        isAcceptingClients: pricingData?.is_active ?? false,
        activeClientCount: activeCount,
        activeClientRange: activeCount <= 5 ? "1-5" : activeCount <= 10 ? "5-10" : "10+",
        avgResponseHours,
        responseLabel,
      });
    } catch (err) {
      console.error("Error fetching coach availability:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return { availability, loading, refresh: fetchAvailability };
}
