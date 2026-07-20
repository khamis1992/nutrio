import { useQuery } from "@tanstack/react-query";

import { fetchRetentionAnalytics } from "@/services/retentionAnalyticsService";

export function useRetentionAnalytics() {
  return useQuery({
    queryKey: ["retention-analytics"],
    queryFn: fetchRetentionAnalytics,
  });
}
