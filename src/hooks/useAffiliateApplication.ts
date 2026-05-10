import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AffiliateStatus = "pending" | "approved" | "rejected" | null;

interface AffiliateApplication {
  id: string;
  user_id: string;
  status: AffiliateStatus;
  application_note: string | null;
  rejection_reason: string | null;
  applied_at: string;
  reviewed_at: string | null;
}

export function useAffiliateApplication() {
  const { user } = useAuth();
  const [application, setApplication] = useState<AffiliateApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApprovedAffiliate, setIsApprovedAffiliate] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchApplication = async () => {
      try {
        const { data, error } = await supabase
          .from("affiliate_applications")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = "The result contains 0 rows" - this is expected when no application exists
          throw error;
        }

        // No application found is not an error - just set null
        setApplication(data || null);
        setIsApprovedAffiliate(data?.status === "approved");
      } catch (err) {
        // Only log if it's a real error (not the expected "no rows" case)
        if ((err as { code?: string }).code !== 'PGRST116') {
          console.warn("Error fetching affiliate application:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [user]);

  const applyForAffiliate = async (note?: string) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const { data, error } = await supabase
        .from("affiliate_applications")
        .insert({
          user_id: user.id,
          application_note: note || null,
        })
        .select()
        .single();

      if (error) throw error;

      setApplication(data);
      return { success: true };
    } catch (err: unknown) {
      console.error("Error applying for affiliate:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  };

  const refetch = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("affiliate_applications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      setApplication(data);
      setIsApprovedAffiliate(data?.status === "approved");
    } catch (err) {
      console.error("Error refetching affiliate application:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    application,
    loading,
    isApprovedAffiliate,
    hasApplied: !!application,
    isPending: application?.status === "pending",
    isRejected: application?.status === "rejected",
    applyForAffiliate,
    refetch,
  };
}
