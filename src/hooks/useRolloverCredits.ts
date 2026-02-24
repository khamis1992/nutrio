import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface RolloverInfo {
  rollover_credits: number;
  expiry_date: string | null;
  total_credits: number;
  new_credits: number;
}

export interface RolloverRecord {
  id: string;
  user_id: string;
  subscription_id: string;
  rollover_credits: number;
  source_cycle_start: string;
  source_cycle_end: string;
  expiry_date: string;
  is_consumed: boolean;
  consumed_at?: string;
  created_at: string;
}

// Get rollover credits info for a subscription
// NOTE: Rollover functionality is disabled - database columns don't exist
export function useRolloverCredits(_subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["rollover-credits", _subscriptionId],
    queryFn: async () => {
      // Return default values since rollover tables/columns don't exist
      return {
        rollover_credits: 0,
        expiry_date: null,
        total_credits: 0,
        new_credits: 0,
      } as RolloverInfo;
    },
    enabled: false,
  });
}

// Get active rollover records
// NOTE: Rollover functionality is disabled - database tables don't exist
export function useActiveRollovers(_subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["active-rollovers", _subscriptionId],
    queryFn: async () => {
      return [] as RolloverRecord[];
    },
    enabled: false,
  });
}

// Get rollover history
// NOTE: Rollover functionality is disabled - database tables don't exist
export function useRolloverHistory(_subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["rollover-history", _subscriptionId],
    queryFn: async () => {
      return [] as RolloverRecord[];
    },
    enabled: false,
  });
}

// Get days until rollover expiry
export function useRolloverExpiryCountdown(expiryDate: string | null) {
  if (!expiryDate) return null;

  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    days: Math.max(0, diffDays),
    isExpired: diffDays <= 0,
    isExpiringSoon: diffDays <= 3 && diffDays > 0,
  };
}

// Calculate rollover utilization rate
// NOTE: Rollover functionality is disabled - database tables don't exist
export function useRolloverStats(_subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["rollover-stats", _subscriptionId],
    queryFn: async () => {
      return {
        totalRollovers: 0,
        consumedRollovers: 0,
        expiredRollovers: 0,
        utilizationRate: 0,
        totalCreditsRolled: 0,
        totalCreditsConsumed: 0,
      };
    },
    enabled: false,
  });
}

// Refresh rollover data
export function useRefreshRolloverData() {
  const queryClient = useQueryClient();

  return {
    refresh: (subscriptionId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["rollover-credits", subscriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["active-rollovers", subscriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["rollover-history", subscriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["rollover-stats", subscriptionId],
      });
    },
  };
}
