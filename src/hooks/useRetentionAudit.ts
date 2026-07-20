import { useQuery } from "@tanstack/react-query";

import { fetchRetentionAuditLogs } from "@/services/retentionAuditService";
import type { RetentionAuditFilters } from "@/types/retention";

export function useRetentionAudit(filters: RetentionAuditFilters = {}) {
  return useQuery({
    queryKey: ["retention-audit", filters],
    queryFn: () => fetchRetentionAuditLogs(filters),
  });
}

export const useRetentionAuditLogs = useRetentionAudit;
