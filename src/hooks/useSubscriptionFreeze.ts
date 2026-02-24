import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SubscriptionFreeze {
  id: string;
  user_id: string;
  subscription_id: string;
  freeze_start_date: string;
  freeze_end_date: string;
  freeze_days: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  requested_at: string;
  activated_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
}

export interface FreezeRequestInput {
  subscription_id: string;
  freeze_start_date: string;
  freeze_end_date: string;
}

export interface FreezeRequestResult {
  success: boolean;
  freeze_id?: string;
  freeze_days?: number;
  freeze_start?: string;
  freeze_end?: string;
  days_remaining_this_cycle?: number;
  error?: string;
}

// Fetch freezes for a subscription
export function useSubscriptionFreezes(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["subscription-freezes", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return [];
      
      const { data, error } = await supabase
        .from("subscription_freezes")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .order("requested_at", { ascending: false });

      if (error) {
        console.error("Error fetching freezes:", error);
        throw error;
      }

      return data as SubscriptionFreeze[];
    },
    enabled: !!subscriptionId,
  });
}

// Fetch active freezes
export function useActiveFreezes(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["active-freezes", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return [];
      
      const { data, error } = await supabase
        .from("subscription_freezes")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .in("status", ["scheduled", "active"])
        .order("freeze_start_date", { ascending: true });

      if (error) {
        console.error("Error fetching active freezes:", error);
        throw error;
      }

      return data as SubscriptionFreeze[];
    },
    enabled: !!subscriptionId,
  });
}

// Get freeze days remaining
export function useFreezeDaysRemaining(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["freeze-days-remaining", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return { used: 0, remaining: 7, total: 7 };
      
      const { data, error } = await supabase
        .from("subscriptions")
        .select("freeze_days_used")
        .eq("id", subscriptionId)
        .single();

      if (error) {
        console.error("Error fetching freeze days:", error);
        throw error;
      }

      const used = data?.freeze_days_used || 0;
      return {
        used,
        remaining: 7 - used,
        total: 7,
      };
    },
    enabled: !!subscriptionId,
  });
}

// Request a freeze
export function useRequestFreeze() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FreezeRequestInput) => {
      const { data, error } = await supabase.functions.invoke(
        "handle-freeze-request",
        {
          body: input,
        }
      );

      if (error) {
        console.error("Error requesting freeze:", error);
        throw error;
      }

      return data as FreezeRequestResult;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["subscription-freezes", variables.subscription_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["active-freezes", variables.subscription_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["freeze-days-remaining", variables.subscription_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["subscription"],
      });

      if (result.success) {
        toast.success(
          `Freeze scheduled for ${result.freeze_days} days. ${result.days_remaining_this_cycle} days remaining this cycle.`
        );
      } else {
        toast.error(result.error || "Failed to schedule freeze");
      }
    },
    onError: (error: Error) => {
      console.error("Freeze request error:", error);
      toast.error(error.message || "Failed to schedule freeze");
    },
  });
}

// Cancel a scheduled freeze
export function useCancelFreeze() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      freezeId,
      subscriptionId,
      reason,
    }: {
      freezeId: string;
      subscriptionId: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("subscription_freezes")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_reason: reason || "User cancelled",
        })
        .eq("id", freezeId)
        .eq("status", "scheduled");

      if (error) {
        console.error("Error cancelling freeze:", error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["subscription-freezes", variables.subscriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["active-freezes", variables.subscriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["freeze-days-remaining", variables.subscriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["subscription"],
      });
      toast.success("Freeze cancelled successfully");
    },
    onError: (error) => {
      console.error("Cancel freeze error:", error);
      toast.error("Failed to cancel freeze. It may have already started.");
    },
  });
}

// Check if subscription is currently frozen
export function useIsSubscriptionFrozen(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["is-frozen", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return false;
      
      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("subscription_freezes")
        .select("id")
        .eq("subscription_id", subscriptionId)
        .eq("status", "active")
        .lte("freeze_start_date", today)
        .gte("freeze_end_date", today)
        .limit(1);

      if (error) {
        console.error("Error checking freeze status:", error);
        throw error;
      }

      return data && data.length > 0;
    },
    enabled: !!subscriptionId,
  });
}

// Get all freezes for a user (across all subscriptions)
export function useUserFreezes(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-freezes", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("subscription_freezes")
        .select("*, subscriptions(plan_id)")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false });

      if (error) {
        console.error("Error fetching user freezes:", error);
        throw error;
      }

      return data as (SubscriptionFreeze & { subscriptions: { plan_id: string } })[];
    },
    enabled: !!userId,
  });
}
