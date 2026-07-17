import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Flame, TrendingUp, TrendingDown,
  Droplets, CalendarCheck, Brain, Target, Trophy,
  UtensilsCrossed, Apple, Star, Zap, FileDown, Loader2,
  ShieldCheck, Clock3, Lightbulb, Gift, ChefHat, AlertCircle,
  Activity,
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
import { calculateGoalAlignmentScore, getGoalAlignmentLabelKey, reviewGoalProgress } from "@/lib/goal-engine";
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const metricCards = [
  {
    labelKey: "meal_quality",
    key: "quality",
    icon: Star,
    iconBg: "bg-[#EFFFFA]",
    iconColor: "text-[#22C7A1]",
    accent: "text-[#22C7A1]",
  },
  {
    labelKey: "consistency",
    key: "consistency",
    icon: CalendarCheck,
    iconBg: "bg-[#FFF7ED]",
    iconColor: "text-[#F97316]",
    accent: "text-[#F97316]",
  },
  {
    labelKey: "streak",
    key: "streak",
    icon: Flame,
    iconBg: "bg-[#FFF0F2]",
    iconColor: "text-[#FB6B7A]",
    accent: "text-[#FB6B7A]",
  },
] as const;

const macroRows = [
  {
    labelKey: "protein_label",
    unit: "g",
    key: "protein",
    bar: "bg-[#7C83F6]",
    chip: "bg-[#F3F4FF] text-[#7C83F6]",
  },
  {
    labelKey: "carbs",
    unit: "g",
    key: "carbs",
    bar: "bg-[#F97316]",
    chip: "bg-[#FFF7ED] text-[#F97316]",
  },
  {
    labelKey: "fat_label",
    unit: "g",
    key: "fat",
    bar: "bg-[#FB6B7A]",
    chip: "bg-[#FFF0F2] text-[#FB6B7A]",
  },
] as const;

const todayRows = [
  { labelKey: "calories", key: "calories", unit: "kcal", color: "text-[#22C7A1]", bg: "bg-[#EFFFFA]" },
  { labelKey: "protein_label", key: "protein", unit: "g", color: "text-[#7C83F6]", bg: "bg-[#F3F4FF]" },
  { labelKey: "carbs", key: "carbs", unit: "g", color: "text-[#F97316]", bg: "bg-[#FFF7ED]" },
  { labelKey: "fat_label", key: "fat", unit: "g", color: "text-[#FB6B7A]", bg: "bg-[#FFF0F2]" },
] as const;

