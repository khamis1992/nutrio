import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Flame, TrendingUp, TrendingDown,
  Droplets, CalendarCheck, Brain, Target, Trophy,
  UtensilsCrossed, Apple, Star, Zap, FileDown, Loader2,
  ShieldCheck, Clock3,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useMealQuality } from "@/hooks/useMealQuality";
import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";
import { generateWeeklyMealPlan, loadMealPlanImages } from "@/lib/meal-plan-generator";
import { aiReportGenerator } from "@/lib/ai-report-generator";
import { aiReportPDF } from "@/lib/ai-report-pdf";
import type { AIReportContent } from "@/lib/ai-report-generator";
import { supabase } from "@/integrations/supabase/client";
import type { WeeklyReportData } from "@/lib/professional-weekly-report-pdf";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const metricCards = [
  {
    label: "Meal Quality",
    key: "quality",
    icon: Star,
    bg: "bg-emerald-50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    accent: "text-emerald-700",
  },
  {
    label: "Consistency",
    key: "consistency",
    icon: CalendarCheck,
    bg: "bg-amber-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    accent: "text-amber-700",
  },
  {
    label: "Streak",
    key: "streak",
    icon: Flame,
    bg: "bg-rose-50",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    accent: "text-rose-700",
  },
] as const;

const macroRows = [
  {
    label: "Protein",
    unit: "g",
    key: "protein",
    bar: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700",
  },
  {
    label: "Carbs",
    unit: "g",
    key: "carbs",
    bar: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700",
  },
  {
    label: "Fat",
    unit: "g",
    key: "fat",
    bar: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700",
  },
] as const;

const todayRows = [
  { label: "Calories", key: "calories", unit: "kcal", color: "text-orange-700", bg: "bg-orange-50" },
  { label: "Protein", key: "protein", unit: "g", color: "text-rose-700", bg: "bg-rose-50" },
  { label: "Carbs", key: "carbs", unit: "g", color: "text-amber-700", bg: "bg-amber-50" },
  { label: "Fat", key: "fat", unit: "g", color: "text-sky-700", bg: "bg-sky-50" },
] as const;

