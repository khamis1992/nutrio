import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NutritionGoal {
  id: string;
  goal_type: "weight_loss" | "muscle_gain" | "maintenance" | "general_health";
  target_weight_kg: number | null;
  target_date: string | null;
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
  is_active: boolean;
  calculation_source?: string | null;
  reason?: string | null;
  version?: number | null;
  activity_level_snapshot?: string | null;
}

interface GoalEvent {
  id: string;
  goal_id: string | null;
  event_type: string;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

interface Milestone {
  id: string;
  milestone_type: string;
  milestone_value: number | null;
  description: string;
  achieved_at: string | null;
  is_celebrated: boolean | null;
  icon_emoji: string | null;
}

export function useNutritionGoals(userId: string | undefined) {
  const [goals, setGoals] = useState<NutritionGoal[]>([]);
  const [activeGoal, setActiveGoal] = useState<NutritionGoal | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [goalEvents, setGoalEvents] = useState<GoalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch nutrition goals
      let { data: goalsData, error: goalsError } = await supabase
        .from("nutrition_goals")
        .select("id, goal_type, target_weight_kg, target_date, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g, is_active, calculation_source, reason, version, activity_level_snapshot")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (goalsError && /calculation_source|reason|version|activity_level_snapshot/i.test(goalsError.message)) {
        const fallback = await supabase
          .from("nutrition_goals")
          .select("id, goal_type, target_weight_kg, target_date, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g, is_active")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        goalsData = (fallback.data || []).map((goal) => ({
          ...goal,
          calculation_source: null,
          reason: null,
          version: null,
          activity_level_snapshot: null,
        }));
        goalsError = fallback.error;
      }

      if (goalsError) throw goalsError;

      const goalsList: NutritionGoal[] = (goalsData || []).map((goal) => ({
        ...goal,
        goal_type: goal.goal_type as NutritionGoal["goal_type"],
        daily_calorie_target: goal.daily_calorie_target ?? 0,
        protein_target_g: goal.protein_target_g ?? 0,
        carbs_target_g: goal.carbs_target_g ?? 0,
        fat_target_g: goal.fat_target_g ?? 0,
        fiber_target_g: goal.fiber_target_g ?? 0,
        is_active: goal.is_active ?? false,
      }));
      setGoals(goalsList);
      setActiveGoal(goalsList.find((goal) => goal.is_active) || goalsList[0] || null);

      const { data: eventsData, error: eventsError } = await supabase
        .from("nutrition_goal_events")
        .select("id, goal_id, event_type, previous_values, new_values, reason, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!eventsError) {
        setGoalEvents((eventsData || []) as unknown as GoalEvent[]);
      }

      // Fetch milestones
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("user_milestones")
        .select("id, milestone_type, milestone_value, description, achieved_at, is_celebrated, icon_emoji")
        .eq("user_id", userId)
        .order("achieved_at", { ascending: false });

      if (milestonesError) throw milestonesError;

      setMilestones(milestonesData || []);
    } catch (error) {
      console.error("Error fetching nutrition goals:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const logGoalEvent = useCallback(async (
    goalId: string | null,
    eventType: "created" | "updated" | "recalculated" | "smart_adjusted" | "coach_updated" | "archived" | "activated",
    previousValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null,
    reason?: string | null,
  ) => {
    if (!userId) return;

    const { error } = await supabase
      .from("nutrition_goal_events")
      .insert({
        user_id: userId,
        goal_id: goalId,
        event_type: eventType,
        previous_values: previousValues,
        new_values: newValues,
        reason: reason || null,
      } as never);

    if (error) console.warn("Failed to log nutrition goal event:", error);
  }, [userId]);

