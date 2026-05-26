import { useState } from "react";
import { subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { WeeklyReportData } from "@/lib/professional-weekly-report-pdf";
import { nutrioReportPDF } from "@/lib/nutrio-report-pdf";
import { generateWeeklyMealPlan, loadMealPlanImages } from "@/lib/meal-plan-generator";
import { calculateBMR, calculateTDEE, calculateTargetCalories, calculateMacros } from "@/lib/nutrition-calculator";

export function useDownloadReport(
  userId: string | undefined,
  userEmail: string | undefined,
  weeklySummary: any,
  activeGoal: any,
  dailyCalorieTarget: number,
  dailyProteinTarget: number,
  calorieProgress: number,
  averageScore: number | undefined,
  streaks: any,
  milestones: any,
  recommendations: any[],
  profile: any,
) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [generatingReport, setGeneratingReport] = useState(false);

  const handleDownloadReport = async () => {
    if (!userId || !weeklySummary) {
      toast({ title: t("no_data_available"), variant: "destructive" });
      return;
    }

    setGeneratingReport(true);
    try {
      const weekEnd = new Date();
      const weekStart = subDays(weekEnd, 7);

      const { data: dailyLogs } = await supabase
        .from('progress_logs')
        .select('log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, weight_kg')
        .eq('user_id', userId)
        .gte('log_date', weekStart.toISOString().split('T')[0])
        .lte('log_date', weekEnd.toISOString().split('T')[0])
        .order('log_date');

      const { data: waterLogs } = await supabase
        .from('water_intake')
        .select('log_date, glasses')
        .eq('user_id', userId)
        .gte('log_date', weekStart.toISOString().split('T')[0])
        .lte('log_date', weekEnd.toISOString().split('T')[0]);

      const lastWeekStart = subDays(weekStart, 7);
      const { data: lastWeekLogs } = await supabase
        .from('progress_logs')
        .select('calories_consumed')
        .eq('user_id', userId)
        .gte('log_date', lastWeekStart.toISOString().split('T')[0])
        .lt('log_date', weekStart.toISOString().split('T')[0]);

      const lastWeekAvg = lastWeekLogs && lastWeekLogs.length > 0
        ? lastWeekLogs.reduce((sum: number, log: Record<string, unknown>) => sum + ((log.calories_consumed as number) || 0), 0) / lastWeekLogs.length
        : 0;

      const mealPlan = await generateWeeklyMealPlan(dailyCalorieTarget, dailyProteinTarget);

      const mealImages = await loadMealPlanImages(mealPlan);
      const mealPlanWithEmbeddedImages = mealPlan.map((day) => {
        const embed = (meal: typeof day.breakfast) =>
          meal
            ? { ...meal, image_url: mealImages.get(meal.id) || meal.image_url }
            : meal;
        return {
          ...day,
          breakfast: embed(day.breakfast),
          lunch: embed(day.lunch),
          dinner: embed(day.dinner),
          snack: embed(day.snack),
        };
      });

      const reportDailyData: WeeklyReportData['dailyData'] = [];
      for (let i = 0; i < 7; i++) {
        const date = subDays(weekEnd, i);
        const dateStr = date.toISOString().split('T')[0];
        const log = dailyLogs?.find((l: Record<string, unknown>) => l.log_date === dateStr);
        const waterLog = waterLogs?.find((w: Record<string, unknown>) => w.log_date === dateStr);
        
        reportDailyData.unshift({
          date: dateStr,
          calories: log?.calories_consumed || 0,
          protein: log?.protein_consumed_g || 0,
          carbs: log?.carbs_consumed_g || 0,
          fat: log?.fat_consumed_g || 0,
          weight: log?.weight_kg || null,
          water: waterLog?.glasses || 0,
        });
      }

      const reportData: WeeklyReportData = {
        userName: userEmail?.split('@')[0] || 'User',
        userEmail: userEmail || '',
        reportDate: new Date().toISOString(),
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        currentWeight: null,
        weightChange: null,
        weightGoal: activeGoal?.target_weight_kg || null,
        weightProgress: 0,
        avgCalories: weeklySummary?.calories.thisWeekAvg || 0,
        calorieTarget: dailyCalorieTarget,
        calorieProgress: calorieProgress,
        avgProtein: weeklySummary?.macros?.protein?.consumed || 0,
        proteinTarget: dailyProteinTarget,
        avgCarbs: weeklySummary?.macros?.carbs?.consumed || 0,
        carbsTarget: 250,
        avgFat: weeklySummary?.macros?.fat?.consumed || 0,
        fatTarget: 65,
        dailyData: reportDailyData,
        consistencyScore: weeklySummary?.consistency?.percentage || 0,
        daysLogged: weeklySummary?.consistency?.daysLogged || 0,
        totalDays: 7,
        mealQualityScore: averageScore || 0,
        waterAverage: reportDailyData.reduce((sum, d) => sum + d.water, 0) / 7,
        currentStreak: streaks?.logging?.currentStreak || 0,
        bestStreak: streaks?.logging?.bestStreak || 0,
        activeGoal: activeGoal?.goal_type || null,
        goalProgress: 0,
        milestonesAchieved: milestones?.filter((m: Record<string, unknown>) => m.achieved_at).length || 0,
        totalMilestones: milestones?.length || 0,
        insights: recommendations.slice(0, 3).map((r: any) => r.description),
        recommendations: recommendations.slice(0, 3).map((r: any) => `${r.title}: ${r.description}`),
        vsLastWeek: {
          calories: weeklySummary ? weeklySummary.calories.thisWeekAvg - lastWeekAvg : 0,
          weight: 0,
          consistency: weeklySummary?.consistency?.percentage || 0,
        },
        mealPlan: mealPlanWithEmbeddedImages,
        mealImages,
      };

      const { data: weightHistory } = await supabase
        .from('body_measurements')
        .select('log_date, weight_kg')
        .eq('user_id', userId)
        .gte('log_date', weekStart.toISOString().split('T')[0])
        .lte('log_date', weekEnd.toISOString().split('T')[0])
        .order('log_date');

      const dailySteps = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(weekEnd, 6 - i);
        const dateStr = d.toISOString().split('T')[0];
        const steps = parseInt(localStorage.getItem(`tracker_steps_${userId}_${dateStr}`) || '0', 10);
        return { date: dateStr, steps };
      });

      const dailyWater = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(weekEnd, 6 - i);
        const dateStr = d.toISOString().split('T')[0];
        const waterLog = waterLogs?.find((w: Record<string, unknown>) => w.log_date === dateStr);
        return { date: dateStr, waterMl: (waterLog?.glasses || 0) * 250 };
      });

      const heightCm = profile?.height_cm || null;
      const currentWeightKg = profile?.current_weight_kg || null;
      const bmi = heightCm && currentWeightKg
        ? parseFloat((currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
        : null;
      const bmiLabel = bmi === null ? null
        : bmi < 18.5 ? 'Underweight'
        : bmi < 25 ? 'Normal'
        : bmi < 30 ? 'Overweight'
        : bmi < 35 ? 'Obese I'
        : 'Obese II';

      reportData.trackerInsights = {
        dailySteps,
        dailyWater,
        weightHistory: (weightHistory || []).map((w: Record<string, unknown>) => ({ date: w.log_date as string, weight_kg: w.weight_kg as number })),
        bmi,
        bmiLabel,
        heightCm,
        stepGoal: 6000,
        waterTargetMl: 2500,
      };

      await nutrioReportPDF.download(reportData);
      toast({ title: t("report_downloaded"), description: "Your Nutrition Performance & Habit Intelligence report has been saved." });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({ title: t("report_failed"), variant: "destructive" });
    } finally {
      setGeneratingReport(false);
    }
  };

  return { handleDownloadReport, generatingReport };
}
