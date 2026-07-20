import { supabase } from "@/integrations/supabase/client";
import type { RetentionAuditFilters, RetentionAuditLog } from "@/types/retention";

export async function fetchRetentionAuditLogs(
  filters: RetentionAuditFilters = {},
): Promise<RetentionAuditLog[]> {
  let query = supabase
    .from("retention_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.subscriptionId) query = query.eq("subscription_id", filters.subscriptionId);
  if (filters.actionType) query = query.eq("action_type", filters.actionType);
  if (filters.startDate) query = query.gte("created_at", filters.startDate);
  if (filters.endDate) query = query.lte("created_at", filters.endDate);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []) as RetentionAuditLog[];
}
