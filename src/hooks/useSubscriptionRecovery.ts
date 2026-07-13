import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface RecoveryOffer {
  id: string;
  offer_type: "discount" | "bonus_credits" | "free_week" | "downgrade_retention";
  name: string;
  description: string | null;
  discount_percent: number | null;
  bonus_credits: number | null;
  free_days: number | null;
  downgrade_to_tier: string | null;
}

export interface RecoveryStatus {
  id: string;
  subscription_id: string;
  status: string;
  expired_at: string;
  recovery_offer_id: string | null;
  offer_applied_at: string | null;
  reactivated_at: string | null;
  notification_stage: number;
  days_since_expiry: number;
}

type RecoveryActionResult = {
  success: boolean;
  error?: string;
  message?: string;
};

function parseRecoveryAction(data: unknown): RecoveryActionResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, error: "Invalid recovery response" };
  }
  const result = data as Record<string, unknown>;
  return {
    success: result.success === true,
    error: typeof result.error === "string" ? result.error : undefined,
    message: typeof result.message === "string" ? result.message : undefined,
  };
}

const RECOVERY_OFFER_TYPES: RecoveryOffer["offer_type"][] = [
  "discount",
  "bonus_credits",
  "free_week",
  "downgrade_retention",
];

function isRecoveryOfferType(value: string): value is RecoveryOffer["offer_type"] {
  return RECOVERY_OFFER_TYPES.includes(value as RecoveryOffer["offer_type"]);
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
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
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
      const { data, error } = await supabase.rpc("get_recovery_offers");
      if (error) {
        console.error("Failed to fetch recovery offers:", error);
        return [];
      }
      return (data || []).flatMap((offer) =>
        isRecoveryOfferType(offer.offer_type)
          ? [{ ...offer, offer_type: offer.offer_type }]
          : [],
      );
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
      const result = parseRecoveryAction(data);
      if (result.success) {
        toast.success("Subscription reactivated!");
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
      offerId: string
    ): Promise<{ success: boolean; error?: string; message?: string }> => {
      if (!user) return { success: false, error: "Not authenticated" };
      const { data, error } = await supabase.rpc("apply_recovery_offer", {
        p_subscription_id: subscriptionId,
        p_offer_id: offerId,
      });
      if (error) return { success: false, error: error.message };
      const result = parseRecoveryAction(data);
      if (result.success) {
        toast.success("Offer applied! Welcome back!");
        queryClient.invalidateQueries({ queryKey: ["recovery_status", user?.id] });
        queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] });
        return { success: true, message: result.message };
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

  const dismiss = useCallback(async (subscriptionId: string): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("dismiss_recovery", {
      p_subscription_id: subscriptionId,
    });
    if (error) {
      console.error("Failed to dismiss recovery:", error);
      return false;
    }
    const result = parseRecoveryAction(data);
    if (result.success) {
      toast.success("Offer dismissed");
      queryClient.invalidateQueries({ queryKey: ["recovery_status", user?.id] });
      return true;
    }
    if (result.error) console.error("Failed to dismiss recovery:", result.error);
    return false;
  }, [user, queryClient]);

  return { dismiss };
}
