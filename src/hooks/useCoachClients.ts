import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ClientCompliance {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  goal_type: string | null;
  adherencePct: number;
  macroHitRate: number;
  weightTrend: number | null;
  weightLastKg: number | null;
  streakDays: number;
  daysTrackedThisWeek: number;
}

interface PendingRequest {
  assignmentId: string;
  clientId: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export function useCoachClients(coachId: string | undefined) {
  const [clients, setClients] = useState<ClientCompliance[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!coachId) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      const { data: assignments, error: assignError } = await supabase
        .from("coach_client_assignments")
        .select("client_id")
        .eq("coach_id", coachId)
        .eq("status", "active");

      if (assignError || !assignments?.length) {
        setClients([]);
        setLoading(false);
        return;
      }

      const clientIds = assignments.map((a) => a.client_id);

      const [
        { data: profiles },
        { data: mealSchedules },
        { data: progressLogs },
        { data: goals },
        { data: streaks },
        { data: bodyLogs },
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", clientIds),
        supabase.from("meal_schedules").select("user_id, order_status").in("user_id", clientIds).gte("scheduled_date", weekAgoStr).lte("scheduled_date", todayStr),
        supabase.from("progress_logs").select("user_id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, log_date").in("user_id", clientIds).gte("log_date", weekAgoStr),
        supabase.from("nutrition_goals").select("user_id, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g").in("user_id", clientIds).eq("is_active", true),
        supabase.from("user_streaks").select("user_id, streak_type, current_streak").in("user_id", clientIds).eq("streak_type", "logging"),
        supabase.from("body_measurements").select("user_id, weight_kg, log_date").in("user_id", clientIds).gte("log_date", weekAgoStr).order("log_date", { ascending: true }),
      ]);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const byClient = new Map<string, ClientCompliance>();

      for (const cId of clientIds) {
        const profile = profileMap.get(cId);
        byClient.set(cId, {
          id: cId,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          goal_type: null,
          adherencePct: 0,
          macroHitRate: 0,
          weightTrend: null,
          weightLastKg: null,
          streakDays: 0,
          daysTrackedThisWeek: 0,
        });
      }

      for (const ms of mealSchedules || []) {
        const c = byClient.get(ms.user_id);
        if (!c) continue;
        const status = ms.order_status as string;
        if (status === "delivered" || status === "completed") {
          (c as any)._eaten = ((c as any)._eaten || 0) + 1;
        }
        (c as any)._total = ((c as any)._total || 0) + 1;
      }

      for (const log of progressLogs || []) {
        const c = byClient.get(log.user_id);
        if (!c) continue;
        (c as any)._loggedDays = ((c as any)._loggedDays || 0) + 1;
        (c as any)._caloriesSum = ((c as any)._caloriesSum || 0) + (log.calories_consumed || 0);
      }

      for (const goal of goals || []) {
        const c = byClient.get(goal.user_id);
        if (!c) continue;
        c.goal_type = goal.goal_type as string | null;
        (c as any)._goalCalories = goal.daily_calorie_target;
        (c as any)._goalProtein = goal.protein_target_g;
      }

      for (const streak of streaks || []) {
        const c = byClient.get(streak.user_id);
        if (!c) continue;
        c.streakDays = streak.current_streak || 0;
      }

      for (const log of bodyLogs || []) {
        const c = byClient.get(log.user_id);
        if (!c) continue;
        if (!(c as any)._weights) (c as any)._weights = [];
        (c as any)._weights.push({ date: log.log_date, kg: log.weight_kg });
      }

      for (const c of byClient.values()) {
        const total = (c as any)._total || 0;
        const eaten = (c as any)._eaten || 0;
        c.adherencePct = total > 0 ? Math.round((eaten / total) * 100) : 0;

        const loggedDays = (c as any)._loggedDays || 0;
        const calSum = (c as any)._caloriesSum || 0;
        const goalCal = (c as any)._goalCalories || 2000;
        c.daysTrackedThisWeek = loggedDays;
        c.macroHitRate = loggedDays > 0 ? Math.min(100, Math.round((calSum / loggedDays / goalCal) * 100)) : 0;

        const weights = (c as any)._weights || [];
        if (weights.length >= 2) {
          const first = weights[0].kg;
          const last = weights[weights.length - 1].kg;
          if (first != null && last != null) {
            c.weightTrend = Math.round((last - first) * 100) / 100;
            c.weightLastKg = last;
          }
        } else if (weights.length === 1) {
          c.weightLastKg = weights[0].kg;
        }
      }

      const sorted = Array.from(byClient.values()).sort((a, b) => {
        if (a.adherencePct !== b.adherencePct) return b.adherencePct - a.adherencePct;
        return b.streakDays - a.streakDays;
      });

      setClients(sorted);
    } catch (err) {
      console.error("Error fetching coach clients:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return { clients, loading, refresh: fetchClients };
}
