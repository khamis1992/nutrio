import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

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
  report_data: Json | null;
}

type WeeklyReportRow = {
  id: string;
  week_start_date: string;
  week_end_date: string;
  avg_calories: number | null;
  avg_protein: number | null;
  avg_carbs: number | null;
  avg_fat: number | null;
  weight_change_kg: number | null;
  consistency_score: number | null;
  days_logged: number | null;
  report_data: Json | null;
};

const normalizeWeeklyReport = (report: WeeklyReportRow): WeeklyReport => ({
  ...report,
  avg_calories: report.avg_calories ?? 0,
  avg_protein: report.avg_protein ?? 0,
  avg_carbs: report.avg_carbs ?? 0,
  avg_fat: report.avg_fat ?? 0,
  consistency_score: report.consistency_score ?? 0,
  days_logged: report.days_logged ?? 0,
});

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
      const { data: existingReport, error: reportError } = await supabase
        .from("weekly_nutrition_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start_date", format(weekStart, "yyyy-MM-dd"))
        .maybeSingle();

      if (reportError) throw reportError;

      if (existingReport) {
        setCurrentWeekReport(normalizeWeeklyReport(existingReport));
      }

      // Fetch historical reports
      const { data: reports, error: historyError } = await supabase
        .from("weekly_nutrition_reports")
        .select("*")
        .eq("user_id", userId)
        .order("week_start_date", { ascending: false })
        .limit(4);

      if (historyError) throw historyError;

      setHistoricalReports((reports ?? []).map(normalizeWeeklyReport));

      // If no current report exists, try to generate one
      if (!existingReport) {
        const { data: reportId, error: genError } = await supabase
          .rpc("generate_weekly_report", {
            p_user_id: userId,
            p_week_start: format(weekStart, "yyyy-MM-dd"),
          });

        if (!genError && reportId) {
          const { data: generatedReport, error: generatedError } = await supabase
            .from("weekly_nutrition_reports")
            .select("*")
            .eq("id", reportId)
            .single();

          if (generatedError) throw generatedError;
          setCurrentWeekReport(normalizeWeeklyReport(generatedReport));
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
