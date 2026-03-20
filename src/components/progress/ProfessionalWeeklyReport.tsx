import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileDown,
  Loader2,
  TrendingUp,
  TrendingDown,
  Flame,
  Target,
  Droplets,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  RefreshCw,
  Apple,
  Lightbulb,
  Moon,
  Zap,
  Check,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { WeeklyReportData } from "@/lib/professional-weekly-report-pdf";

interface ProfessionalWeeklyReportProps {
  userId: string | undefined;
  weeklySummary: {
    calories: { thisWeekAvg: number; lastWeekAvg?: number };
    macros: {
      protein: { consumed: number; target?: number };
      carbs: { consumed: number; target?: number };
      fat: { consumed: number; target?: number };
    };
    consistency: { percentage: number; daysLogged: number };
  } | null;
  activeGoal: {
    goal_type: string | null;
    target_weight_kg: number | null;
    daily_calorie_target: number;
    protein_target_g: number;
    carbs_target_g?: number;
    fat_target_g?: number;
  } | null;
  streaks: { logging?: { currentStreak?: number; bestStreak?: number } | null } | null;
  averageScore: number | null;
  waterSummary: { percentage?: number; total?: number } | null;
  milestones: { achieved_at?: string }[];
  recommendations: { title: string; description: string; category?: string; priority?: string; progress?: { value: number; max: number; unit: string }; action_link?: string; action_text?: string }[];
  dailyData: WeeklyReportData["dailyData"];
  onDownload: () => Promise<void>;
  generatingReport: boolean;
  onRefreshRecommendations?: () => void;
  weeklyBurned?: number;
  bmi?: number | null;
  bmiLabel?: string | null;
}

