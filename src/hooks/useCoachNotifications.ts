import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CoachMilestone {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: {
    client_id: string;
    milestone_type: string;
    value: string | number;
  } | null;
  status: string;
  read_at: string | null;
  created_at: string;
}

export function useCoachNotifications(coachId: string | undefined) {
  const [milestones, setMilestones] = useState<CoachMilestone[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMilestones = useCallback(async () => {
    if (!coachId) {
      setMilestones([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", coachId)
        .in("type", ["coach_milestone", "coach_onboarding", "coach_session_scheduled", "coach_goal_accepted", "coach_withdrawal"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setMilestones((data || []) as CoachMilestone[]);

      const { data: unreadData, error: unreadError } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", coachId)
        .eq("status", "unread")
        .in("type", ["coach_milestone", "coach_onboarding", "coach_session_scheduled", "coach_goal_accepted", "coach_withdrawal"]);

      if (!unreadError) {
        setUnreadCount(unreadData ? (unreadData as unknown as { count: number }).count || 0 : 0);
      }
    } catch (err) {
      console.error("Error fetching coach notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", coachId);

      if (error) throw error;
      setMilestones((prev) =>
        prev.map((m) => (m.id === notificationId ? { ...m, status: "read", read_at: new Date().toISOString() } : m))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }, [coachId]);

  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("user_id", coachId)
        .eq("status", "unread")
        .in("type", ["coach_milestone", "coach_onboarding", "coach_session_scheduled", "coach_goal_accepted", "coach_withdrawal"]);

      if (error) throw error;
      setMilestones((prev) => prev.map((m) => ({ ...m, status: "read", read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  }, [coachId]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  return { milestones, unreadCount, loading, markAsRead, markAllAsRead, refresh: fetchMilestones };
}
