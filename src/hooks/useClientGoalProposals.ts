import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientGoalProposal {
  id: string;
  coach_id: string;
  client_id: string;
  goal_type: string;
  target_value: string;
  current_value: string | null;
  deadline: string | null;
  status: "proposed" | "accepted" | "rejected" | "completed";
  notes: string | null;
  created_at: string;
  updated_at: string;
  coach_name?: string;
}

export interface GoalProgress {
  proposalId: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  progressPct: number;
  unit: string;
  deadline: string | null;
  daysRemaining: number | null;
}

/**
 * Client-side hook for viewing and interacting with coach-proposed goals.
 * Fetches all goal proposals for the current client (from any coach),
 * provides accept/reject actions, and computes progress from live data.
 */
export function useClientGoalProposals(clientId: string | undefined) {
  const [proposals, setProposals] = useState<ClientGoalProposal[]>([]);
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    if (!clientId) {
      setProposals([]);
      setLoading(false);
      return;
    }
    try {
      // Fetch goal proposals for this client
      const { data, error } = await supabase
        .from("goal_proposals")
        .select(`
          id,
          coach_id,
          client_id,
          goal_type,
          target_value,
          current_value,
          deadline,
          status,
          notes,
          created_at,
          updated_at
        `)
        .eq("client_id", clientId)
        .in("status", ["proposed", "accepted"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const proposalRows: ClientGoalProposal[] = (data || []).map((proposal) => ({
        ...proposal,
        status: proposal.status as ClientGoalProposal["status"],
      }));

      // Enrich with coach names
      const coachIds = [...new Set(proposalRows.map((proposal) => proposal.coach_id))];
      const coachNames: Record<string, string> = {};

      if (coachIds.length > 0) {
        const { data: coachData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", coachIds);

        (coachData || []).forEach((c: { user_id: string; full_name: string | null }) => {
          coachNames[c.user_id] = c.full_name || "Coach";
        });
      }

      const enriched = proposalRows.map((p) => ({
        ...p,
        coach_name: coachNames[p.coach_id] || "Coach",
      }));

      setProposals(enriched);

      // Compute progress for accepted goals
      const acceptedGoals = enriched.filter(
        (p: ClientGoalProposal) => p.status === "accepted"
      );
      await computeProgress(acceptedGoals);
    } catch (err) {
      console.error("Error fetching client goal proposals:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const computeProgress = useCallback(async (goals: ClientGoalProposal[]) => {
    if (!clientId || goals.length === 0) {
      setProgress([]);
      return;
    }

    const progressList: GoalProgress[] = [];

    for (const goal of goals) {
      const target = parseFloat(goal.target_value) || 0;
      let current = parseFloat(goal.current_value || "0") || 0;
      let unit = "";
      let daysRemaining: number | null = null;

      if (goal.deadline) {
        const deadlineDate = new Date(goal.deadline);
        const now = new Date();
        daysRemaining = Math.max(
          0,
          Math.ceil(
            (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
      }

      // Auto-track current value based on goal type
      switch (goal.goal_type) {
        case "weight_target": {
          unit = "kg";
          // Get latest weight from body_measurements
          const { data: weightData } = await supabase
            .from("body_measurements")
            .select("weight_kg")
            .eq("user_id", clientId)
            .order("log_date", { ascending: false })
            .limit(1);

          if (weightData && weightData.length > 0) {
            current = weightData[0].weight_kg || 0;
          }
          break;
        }
        case "calorie_target": {
          unit = "kcal";
          // Get average daily calories from last 7 days of progress_logs
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const { data: logData } = await supabase
            .from("progress_logs")
            .select("calories_consumed")
            .eq("user_id", clientId)
            .gte("log_date", sevenDaysAgo.toISOString().split("T")[0]);

          if (logData && logData.length > 0) {
            const avg =
              logData.reduce(
                (sum: number, l: { calories_consumed: number | null }) =>
                  sum + (l.calories_consumed || 0),
                0
              ) / logData.length;
            current = Math.round(avg);
          }
          break;
        }
        case "streak_target": {
          unit = "days";
          const { data: streakData } = await supabase
            .from("user_streaks")
            .select("current_streak")
            .eq("user_id", clientId)
            .eq("streak_type", "logging")
            .limit(1);

          if (streakData && streakData.length > 0) {
            current = streakData[0].current_streak || 0;
          }
          break;
        }
        case "workout_frequency": {
          unit = "sessions";
          // Count workout sessions in the last 7 days
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const { data: workoutData } = await supabase
            .from("workout_sessions")
            .select("id")
            .eq("user_id", clientId)
            .gte("created_at", weekAgo.toISOString());

          current = workoutData?.length || 0;
          break;
        }
        case "meal_adherence": {
          unit = "%";
          // Calculate meal adherence from last 7 days
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const { data: mealData } = await supabase
            .from("meal_schedules")
            .select("order_status")
            .eq("user_id", clientId)
            .gte("scheduled_date", weekAgo.toISOString().split("T")[0]);

          if (mealData && mealData.length > 0) {
            const completed = mealData.filter(
              (meal) => meal.order_status === "delivered" || meal.order_status === "completed"
            ).length;
            current = Math.round((completed / mealData.length) * 100);
          }
          break;
        }
        case "macro_target": {
          unit = "%";
          // Check if client is hitting macro targets
          const today = new Date().toISOString().split("T")[0];
          const { data: todayLog } = await supabase
            .from("progress_logs")
            .select("protein_consumed_g, carbs_consumed_g, fat_consumed_g")
            .eq("user_id", clientId)
            .eq("log_date", today)
            .limit(1);

          if (todayLog && todayLog.length > 0) {
            const log = todayLog[0];
            // Simple: average of protein/carbs/fat target hit percentage
            const proteinPct = Math.min(
              100,
              ((log.protein_consumed_g || 0) / 150) * 100
            );
            const carbsPct = Math.min(
              100,
              ((log.carbs_consumed_g || 0) / 250) * 100
            );
            const fatPct = Math.min(
              100,
              ((log.fat_consumed_g || 0) / 65) * 100
            );
            current = Math.round((proteinPct + carbsPct + fatPct) / 3);
          }
          break;
        }
        default: {
          // Generic: use current_value as-is if set
          if (goal.current_value) {
            current = parseFloat(goal.current_value) || 0;
          }
        }
      }

      // Calculate progress percentage
      let progressPct = 0;
      if (target > 0) {
        if (goal.goal_type === "weight_target") {
          // For weight loss, progress = how close to target (starting from a higher weight)
          // For weight gain, similar logic
          // We use current_value stored or fetched above
          // Progress = (1 - |current - target| / |start - target|) * 100
          // But we don't have start weight easily, so we use target vs current ratio
          progressPct = Math.min(
            100,
            Math.max(
              0,
              Math.round((1 - Math.abs(current - target) / Math.max(target, 1)) * 100)
            )
          );
        } else if (goal.goal_type === "meal_adherence" || goal.goal_type === "macro_target") {
          // Percentage goals: current is already a percentage
          progressPct = Math.min(100, Math.round((current / target) * 100));
        } else {
          // Counting goals: sessions, days, etc.
          progressPct = Math.min(100, Math.round((current / target) * 100));
        }
      }

      progressList.push({
        proposalId: goal.id,
        goalType: goal.goal_type,
        targetValue: target,
        currentValue: current,
        progressPct,
        unit,
        deadline: goal.deadline,
        daysRemaining,
      });

      // Update current_value in DB if it changed
      const newCurrentValue = String(current);
      if (goal.current_value !== newCurrentValue && goal.status === "accepted") {
        await supabase
          .from("goal_proposals")
          .update({
            current_value: newCurrentValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", goal.id);
      }
    }

    setProgress(progressList);
  }, [clientId]);

  const acceptGoal = useCallback(
    async (proposalId: string) => {
      if (!clientId) return;
      try {
        const { error } = await supabase
          .from("goal_proposals")
          .update({ status: "accepted", updated_at: new Date().toISOString() })
          .eq("id", proposalId)
          .eq("client_id", clientId);

        if (error) throw error;
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId ? { ...p, status: "accepted" as const } : p
          )
        );
      } catch (err) {
        console.error("Error accepting goal:", err);
      }
    },
    [clientId]
  );

  const rejectGoal = useCallback(
    async (proposalId: string) => {
      if (!clientId) return;
      try {
        const { error } = await supabase
          .from("goal_proposals")
          .update({ status: "rejected", updated_at: new Date().toISOString() })
          .eq("id", proposalId)
          .eq("client_id", clientId);

        if (error) throw error;
        // Remove rejected goals from view
        setProposals((prev) => prev.filter((p) => p.id !== proposalId));
      } catch (err) {
        console.error("Error rejecting goal:", err);
      }
    },
    [clientId]
  );

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return {
    proposals,
    progress,
    loading,
    acceptGoal,
    rejectGoal,
    refresh: fetchProposals,
  };
}
