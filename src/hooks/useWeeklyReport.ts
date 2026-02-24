import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek } from "date-fns";

interface WeeklyReport {
  id: string;
  week_start_date: string;
  week_end_date: string;
  avg_calories: number;
  avg_protein: number;
  avg_carbs: number;
  avg_fat: number;
  weight_change_kg: number | null;
  consistency_score: number;
  days_logged: number;
  report_data: any;
}

export function useWeeklyReport(userId: string | undefined) {
  const [currentWeekReport, setCurrentWeekReport] = useState<WeeklyReport | null>(null);
  const [historicalReports, setHistoricalReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Get current week dates
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });

      // Check if report exists for current week
      const { data: existingReport, error: reportError } = await (supabase as any)
        .from("weekly_nutrition_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start_date", format(weekStart, "yyyy-MM-dd"))
        .maybeSingle();

      if (reportError) throw reportError;

      if (existingReport) {
        setCurrentWeekReport(existingReport);
      }

      // Fetch historical reports
      const { data: reports, error: historyError } = await (supabase as any)
        .from("weekly_nutrition_reports")
        .select("*")
        .eq("user_id", userId)
        .order("week_start_date", { ascending: false })
        .limit(4);

      if (historyError) throw historyError;

      setHistoricalReports(reports || []);

      // If no current report exists, try to generate one
      if (!existingReport) {
        const { data: newReport, error: genError } = await (supabase as any)
          .rpc("generate_weekly_report", {
            p_user_id: userId,
            p_week_start: format(weekStart, "yyyy-MM-dd"),
          });

        if (!genError && newReport) {
          setCurrentWeekReport(newReport);
        }
      }
    } catch (error) {
      console.error("Error fetching weekly report:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    currentWeekReport,
    historicalReports,
    loading,
    refresh: fetchReports,
  };
}
