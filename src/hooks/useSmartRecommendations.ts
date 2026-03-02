import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SmartRecommendation {
  id: string;
  category: "nutrition" | "hydration" | "activity" | "sleep" | "general";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action_text: string;
  action_link: string | null;
  progress?: { value: number; max: number; unit: string } | null;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function useSmartRecommendations(userId: string | undefined) {
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const generateRecommendations = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Fetch real weekly logs directly (always populated)
      const [logsRes, waterRes, goalRes, streakRes] = await Promise.all([
        supabase
          .from("progress_logs")
          .select("log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
          .eq("user_id", userId)
          .gte("log_date", weekAgo)
          .order("log_date", { ascending: false }),
        (supabase as any)
          .from("water_intake")
          .select("glasses, log_date")
          .eq("user_id", userId)
          .gte("log_date", weekAgo),
        supabase
          .from("nutrition_goals")
          .select("goal_type, daily_calorie_target, protein_target_g, target_weight_kg")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle(),
        (supabase as any)
          .from("user_streaks")
          .select("streak_type, current_streak, best_streak")
          .eq("user_id", userId),
      ]);

      const logs = logsRes.data || [];
      const waterLogs = waterRes.data || [];
      const goal = goalRes.data;
      const streaks = streakRes.data || [];

      const recs: SmartRecommendation[] = [];

      const daysLogged = logs.length;
      const calorieTarget = goal?.daily_calorie_target || 2000;
      const proteinTarget = goal?.protein_target_g || 120;
      const goalType = goal?.goal_type || "general";

      // --- Derived stats ---
      const avgCalories = daysLogged > 0
        ? logs.reduce((s: number, l: any) => s + (l.calories_consumed || 0), 0) / daysLogged
        : 0;
      const avgProtein = daysLogged > 0
        ? logs.reduce((s: number, l: any) => s + (l.protein_consumed_g || 0), 0) / daysLogged
        : 0;
      const avgCarbs = daysLogged > 0
        ? logs.reduce((s: number, l: any) => s + (l.carbs_consumed_g || 0), 0) / daysLogged
        : 0;
      const avgFat = daysLogged > 0
        ? logs.reduce((s: number, l: any) => s + (l.fat_consumed_g || 0), 0) / daysLogged
        : 0;
      const consistencyPct = Math.round((daysLogged / 7) * 100);
      const calorieDiff = avgCalories - calorieTarget;
      const proteinRatio = proteinTarget > 0 ? avgProtein / proteinTarget : 0;

      const totalWater = waterLogs.reduce((s: number, w: any) => s + (w.glasses || 0), 0);
      const avgWater = waterLogs.length > 0 ? totalWater / waterLogs.length : 0;

      const loggingStreak = streaks.find((s: any) => s.streak_type === "logging");
      const currentStreak = loggingStreak?.current_streak || 0;
      const bestStreak = loggingStreak?.best_streak || 0;

      // ─── High Priority ──────────────────────────────────────────────

      if (daysLogged < 3) {
        recs.push({
          id: "low-logging",
          category: "general",
          priority: "high",
          title: "Start Tracking Daily",
          description: `You've only logged ${daysLogged} day${daysLogged === 1 ? "" : "s"} this week. Aim for at least 5 days to unlock accurate insights and recommendations.`,
          action_text: "Log Today's Meals",
          action_link: "/dashboard",
        });
      }

      if (proteinRatio < 0.6 && daysLogged >= 2) {
        recs.push({
          id: "protein-low",
          category: "nutrition",
          priority: "high",
          title: "Protein Needs Attention",
          description: `You're averaging ${Math.round(avgProtein)}g protein — only ${Math.round(proteinRatio * 100)}% of your ${proteinTarget}g target. Add eggs, chicken, fish, or Greek yogurt to each meal.`,
          action_text: "Browse High-Protein Meals",
          action_link: "/meals?filter=high-protein",
          progress: { value: Math.round(avgProtein), max: proteinTarget, unit: "g" },
        });
      }

      if (calorieDiff > 300 && daysLogged >= 3 && (goalType === "lose_weight" || goalType === "maintain_weight")) {
        recs.push({
          id: "calories-over",
          category: "nutrition",
          priority: "high",
          title: "Calorie Surplus Detected",
          description: `Your intake averages ${Math.round(calorieDiff)} kcal over your ${calorieTarget} kcal target. Try reducing portion sizes or swapping high-calorie snacks.`,
          action_text: "View Meal Plan",
          action_link: "/schedule",
          progress: { value: Math.round(avgCalories), max: calorieTarget, unit: "kcal" },
        });
      }

      if (calorieDiff < -400 && daysLogged >= 3 && goalType === "gain_muscle") {
        recs.push({
          id: "calories-under",
          category: "nutrition",
          priority: "high",
          title: "Not Eating Enough for Muscle Gain",
          description: `You're eating ${Math.round(Math.abs(calorieDiff))} kcal below your target. A calorie surplus is essential for muscle growth — add a protein-rich snack or larger meals.`,
          action_text: "Browse High-Calorie Meals",
          action_link: "/meals",
          progress: { value: Math.round(avgCalories), max: calorieTarget, unit: "kcal" },
        });
      }

      // ─── Medium Priority ─────────────────────────────────────────────

      if (proteinRatio >= 0.6 && proteinRatio < 0.85 && daysLogged >= 2) {
        recs.push({
          id: "protein-boost",
          category: "nutrition",
          priority: "medium",
          title: "Boost Protein to Hit Your Goal",
          description: `You're at ${Math.round(avgProtein)}g protein — close to your ${proteinTarget}g target. Try a protein shake or an extra serving of lean meat to close the gap.`,
          action_text: "Find Protein Meals",
          action_link: "/meals?filter=high-protein",
          progress: { value: Math.round(avgProtein), max: proteinTarget, unit: "g" },
        });
      }

      if (avgWater < 5 && waterLogs.length >= 2) {
        recs.push({
          id: "hydration",
          category: "hydration",
          priority: "medium",
          title: "Drink More Water",
          description: `You're averaging ${avgWater.toFixed(1)} glasses per day — below the recommended 8. Start each meal with a full glass to build the habit.`,
          action_text: "Track Water Intake",
          action_link: null,
          progress: { value: parseFloat(avgWater.toFixed(1)), max: 8, unit: "glasses" },
        });
      }

      if (consistencyPct < 60 && daysLogged >= 2) {
        recs.push({
          id: "consistency",
          category: "general",
          priority: "medium",
          title: "Build a Logging Habit",
          description: `You're tracking ${consistencyPct}% of days this week. Set a daily reminder after breakfast to log what you eat while it's fresh.`,
          action_text: "Set a Reminder",
          action_link: null,
        });
      }

      if (avgFat > 80 && daysLogged >= 3) {
        recs.push({
          id: "fat-high",
          category: "nutrition",
          priority: "medium",
          title: "Reduce Saturated Fat",
          description: `Your fat intake is averaging ${Math.round(avgFat)}g/day. Swap fried foods and heavy sauces for grilled options and olive oil-based dressings.`,
          action_text: "Browse Lighter Meals",
          action_link: "/meals?filter=low-fat",
          progress: { value: Math.round(avgFat), max: 80, unit: "g" },
        });
      }

      if (avgCarbs > 300 && daysLogged >= 3 && goalType === "lose_weight") {
        recs.push({
          id: "carbs-high",
          category: "nutrition",
          priority: "medium",
          title: "Moderate Your Carb Intake",
          description: `You're averaging ${Math.round(avgCarbs)}g carbs/day. For weight loss, try swapping white rice or bread for vegetables or legumes.`,
          action_text: "Browse Low-Carb Meals",
          action_link: "/meals?filter=low-carb",
          progress: { value: Math.round(avgCarbs), max: 300, unit: "g" },
        });
      }

      // ─── Low Priority ─────────────────────────────────────────────────

      if (currentStreak >= 7) {
        recs.push({
          id: "streak-fire",
          category: "general",
          priority: "low",
          title: `${currentStreak}-Day Streak! 🔥`,
          description: `You've logged every day for ${currentStreak} days in a row${bestStreak > currentStreak ? ` — your best is ${bestStreak}. Keep pushing!` : " — this is your personal best!"}`,
          action_text: "View Progress",
          action_link: "/progress",
        });
      }

      if (consistencyPct >= 85 && daysLogged >= 5) {
        recs.push({
          id: "great-week",
          category: "general",
          priority: "low",
          title: "Excellent Week!",
          description: `You've tracked ${daysLogged} out of 7 days this week. Your consistency is building powerful nutrition awareness.`,
          action_text: "Download Report",
          action_link: "/progress",
        });
      }

      if (proteinRatio >= 0.9 && daysLogged >= 4) {
        recs.push({
          id: "protein-great",
          category: "nutrition",
          priority: "low",
          title: "Strong Protein Game",
          description: `You're hitting ${Math.round(proteinRatio * 100)}% of your protein target this week. Consistent protein intake supports muscle retention and satiety.`,
          action_text: "View Nutrition",
          action_link: "/progress",
        });
      }

      if (avgWater >= 7) {
        recs.push({
          id: "hydration-great",
          category: "hydration",
          priority: "low",
          title: "Well Hydrated!",
          description: `You're averaging ${avgWater.toFixed(1)} glasses per day — above the recommended 8. Great hydration supports metabolism and energy.`,
          action_text: "Keep It Up",
          action_link: null,
        });
      }

      // ─── Fallback if no recs generated ────────────────────────────────
      if (recs.length === 0) {
        recs.push({
          id: "start-tracking",
          category: "general",
          priority: "low",
          title: "Log Your First Meal",
          description: "Start logging meals to unlock personalized nutrition recommendations tailored to your goals.",
          action_text: "Log a Meal",
          action_link: "/dashboard",
        });
      }

      recs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
      setRecommendations(recs.slice(0, 5));
    } catch (error) {
      console.error("Error generating recommendations:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    generateRecommendations();
  }, [generateRecommendations]);

  return {
    recommendations,
    loading,
    refresh: generateRecommendations,
  };
}
