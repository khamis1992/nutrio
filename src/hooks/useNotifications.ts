import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "unread");

  if (error) throw error;
  return count || 0;
}

export function useNotifications(userId: string | undefined) {
  const enabled = !!userId;

  const { data: unreadCount = 0, isLoading: loading } = useQuery({
    queryKey: ["notifications", "unread", userId],
    queryFn: () => fetchNotificationCount(userId!),
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  return { unreadCount, loading };
}