const goalLabelKeys: Record<string, string> = {
  weight_loss: "goal_weight_loss",
  muscle_gain: "goal_muscle_gain",
  maintenance: "maintain",
  maintain_weight: "maintain",
  general_health: "general_health",
  general: "general_health",
};

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
    setEnhancingAI(true);
    aiReportGenerator
      .generateReportContent(weeklyReportData, user.id, isRTL ? "ar" : "en")
      .then(({ content }) => {
        if (!cancelled) setAiContent(content);
      })
      .catch(() => void 0)
      .finally(() => {
        if (!cancelled) setEnhancingAI(false);
      });
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
    ? "text-[#FB6B7A] bg-[#FFF0F2]"
    : reportData.calories.trend === "down"
      ? "text-[#22C7A1] bg-[#EFFFFA]"
      : "text-[#020617] bg-[#F6F8FB]";
  const reportScore = Math.round(
    (
      Math.min(reportData.mealQuality.score, 100) +
      Math.min(reportData.consistency.percentage, 100) +
      caloriesProgress +
      hydrationProgress
    ) / 4
  );
  const goalLabel = t(goalLabelKeys[reportData.profile.goal] ?? "general_health");
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
  const caloriePattern = Math.abs(calorieDiff) <= 150
    ? t("ai_report_calorie_pattern_aligned")
    : calorieDiff > 0
      ? t("ai_report_calorie_pattern_above", { amount: calorieDiff })
      : t("ai_report_calorie_pattern_below", { amount: Math.abs(calorieDiff) });
  const bestQualityDay = weeklyQuality.length
    ? weeklyQuality.reduce((best, day) => day.avgScore > best.avgScore ? day : best, weeklyQuality[0])
    : null;
  const bestDayLabel = bestQualityDay
    ? t("ai_report_best_day_value", {
      day: format(new Date(bestQualityDay.date), "EEE, MMM d"),
      score: Math.round(bestQualityDay.avgScore),
    })
    : t("ai_report_best_day_pending");
  const needsFocusLabel = reportData.consistency.daysLogged < 4
    ? t("ai_report_focus_logging")
    : proteinGap > 0
      ? t("ai_report_focus_protein")
      : t("ai_report_focus_consistency");
  const consistencyExplanation = t("ai_report_consistency_explanation", {
    days: reportData.consistency.daysLogged,
    total: 7,
    percent: Math.round(reportData.consistency.percentage),
  });
  const nextRewardText = reportData.consistency.daysLogged >= 5
    ? t("ai_report_reward_close")
    : t("ai_report_reward_next", { days: Math.max(0, 5 - reportData.consistency.daysLogged) });
  const coachNote = reportScore >= 70
    ? t("ai_report_coach_note_good")
    : reportScore >= 40
      ? t("ai_report_coach_note_building")
      : t("ai_report_coach_note_start");
  const recoveryReadiness = calculateRecoveryReadiness(healthDailyMetrics);
  const bodyLoad = calculateBodyLoad(healthDailyMetrics);
  const readinessFoodTipKey = buildReadinessFoodTip(recoveryReadiness, bodyLoad);
  const readinessScoreDisplay = recoveryReadiness.score === null ? "--" : recoveryReadiness.score;
  const readinessTrend = healthRangeMetrics.map((item) => calculateRecoveryReadiness(item).score ?? 0);
  const readinessAverage = readinessTrend.length
    ? Math.round(readinessTrend.reduce((sum, score) => sum + score, 0) / readinessTrend.length)
    : null;
  const highLoadDays = healthRangeMetrics.filter((item) => calculateBodyLoad(item).score >= 15).length;

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#020617]" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-50 border-b border-[#E5EAF1] bg-[#F6F8FB]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[430px] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            data-testid="ai-report-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
            <Logo size="xl" className="!h-11" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{t("nutrition")}</p>
            <h1 className="truncate text-[22px] font-black leading-tight text-[#020617]">{t("ai_report")}</h1>
          </div>
          <button
            data-testid="ai-report-download-btn"
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#020617] px-3.5 text-[12px] font-black uppercase tracking-[0.08em] text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition active:scale-95 disabled:opacity-60"
            aria-label={t("download_pdf_report")}
            title={t("download_pdf_report")}
          >
            {generatingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span>PDF</span>
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] px-4 pb-44 pt-4">
        <motion.section
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1]"
        >
          <div className="border-b border-[#E5EAF1] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                  {t("weekly_intelligence")}
                </p>
                <h2 className="mt-1 text-[28px] font-black leading-tight text-[#020617]">
                  {t("nutrition_report")}
                </h2>
                <p className="mt-1 text-[13px] font-bold text-[#94A3B8]">
                  {reportData.weekRange}
                </p>
              </div>
              <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full bg-[#020617] text-white ring-8 ring-[#F6F8FB]">
                <div className="text-center">
                  <p className="text-2xl font-black leading-none">{reportScore}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide">{t("score")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            {displayContent ? (
              <>
                <div className="rounded-[24px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
                  <div className="mb-3 flex items-center gap-2">
                    <Brain className="h-5 w-5 text-[#7C83F6]" />
                    <p className="text-[12px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      {t("executive_summary")}
                    </p>
                  </div>
                  <p className="text-[15px] font-semibold leading-7 text-[#020617]/75">
                    {displayContent.summary}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="flex min-h-[82px] flex-col items-center justify-center rounded-[18px] bg-[#F6F8FB] p-3 text-center ring-1 ring-[#E5EAF1]">
                    <Target className="h-4 w-4 text-[#22C7A1]" />
                    <p className="mt-2 text-[11px] font-bold text-[#94A3B8]">{t("goal")}</p>
                    <p className="mt-0.5 w-full text-center text-[13px] font-black text-[#020617]">
                      {goalLabel}
                    </p>
                  </div>
                  <div className="flex min-h-[82px] flex-col items-center justify-center rounded-[18px] bg-[#F6F8FB] p-3 text-center ring-1 ring-[#E5EAF1]">
                    <Clock3 className="h-4 w-4 text-[#F97316]" />
                    <p className="mt-2 text-[11px] font-bold text-[#94A3B8]">{t("logged")}</p>
                    <p className="mt-0.5 w-full text-center text-[13px] font-black text-[#020617]">
                      {t("days_logged_fraction", { current: reportData.consistency.daysLogged, total: 7 })}
                    </p>
                  </div>
                  <div className="flex min-h-[82px] flex-col items-center justify-center rounded-[18px] bg-[#F6F8FB] p-3 text-center ring-1 ring-[#E5EAF1]">
                    <ShieldCheck className="h-4 w-4 text-[#38BDF8]" />
                    <p className="mt-2 text-[11px] font-bold text-[#94A3B8]">{t("mode")}</p>
                    <p className="mt-0.5 w-full text-center text-[13px] font-black text-[#020617]">
                      {aiContent ? "AI" : t("rules")}
                    </p>
                  </div>
                </div>

                {enhancingAI && !aiContent && (
                  <div className="mt-4 flex items-center gap-2 rounded-[18px] bg-[#F3F4FF] px-3 py-3 text-xs font-bold text-[#7C83F6]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("personalizing_report")}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-[#7C83F6]" />
                <span className="text-sm font-semibold text-[#94A3B8]">{t("loading_analysis")}</span>
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
              <div key={metric.labelKey} className="flex min-h-[134px] min-w-0 flex-col items-center justify-center rounded-[24px] bg-white p-3 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${metric.iconBg}`}>
                  <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                </div>
                <p className={`w-full text-center text-[28px] font-black leading-none ${metric.accent}`}>{value}</p>
                <p className="mt-1 w-full truncate text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">
                  {t(metric.labelKey)}
                </p>
                <p className="mt-1 w-full text-center text-[11px] font-bold text-[#94A3B8]">{t("of_value", { value: max })}</p>
              </div>
            );
          })}
        </motion.section>

        <motion.section
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("goal_weekly_review")}</p>
              <h2 className="mt-1 text-[20px] font-black leading-tight text-[#020617]">{t(goalReview.titleKey)}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#64748B]">{t(goalReview.detailKey)}</p>
            </div>
            <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
              <div className="text-center">
                <p className="text-[24px] font-black leading-none text-[#020617]">{goalAlignmentScore}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#94A3B8]">{t("score")}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/weekly-check-in")}
            className="mt-4 block w-full rounded-2xl bg-[#F6F8FB] p-3 text-start ring-1 ring-[#E5EAF1] transition active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-[#020617]">{t(getGoalAlignmentLabelKey(goalAlignmentScore))}</span>
              <span className="rounded-full bg-[#020617] px-3 py-1.5 text-[11px] font-black text-white">{isRTL ? "ابدأ المراجعة" : "Start check-in"}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
              <div className="h-full rounded-full bg-[#22C7A1]" style={{ width: `${Math.min(goalAlignmentScore, 100)}%` }} />
            </div>
          </button>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("health_readiness_report")}</p>
              <h2 className="mt-1 text-[20px] font-black leading-tight text-[#020617]">{t(recoveryReadiness.labelKey)}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#64748B]">{t(recoveryReadiness.detailKey)}</p>
            </div>
            <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full bg-[#020617] text-white ring-8 ring-[#F6F8FB]">
              <div className="text-center">
                <p className="text-[24px] font-black leading-none">{readinessScoreDisplay}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-white/70">{t("score")}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("body_load")}</p>
                <Activity className="h-4 w-4 text-[#7C83F6]" />
              </div>
              <p className="text-[30px] font-black leading-none text-[#020617]">{bodyLoad.score}<span className="ml-1 text-[12px] font-black text-[#94A3B8]">/21</span></p>
              <p className="mt-2 text-[12px] font-bold leading-5 text-[#64748B]">{t(bodyLoad.detailKey)}</p>
            </div>
            <div className="rounded-[22px] bg-[#EFFFFA] p-4 ring-1 ring-[#22C7A1]/20">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">{t("food_tip")}</p>
                <UtensilsCrossed className="h-4 w-4 text-[#22C7A1]" />
              </div>
              <p className="text-[13px] font-black leading-5 text-[#020617]">{t(readinessFoodTipKey)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("avg_readiness")}</p>
              <p className="mt-2 text-[28px] font-black leading-none text-[#020617]">{readinessAverage ?? "--"}</p>
              <p className="mt-2 text-[12px] font-bold leading-5 text-[#64748B]">{t("readiness_trend_desc")}</p>
            </div>
            <div className="rounded-[22px] bg-[#FFF7ED] p-4 ring-1 ring-[#F97316]/20">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#F97316]">{t("high_load_days")}</p>
              <p className="mt-2 text-[28px] font-black leading-none text-[#020617]">{highLoadDays}</p>
              <p className="mt-2 text-[12px] font-bold leading-5 text-[#64748B]">{t("high_load_days_desc")}</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
            <div className="h-full rounded-full bg-[#22C7A1]" style={{ width: `${Math.max(8, recoveryReadiness.score ?? 12)}%` }} />
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-5 text-[#94A3B8]">{t("readiness_data_sources")}</p>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("weekly_average")}</p>
              <h2 className="mt-1 text-[20px] font-black text-[#020617]">{t("macro_targets")}</h2>
            </div>
            <Apple className="h-6 w-6 text-[#22C7A1]" />
          </div>
          <div className="space-y-4">
            {macroRows.map((macro) => {
              const data = reportData.macros[macro.key];
              return (
                <div key={macro.labelKey}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${macro.chip}`}>{t(macro.labelKey)}</span>
                    <span className="text-sm font-black text-[#020617]">
                      {data.consumed} / {data.target}{macro.unit}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#E5EAF1]">
                    <div
                      className={`h-full rounded-full transition-all ${macro.bar}`}
                      style={{ width: `${Math.min(data.percentage, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs font-bold text-[#94A3B8]">{Math.round(data.percentage)}%</p>
                </div>
              );
            })}
          </div>
        </motion.section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <motion.section variants={fadeIn} initial="hidden" animate="visible" className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{t("calories")}</p>
                <p className="mt-3 text-[34px] font-black leading-none text-[#020617]">{reportData.calories.avg}</p>
                <p className="mt-1 text-xs font-bold text-[#94A3B8]">{t("avg_over_target", { target: reportData.calories.target })}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${trendTone}`}>
                {reportData.calories.trend === "up" ? <TrendingUp className="h-3 w-3" /> : reportData.calories.trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                {reportData.calories.change > 0 ? "+" : ""}{reportData.calories.change}%
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#E5EAF1]">
              <div className="h-full rounded-full bg-[#22C7A1]" style={{ width: `${caloriesProgress}%` }} />
            </div>
          </motion.section>

          <motion.section variants={fadeIn} initial="hidden" animate="visible" className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#38BDF8]">{t("hydration")}</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r="25" fill="none" stroke="#E5EAF1" strokeWidth="7" />
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${(hydrationProgress / 100) * 157} 157`}
                  />
                </svg>
                <Droplets className="h-6 w-6 text-[#38BDF8]" />
              </div>
              <div className="min-w-0">
                <p className="text-[34px] font-black leading-none text-[#020617]">{reportData.water.avg}</p>
                <p className="mt-1 text-xs font-bold text-[#94A3B8]">{t("of_value", { value: reportData.water.target })}</p>
              </div>
            </div>
          </motion.section>
        </div>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("ai_report_score_breakdown")}</p>
              <h2 className="mt-1 text-[20px] font-black text-[#020617]">{t("ai_report_why_score")}</h2>
            </div>
            <AlertCircle className="h-6 w-6 text-[#FB6B7A]" />
          </div>
          <div className="space-y-2.5">
            {(scoreReasons.length ? scoreReasons : [t("ai_report_score_reason_good")]).map((reason, index) => (
              <div key={`${reason}-${index}`} className="flex gap-3 rounded-[20px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF0F2] text-[12px] font-black text-[#FB6B7A]">
                  {index + 1}
                </span>
                <p className="text-[13px] font-bold leading-5 text-[#020617]/75">{reason}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-[#020617] p-5 text-white shadow-[0_18px_38px_rgba(2,6,23,0.18)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{t("ai_report_next_week")}</p>
              <h2 className="mt-1 text-[20px] font-black">{t("ai_report_top_priorities")}</h2>
            </div>
            <Lightbulb className="h-6 w-6 text-[#22C7A1]" />
          </div>
          <div className="space-y-3">
            {weeklyPriorities.map((priority, index) => (
              <div key={priority} className="flex items-start gap-3 rounded-[20px] bg-white/8 p-3 ring-1 ring-white/10">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-black text-[#020617]">
                  {index + 1}
                </span>
                <p className="text-[13px] font-bold leading-5 text-white/82">{priority}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[26px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("protein_gap_title")}</p>
            <p className="mt-3 text-[30px] font-black leading-none text-[#020617]">{proteinGap}g</p>
            <p className="mt-2 text-[12px] font-bold leading-5 text-[#94A3B8]">
              {proteinGap > 0 ? t("ai_report_protein_gap_body", { amount: proteinGap }) : t("ai_report_protein_gap_closed")}
            </p>
          </div>
          <div className="rounded-[26px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#F97316]">{t("ai_report_calorie_pattern")}</p>
            <p className="mt-3 text-[30px] font-black leading-none text-[#020617]">{calorieDiff > 0 ? "+" : ""}{calorieDiff}</p>
            <p className="mt-2 text-[12px] font-bold leading-5 text-[#94A3B8]">{caloriePattern}</p>
          </div>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{t("ai_report_week_pattern")}</p>
              <h2 className="mt-1 text-[20px] font-black text-[#020617]">{t("ai_report_best_and_focus")}</h2>
            </div>
            <Star className="h-6 w-6 text-[#22C7A1]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-[#EFFFFA] p-4 ring-1 ring-[#22C7A1]/20">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">{t("best_day")}</p>
              <p className="mt-2 text-[14px] font-black leading-5 text-[#020617]">{bestDayLabel}</p>
            </div>
            <div className="rounded-[22px] bg-[#FFF7ED] p-4 ring-1 ring-[#F97316]/20">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#F97316]">{t("ai_report_needs_focus")}</p>
              <p className="mt-2 text-[14px] font-black leading-5 text-[#020617]">{needsFocusLabel}</p>
            </div>
          </div>
          <p className="mt-4 rounded-[20px] bg-[#F6F8FB] p-3 text-[13px] font-bold leading-5 text-[#020617]/70 ring-1 ring-[#E5EAF1]">
            {consistencyExplanation}
          </p>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#F97316]">{t("ai_report_nutrio_picks")}</p>
              <h2 className="mt-1 text-[20px] font-black text-[#020617]">{t("ai_report_recommended_meals")}</h2>
            </div>
            <ChefHat className="h-6 w-6 text-[#F97316]" />
          </div>
          <div className="space-y-2.5">
            {recommendedMealIdeas.map((idea, index) => (
              <div key={idea} className="flex gap-3 rounded-[20px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF7ED] text-[12px] font-black text-[#F97316]">
                  {index + 1}
                </span>
                <p className="text-[13px] font-bold leading-5 text-[#020617]/75">{idea}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("ai_report_coach_note")}</p>
              <p className="mt-2 text-[14px] font-bold leading-6 text-[#020617]/75">{coachNote}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-[#EFFFFA] p-3 ring-1 ring-[#22C7A1]/20">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#22C7A1]">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">{t("next_reward")}</p>
              <p className="mt-1 text-[13px] font-black leading-5 text-[#020617]">{nextRewardText}</p>
            </div>
          </div>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-[#020617]" />
            <h2 className="text-[20px] font-black text-[#020617]">{t("todays_snapshot")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {todayRows.map((item) => (
              <div key={item.labelKey} className={`rounded-[22px] p-4 ${item.bg}`}>
                <p className={`text-[28px] font-black leading-none ${item.color}`}>{reportData.today[item.key]}</p>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{item.unit}</p>
                <p className="mt-3 text-sm font-black text-[#020617]">{t(item.labelKey)}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeIn} initial="hidden" animate="visible" className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#F97316]" />
              <h2 className="text-[20px] font-black text-[#020617]">{t("next_best_actions")}</h2>
            </div>
            <span className="rounded-full bg-[#F6F8FB] px-3 py-1.5 text-xs font-black text-[#020617] ring-1 ring-[#E5EAF1]">
              {reportData.recommendations.length || 0}
            </span>
          </div>

          <div className="space-y-3">
            {reportData.recommendations.length > 0 ? reportData.recommendations.map((rec, i) => {
              const priorityClass = rec.priority === "high"
                ? "bg-[#FFF0F2] text-[#FB6B7A]"
                : rec.priority === "medium"
                  ? "bg-[#FFF7ED] text-[#F97316]"
                  : "bg-[#F6F8FB] text-[#020617]";

              return (
                <div key={`${rec.title}-${i}`} className="flex gap-3 rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${priorityClass}`}>
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#020617]">{rec.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-[#94A3B8]">{rec.description}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[22px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-5 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-[#7C83F6]" />
                <p className="mt-2 text-sm font-black text-[#020617]">{t("no_recommendations_yet")}</p>
                <p className="mt-1 text-xs font-semibold text-[#94A3B8]">{t("log_more_meals_unlock_actions")}</p>
              </div>
            )}
          </div>
        </motion.section>

        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="py-6 text-center">
          <p className="text-xs font-semibold text-[#94A3B8]">{t("generated_on", { date: reportData.date })}</p>
        </motion.div>
      </main>

    </div>
  );
}
