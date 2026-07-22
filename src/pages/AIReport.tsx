import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Flame, TrendingUp, TrendingDown,
  Droplets, CalendarCheck, Brain,
  UtensilsCrossed, Apple, Star, FileDown, Loader2,
  Lightbulb, ChefHat, AlertCircle,
  Activity, MessageCircle, ChevronRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useMealQuality } from "@/hooks/useMealQuality";
import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";
import { useHealthDailyMetrics } from "@/hooks/useHealthDailyMetrics";
import { calculateGoalAlignmentScore, reviewGoalProgress } from "@/lib/goal-engine";
import {
  buildReadinessFoodTip,
  calculateBodyLoad,
  calculateHealthBaseline,
  calculateRecoveryReadiness,
  getRecoveryPlanKey,
} from "@/lib/health-readiness";
import { Logo } from "@/components/Logo";
import { generateWeeklyMealPlan, loadMealPlanImages } from "@/lib/meal-plan-generator";
import { aiReportGenerator } from "@/lib/ai-report-generator";
import { aiReportPDF } from "@/lib/ai-report-pdf";
import type { AIReportContent } from "@/lib/ai-report-generator";
import { supabase } from "@/integrations/supabase/client";
import { WATER_GLASS_ML } from "@/lib/water-service";
import type { WeeklyReportData } from "@/lib/professional-weekly-report-pdf";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: (custom: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: custom * 0.05 },
  }),
};

const metricCards = [
  {
    labelKey: "meal_quality",
    key: "quality",
    icon: Star,
  },
  {
    labelKey: "consistency",
    key: "consistency",
    icon: CalendarCheck,
  },
  {
    labelKey: "streak",
    key: "streak",
    icon: Flame,
  },
] as const;

const macroRows = [
  {
    labelKey: "protein_label",
    unit: "g",
    key: "protein",
  },
  {
    labelKey: "carbs",
    unit: "g",
    key: "carbs",
  },
  {
    labelKey: "fat_label",
    unit: "g",
    key: "fat",
  },
] as const;

const todayRows = [
  { labelKey: "calories", key: "calories", unit: "kcal" },
  { labelKey: "protein_label", key: "protein", unit: "g" },
  { labelKey: "carbs", key: "carbs", unit: "g" },
  { labelKey: "fat_label", key: "fat", unit: "g" },
] as const;