export default function AIReportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { streaks } = useStreak(user?.id);
  const { todayProgress } = useTodayProgress(user?.id, new Date(), 0);
  const { dailySummary: waterSummary } = useWaterIntake(user?.id);
  const { averageScore: mealQualityScore, weeklyQuality } = useMealQuality(user?.id);
  const { recommendations: smartRecs } = useSmartRecommendations(user?.id);

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [enhancingAI, setEnhancingAI] = useState(false);
  const [aiContent, setAiContent] = useState<AIReportContent | null>(null);

  const reportData = useMemo(() => {
    const weekMacros = weeklySummary?.macros;
    const calories = weeklySummary?.calories;
    const consistency = weeklySummary?.consistency;
    const calorieTarget = activeGoal?.daily_calorie_target ?? 2000;
    const caloriePct = Math.min(100, Math.round(((calories?.thisWeekAvg ?? 0) / Math.max(calorieTarget, 1)) * 100));
    const proteinPct = weekMacros?.protein?.percentage ?? 0;
    const hydrationPct = Math.min(100, waterSummary?.percentage ?? 0);
    const consistencyPct = consistency?.percentage ?? 0;
    const hasTodayNutrition =
      (todayProgress?.calories ?? 0) > 0 ||
      (todayProgress?.protein ?? 0) > 0 ||
      (todayProgress?.carbs ?? 0) > 0 ||
      (todayProgress?.fat ?? 0) > 0 ||
      (waterSummary?.total ?? 0) > 0;
    const nutritionFallbackScore = Math.round((caloriePct * 0.38) + (proteinPct * 0.32) + (hydrationPct * 0.2) + (consistencyPct * 0.1));
    const weeklyFallbackScore = Math.round((caloriePct + proteinPct + consistencyPct) / 3);
    const resolvedMealQualityScore = mealQualityScore > 0
      ? Math.round(mealQualityScore)
      : hasTodayNutrition
        ? nutritionFallbackScore
        : weeklyFallbackScore;

    return {
      date: format(new Date(), "MMMM d, yyyy"),
      weekRange: `${format(new Date(Date.now() - 7 * 86400000), "MMM d")} - ${format(new Date(), "MMM d, yyyy")}`,
      profile: {
        name: profile?.full_name || "User",
        goal: activeGoal?.goal_type || "general",
        weight: profile?.weight_kg ?? 0,
        height: profile?.height_cm ?? 0,
      },
      macros: {
        protein: {
          consumed: Math.round(weekMacros?.protein?.consumed ?? 0),
          target: weekMacros?.protein?.target ?? activeGoal?.protein_target_g ?? 0,
          percentage: weekMacros?.protein?.percentage ?? 0,
        },
        carbs: {
          consumed: Math.round(weekMacros?.carbs?.consumed ?? 0),
          target: weekMacros?.carbs?.target ?? activeGoal?.carbs_target_g ?? 0,
          percentage: weekMacros?.carbs?.percentage ?? 0,
        },
        fat: {
          consumed: Math.round(weekMacros?.fat?.consumed ?? 0),
          target: weekMacros?.fat?.target ?? activeGoal?.fat_target_g ?? 0,
          percentage: weekMacros?.fat?.percentage ?? 0,
        },
      },
      calories: {
        avg: Math.round(calories?.thisWeekAvg ?? 0),
        target: calorieTarget,
        change: calories?.changePercent ?? 0,
        trend: calories?.trend ?? "stable",
      },
      consistency: {
        daysLogged: consistency?.daysLogged ?? 0,
        percentage: consistency?.percentage ?? 0,
        streak: streaks?.logging?.currentStreak ?? 0,
        bestStreak: streaks?.logging?.bestStreak ?? 0,
      },
      water: {
        avg: waterSummary?.total ?? 0,
        target: waterSummary?.target ?? 8,
        percentage: waterSummary?.percentage ?? 0,
      },
      mealQuality: {
        score: resolvedMealQualityScore,
        weeklyAvg: weeklyQuality.length > 0
          ? Math.round(weeklyQuality.reduce((a, d) => a + d.avgScore, 0) / weeklyQuality.length)
          : 0,
      },
      today: {
        calories: todayProgress?.calories ?? 0,
        protein: todayProgress?.protein ?? 0,
        carbs: todayProgress?.carbs ?? 0,
        fat: todayProgress?.fat ?? 0,
      },
      recommendations: smartRecs.slice(0, 6).map((r: any) => ({
        title: r.title || r.label,
        description: r.description || r.action_text,
        category: r.category,
        priority: r.priority,
      })),
    };
  }, [weeklySummary, activeGoal, profile, streaks, waterSummary, mealQualityScore, weeklyQuality, todayProgress, smartRecs]);

  const weeklyReportData: WeeklyReportData | null = useMemo(() => {
    if (!weeklySummary) return null;
    const weekEnd = new Date();
    const weekStart = subDays(weekEnd, 7);
    return {
      userName: profile?.full_name || user?.email?.split("@")[0] || "User",
      userEmail: user?.email || "",
      reportDate: new Date().toISOString(),
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      currentWeight: profile?.weight_kg ?? null,
      weightChange: null,
      weightGoal: activeGoal?.target_weight_kg ?? null,
      weightProgress: 0,
      avgCalories: weeklySummary?.calories?.thisWeekAvg ?? 0,
      calorieTarget: activeGoal?.daily_calorie_target ?? 2000,
      calorieProgress: activeGoal?.daily_calorie_target
        ? Math.round(((weeklySummary?.calories?.thisWeekAvg ?? 0) / activeGoal.daily_calorie_target) * 100)
        : 0,
      avgProtein: Math.round(weeklySummary?.macros?.protein?.consumed ?? 0),
      proteinTarget: activeGoal?.protein_target_g ?? 120,
      avgCarbs: Math.round(weeklySummary?.macros?.carbs?.consumed ?? 0),
      carbsTarget: activeGoal?.carbs_target_g ?? 250,
      avgFat: Math.round(weeklySummary?.macros?.fat?.consumed ?? 0),
      fatTarget: activeGoal?.fat_target_g ?? 65,
      dailyData: [],
      consistencyScore: weeklySummary?.consistency?.percentage ?? 0,
      daysLogged: weeklySummary?.consistency?.daysLogged ?? 0,
      totalDays: 7,
      mealQualityScore: Math.round(mealQualityScore),
      waterAverage: waterSummary?.total ?? 0,
      currentStreak: streaks?.logging?.currentStreak ?? 0,
      bestStreak: streaks?.logging?.bestStreak ?? 0,
      activeGoal: activeGoal?.goal_type ?? null,
      goalProgress: 0,
      milestonesAchieved: 0,
      totalMilestones: 0,
      insights: [],
      recommendations: [],
      vsLastWeek: {
        calories: weeklySummary?.calories?.changePercent ?? 0,
        weight: 0,
        consistency: 0,
      },
      mealPlan: [] as any,
      mealImages: new Map(),
    };
  }, [weeklySummary, activeGoal, profile, user, mealQualityScore, waterSummary, streaks]);

  const fallbackContent = useMemo(() => {
    if (!weeklyReportData) return null;
    return aiReportGenerator.generateFallbackContent(weeklyReportData);
  }, [weeklyReportData]);

  const displayContent = aiContent ?? fallbackContent;

  useEffect(() => {
    if (!weeklyReportData || !user?.id || aiContent) return;
    let cancelled = false;
    setEnhancingAI(true);
    aiReportGenerator
      .generateReportContent(weeklyReportData, user.id)
      .then(({ content }) => {
        if (!cancelled) setAiContent(content);
      })
      .catch(() => void 0)
      .finally(() => {
        if (!cancelled) setEnhancingAI(false);
      });
    return () => { cancelled = true; };
  }, [weeklyReportData, user?.id, aiContent]);

  const handleDownloadPdf = async () => {
    if (!user?.id || !weeklySummary) {
      toast.error("No data available to generate report");
      return;
    }
    setGeneratingPdf(true);
    try {
      const weekEnd = new Date();
      const weekStart = subDays(weekEnd, 7);

      const [{ data: dailyLogs }, { data: waterLogs }] = await Promise.all([
        supabase.from("progress_logs")
          .select("log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, weight_kg")
          .eq("user_id", user.id)
          .gte("log_date", weekStart.toISOString().split("T")[0])
          .lte("log_date", weekEnd.toISOString().split("T")[0])
          .order("log_date"),
        supabase.from("water_intake")
          .select("log_date, glasses")
          .eq("user_id", user.id)
          .gte("log_date", weekStart.toISOString().split("T")[0])
          .lte("log_date", weekEnd.toISOString().split("T")[0]),
      ]);

      const dailyData: WeeklyReportData["dailyData"] = [];
      for (let i = 0; i < 7; i++) {
        const date = subDays(weekEnd, i);
        const dateStr = date.toISOString().split("T")[0];
        const log = (dailyLogs || []).find((l: any) => l.log_date === dateStr);
        const wLog = (waterLogs || []).find((w: any) => w.log_date === dateStr);
        dailyData.unshift({
          date: dateStr,
          calories: log?.calories_consumed || 0,
          protein: log?.protein_consumed_g || 0,
          carbs: log?.carbs_consumed_g || 0,
          fat: log?.fat_consumed_g || 0,
          weight: log?.weight_kg || null,
          water: wLog?.glasses || 0,
        });
      }

      const mealPlan = await generateWeeklyMealPlan(
        activeGoal?.daily_calorie_target ?? 2000,
        activeGoal?.protein_target_g ?? 120
      );
      const mealImages = await loadMealPlanImages(mealPlan);
      const mealPlanWithImages = mealPlan.map((day) => ({
        ...day,
        breakfast: day.breakfast ? { ...day.breakfast, image_url: mealImages.get(day.breakfast.id) || day.breakfast.image_url } : null,
        lunch: day.lunch ? { ...day.lunch, image_url: mealImages.get(day.lunch.id) || day.lunch.image_url } : null,
        dinner: day.dinner ? { ...day.dinner, image_url: mealImages.get(day.dinner.id) || day.dinner.image_url } : null,
        snack: day.snack ? { ...day.snack, image_url: mealImages.get(day.snack.id) || day.snack.image_url } : null,
      }));

      const reportPayload: WeeklyReportData = {
        ...weeklyReportData!,
        dailyData,
        mealPlan: mealPlanWithImages as any,
        mealImages: mealImages as any,
      };

      await aiReportPDF.download(reportPayload, displayContent);
      toast.success("Report downloaded");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Failed to generate report");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const caloriesProgress = Math.min(
    Math.round((reportData.calories.avg / Math.max(reportData.calories.target, 1)) * 100),
    100
  );
  const hydrationProgress = Math.min(reportData.water.percentage, 100);
  const trendTone = reportData.calories.trend === "up"
    ? "text-rose-600 bg-rose-50"
    : reportData.calories.trend === "down"
      ? "text-emerald-700 bg-emerald-50"
      : "text-slate-600 bg-slate-100";
  const reportScore = Math.round(
    (
      Math.min(reportData.mealQuality.score, 100) +
      Math.min(reportData.consistency.percentage, 100) +
      caloriesProgress +
      hydrationProgress
    ) / 4
  );

  return (
    <div className="min-h-screen bg-[#F6F8F4] text-slate-950">
      <div className="sticky top-0 z-50 border-b border-emerald-50 bg-[#F6F8F4]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[430px] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-slate-100 transition active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600">Nutrition</p>
            <h1 className="truncate text-[22px] font-black leading-tight">AI Report</h1>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition active:scale-95 disabled:opacity-60"
            aria-label="Download report"
          >
            {generatingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] px-4 pb-44 pt-4">
        <motion.section
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-100"
        >
          <div className="border-b border-slate-100 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">
                  Weekly Intelligence
                </p>
                <h2 className="mt-1 text-[28px] font-black leading-tight">
                  Nutrition report
                </h2>
                <p className="mt-1 text-[13px] font-bold text-slate-500">
                  {reportData.weekRange}
                </p>
              </div>
              <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/60">
                <div className="text-center">
                  <p className="text-2xl font-black leading-none">{reportScore}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide">score</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            {displayContent ? (
              <>
                <div className="rounded-[24px] bg-[#F8FBF6] p-4 ring-1 ring-emerald-50">
                  <div className="mb-3 flex items-center gap-2">
                    <Brain className="h-5 w-5 text-emerald-600" />
                    <p className="text-[12px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Executive summary
                    </p>
                  </div>
                  <p className="text-[15px] font-semibold leading-7 text-slate-700">
                    {displayContent.summary}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-[18px] bg-slate-50 p-3">
                    <Target className="h-4 w-4 text-emerald-600" />
                    <p className="mt-2 text-[11px] font-bold text-slate-500">Goal</p>
                    <p className="mt-0.5 truncate text-[13px] font-black capitalize text-slate-900">
                      {reportData.profile.goal.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-slate-50 p-3">
                    <Clock3 className="h-4 w-4 text-amber-600" />
                    <p className="mt-2 text-[11px] font-bold text-slate-500">Logged</p>
                    <p className="mt-0.5 text-[13px] font-black text-slate-900">
                      {reportData.consistency.daysLogged}/7 days
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-slate-50 p-3">
                    <ShieldCheck className="h-4 w-4 text-sky-600" />
                    <p className="mt-2 text-[11px] font-bold text-slate-500">Mode</p>
                    <p className="mt-0.5 text-[13px] font-black text-slate-900">
                      {aiContent ? "AI" : "Rules"}
                    </p>
                  </div>
                </div>

                {enhancingAI && !aiContent && (
                  <div className="mt-4 flex items-center gap-2 rounded-[18px] bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Personalizing report
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                <span className="text-sm font-semibold text-slate-500">Loading analysis</span>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="mt-4 grid grid-cols-3 gap-3"
        >
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            const value = metric.key === "quality"
              ? reportData.mealQuality.score
              : metric.key === "consistency"
                ? Math.round(reportData.consistency.percentage)
                : reportData.consistency.streak;
            const max = metric.key === "streak" ? reportData.consistency.bestStreak || 7 : 100;

            return (
              <div key={metric.label} className="min-w-0 rounded-[24px] bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${metric.iconBg}`}>
                  <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                </div>
                <p className={`text-[28px] font-black leading-none ${metric.accent}`}>{value}</p>
                <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                  {metric.label}
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">of {max}</p>
              </div>
            );
          })}
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Weekly average</p>
              <h2 className="mt-1 text-[20px] font-black">Macro targets</h2>
            </div>
            <Apple className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="space-y-4">
            {macroRows.map((macro) => {
              const data = reportData.macros[macro.key];
              return (
                <div key={macro.label}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${macro.chip}`}>{macro.label}</span>
                    <span className="text-sm font-black text-slate-700">
                      {data.consumed} / {data.target}{macro.unit}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${macro.bar}`}
                      style={{ width: `${Math.min(data.percentage, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs font-bold text-slate-400">{Math.round(data.percentage)}%</p>
                </div>
              );
            })}
          </div>
        </motion.section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <motion.section variants={fadeIn} initial="hidden" animate="visible" className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Calories</p>
                <p className="mt-3 text-[34px] font-black leading-none">{reportData.calories.avg}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">avg / {reportData.calories.target}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${trendTone}`}>
                {reportData.calories.trend === "up" ? <TrendingUp className="h-3 w-3" /> : reportData.calories.trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                {reportData.calories.change > 0 ? "+" : ""}{reportData.calories.change}%
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-orange-500" style={{ width: `${caloriesProgress}%` }} />
            </div>
          </motion.section>

          <motion.section variants={fadeIn} initial="hidden" animate="visible" className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Hydration</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r="25" fill="none" stroke="#E2E8F0" strokeWidth="7" />
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${(hydrationProgress / 100) * 157} 157`}
                  />
                </svg>
                <Droplets className="h-6 w-6 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[34px] font-black leading-none">{reportData.water.avg}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">of {reportData.water.target}</p>
              </div>
            </div>
          </motion.section>
        </div>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-emerald-600" />
            <h2 className="text-[20px] font-black">Today's snapshot</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {todayRows.map((item) => (
              <div key={item.label} className={`rounded-[22px] p-4 ${item.bg}`}>
                <p className={`text-[28px] font-black leading-none ${item.color}`}>{reportData.today[item.key]}</p>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{item.unit}</p>
                <p className="mt-3 text-sm font-black text-slate-700">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              <h2 className="text-[20px] font-black">Next best actions</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {reportData.recommendations.length || 0}
            </span>
          </div>

          <div className="space-y-3">
            {reportData.recommendations.length > 0 ? reportData.recommendations.map((rec, i) => {
              const priorityClass = rec.priority === "high"
                ? "bg-rose-50 text-rose-700"
                : rec.priority === "medium"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600";

              return (
                <div key={`${rec.title}-${i}`} className="flex gap-3 rounded-[22px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${priorityClass}`}>
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{rec.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{rec.description}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-emerald-600" />
                <p className="mt-2 text-sm font-black text-slate-800">No recommendations yet</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Log more meals to unlock personalized actions.</p>
              </div>
            )}
          </div>
        </motion.section>

        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="py-6 text-center">
          <p className="text-xs font-semibold text-slate-400">Generated on {reportData.date}</p>
        </motion.div>
      </main>

      <div className="fixed inset-x-0 z-50 border-t border-slate-100 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-14px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl" style={{ bottom: "56px" }}>
        <div className="mx-auto max-w-[430px]">
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-[15px] font-black text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition active:scale-[0.99] disabled:opacity-60"
          >
            {generatingPdf ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileDown className="h-5 w-5" />
            )}
            {generatingPdf ? "Preparing PDF" : "Download professional PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
