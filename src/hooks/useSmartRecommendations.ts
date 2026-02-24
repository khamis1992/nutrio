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
}

export function useSmartRecommendations(userId: string | undefined) {
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const generateRecommendations = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Generate recommendations based on user's data
      const { data: weeklyData } = await (supabase as any)
        .from("weekly_nutrition_reports")
        .select("avg_calories, avg_protein, avg_carbs, avg_fat, consistency_score, avg_fiber")
        .eq("user_id", userId)
        .order("week_start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: waterData } = await (supabase as any)
        .from("water_intake")
        .select("glasses, log_date")
        .eq("user_id", userId)
        .gte("log_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const { data: streakData } = await (supabase as any)
        .from("user_streaks")
        .select("streak_type, current_streak")
        .eq("user_id", userId);

      const generatedRecs: SmartRecommendation[] = [];

      // Nutrition recommendations
      if (weeklyData) {
        if (weeklyData.avg_protein < 80) {
          generatedRecs.push({
            id: "protein-boost",
            category: "nutrition",
            priority: "high",
            title: "Boost Your Protein Intake",
            description: "Your protein intake is below optimal levels. Try adding lean meats, fish, legumes, or protein shakes.",
            action_text: "Browse High-Protein Meals",
            action_link: "/meals",
          });
        }

        if (weeklyData.avg_fiber && weeklyData.avg_fiber < 20) {
          generatedRecs.push({
            id: "fiber-boost",
            category: "nutrition",
            priority: "medium",
            title: "Increase Fiber Intake",
            description: "Your fiber intake is below optimal levels. Try adding more vegetables, fruits, and whole grains.",
            action_text: "View Meal Tips",
            action_link: null,
          });
        }

        if (weeklyData.consistency_score < 50) {
          generatedRecs.push({
            id: "consistency",
            category: "general",
            priority: "high",
            title: "Build Consistency",
            description: "Logging your meals regularly helps you stay on track. Try setting daily reminders.",
            action_text: "Set Reminders",
            action_link: null,
          });
        }
      }

      // Hydration recommendations
      if (waterData) {
        const totalGlasses = waterData.reduce((sum: number, entry: any) => sum + (entry.glasses || 0), 0);
        const avgDailyGlasses = totalGlasses / 7;

        if (avgDailyGlasses < 5) {
          generatedRecs.push({
            id: "hydration",
            category: "hydration",
            priority: "medium",
            title: "Stay Better Hydrated",
            description: "Your average water intake is below recommended levels (8 glasses/day). Try drinking a glass before each meal.",
            action_text: "Track Water",
            action_link: null,
          });
        }
      }

      // Streak-based recommendations
      const loggingStreak = streakData?.find((s: any) => s.streak_type === "logging");
      if (loggingStreak?.current_streak >= 7) {
        generatedRecs.push({
          id: "streak-milestone",
          category: "general",
          priority: "low",
          title: "Amazing Streak!",
          description: `You're on a ${loggingStreak.current_streak}-day logging streak! Keep up the great work.`,
          action_text: "Share Progress",
          action_link: null,
        });
      }

      // Add general recommendation if list is short
      if (generatedRecs.length < 3) {
        generatedRecs.push({
          id: "general-health",
          category: "general",
          priority: "low",
          title: "Track Your Progress",
          description: "Regularly reviewing your progress helps you stay motivated and make adjustments.",
          action_text: "View Full Report",
          action_link: "/progress",
        });
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      generatedRecs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      setRecommendations(generatedRecs);
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