export function ProfessionalWeeklyReport({
  weeklySummary,
  activeGoal,
  streaks,
  averageScore,
  milestones,
  recommendations,
  dailyData,
  onDownload,
  generatingReport,
  onRefreshRecommendations,
  weeklyBurned = 0,
  bmi,
  bmiLabel,
}: ProfessionalWeeklyReportProps) {
  const { t } = useLanguage();
  const weekStart = subDays(new Date(), 7);
  const weekEnd = new Date();
  const [dismissedRecs, setDismissedRecs] = useState<Set<number>>(new Set());

  const stats = useMemo(() => {
    const calorieTarget = activeGoal?.daily_calorie_target || 2000;
    const proteinTarget = activeGoal?.protein_target_g || 120;
    const carbsTarget = activeGoal?.carbs_target_g || 250;
    const fatTarget = activeGoal?.fat_target_g || 65;

    const avgCalories = weeklySummary?.calories.thisWeekAvg || 0;
    const avgProtein = weeklySummary?.macros.protein.consumed || 0;
    const avgCarbs = weeklySummary?.macros.carbs.consumed || 0;
    const avgFat = weeklySummary?.macros.fat.consumed || 0;

    const calorieProgress = Math.min(100, Math.round((avgCalories / calorieTarget) * 100));
    const proteinProgress = Math.min(100, Math.round((avgProtein / proteinTarget) * 100));
    const consistency = weeklySummary?.consistency.percentage || 0;
    const quality = averageScore || 0;
    const streak = streaks?.logging?.currentStreak || 0;

    const daysWithLogs = dailyData.filter((d) => d.calories > 0).length;
    const daysWithWater = dailyData.filter((d) => d.water > 0).length;
    const totalWater = dailyData.reduce((sum, d) => sum + d.water, 0);
    const avgWater = daysWithWater > 0 ? totalWater / daysWithWater : 0;
    const hydration = Math.min(100, Math.round((avgWater / 8) * 100));

    const overallScore = Math.round(
      consistency * 0.25 +
        Math.min(100, calorieProgress) * 0.2 +
        Math.min(100, proteinProgress) * 0.15 +
        quality * 0.2 +
        hydration * 0.1 +
        Math.min(100, (streak / Math.max(streaks?.logging?.bestStreak || 1, 1)) * 100) * 0.1
    );

    const achievedMilestones = milestones.filter((m) => m.achieved_at).length;

    const lastWeekAvg = weeklySummary?.calories.lastWeekAvg || 0;

    return {
      avgCalories,
      avgProtein,
      avgCarbs,
      avgFat,
      calorieTarget,
      proteinTarget,
      carbsTarget,
      fatTarget,
      calorieProgress,
      proteinProgress,
      consistency,
      quality,
      hydration,
      streak,
      overallScore,
      daysWithLogs,
      avgWater,
      achievedMilestones,
      totalMilestones: milestones.length || 1,
      lastWeekAvg,
    };
  }, [weeklySummary, activeGoal, streaks, averageScore, milestones, dailyData]);

  const chartData = useMemo(() => {
    return dailyData.map((day) => ({
      date: format(new Date(day.date), "EEE"),
      calories: day.calories,
      target: stats.calorieTarget,
    }));
  }, [dailyData, stats.calorieTarget]);

  const waterChartData = useMemo(() => {
    return dailyData.map((day) => ({
      date: format(new Date(day.date), "EEE"),
      water: day.water,
    }));
  }, [dailyData]);

  const macroChartData = useMemo(() => {
    return dailyData.map((day) => ({
      date: format(new Date(day.date), "EEE"),
      protein: Math.round(day.protein),
      carbs: Math.round(day.carbs),
      fat: Math.round(day.fat),
    }));
  }, [dailyData]);

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return t("report_score_excellent");
    if (score >= 60) return t("report_score_good");
    if (score >= 40) return t("report_score_fair");
    return t("report_score_needs_work");
  };

  type InsightItem = {
    id: string;
    icon: React.ElementType;
    text: string;
    type: "success" | "warning" | "info";
    metric?: "calories" | "protein" | "hydration" | "consistency";
    current?: number;
    target?: number;
    unit?: string;
    trend?: "up" | "down" | "neutral";
    trendLabel?: string;
  };

  const insights = useMemo((): InsightItem[] => {
    const items: InsightItem[] = [];

    if (stats.consistency >= 80) {
      items.push({ id: "consistency", icon: CheckCircle2, text: t("report_insight_consistency_excellent", { days: stats.daysWithLogs }), type: "success", metric: "consistency", current: stats.daysWithLogs, target: 7, unit: t("report_unit_days") });
    } else if (stats.consistency < 50) {
      items.push({ id: "consistency", icon: AlertTriangle, text: t("report_insight_consistency_low", { days: stats.daysWithLogs }), type: "warning", metric: "consistency", current: stats.daysWithLogs, target: 7, unit: t("report_unit_days") });
    } else {
      items.push({ id: "consistency", icon: CheckCircle2, text: t("report_insight_consistency_good", { days: stats.daysWithLogs }), type: "info", metric: "consistency", current: stats.daysWithLogs, target: 7, unit: t("report_unit_days") });
    }

    const calorieDiff = Math.round(stats.avgCalories - stats.calorieTarget);
    const calorieTrend = stats.lastWeekAvg > 0
      ? stats.avgCalories > stats.lastWeekAvg ? "up" : stats.avgCalories < stats.lastWeekAvg ? "down" : "neutral"
      : "neutral";
    const calorieTrendLabel = stats.lastWeekAvg > 0
      ? t("report_calorie_trend_label", { amount: Math.abs(Math.round(stats.avgCalories - stats.lastWeekAvg)), direction: calorieTrend === "up" ? "↑" : calorieTrend === "down" ? "↓" : "→" })
      : undefined;

    if (stats.calorieProgress >= 90 && stats.calorieProgress <= 110) {
      items.push({ id: "calories", icon: Target, text: t("report_insight_calories_on_target", { avg: Math.round(stats.avgCalories), target: stats.calorieTarget }), type: "success", metric: "calories", current: Math.round(stats.avgCalories), target: stats.calorieTarget, unit: t("report_unit_kcal"), trend: calorieTrend, trendLabel: calorieTrendLabel });
    } else if (calorieDiff > 200) {
      items.push({ id: "calories", icon: TrendingUp, text: t("report_insight_calories_over", { diff: calorieDiff, target: stats.calorieTarget }), type: "warning", metric: "calories", current: Math.round(stats.avgCalories), target: stats.calorieTarget, unit: t("report_unit_kcal"), trend: calorieTrend, trendLabel: calorieTrendLabel });
    } else if (calorieDiff < -200) {
      items.push({ id: "calories", icon: TrendingUp, text: t("report_insight_calories_under", { diff: Math.abs(calorieDiff), target: stats.calorieTarget }), type: "info", metric: "calories", current: Math.round(stats.avgCalories), target: stats.calorieTarget, unit: t("report_unit_kcal"), trend: calorieTrend, trendLabel: calorieTrendLabel });
    }

    if (stats.proteinProgress >= 90) {
      items.push({ id: "protein", icon: CheckCircle2, text: t("report_insight_protein_on_track", { avg: Math.round(stats.avgProtein), progress: Math.round(stats.proteinProgress) }), type: "success", metric: "protein", current: Math.round(stats.avgProtein), target: stats.proteinTarget, unit: "g" });
    } else if (stats.proteinProgress < 60) {
      items.push({ id: "protein", icon: AlertTriangle, text: t("report_insight_protein_low", { avg: Math.round(stats.avgProtein), progress: Math.round(stats.proteinProgress), target: stats.proteinTarget }), type: "warning", metric: "protein", current: Math.round(stats.avgProtein), target: stats.proteinTarget, unit: "g" });
    }

    if (stats.hydration >= 75) {
      items.push({ id: "hydration", icon: Droplets, text: t("report_insight_hydration_good", { avg: stats.avgWater.toFixed(1) }), type: "success", metric: "hydration", current: parseFloat(stats.avgWater.toFixed(1)), target: 8, unit: t("report_unit_glasses") });
    } else if (stats.avgWater < 4) {
      items.push({ id: "hydration", icon: Droplets, text: t("report_insight_hydration_low", { avg: stats.avgWater.toFixed(1) }), type: "warning", metric: "hydration", current: parseFloat(stats.avgWater.toFixed(1)), target: 8, unit: t("report_unit_glasses") });
    }

    if (stats.streak >= 7) {
      items.push({ id: "streak", icon: Flame, text: t("report_insight_streak_excellent", { streak: stats.streak }), type: "success" });
    } else if (stats.streak >= 3) {
      items.push({ id: "streak", icon: Flame, text: t("report_insight_streak_good", { streak: stats.streak }), type: "info" });
    }

    return items.slice(0, 4);
  }, [stats, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="font-bold text-slate-900">{t("report_weekly_overview")}</h3>
          <p className="text-xs text-slate-500">{format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}</p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white",
          stats.overallScore >= 80 ? "bg-emerald-500" : stats.overallScore >= 60 ? "bg-amber-500" : "bg-orange-500"
        )}>
          <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
          {getScoreLabel(stats.overallScore)}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 shadow-md">
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <svg className="w-24 h-24 -rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="7" />
              <circle
                cx="48" cy="48" r="40"
                fill="none"
                stroke="white"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${stats.overallScore * 2.51} 251`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{stats.overallScore}</span>
              <span className="text-[10px] text-white/60 uppercase tracking-wider">{t("report_score_label")}</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-white/70 mb-1">{t("report_weekly_progress")}</p>
            <p className="text-xl font-bold">{t("report_days_logged", { current: stats.daysWithLogs, total: 7 })}</p>
            <div className="flex gap-1 mt-2">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={cn("h-1.5 flex-1 rounded-full transition-all", i < stats.daysWithLogs ? "bg-white" : "bg-white/20")}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-around items-center py-2">
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-200 flex flex-col items-center justify-center">
            <Flame className="w-4 h-4 text-white/80 mb-0.5" />
            <p className="text-base font-extrabold text-white leading-none">{Math.round(stats.avgCalories)}</p>
          </div>
          <p className="text-[10px] font-medium text-gray-500 text-center">{t("report_avg_calories")}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-200 flex flex-col items-center justify-center">
            <Target className="w-4 h-4 text-white/80 mb-0.5" />
            <p className="text-base font-extrabold text-white leading-none">{stats.quality}</p>
          </div>
          <p className="text-[10px] font-medium text-gray-500 text-center">{t("report_quality_score")}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-200 flex flex-col items-center justify-center">
            <Flame className="w-4 h-4 text-white/80 mb-0.5" />
            <p className="text-base font-extrabold text-white leading-none">{weeklyBurned}</p>
          </div>
          <p className="text-[10px] font-medium text-gray-500 text-center">{t("report_cal_burned")}</p>
        </div>
      </div>

      <Button
        className="w-full h-10 text-sm font-medium rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
        onClick={onDownload}
        disabled={generatingReport}
      >
        {generatingReport ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t("report_generating")}
          </>
        ) : (
          <>
            <FileDown className="w-4 h-4 mr-2" />
            {t("report_download_pdf")}
          </>
        )}
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <Flame className="w-4.5 h-4.5 text-orange-500" />
            </div>
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full",
              stats.calorieProgress >= 90 && stats.calorieProgress <= 110
                ? "bg-emerald-100 text-emerald-600"
                : stats.calorieProgress > 110
                  ? "bg-amber-100 text-amber-600"
                  : "bg-blue-100 text-blue-600"
            )}>
              {stats.calorieProgress >= 90 && stats.calorieProgress <= 110
                ? t("report_status_on_target")
                : stats.calorieProgress > 110
                  ? t("report_status_above")
                  : t("report_status_below")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{Math.round(stats.avgCalories)}</span>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-600">{Math.round(stats.avgCalories)} <span className="text-slate-400">of {stats.calorieTarget}</span></p>
              <p className="text-[10px] text-slate-400">{t("report_target")}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 mb-2">{t("report_daily_avg_calories")}</p>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((stats.avgCalories / stats.calorieTarget) * 100, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">{t("report_metric_calories")} ({t("report_avg_daily")})</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
              <Target className="w-4.5 h-4.5 text-blue-500" />
            </div>
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full",
              stats.proteinProgress >= 80
                ? "bg-emerald-100 text-emerald-600"
                : stats.proteinProgress >= 50
                  ? "bg-amber-100 text-amber-600"
                  : "bg-slate-100 text-slate-600"
            )}>
              {stats.proteinProgress >= 80 ? t("report_status_great") : stats.proteinProgress >= 50 ? t("report_status_good") : t("report_status_keep_going")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl font-extrabold text-slate-900">{Math.round(stats.avgProtein)}</span>
              <span className="text-lg font-bold text-slate-400">g</span>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-600">{Math.round(stats.avgProtein)} <span className="text-slate-400">of {stats.proteinTarget}g</span></p>
              <p className="text-[10px] text-slate-400">{t("report_target")}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 mb-2">{t("report_daily_avg_protein")}</p>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(stats.proteinProgress, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">{t("report_protein")} ({t("report_avg_daily")})</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
              {stats.consistency}%
            </span>
          </div>
          <div className="flex items-baseline gap-0.5 mb-1">
            <span className="text-3xl font-extrabold text-slate-900">{stats.consistency}</span>
            <span className="text-lg font-bold text-slate-400">%</span>
          </div>
          <p className="text-xs text-slate-500 mb-2">{t("report_consistency_score")}</p>
          <div className="grid grid-cols-7 gap-1">
            {dailyData.map((day, i) => {
              const logged = day.calories > 0;
              return (
                <div key={i} className="flex items-center justify-center">
                  <div className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center",
                    logged ? "bg-emerald-100" : "bg-slate-100"
                  )}>
                    {logged ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">{t("report_goal_consistency")}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-50 flex items-center justify-center">
              <Droplets className="w-4.5 h-4.5 text-cyan-500" />
            </div>
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full",
              stats.hydration >= 80
                ? "bg-emerald-100 text-emerald-600"
                : stats.hydration >= 50
                  ? "bg-amber-100 text-amber-600"
                  : "bg-slate-100 text-slate-600"
            )}>
              {stats.hydration >= 80 ? t("report_status_well_done") : stats.hydration >= 50 ? t("report_status_good") : t("report_status_drink_more")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-900">{stats.avgWater.toFixed(1)}</span>
              <span className="text-sm font-medium text-slate-400">{t("report_unit_glasses")}</span>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-600">{stats.avgWater.toFixed(1)} <span className="text-slate-400">of 8 {t("report_unit_glasses")}</span></p>
              <p className="text-[10px] text-slate-400">{t("report_target")}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 mb-2">{t("report_daily_avg_water")}</p>
          <div className="flex gap-1.5 justify-center">
            {[...Array(8)].map((_, i) => (
              <Droplets
                key={i}
                className={cn(
                  "w-4 h-4 transition-all",
                  i < Math.round(stats.avgWater) ? "text-cyan-400" : "text-slate-200"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: t("report_daily_goals_met"), sublabel: t("report_goals_achieved_today"), value: stats.daysWithLogs, unit: "" },
          { label: t("report_calories_today"), sublabel: "", value: Math.round(stats.avgCalories), unit: "" },
          { label: t("report_protein_today"), sublabel: "", value: Math.round(stats.avgProtein), unit: "g" },
          { label: t("report_water_today"), sublabel: "", value: stats.avgWater.toFixed(1), unit: "" },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-extrabold text-slate-900">
                {item.value}{item.unit && <span className="text-sm font-bold text-slate-400">{item.unit}</span>}
              </p>
              <p className="text-[10px] font-medium text-slate-600 mt-1 leading-tight">{item.label}</p>
              {item.sublabel && <p className="text-[9px] text-slate-400 mt-0.5">{item.sublabel}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{t("report_daily_calories")}</h3>
            <span className="text-xs text-muted-foreground">{t("report_last_7_days")}</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${Math.round(value)} ${t("report_unit_kcal")}`, t("report_calories")]}
                />
                <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.calories >= entry.target * 0.9 && entry.calories <= entry.target * 1.1
                          ? "hsl(160, 84%, 39%)"
                          : entry.calories > entry.target * 1.1
                            ? "hsl(38, 92%, 50%)"
                            : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-muted-foreground">{t("report_status_on_target")}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-muted-foreground">{t("report_status_below")}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-amber-500" />
              <span className="text-muted-foreground">{t("report_status_above")}</span>
            </div>
          </div>
        </CardContent>
      </Card>


      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Score hero */}
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke={`url(#insightScoreGrad)`}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${stats.overallScore * 2.639} 263.9`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="insightScoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={stats.overallScore >= 80 ? "#34d399" : stats.overallScore >= 60 ? "#fbbf24" : "#f87171"} />
                    <stop offset="100%" stopColor={stats.overallScore >= 80 ? "#10b981" : stats.overallScore >= 60 ? "#f59e0b" : "#ef4444"} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900 leading-none">{stats.overallScore}</span>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{t("report_score_label")}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-slate-900">{t("report_insights")}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t("report_weekly_progress")}</p>
              <div className={cn(
                "inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full",
                stats.overallScore >= 80 ? "bg-emerald-50 text-emerald-600"
                  : stats.overallScore >= 60 ? "bg-amber-50 text-amber-600"
                  : "bg-red-50 text-red-600"
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  stats.overallScore >= 80 ? "bg-emerald-500" : stats.overallScore >= 60 ? "bg-amber-500" : "bg-red-500"
                )} />
                {getScoreLabel(stats.overallScore)}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 mx-5" />

        {/* Insight rows */}
        <div className="px-5 py-3">
          {insights.map((insight, idx) => {
            const pct = insight.current != null && insight.target
              ? Math.min((insight.current / insight.target) * 100, 100)
              : null;

            return (
              <div key={insight.id}>
                <div className="flex items-center gap-3 py-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    insight.type === "success" ? "bg-emerald-50"
                      : insight.type === "warning" ? "bg-amber-50"
                      : "bg-sky-50"
                  )}>
                    <insight.icon
                      className={cn(
                        "w-4 h-4",
                        insight.type === "success" ? "text-emerald-500" : insight.type === "warning" ? "text-amber-500" : "text-sky-500"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-800 leading-snug">{insight.text}</p>
                    {pct !== null && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              insight.type === "success" ? "bg-emerald-500" : insight.type === "warning" ? "bg-amber-500" : "bg-sky-500"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 tabular-nums shrink-0">{Math.round(pct)}%</span>
                      </div>
                    )}
                  </div>
                </div>
                {idx < insights.length - 1 && <div className="h-px bg-slate-50 ml-12" />}
              </div>
            );
          })}
        </div>
      </div>

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-sm">{t("report_recommendations")}</h3>
              {recommendations.filter((_, i) => !dismissedRecs.has(i)).length > 0 && (
                <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {recommendations.filter((_, i) => !dismissedRecs.has(i)).length}
                </span>
              )}
            </div>
            {onRefreshRecommendations && (
              <button
                onClick={onRefreshRecommendations}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                title={t("report_refresh_recommendations")}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="space-y-2.5">
            {recommendations
              .slice(0, 4)
              .filter((_, i) => !dismissedRecs.has(i))
              .map((rec, displayIndex) => {
                const originalIndex = recommendations.indexOf(rec);
                const catIcon = rec.category === "hydration" ? Droplets
                  : rec.category === "nutrition" ? Apple
                  : rec.category === "activity" ? Zap
                  : rec.category === "sleep" ? Moon
                  : Lightbulb;
                const CatIcon = catIcon;
                const priorityBorder = rec.priority === "high"
                  ? "border-l-4 border-l-red-500"
                  : rec.priority === "medium"
                    ? "border-l-4 border-l-amber-400"
                    : "border-l-4 border-l-slate-300 dark:border-l-slate-600";
                const priorityBadge = rec.priority === "high"
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  : rec.priority === "medium"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
                const hasProg = rec.progress != null;
                const progPct = hasProg ? Math.min((rec.progress!.value / rec.progress!.max) * 100, 100) : 0;

                return (
                  <div
                    key={originalIndex}
                    className={cn("rounded-xl bg-muted/30 border border-border/50 transition-all", priorityBorder)}
                    style={{ animationDelay: `${displayIndex * 60}ms` }}
                  >
                    <div className="p-3 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-xs font-bold text-white">{displayIndex + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide", priorityBadge)}>
                            {rec.priority === "high" ? t("report_priority_urgent") : rec.priority === "medium" ? t("report_priority_recommended") : t("report_priority_tip")}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-foreground">{rec.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.description}</p>

                        {hasProg && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>{rec.progress!.value}{rec.progress!.unit}</span>
                              <span className="font-semibold">{Math.round(progPct)}% {t("report_of")} {rec.progress!.max}{rec.progress!.unit}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-700",
                                  rec.category === "hydration" ? "bg-gradient-to-r from-blue-400 to-cyan-500"
                                    : progPct >= 80 ? "bg-gradient-to-r from-emerald-400 to-green-500"
                                    : "bg-gradient-to-r from-primary to-accent"
                                )}
                                style={{ width: `${progPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {rec.action_link && rec.action_text !== "Download Report" && (
                          <Link
                            to={rec.action_link}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            {rec.action_text}
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <CatIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <button
                          onClick={() => setDismissedRecs(new Set([...dismissedRecs, originalIndex]))}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            {recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t("report_set_goal_for_recommendations")}</p>
            )}
            {recommendations.length > 0 && recommendations.filter((_, i) => !dismissedRecs.has(i)).length === 0 && (
              <div className="text-center py-5 space-y-2">
                <Check className="w-7 h-7 text-emerald-400 mx-auto" />
                <p className="text-sm text-muted-foreground">{t("report_all_recommendations_reviewed")}</p>
                <button onClick={() => setDismissedRecs(new Set())} className="text-xs text-primary hover:underline">{t("report_show_again")}</button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