  const setGoal = useCallback(async (goal: Omit<NutritionGoal, "id">, reason?: string) => {
    if (!userId) return;

    // Deactivate current goal
    if (activeGoal) {
      await supabase
        .from("nutrition_goals")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);
    }

    // Insert new goal — let any error propagate to the caller
    const insertPayload = {
      user_id: userId,
      goal_type: goal.goal_type,
      target_weight_kg: goal.target_weight_kg,
      target_date: goal.target_date,
      daily_calorie_target: goal.daily_calorie_target,
      protein_target_g: goal.protein_target_g,
      carbs_target_g: goal.carbs_target_g,
      fat_target_g: goal.fat_target_g,
      fiber_target_g: goal.fiber_target_g,
      is_active: true,
      calculation_source: goal.calculation_source || "manual",
      reason: reason || goal.reason || null,
      version: 1,
      activity_level_snapshot: goal.activity_level_snapshot || null,
    };

    let { data, error } = await supabase
      .from("nutrition_goals")
      .insert(insertPayload as never)
      .select("id")
      .single();

    if (error && /calculation_source|reason|version|activity_level_snapshot/i.test(error.message)) {
      const { calculation_source, reason: _reason, version, activity_level_snapshot, ...legacyPayload } = insertPayload;
      void calculation_source;
      void _reason;
      void version;
      void activity_level_snapshot;
      const fallback = await supabase
        .from("nutrition_goals")
        .insert(legacyPayload)
        .select("id")
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    await logGoalEvent(
      (data as { id?: string } | null)?.id || null,
      "created",
      activeGoal as unknown as Record<string, unknown> | null,
      goal as unknown as Record<string, unknown>,
      reason || goal.reason || "Goal created",
    );

    await fetchGoals();
  }, [userId, activeGoal, fetchGoals, logGoalEvent]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const updateGoalTargets = useCallback(async (
    updates: Partial<Pick<NutritionGoal, "daily_calorie_target" | "protein_target_g" | "carbs_target_g" | "fat_target_g">>
  ) => {
    if (!userId || !activeGoal) return false;
    try {
      const { error } = await supabase
        .from("nutrition_goals")
        .update(updates)
        .eq("id", activeGoal.id);
      if (error) throw error;

      await logGoalEvent(
        activeGoal.id,
        "smart_adjusted",
        activeGoal as unknown as Record<string, unknown>,
        { ...activeGoal, ...updates } as unknown as Record<string, unknown>,
        "Smart goal adjustment",
      );

      await fetchGoals();
      return true;
    } catch (error) {
      console.error("Error updating goal targets:", error);
      return false;
    }
  }, [userId, activeGoal, fetchGoals, logGoalEvent]);

  const updateActiveGoal = useCallback(async (
    updates: Partial<Omit<NutritionGoal, "id">>,
    reason?: string,
    eventType: "updated" | "recalculated" | "smart_adjusted" | "coach_updated" = "updated",
  ) => {
    if (!userId || !activeGoal) return false;

    try {
      const payload = {
        ...updates,
        reason: reason || updates.reason || activeGoal.reason || null,
        version: (activeGoal.version || 1) + 1,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase
        .from("nutrition_goals")
        .update(payload as never)
        .eq("id", activeGoal.id);

      if (error && /reason|version|activity_level_snapshot/i.test(error.message)) {
        const { reason: _reason, version, activity_level_snapshot, ...legacyPayload } = payload;
        void _reason;
        void version;
        void activity_level_snapshot;
        const fallback = await supabase
          .from("nutrition_goals")
          .update(legacyPayload as never)
          .eq("id", activeGoal.id);
        error = fallback.error;
      }

      if (error) throw error;

      await logGoalEvent(
        activeGoal.id,
        eventType,
        activeGoal as unknown as Record<string, unknown>,
        { ...activeGoal, ...payload } as unknown as Record<string, unknown>,
        reason || updates.reason || "Goal updated",
      );
      await fetchGoals();
      return true;
    } catch (error) {
      console.error("Error updating active nutrition goal:", error);
      return false;
    }
  }, [userId, activeGoal, fetchGoals, logGoalEvent]);

  return {
    goals,
    activeGoal,
    milestones,
    goalEvents,
    loading,
    error,
    setGoal,
    updateActiveGoal,
    updateGoalTargets,
    refresh: fetchGoals,
  };
}
