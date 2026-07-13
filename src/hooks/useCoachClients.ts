import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateCoachComplianceBreakdown } from "@/lib/coach-compliance";
import { WATER_GLASS_ML } from "@/lib/water-service";

export interface ClientCompliance {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  goal_type: string | null;
  adherencePct: number;
  macroHitRate: number;
  proteinHitDays: number;
  calorieHitDays: number;
  hydrationHitDays: number;
  coachSummary: string;
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

  const fetchPending = useCallback(async () => {
    if (!coachId) return;
    try {
      const { data: pendingRows } = await supabase
        .from("coach_client_assignments")
        .select("id, client_id, invite_code, created_at")
        .eq("coach_id", coachId)
        .eq("status", "pending");

      if (!pendingRows?.length) {
        setPending([]);
        return;
      }

      const clientIds = pendingRows
        .map((row) => row.client_id)
        .filter((clientId): clientId is string => Boolean(clientId));
      const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();

      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", clientIds);
        for (const p of profiles || []) {
          profileMap.set(p.user_id, p);
        }
      }

      setPending(
        pendingRows.map((r) => ({
          assignmentId: r.id,
          clientId: r.client_id || "",
          fullName: r.client_id ? (profileMap.get(r.client_id)?.full_name || "Unknown Client") : "Waiting (via invite code)",
          avatarUrl: r.client_id ? profileMap.get(r.client_id)?.avatar_url || null : null,
        }))
      );
    } catch (err) {
      console.error("Error fetching pending requests:", err);
    }
  }, [coachId]);

  const handleAccept = useCallback(
    async (assignmentId: string) => {
      if (!coachId) return;
      const { error } = await supabase
        .from("coach_client_assignments")
        .update({ status: "active" })
        .eq("id", assignmentId)
        .eq("coach_id", coachId);

      if (error) throw error;
      setPending((prev) => prev.filter((r) => r.assignmentId !== assignmentId));
      await fetchClients();
    },
    [coachId]
  );

  const handleReject = useCallback(
    async (assignmentId: string) => {
      if (!coachId) return;
      const { error } = await supabase
        .from("coach_client_assignments")
        .update({ status: "revoked" })
        .eq("id", assignmentId)
        .eq("coach_id", coachId);

      if (error) throw error;
      setPending((prev) => prev.filter((r) => r.assignmentId !== assignmentId));
    },
    [coachId]
  );

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

      const clientIds = assignments
        .map((assignment) => assignment.client_id)
        .filter((clientId): clientId is string => Boolean(clientId));

      const [
        { data: profiles },
        { data: mealSchedules },
        { data: progressLogs },
        { data: waterLogs },
        { data: goals },
        { data: streaks },
        { data: bodyLogs },
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", clientIds),
        supabase.from("meal_schedules").select("user_id, order_status").in("user_id", clientIds).gte("scheduled_date", weekAgoStr).lte("scheduled_date", todayStr),
        supabase.from("progress_logs").select("user_id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, log_date").in("user_id", clientIds).gte("log_date", weekAgoStr),
        supabase.from("water_entries").select("user_id, amount_ml, log_date").in("user_id", clientIds).gte("log_date", weekAgoStr).lte("log_date", todayStr),
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
          proteinHitDays: 0,
          calorieHitDays: 0,
          hydrationHitDays: 0,
          coachSummary: "No weekly data yet",
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
        if (!(c as any)._progressLogs) (c as any)._progressLogs = [];
        (c as any)._progressLogs.push(log);
      }

      for (const water of waterLogs || []) {
        const c = byClient.get(water.user_id);
        if (!c) continue;
        if (!(c as any)._waterLogs) (c as any)._waterLogs = [];
        (c as any)._waterLogs.push(water);
      }

      for (const goal of goals || []) {
        const c = byClient.get(goal.user_id);
        if (!c) continue;
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
        c.daysTrackedThisWeek = loggedDays;
        const compliance = calculateCoachComplianceBreakdown(
          ((c as any)._progressLogs || []).map((log: any) => ({
            log_date: log.log_date,
            calories_consumed: log.calories_consumed,
            protein_consumed_g: log.protein_consumed_g,
          })),
          ((c as any)._waterLogs || []).map((log: any) => ({
            log_date: log.log_date,
            glasses: (log.amount_ml || 0) / WATER_GLASS_ML,
          })),
          {
            daily_calorie_target: (c as any)._goalCalories || 2000,
            protein_target_g: (c as any)._goalProtein || 120,
          },
        );
        c.macroHitRate = compliance.macroHitRate;
        c.proteinHitDays = compliance.proteinHitDays;
        c.calorieHitDays = compliance.calorieHitDays;
        c.hydrationHitDays = compliance.hydrationHitDays;
        c.coachSummary = compliance.coachSummary;

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
    if (!coachId) return;
    Promise.all([fetchClients(), fetchPending()]);
  }, [coachId]);

  return { clients, pending, loading, refresh: () => Promise.all([fetchClients(), fetchPending()]), handleAccept, handleReject };
}