export default function AIReportPage() {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { streaks } = useStreak(user?.id);
  const { todayProgress } = useTodayProgress(user?.id, new Date(), 0);
  const { dailySummary: waterSummary } = useWaterIntake(user?.id);
  const { averageScore: mealQualityScore, weeklyQuality } = useMealQuality(user?.id);
  const { recommendations: smartRecs } = useSmartRecommendations(user?.id);
  const { metrics: healthDailyMetrics, rangeMetrics: healthRangeMetrics } = useHealthDailyMetrics(user?.id, undefined, 14);

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [aiContent, setAiContent] = useState<AIReportContent | null>(null);

  const prefersReducedMotion = useReducedMotion();
  const motionProps = (index: number) => ({
    variants: fadeIn,
    initial: "hidden",
    animate: "visible",
    custom: prefersReducedMotion ? 0 : index,
  });

  const reportData = useMemo(() => {
    const weekMacros = weeklySummary?.macros;
    const calories = weeklySummary?.calories;
    const consistency = weeklySummary?.consistency;
    const calorieTarget = activeGoal?.daily_calorie_target ?? 2000;
    const caloriePct = Math.min(100, Math.round(((calories?.thisWeekAvg ?? 0) / Math.max(calorieTarget, 1)) * 100));
    const proteinPct = weekMacros?.protein?.percentage ?? 0;
    const hydrationPct = Math.min(100, waterSummary?.percentage ?? 0);
    const consistencyPct = consistency?.percentage ?? 0;
    const goalAlignment = calculateGoalAlignmentScore({
      caloriePct,
      proteinPct,
      consistencyPct,
    });
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
        name: profile?.full_name || t("user"),
        goal: activeGoal?.goal_type || "general",
        weight: profile?.current_weight_kg ?? 0,
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
        goalAlignment,
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
  }, [weeklySummary, activeGoal, profile, streaks, waterSummary, mealQualityScore, weeklyQuality, todayProgress, smartRecs, t]);

  const weeklyReportData: WeeklyReportData | null = useMemo(() => {
    if (!weeklySummary) return null;
    const weekEnd = new Date();
    const weekStart = subDays(weekEnd, 7);
    const pdfReadiness = calculateRecoveryReadiness(healthDailyMetrics);
    const pdfBodyLoad = calculateBodyLoad(healthDailyMetrics);
    const pdfBaseline = calculateHealthBaseline(healthRangeMetrics);
    const pdfPlanKey = getRecoveryPlanKey(pdfBaseline, pdfReadiness, pdfBodyLoad);
    const pdfFoodTipKey = buildReadinessFoodTip(pdfReadiness, pdfBodyLoad);
    return {
      userName: profile?.full_name || user?.email?.split("@")[0] || "User",
      userEmail: user?.email || "",
      reportDate: new Date().toISOString(),
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      currentWeight: profile?.current_weight_kg ?? null,
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
      healthReadiness: {
        readinessScore: pdfReadiness.score,
        bodyLoad: pdfBodyLoad.score,
        avgReadiness: pdfBaseline.avgReadiness,
        highLoadDays: pdfBaseline.highLoadDays,
        sleepMinutes: pdfBaseline.avgSleepMinutes,
        recoveryPlan: t(pdfPlanKey),
        foodTip: t(pdfFoodTipKey),
      },
    };
  }, [weeklySummary, activeGoal, profile, user, mealQualityScore, waterSummary, streaks, healthDailyMetrics, healthRangeMetrics, t]);

  const fallbackContent = useMemo(() => {
    if (!weeklyReportData) return null;
    return aiReportGenerator.generateFallbackContent(weeklyReportData, isRTL ? "ar" : "en");
  }, [weeklyReportData, isRTL]);

  const displayContent = aiContent ?? fallbackContent;

  useEffect(() => {
    setAiContent(null);
  }, [isRTL]);

  useEffect(() => {
    if (!weeklyReportData || !user?.id || aiContent) return;
    let cancelled = false;
    aiReportGenerator
      .generateReportContent(weeklyReportData, user.id, isRTL ? "ar" : "en")
      .then(({ content }) => {
        if (!cancelled) setAiContent(content);
      })
      .catch(() => void 0);
    return () => { cancelled = true; };
  }, [weeklyReportData, user?.id, aiContent, isRTL]);

  const handleDownloadPdf = async () => {
    if (!user?.id || !weeklySummary) {
      toast.error(t("ai_report_no_data"));
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
        supabase.from("water_entries")
          .select("log_date, amount_ml")
          .eq("user_id", user.id)
          .gte("log_date", weekStart.toISOString().split("T")[0])
          .lte("log_date", weekEnd.toISOString().split("T")[0]),
      ]);

      const dailyData: WeeklyReportData["dailyData"] = [];
      for (let i = 0; i < 7; i++) {
        const date = subDays(weekEnd, i);
        const dateStr = date.toISOString().split("T")[0];
        const log = (dailyLogs || []).find((l: any) => l.log_date === dateStr);
        const dayWaterMl = (waterLogs || [])
          .filter((w: any) => w.log_date === dateStr)
          .reduce((sum: number, w: any) => sum + (w.amount_ml || 0), 0);
        dailyData.unshift({
          date: dateStr,
          calories: log?.calories_consumed || 0,
          protein: log?.protein_consumed_g || 0,
          carbs: log?.carbs_consumed_g || 0,
          fat: log?.fat_consumed_g || 0,
          weight: log?.weight_kg || null,
          water: Number((dayWaterMl / WATER_GLASS_ML).toFixed(1)),
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

      let pdfContent = aiReportGenerator.generateFallbackContent(reportPayload, "en");
      try {
        const { content } = await aiReportGenerator.generateReportContent(reportPayload, user.id, "en");
        pdfContent = content;
      } catch (contentErr) {
        console.error("Error generating English PDF content:", contentErr);
      }

      await aiReportPDF.download(reportPayload, pdfContent);
      toast.success(t("ai_report_downloaded"));
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error(t("ai_report_failed"));
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
    ? "text-rose-500 bg-rose-50"
    : reportData.calories.trend === "down"
      ? "text-emerald-500 bg-emerald-50"
      : "text-slate-900 bg-slate-50";
  const reportScore = Math.round(
    (
      Math.min(reportData.mealQuality.score, 100) +
      Math.min(reportData.consistency.percentage, 100) +
      caloriesProgress +
      hydrationProgress
    ) / 4
  );
  const goalAlignmentScore = reportData.calories.goalAlignment ?? calculateGoalAlignmentScore({
    caloriePct: caloriesProgress,
    proteinPct: reportData.macros.protein.percentage,
    consistencyPct: reportData.consistency.percentage,
  });
  const goalReview = reviewGoalProgress({
    goalType: reportData.profile.goal,
    caloriePct: caloriesProgress,
    proteinPct: reportData.macros.protein.percentage,
    consistencyPct: reportData.consistency.percentage,
    daysLogged: reportData.consistency.daysLogged,
  });
  const proteinGap = Math.max(0, Math.round(reportData.macros.protein.target - reportData.macros.protein.consumed));
  const calorieDiff = Math.round(reportData.calories.avg - reportData.calories.target);
  const scoreReasons = [
    reportData.consistency.daysLogged < 4 && t("ai_report_score_reason_low_logging", { days: reportData.consistency.daysLogged }),
    proteinGap > 0 && t("ai_report_score_reason_protein_gap", { amount: proteinGap }),
    hydrationProgress < 70 && t("ai_report_score_reason_hydration", { percent: hydrationProgress }),
    Math.abs(calorieDiff) > 250 && t("ai_report_score_reason_calories", { amount: Math.abs(calorieDiff) }),
  ].filter(Boolean) as string[];
  const weeklyPriorities = [
    t("ai_report_priority_log_days"),
    proteinGap > 0
      ? t("ai_report_priority_protein", { amount: Math.min(proteinGap, 35) })
      : t("ai_report_priority_keep_protein"),
    hydrationProgress < 80 ? t("ai_report_priority_water") : t("ai_report_priority_review"),
  ];
  const recommendedMealIdeas = [
    proteinGap > 0 ? t("ai_report_meal_idea_protein") : t("ai_report_meal_idea_balanced"),
    Math.abs(calorieDiff) > 250 ? t("ai_report_meal_idea_calorie_fit") : t("ai_report_meal_idea_repeat"),
    t("ai_report_meal_idea_nutrio"),
  ];
  const recoveryReadiness = calculateRecoveryReadiness(healthDailyMetrics);
  const bodyLoad = calculateBodyLoad(healthDailyMetrics);
  const readinessScoreDisplay = recoveryReadiness.score === null ? "--" : recoveryReadiness.score;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-100 bg-[#F8FAFC]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[430px] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            data-testid="ai-report-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 font-bold ring-1 ring-slate-200 hover:bg-slate-50 transition active:scale-95"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
            <Logo size="xl" className="!h-11" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">{t("nutrition")}</p>
            <h1 className="truncate text-[20px] font-black leading-tight text-slate-900">{t("ai_report")}</h1>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] pt-4 space-y-3">

        {/* Hero Tile */}
        <motion.section {...motionProps(0)} className="relative overflow-hidden rounded-2xl bg-[#0F172A] p-6 text-white">
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">{t("weekly_intelligence")}</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-400">{reportData.weekRange}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                data-testid="ai-report-download-btn"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-md transition hover:bg-white/15 active:scale-95 disabled:opacity-60"
                aria-label={t("download_pdf_report")}
              >
                {generatingPdf ? (
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                ) : (
                  <FileDown className="h-3 w-3 text-emerald-500" />
                )}
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white">PDF</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/ai-coach")}
                className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 backdrop-blur-md transition hover:bg-emerald-400 active:scale-95"
                aria-label={t("ai_coach_label")}
                title={t("ai_coach_label")}
              >
                <MessageCircle className="h-3 w-3 text-white" />
                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.1em] text-white">
                  {t("ai_coach_label")}
                </span>
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-8 flex items-end justify-between">
            <div>
              <p className="text-[72px] font-mono font-black leading-none tracking-tighter text-white">
                {reportScore}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("score")}</p>
            </div>
            <div className="relative h-16 w-16">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" className="stroke-white/10" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  className="stroke-emerald-500"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(reportScore / 100) * 175.9} 175.9`}
                />
              </svg>
            </div>
          </div>

          {/* Executive Summary */}
          {displayContent && (
            <div className="relative z-10 mt-6 border-t border-white/10 pt-4">
              <p className="text-[13px] font-semibold leading-6 text-slate-300">
                {displayContent.summary}
              </p>
            </div>
          )}
        </motion.section>

        {/* Metric Trio */}
        <motion.section {...motionProps(1)} className="grid grid-cols-3 gap-3">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            const value = metric.key === "quality"
              ? reportData.mealQuality.score
              : metric.key === "consistency"
                ? Math.round(reportData.consistency.percentage)
                : reportData.consistency.streak;
            const max = metric.key === "streak" ? reportData.consistency.bestStreak || 7 : 100;

            return (
              <div key={metric.labelKey} className="flex flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-mono font-bold text-slate-400">/{max}</span>
                </div>
                <div className="mt-4">
                  <p className="text-[28px] font-mono font-black leading-none tracking-tight text-slate-900">{value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{t(metric.labelKey)}</p>
                </div>
              </div>
            );
          })}
        </motion.section>

        {/* Goal Alignment */}
        <motion.section {...motionProps(2)} className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("goal_weekly_review")}</p>
              <h2 className="mt-1 text-[18px] font-black leading-tight text-slate-900">{t(goalReview.titleKey)}</h2>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-slate-500">{t(goalReview.detailKey)}</p>
            </div>
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" className="stroke-slate-100" strokeWidth="5" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  className="stroke-emerald-500"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(goalAlignmentScore / 100) * 150.7} 150.7`}
                />
              </svg>
              <span className="absolute font-mono text-[14px] font-black text-slate-900">{goalAlignmentScore}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/weekly-check-in")}
            className="mt-5 flex w-full items-center justify-between rounded-full bg-emerald-500 px-5 py-3.5 transition active:scale-[0.98] hover:bg-emerald-600"
          >
            <span className="text-[13px] font-extrabold text-white">{isRTL ? "ابدأ المراجعة" : "Start check-in"}</span>
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </motion.section>

        {/* Health Readiness */}
        <motion.section {...motionProps(3)} className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("recovery")}</p>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 flex items-end gap-2">
              <p className="text-[32px] font-mono font-black leading-none tracking-tight text-slate-900">{readinessScoreDisplay}</p>
              <p className="mb-1 text-[10px] font-mono font-bold text-slate-400">/100</p>
            </div>
            <p className="mt-2 text-[12px] font-semibold leading-tight text-slate-500">{t(recoveryReadiness.labelKey)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("body_load")}</p>
              <Brain className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 flex items-end gap-2">
              <p className="text-[32px] font-mono font-black leading-none tracking-tight text-slate-900">{bodyLoad.score}</p>
              <p className="mb-1 text-[10px] font-mono font-bold text-slate-400">/21</p>
            </div>
            <p className="mt-2 text-[12px] font-semibold leading-tight text-slate-500">{t(bodyLoad.detailKey)}</p>
          </div>
        </motion.section>

        {/* Macro Targets */}
        <motion.section {...motionProps(4)} className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("macro_targets")}</p>
            <Apple className="h-4 w-4 text-slate-400" />
          </div>
          <div className="space-y-4">
            {macroRows.map((macro) => {
              const data = reportData.macros[macro.key];
              return (
                <div key={macro.labelKey}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-slate-700">{t(macro.labelKey)}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-[13px] font-black text-slate-900">{data.consumed}</span>
                      <span className="font-mono text-[10px] font-bold text-slate-400">/ {data.target}{macro.unit}</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(data.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Calories + Hydration */}
        <motion.section {...motionProps(5)} className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("calories")}</p>
              <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-mono font-black ${trendTone}`}>
                {reportData.calories.trend === "up" ? <TrendingUp className="h-3 w-3" /> : reportData.calories.trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                {reportData.calories.change > 0 ? "+" : ""}{reportData.calories.change}%
              </span>
            </div>
            <div className="mt-4">
              <p className="text-[32px] font-mono font-black leading-none tracking-tight text-slate-900">{reportData.calories.avg}</p>
              <p className="mt-1 text-[10px] font-mono font-bold text-slate-400">/ {reportData.calories.target} kcal</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${caloriesProgress}%` }} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("hydration")}</p>
              <Droplets className="h-4 w-4 text-sky-500" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" className="stroke-slate-100" strokeWidth="4" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    className="stroke-sky-500"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(hydrationProgress / 100) * 125.6} 125.6`}
                  />
                </svg>
              </div>
              <div>
                <p className="text-[24px] font-mono font-black leading-none tracking-tight text-slate-900">{reportData.water.avg}</p>
                <p className="mt-1 text-[10px] font-mono font-bold text-slate-400">/ {reportData.water.target} L</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Score Breakdown */}
        <motion.section {...motionProps(6)} className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("ai_report_why_score")}</p>
            <AlertCircle className="h-4 w-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            {(scoreReasons.length ? scoreReasons : [t("ai_report_score_reason_good")]).map((reason, index) => (
              <div key={`${reason}-${index}`} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[10px] font-black text-slate-500">
                  {index + 1}
                </span>
                <p className="text-[13px] font-semibold leading-5 text-slate-700">{reason}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Top Priorities */}
        <motion.section {...motionProps(7)} className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("ai_report_top_priorities")}</p>
            <Lightbulb className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="space-y-3">
            {weeklyPriorities.map((priority, index) => (
              <div key={priority} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-mono text-[10px] font-black text-emerald-600">
                  {index + 1}
                </span>
                <p className="text-[13px] font-semibold leading-5 text-slate-700">{priority}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Nutrio Picks */}
        <motion.section {...motionProps(8)} className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("ai_report_recommended_meals")}</p>
            <ChefHat className="h-4 w-4 text-slate-400" />
          </div>
          <div className="-mx-5 flex snap-x snap-mandatory overflow-x-auto px-5 pb-2 scrollbar-hide">
            <div className="flex gap-3">
              {recommendedMealIdeas.map((idea, index) => (
                <div key={idea} className="w-[240px] shrink-0 snap-start rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <span className="font-mono text-[10px] font-black text-slate-400">0{index + 1}</span>
                  <p className="mt-2 text-[13px] font-semibold leading-5 text-slate-700">{idea}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Today's Snapshot */}
        <motion.section {...motionProps(9)} className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("todays_snapshot")}</p>
            <UtensilsCrossed className="h-4 w-4 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {todayRows.map((item) => (
              <div key={item.labelKey} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{t(item.labelKey)}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <p className="font-mono text-[24px] font-black leading-none text-slate-900">{reportData.today[item.key]}</p>
                  <p className="font-mono text-[10px] font-bold text-slate-400">{item.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Next Best Actions */}
        <motion.section {...motionProps(10)} className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t("next_best_actions")}</p>
            <span className="font-mono text-[10px] font-black text-slate-400">{reportData.recommendations.length || 0}</span>
          </div>
          <div className="space-y-3">
            {reportData.recommendations.length > 0 ? reportData.recommendations.map((rec, i) => {
              const priorityColor = rec.priority === "high"
                ? "bg-rose-500"
                : rec.priority === "medium"
                  ? "bg-amber-500"
                  : "bg-slate-400";

              return (
                <div key={`${rec.title}-${i}`} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityColor}`} />
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">{rec.title}</p>
                    <p className="mt-0.5 text-[12px] font-medium leading-5 text-slate-500">{rec.description}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-slate-400" />
                <p className="mt-2 text-[13px] font-bold text-slate-900">{t("no_recommendations_yet")}</p>
                <p className="mt-1 text-[12px] font-medium text-slate-500">{t("log_more_meals_unlock_actions")}</p>
              </div>
            )}
          </div>
        </motion.section>

        <motion.div {...motionProps(11)} className="py-6 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {t("generated_on", { date: reportData.date })}
          </p>
        </motion.div>
      </main>

      {createPortal(
        <motion.button
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/ai-coach")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0F172A] text-white shadow-[0_8px_24px_rgba(15,23,42,0.28)] ring-1 ring-white/10 transition hover:bg-slate-800 active:scale-90"
          style={{
            position: "fixed",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
            zIndex: 60,
            ...(isRTL ? { left: 20 } : { right: 20 }),
          }}
          aria-label={t("ai_coach_label")}
          title={t("ai_coach_label")}
        >
          <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
        </motion.button>,
        document.body
      )}
    </div>
  );
}
