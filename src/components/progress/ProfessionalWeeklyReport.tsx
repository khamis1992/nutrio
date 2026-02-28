import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileDown,
  Loader2,
  TrendingUp,
  Flame,
  Target,
  Droplets,
  Award,
  Calendar,
  Activity,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
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
}: ProfessionalWeeklyReportProps) {
  const weekStart = subDays(new Date(), 7);
  const weekEnd = new Date();

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
    const hydration = Math.round(((waterSummary?.total || 0) / 8) * 100);
    const streak = streaks?.logging?.currentStreak || 0;

    const overallScore = Math.round(
      consistency * 0.25 +
        Math.min(100, calorieProgress) * 0.2 +
        Math.min(100, proteinProgress) * 0.15 +
        quality * 0.2 +
        Math.min(100, hydration) * 0.1 +
        Math.min(100, (streak / Math.max(streaks?.logging?.bestStreak || 1, 1)) * 100) * 0.1
    );

    const daysWithLogs = dailyData.filter((d) => d.calories > 0).length;
    const totalWater = dailyData.reduce((sum, d) => sum + d.water, 0);
    const avgWater = totalWater / 7;

    const achievedMilestones = milestones.filter((m) => m.achieved_at).length;

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
    };
  }, [weeklySummary, activeGoal, streaks, averageScore, waterSummary, milestones, dailyData]);

  const radarData = useMemo(() => {
    return [
      { metric: "Consistency", value: stats.consistency, fullMark: 100 },
      { metric: "Calories", value: stats.calorieProgress, fullMark: 100 },
      { metric: "Protein", value: stats.proteinProgress, fullMark: 100 },
      { metric: "Quality", value: stats.quality, fullMark: 100 },
      { metric: "Hydration", value: stats.hydration, fullMark: 100 },
    ];
  }, [stats]);

  const chartData = useMemo(() => {
    return dailyData.map((day) => ({
      date: format(new Date(day.date), "EEE"),
      calories: day.calories,
      target: stats.calorieTarget,
    }));
  }, [dailyData, stats.calorieTarget]);

  const getScoreGradient = (score: number): string => {
    if (score >= 80) return "from-emerald-500 to-teal-500";
    if (score >= 60) return "from-amber-500 to-yellow-500";
    if (score >= 40) return "from-orange-500 to-amber-500";
    return "from-red-500 to-orange-500";
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  const insights = useMemo(() => {
    const items = [];
    if (stats.consistency >= 80) {
      items.push({ icon: CheckCircle2, text: "Excellent logging consistency this week!", type: "success" });
    } else if (stats.consistency < 50) {
      items.push({ icon: AlertTriangle, text: "Try to log your meals more consistently", type: "warning" });
    }
    if (stats.calorieProgress >= 90 && stats.calorieProgress <= 110) {
      items.push({ icon: Target, text: "Calories right on target - great job!", type: "success" });
    } else if (stats.calorieProgress < 80) {
      items.push({ icon: TrendingUp, text: "Consider increasing your calorie intake", type: "info" });
    }
    if (stats.hydration >= 75) {
      items.push({ icon: Droplets, text: "Great hydration levels maintained", type: "success" });
    }
    if (stats.streak >= 5) {
      items.push({ icon: Flame, text: `Amazing ${stats.streak}-day streak! Keep it up!`, type: "success" });
    }
    return items.slice(0, 3);
  }, [stats]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl p-5 shadow-xl border border-emerald-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-emerald-700">Weekly Report</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <div
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-br",
                getScoreGradient(stats.overallScore)
              )}
            >
              <span className="text-3xl font-bold text-white">{stats.overallScore}</span>
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white px-2 py-0.5 rounded-full shadow-sm">
              <span className="text-xs text-emerald-600 font-medium">{getScoreLabel(stats.overallScore)}</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-xl p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Avg Calories</p>
              <p className="text-xl font-bold text-foreground">{Math.round(stats.avgCalories)}</p>
              <p className="text-xs text-muted-foreground">/ {stats.calorieTarget}</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Days Logged</p>
              <p className="text-xl font-bold text-foreground">{stats.daysWithLogs}/7</p>
              <p className="text-xs text-muted-foreground">{stats.consistency}% consistency</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Meal Quality</p>
              <p className="text-xl font-bold text-foreground">{stats.quality}</p>
              <p className="text-xs text-muted-foreground">/ 100</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Streak</p>
              <p className="text-xl font-bold text-foreground">{stats.streak}</p>
              <p className="text-xs text-muted-foreground">days</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Performance Radar</span>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="hsl(160, 84%, 39%)"
                    fill="hsl(160, 84%, 39%)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Insights</h3>
          </div>
          <div className="space-y-2">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl",
                  insight.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                    : insight.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/30"
                      : "bg-sky-50 dark:bg-sky-950/30"
                )}
              >
                <insight.icon
                  className={cn(
                    "w-4 h-4 mt-0.5",
                    insight.type === "success"
                      ? "text-emerald-600"
                      : insight.type === "warning"
                        ? "text-amber-600"
                        : "text-sky-600"
                  )}
                />
                <p className="text-sm text-foreground">{insight.text}</p>
              </div>
            ))}
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Log more meals to get personalized insights</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Recommendations</h3>
          </div>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{index + 1}</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                </div>
              </div>
            ))}
            {recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Set a goal to get personalized recommendations</p>
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

      <Button
        className="w-full h-12 text-base font-medium bg-gradient-to-r from-primary to-accent hover:opacity-90 rounded-2xl shadow-lg"
        onClick={onDownload}
        disabled={generatingReport}
      >
        {generatingReport ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating Report...
          </>
        ) : (
          <>
            <FileDown className="w-5 h-5 mr-2" />
            Download Weekly Report (PDF)
          </>
        )}
      </Button>
    </div>
  );
}
