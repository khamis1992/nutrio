import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface RecoveryOffer {
  id: string;
  offer_code: string;
  offer_type: "discount" | "bonus_credits" | "free_week" | "downgrade";
  name: string;
  description: string;
  discount_percent: number | null;
  discount_duration_months: number | null;
  bonus_credits: number | null;
  free_days: number | null;
  target_tier: string | null;
}

export interface RecoveryStatus {
  has_recovery: boolean;
  recovery_id?: string;
  recovery_status?: string;
  expired_at?: string;
  days_since_expiry?: number;
  has_offer?: boolean;
  offer?: RecoveryOffer | null;
  reactivated_at?: string;
  reactivation_tier?: string;
  next_notif_due_at?: string;
  notif_t_minus_7_sent?: boolean;
  notif_t_minus_3_sent?: boolean;
  notif_t_minus_1_sent?: boolean;
  notif_t_plus_1_sent?: boolean;
  notif_t_plus_3_sent?: boolean;
  notif_t_plus_7_sent?: boolean;
  last_notif_sent_at?: string;
}

export function useRecoveryStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["recovery_status", user?.id],
    queryFn: async (): Promise<RecoveryStatus | null> => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("get_recovery_status", {
        p_user_id: user.id,
      });
      if (error) {
        console.error("Failed to fetch recovery status:", error);
        return null;
      }
      return data as unknown as RecoveryStatus;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["recovery_status", user?.id] }),
    [queryClient, user?.id]
  );

  return { status, isLoading, refetch };
}

export function useRecoveryOffers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: offers, isLoading } = useQuery({
    queryKey: ["recovery_offers", user?.id],
    queryFn: async (): Promise<RecoveryOffer[]> => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("get_recovery_offers", {
        p_user_id: user.id,
      });
      if (error) {
        console.error("Failed to fetch recovery offers:", error);
        return [];
      }
      return (data || []) as RecoveryOffer[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["recovery_offers", user?.id] }),
    [queryClient, user?.id]
  );

  return { offers: offers || [], isLoading, refetch };
}

export function useReactivateSubscription() {
  const { user } = useAuth();

  const reactivate = useCallback(
    async (subscriptionId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not authenticated" };
      const { data, error } = await supabase.rpc("reactivate_subscription", {
        p_subscription_id: subscriptionId,
      });
      if (error) return { success: false, error: error.message };
      const result = data as { success: boolean; error?: string; message?: string };
      if (result.success) {
        toast.success(result.message || "Subscription reactivated!");
        return { success: true };
      }
      return { success: false, error: result.error || "Reactivation failed" };
    },
    [user]
  );

  return { reactivate };
}

export function useApplyRecoveryOffer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const applyOffer = useCallback(
    async (
      subscriptionId: string,
      offerCode: string
    ): Promise<{ success: boolean; error?: string; message?: string }> => {
      if (!user) return { success: false, error: "Not authenticated" };
      const { data, error } = await supabase.rpc("apply_recovery_offer", {
        p_subscription_id: subscriptionId,
        p_offer_code: offerCode,
      });
      if (error) return { success: false, error: error.message };
      const result = data as { success: boolean; error?: string; message?: string };
      if (result.success) {
        toast.success(result.message || "Offer applied! Welcome back!");
        queryClient.invalidateQueries({ queryKey: ["recovery_status", user?.id] });
        queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] });
        return { success: true };
      }
      return { success: false, error: result.error || "Failed to apply offer" };
    },
    [user, queryClient]
  );

  return { applyOffer };
}

export function useDismissRecovery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const dismiss = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("dismiss_recovery", {
      p_user_id: user.id,
    });
    if (error) {
      console.error("Failed to dismiss recovery:", error);
      return false;
    }
    const result = data as { success: boolean; message?: string };
    if (result.success) {
      toast.success("Offer dismissed");
      queryClient.invalidateQueries({ queryKey: ["recovery_status", user?.id] });
      return true;
    }
    return false;
  }, [user, queryClient]);

  return { dismiss };
}
