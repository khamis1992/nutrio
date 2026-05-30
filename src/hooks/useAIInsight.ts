import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAIInsight(
  userId: string | undefined,
  context: {
    weeklyMacros: { avgCalories: number; avgProtein: number; avgCarbs: number; avgFat: number };
    goals: { calorieTarget: number; proteinTarget: number; goalType: string };
    mealQuality: { avgScore: number; trend: number | null };
    streak: { current: number; best: number };
    daysLogged: number;
    waterAvg: number;
  } | null
) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInsight = useCallback(async () => {
    if (!userId || !context) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-insight`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ context }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch insight");

      const result = await response.json();
      setInsight(result.insight);
    } catch (err) {
      console.error("Error fetching AI insight:", err);
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, [userId, context]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  return { insight, loading, refresh: fetchInsight };
}
