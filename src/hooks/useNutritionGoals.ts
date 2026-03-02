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
}

interface Milestone {
  id: string;
  milestone_type: string;
  milestone_value: number | null;
  description: string;
  achieved_at: string;
  is_celebrated: boolean;
  icon_emoji: string;
}

export function useNutritionGoals(userId: string | undefined) {
  const [goals, setGoals] = useState<NutritionGoal[]>([]);
  const [activeGoal, setActiveGoal] = useState<NutritionGoal | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Fetch nutrition goals
      const { data: goalsData, error: goalsError } = await (supabase as any)
        .from("nutrition_goals")
        .select("id, goal_type, target_weight_kg, target_date, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g, is_active")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (goalsError) throw goalsError;

      const goalsList = goalsData || [];
      setGoals(goalsList);
      setActiveGoal(goalsList.find((g: NutritionGoal) => g.is_active) || goalsList[0] || null);

      // Fetch milestones
      const { data: milestonesData, error: milestonesError } = await (supabase as any)
        .from("user_milestones")
        .select("id, milestone_type, milestone_value, description, achieved_at, is_celebrated, icon_emoji")
        .eq("user_id", userId)
        .order("achieved_at", { ascending: false });

      if (milestonesError) throw milestonesError;

      setMilestones(milestonesData || []);
    } catch (error) {
      console.error("Error fetching nutrition goals:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const setGoal = useCallback(async (goal: Omit<NutritionGoal, "id">) => {
    if (!userId) return;

    try {
      // Deactivate current goal
      if (activeGoal) {
        await (supabase as any)
          .from("nutrition_goals")
          .update({ is_active: false })
          .eq("user_id", userId)
          .eq("is_active", true);
      }

      // Insert new goal
      const { error } = await (supabase as any)
        .from("nutrition_goals")
        .insert({
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
        });

      if (error) throw error;

      await fetchGoals();
    } catch (error) {
      console.error("Error setting nutrition goal:", error);
    }
  }, [userId, activeGoal, fetchGoals]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const updateGoalTargets = useCallback(async (
    updates: Partial<Pick<NutritionGoal, "daily_calorie_target" | "protein_target_g" | "carbs_target_g" | "fat_target_g">>
  ) => {
    if (!userId || !activeGoal) return false;
    try {
      const { error } = await (supabase as any)
        .from("nutrition_goals")
        .update(updates)
        .eq("id", activeGoal.id);
      if (error) throw error;
      await fetchGoals();
      return true;
    } catch (error) {
      console.error("Error updating goal targets:", error);
      return false;
    }
  }, [userId, activeGoal, fetchGoals]);

  return {
    goals,
    activeGoal,
    milestones,
    loading,
    setGoal,
    updateGoalTargets,
    refresh: fetchGoals,
  };
}
