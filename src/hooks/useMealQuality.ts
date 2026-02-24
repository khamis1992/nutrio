import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

interface MealQualityEntry {
  id: string;
  log_date: string;
  meal_quality_score: number;
  protein_present: boolean;
  vegetables_count: number;
  whole_grains: boolean;
  added_sugars: boolean;
  overall_grade: string;
  notes: string | null;
}

interface DailyQuality {
  date: string;
  avgScore: number;
  mealsCount: number;
}

export function useMealQuality(userId: string | undefined) {
  const [todayQuality, setTodayQuality] = useState<MealQualityEntry[]>([]);
  const [weeklyQuality, setWeeklyQuality] = useState<DailyQuality[]>([]);
  const [averageScore, setAverageScore] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMealQuality = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Fetch today's meal quality logs
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: todayData, error: todayError } = await (supabase as any)
        .from("meal_quality_logs")
        .select("id, log_date, meal_quality_score, protein_present, vegetables_count, whole_grains, added_sugars, overall_grade, notes")
        .eq("user_id", userId)
        .eq("log_date", today)
        .order("created_at", { ascending: false });

      if (todayError) throw todayError;

      setTodayQuality(todayData || []);

      // Fetch last 7 days of meal quality
      const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const { data: weeklyData, error: weeklyError } = await (supabase as any)
        .from("meal_quality_logs")
        .select("meal_quality_score, log_date")
        .eq("user_id", userId)
        .gte("log_date", sevenDaysAgo);

      if (weeklyError) throw weeklyError;

      // Calculate daily averages for the week
      const dailyMap = new Map<string, { scores: number[]; count: number }>();
      
      (weeklyData || []).forEach((entry: MealQualityEntry) => {
        const date = entry.log_date;
        const current = dailyMap.get(date) || { scores: [], count: 0 };
        current.scores.push(entry.meal_quality_score || 0);
        current.count += 1;
        dailyMap.set(date, current);
      });

      const weeklyQualityData: DailyQuality[] = [];
      let totalScore = 0;
      let totalCount = 0;

      dailyMap.forEach((value, date) => {
        const avgScore = value.scores.reduce((a, b) => a + b, 0) / value.scores.length;
        weeklyQualityData.push({
          date,
          avgScore: Math.round(avgScore * 10) / 10,
          mealsCount: value.count,
        });
        totalScore += avgScore;
        totalCount += 1;
      });

      weeklyQualityData.sort((a, b) => a.date.localeCompare(b.date));
      setWeeklyQuality(weeklyQualityData);
      setAverageScore(totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : 0);
    } catch (error) {
      console.error("Error fetching meal quality:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const logMealQuality = useCallback(async (mealData: {
    protein_present: boolean;
    vegetables_count: number;
    whole_grains: boolean;
    added_sugars: boolean;
    notes?: string;
  }) => {
    if (!userId) return;

    try {
      // Calculate quality score using the database function
      const { data: scoreData, error: scoreError } = await (supabase as any)
        .rpc("calculate_meal_quality_score", {
          p_protein_present: mealData.protein_present,
          p_vegetables_count: mealData.vegetables_count,
          p_whole_grains: mealData.whole_grains,
          p_added_sugars: mealData.added_sugars,
        });

      if (scoreError) throw scoreError;

      const score = scoreData || 70;

      // Get grade
      const { data: gradeData, error: gradeError } = await (supabase as any)
        .rpc("get_meal_quality_grade", {
          p_score: score,
        });

      if (gradeError) throw gradeError;

      const grade = gradeData || "C";

      // Log the meal quality
      const today = format(new Date(), "yyyy-MM-dd");
      const { error: insertError } = await (supabase as any)
        .from("meal_quality_logs")
        .insert({
          user_id: userId,
          log_date: today,
          meal_quality_score: score,
          protein_present: mealData.protein_present,
          vegetables_count: mealData.vegetables_count,
          whole_grains: mealData.whole_grains,
          added_sugars: mealData.added_sugars,
          overall_grade: grade,
          notes: mealData.notes || null,
        });

      if (insertError) throw insertError;

      await fetchMealQuality();
    } catch (error) {
      console.error("Error logging meal quality:", error);
    }
  }, [userId, fetchMealQuality]);

  useEffect(() => {
    fetchMealQuality();
  }, [fetchMealQuality]);

  return {
    todayQuality,
    weeklyQuality,
    averageScore,
    loading,
    logMealQuality,
    refresh: fetchMealQuality,
  };
}
