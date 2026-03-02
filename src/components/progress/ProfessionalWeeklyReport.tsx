import { useMemo, useState } from "react";
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
  Calendar,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
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
  recommendations: { title: string; description: string }[];
  dailyData: WeeklyReportData["dailyData"];
  onDownload: () => Promise<void>;
  generatingReport: boolean;
  onRefreshRecommendations?: () => void;
}

export function ProfessionalWeeklyReport({
  weeklySummary,
  activeGoal,
  streaks,
  averageScore,
  waterSummary,
  milestones,
  recommendations,
  dailyData,
  onDownload,
  generatingReport,
  onRefreshRecommendations,
}: ProfessionalWeeklyReportProps) {
  const weekStart = subDays(new Date(), 7);
  const weekEnd = new Date();
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
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
    // Average over days that actually have water data (not all 7 days) to avoid artificially low numbers
    const avgWater = daysWithWater > 0 ? totalWater / daysWithWater : 0;
    // Hydration % based on weekly average vs daily 8-glass target
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

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
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

    // Consistency
    if (stats.consistency >= 80) {
      items.push({ id: "consistency", icon: CheckCircle2, text: `You logged ${stats.daysWithLogs} of 7 days — excellent consistency!`, type: "success", metric: "consistency", current: stats.daysWithLogs, target: 7, unit: "days" });
    } else if (stats.consistency < 50) {
      items.push({ id: "consistency", icon: AlertTriangle, text: `Only ${stats.daysWithLogs} days logged this week. Aim for 5+ to get accurate insights.`, type: "warning", metric: "consistency", current: stats.daysWithLogs, target: 7, unit: "days" });
    } else {
      items.push({ id: "consistency", icon: CheckCircle2, text: `${stats.daysWithLogs} days logged this week — good progress, keep going!`, type: "info", metric: "consistency", current: stats.daysWithLogs, target: 7, unit: "days" });
    }

    // Calories with week-over-week trend
    const calorieDiff = Math.round(stats.avgCalories - stats.calorieTarget);
    const calorieTrend = stats.lastWeekAvg > 0
      ? stats.avgCalories > stats.lastWeekAvg ? "up" : stats.avgCalories < stats.lastWeekAvg ? "down" : "neutral"
      : "neutral";
    const calorieTrendLabel = stats.lastWeekAvg > 0
      ? `${Math.abs(Math.round(stats.avgCalories - stats.lastWeekAvg))} kcal ${calorieTrend === "up" ? "↑" : calorieTrend === "down" ? "↓" : "→"} vs last week`
      : undefined;

    if (stats.calorieProgress >= 90 && stats.calorieProgress <= 110) {
      items.push({ id: "calories", icon: Target, text: `Avg ${Math.round(stats.avgCalories)} kcal — right on your ${stats.calorieTarget} kcal target!`, type: "success", metric: "calories", current: Math.round(stats.avgCalories), target: stats.calorieTarget, unit: "kcal", trend: calorieTrend, trendLabel: calorieTrendLabel });
    } else if (calorieDiff > 200) {
      items.push({ id: "calories", icon: TrendingUp, text: `Averaging ${calorieDiff} kcal over your ${stats.calorieTarget} kcal target. Consider smaller portions.`, type: "warning", metric: "calories", current: Math.round(stats.avgCalories), target: stats.calorieTarget, unit: "kcal", trend: calorieTrend, trendLabel: calorieTrendLabel });
    } else if (calorieDiff < -200) {
      items.push({ id: "calories", icon: TrendingUp, text: `Averaging ${Math.abs(calorieDiff)} kcal below your ${stats.calorieTarget} kcal target. Try adding a protein-rich snack.`, type: "info", metric: "calories", current: Math.round(stats.avgCalories), target: stats.calorieTarget, unit: "kcal", trend: calorieTrend, trendLabel: calorieTrendLabel });
    }

    // Protein
    if (stats.proteinProgress >= 90) {
      items.push({ id: "protein", icon: CheckCircle2, text: `Protein on track at ${Math.round(stats.avgProtein)}g avg — hitting ${Math.round(stats.proteinProgress)}% of your goal.`, type: "success", metric: "protein", current: Math.round(stats.avgProtein), target: stats.proteinTarget, unit: "g" });
    } else if (stats.proteinProgress < 60) {
      items.push({ id: "protein", icon: AlertTriangle, text: `Protein at ${Math.round(stats.avgProtein)}g avg — only ${Math.round(stats.proteinProgress)}% of your ${stats.proteinTarget}g target. Add eggs, chicken, or fish.`, type: "warning", metric: "protein", current: Math.round(stats.avgProtein), target: stats.proteinTarget, unit: "g" });
    }

    // Hydration
    if (stats.hydration >= 75) {
      items.push({ id: "hydration", icon: Droplets, text: `Averaging ${stats.avgWater.toFixed(1)} glasses/day — well hydrated!`, type: "success", metric: "hydration", current: parseFloat(stats.avgWater.toFixed(1)), target: 8, unit: "glasses" });
    } else if (stats.avgWater < 4) {
      items.push({ id: "hydration", icon: Droplets, text: `Only ${stats.avgWater.toFixed(1)} glasses/day on average — aim for 8 glasses daily.`, type: "warning", metric: "hydration", current: parseFloat(stats.avgWater.toFixed(1)), target: 8, unit: "glasses" });
    }

    // Streak
    if (stats.streak >= 7) {
      items.push({ id: "streak", icon: Flame, text: `${stats.streak}-day logging streak — that's your discipline showing!`, type: "success" });
    } else if (stats.streak >= 3) {
      items.push({ id: "streak", icon: Flame, text: `${stats.streak}-day streak going — keep it alive today!`, type: "info" });
    }

    return items.slice(0, 4);
  }, [stats]);

  return (
    <div className="space-y-4">
      {/* Card 1: Weekly Overview - Modern Dark Card */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 shadow-2xl">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-violet-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Weekly Overview</h3>
                <p className="text-xs text-white/50">{format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur">
              <div className={cn("w-2 h-2 rounded-full", stats.overallScore >= 80 ? "bg-emerald-400" : stats.overallScore >= 60 ? "bg-amber-400" : "bg-orange-400")} />
              <span className="text-xs font-medium text-white/80">{getScoreLabel(stats.overallScore)}</span>
            </div>
          </div>

          {/* Main Score Display */}
          <div className="flex items-end gap-4 mb-6">
            <div className="relative">
              <svg className="w-28 h-28 -rotate-90">
                <circle cx="56" cy="56" r="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                <circle
                  cx="56"
                  cy="56"
                  r="50"
                  fill="none"
                  stroke="url(#scoreGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${stats.overallScore * 3.14} 314`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{stats.overallScore}</span>
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Score</span>
              </div>
            </div>
            
            <div className="flex-1 pb-2">
              <p className="text-sm text-white/60 mb-1">Weekly Progress</p>
              <p className="text-lg font-semibold text-white">{stats.daysWithLogs} of 7 days</p>
              <div className="flex gap-1 mt-2">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-all",
                      i < stats.daysWithLogs ? "bg-emerald-400" : "bg-white/10"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-orange-400" />
                </div>
              </div>
              <p className="text-lg font-bold text-white">{Math.round(stats.avgCalories)}</p>
              <p className="text-[10px] text-white/50">Avg Calories</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <p className="text-lg font-bold text-white">{stats.quality}</p>
              <p className="text-[10px] text-white/50">Quality Score</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <p className="text-lg font-bold text-white">{stats.streak}</p>
              <p className="text-[10px] text-white/50">Day Streak</p>
            </div>
          </div>

          {/* Download Button */}
          <div className="mt-5">
            <Button
              className="w-full h-10 text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur border border-white/10"
              onClick={onDownload}
              disabled={generatingReport}
            >
              {generatingReport ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 mr-2" />
                  Download Weekly Report (PDF)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Card 2: Performance Metrics - Modern Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Calories Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              stats.calorieProgress >= 90 && stats.calorieProgress <= 110
                ? "bg-emerald-100 text-emerald-600"
                : stats.calorieProgress > 110
                  ? "bg-amber-100 text-amber-600"
                  : "bg-blue-100 text-blue-600"
            )}>
              {stats.calorieProgress >= 90 && stats.calorieProgress <= 110
                ? "On Target"
                : stats.calorieProgress > 110
                  ? "Above"
                  : "Below"}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-slate-900">{Math.round(stats.avgCalories)}</span>
            <span className="text-xs text-slate-400">/ {stats.calorieTarget}</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Daily Avg Calories</p>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((stats.avgCalories / stats.calorieTarget) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Protein Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              stats.proteinProgress >= 80
                ? "bg-emerald-100 text-emerald-600"
                : stats.proteinProgress >= 50
                  ? "bg-amber-100 text-amber-600"
                  : "bg-slate-100 text-slate-600"
            )}>
              {stats.proteinProgress >= 80 ? "Great" : stats.proteinProgress >= 50 ? "Good" : "Keep Going"}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-slate-900">{Math.round(stats.avgProtein)}</span>
            <span className="text-xs text-slate-400">/ {stats.proteinTarget}g</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Daily Avg Protein</p>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(stats.proteinProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Consistency Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-600">
              {stats.consistency}%
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-slate-900">{stats.consistency}</span>
            <span className="text-xs text-slate-400">%</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Consistency Score</p>
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all",
                  i < Math.round(stats.consistency / 20) ? "bg-emerald-400" : "bg-slate-100"
                )}
              />
            ))}
          </div>
        </div>

        {/* Hydration Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-50 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-cyan-500" />
            </div>
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              stats.hydration >= 80
                ? "bg-emerald-100 text-emerald-600"
                : stats.hydration >= 50
                  ? "bg-amber-100 text-amber-600"
                  : "bg-slate-100 text-slate-600"
            )}>
              {stats.hydration >= 80 ? "Well Done" : stats.hydration >= 50 ? "Good" : "Drink More"}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-slate-900">{stats.avgWater.toFixed(1)}</span>
            <span className="text-xs text-slate-400">/ 8 glasses</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Daily Avg Water</p>
          <div className="flex gap-1">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all",
                  i < Math.round(stats.avgWater) ? "bg-cyan-400" : "bg-slate-100"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Consistency", value: stats.consistency, color: "emerald" },
          { label: "Calories", value: stats.calorieProgress, color: "amber" },
          { label: "Protein", value: stats.proteinProgress, color: "violet" },
          { label: "Hydration", value: stats.hydration, color: "sky" },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-3 text-center">
              <div className="relative w-12 h-12 mx-auto mb-2">
                <svg className="w-12 h-12 -rotate-90">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke={`hsl(var(--${item.color}))`}
                    strokeWidth="4"
                    strokeDasharray={`${Math.min(item.value, 100) * 1.256} 125.6`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{Math.min(item.value, 100)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Daily Calories</h3>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
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
                  formatter={(value: number) => [`${Math.round(value)} kcal`, "Calories"]}
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
              <span className="text-muted-foreground">On Target</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-muted-foreground">Below</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-amber-500" />
              <span className="text-muted-foreground">Above</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-violet-600 dark:text-violet-400">Protein</p>
                <p className="text-lg font-bold text-violet-700 dark:text-violet-300">
                  {Math.round(stats.avgProtein)}g
                </p>
                <p className="text-xs text-violet-500/70">/ {stats.proteinTarget}g target</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-sky-600 dark:text-sky-400">Water</p>
                <p className="text-lg font-bold text-sky-700 dark:text-sky-300">{Math.round(stats.avgWater)}</p>
                <p className="text-xs text-sky-500/70">glasses / day avg</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-4">
          {/* Header with score badge */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Insights</h3>
            </div>
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
              stats.overallScore >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : stats.overallScore >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
              <span>{stats.overallScore}</span>
              <span className="font-normal opacity-70">/ 100</span>
            </div>
          </div>

          <div className="space-y-2">
            {insights.filter(i => !dismissedInsights.has(i.id)).map((insight) => {
              const isExpanded = expandedInsight === insight.id;
              const pct = insight.current != null && insight.target
                ? Math.min((insight.current / insight.target) * 100, 100)
                : null;

              return (
                <div
                  key={insight.id}
                  className={cn(
                    "rounded-xl border transition-all duration-200",
                    insight.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900"
                      : insight.type === "warning"
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900"
                        : "bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900"
                  )}
                >
                  <div className="flex items-start gap-3 p-3">
                    <insight.icon
                      className={cn(
                        "w-4 h-4 mt-0.5 shrink-0",
                        insight.type === "success" ? "text-emerald-600" : insight.type === "warning" ? "text-amber-600" : "text-sky-600"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">{insight.text}</p>

                      {/* Week-over-week trend pill */}
                      {insight.trendLabel && (
                        <div className={cn(
                          "inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          insight.trend === "down" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : insight.trend === "up" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {insight.trend === "up" ? <TrendingUp className="w-2.5 h-2.5" /> : insight.trend === "down" ? <TrendingDown className="w-2.5 h-2.5" /> : null}
                          {insight.trendLabel}
                        </div>
                      )}

                      {/* Expanded sparkline */}
                      {isExpanded && insight.metric && (
                        <div className="mt-3 space-y-1.5">
                          {/* Mini progress bar */}
                          {pct !== null && insight.current != null && (
                            <div>
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>{insight.current}{insight.unit}</span>
                                <span>Target: {insight.target}{insight.unit}</span>
                              </div>
                              <div className="h-2 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-700",
                                    insight.type === "success" ? "bg-emerald-500" : insight.type === "warning" ? "bg-amber-500" : "bg-sky-500"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {/* 7-day sparkline */}
                          {insight.metric === "calories" && (
                            <div className="flex items-end gap-0.5 h-10 mt-2">
                              {dailyData.map((day, i) => {
                                const h = day.calories > 0 ? Math.max(4, (day.calories / stats.calorieTarget) * 40) : 4;
                                return (
                                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                    <div
                                      className={cn(
                                        "w-full rounded-sm transition-all",
                                        day.calories >= stats.calorieTarget * 0.9 && day.calories <= stats.calorieTarget * 1.1
                                          ? "bg-emerald-400"
                                          : day.calories > stats.calorieTarget * 1.1
                                            ? "bg-amber-400"
                                            : day.calories > 0 ? "bg-sky-400" : "bg-muted"
                                      )}
                                      style={{ height: `${h}px` }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {insight.metric === "hydration" && (
                            <div className="flex items-end gap-0.5 h-10 mt-2">
                              {dailyData.map((day, i) => {
                                const h = day.water > 0 ? Math.max(4, (day.water / 8) * 40) : 4;
                                return (
                                  <div key={i} className="flex-1">
                                    <div
                                      className={cn("w-full rounded-sm", day.water >= 8 ? "bg-cyan-400" : day.water > 0 ? "bg-sky-300" : "bg-muted")}
                                      style={{ height: `${h}px` }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {insight.metric === "consistency" && (
                            <div className="flex gap-1 mt-2">
                              {dailyData.map((day, i) => (
                                <div
                                  key={i}
                                  className={cn("flex-1 h-4 rounded-sm", day.calories > 0 ? "bg-emerald-400" : "bg-muted")}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      {insight.metric && (
                        <button
                          onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => setDismissedInsights(new Set([...dismissedInsights, insight.id]))}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {insights.filter(i => !dismissedInsights.has(i.id)).length === 0 && (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto" />
                <p className="text-sm text-muted-foreground">All insights reviewed</p>
                {dismissedInsights.size > 0 && (
                  <button
                    onClick={() => setDismissedInsights(new Set())}
                    className="text-xs text-primary hover:underline"
                  >
                    Show again
                  </button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-sm">Recommendations</h3>
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
                title="Refresh recommendations"
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
                            {rec.priority === "high" ? "Urgent" : rec.priority === "medium" ? "Recommended" : "Tip"}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-foreground">{rec.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.description}</p>

                        {/* Progress bar */}
                        {hasProg && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>{rec.progress!.value}{rec.progress!.unit}</span>
                              <span className="font-semibold">{Math.round(progPct)}% of {rec.progress!.max}{rec.progress!.unit}</span>
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

                        {/* Action */}
                        {rec.action_link && (
                          <a
                            href={rec.action_link}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            {rec.action_text}
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Category icon + dismiss */}
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
              <p className="text-sm text-muted-foreground text-center py-4">Set a goal to get personalized recommendations</p>
            )}
            {recommendations.length > 0 && recommendations.filter((_, i) => !dismissedRecs.has(i)).length === 0 && (
              <div className="text-center py-5 space-y-2">
                <Check className="w-7 h-7 text-emerald-400 mx-auto" />
                <p className="text-sm text-muted-foreground">All recommendations reviewed</p>
                <button onClick={() => setDismissedRecs(new Set())} className="text-xs text-primary hover:underline">Show again</button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Daily Log Status</h3>
            <span className="text-xs text-muted-foreground">{stats.daysWithLogs}/7 days logged</span>
          </div>
          <div className="flex gap-1.5">
            {dailyData.map((day, index) => {
              const logged = day.calories > 0;
              const onTarget = logged && day.calories >= stats.calorieTarget * 0.9 && day.calories <= stats.calorieTarget * 1.1;
              return (
                <div key={index} className="flex-1 text-center">
                  <div
                    className={cn(
                      "w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all",
                      onTarget
                        ? "bg-emerald-500 text-white"
                        : logged
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {onTarget ? <CheckCircle2 className="w-4 h-4" /> : format(new Date(day.date), "dd")}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(day.date), "EEE")}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
