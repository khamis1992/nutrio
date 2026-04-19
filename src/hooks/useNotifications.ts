import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/retry";

export function useNotifications(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const fetchUnread = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const { count, error } = await withRetry(async () => {
          const result = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "unread");
          if (result.error) throw result.error;
          return result;
        }, { maxAttempts: 2, delayMs: 500 });

        if (cancelled) return;
        setUnreadCount(count ?? 0);
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching notifications:", err);
        setUnreadCount(0);
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchUnread();

    const channel = supabase
      .channel(`notifications_rt_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      fetchingRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { unreadCount, setUnreadCount };
}
