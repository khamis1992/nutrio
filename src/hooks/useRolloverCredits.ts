import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchActiveRolloverRecords,
  fetchRolloverCredits,
  fetchRolloverHistory,
  fetchRolloverStats,
} from "@/services/rolloverService";
import type { RolloverInfo, RolloverRecord, RolloverStats } from "@/types/retention";

export type { RolloverInfo, RolloverRecord, RolloverStats };

export function useRolloverCredits(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["rollover-credits", subscriptionId],
    queryFn: () => fetchRolloverCredits(subscriptionId as string),
    enabled: !!subscriptionId,
  });
}

export function useActiveRollovers(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["active-rollovers", subscriptionId],
    queryFn: () => fetchActiveRolloverRecords(subscriptionId as string),
    enabled: !!subscriptionId,
  });
}

export function useRolloverHistory(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["rollover-history", subscriptionId],
    queryFn: () => fetchRolloverHistory(subscriptionId as string),
    enabled: !!subscriptionId,
  });
}

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

export function useRolloverStats(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ["rollover-stats", subscriptionId],
    queryFn: () => fetchRolloverStats(subscriptionId as string),
    enabled: !!subscriptionId,
  });
}

export function useRefreshRolloverData() {
  const queryClient = useQueryClient();

  return {
    refresh: (subscriptionId: string) => {
      queryClient.invalidateQueries({ queryKey: ["rollover-credits", subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ["active-rollovers", subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ["rollover-history", subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ["rollover-stats", subscriptionId] });
    },
  };
}
