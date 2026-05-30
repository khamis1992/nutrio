import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Flame, TrendingUp, TrendingDown,
  Droplets, Leaf, CalendarCheck, Brain,
  UtensilsCrossed, Apple, Star, Zap, FileDown, Loader2,
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
import { professionalWeeklyReportPDF } from "@/lib/professional-weekly-report-pdf";
import { generateWeeklyMealPlan, loadMealPlanImages } from "@/lib/meal-plan-generator";
import { aiReportGenerator } from "@/lib/ai-report-generator";
import type { AIReportContent } from "@/lib/ai-report-generator";
import { supabase } from "@/integrations/supabase/client";
import type { WeeklyReportData } from "@/lib/professional-weekly-report-pdf";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

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
        target: activeGoal?.daily_calorie_target ?? 2000,
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
        score: Math.round(mealQualityScore),
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

      await professionalWeeklyReportPDF.download(reportPayload);
      toast.success("Report downloaded");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Failed to generate report");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const scoreGrade = (pct: number) =>
    pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500";

  const scoreBg = (pct: number) =>
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="min-h-screen bg-[#f8f6ff]">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-lg border-b border-violet-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-violet-50 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4 text-violet-600" />
          </button>
          <div>
            <h1 className="text-[17px] font-extrabold text-slate-950">AI Nutrition Report</h1>
            <p className="text-[11px] text-slate-400">{reportData.weekRange}</p>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[12px] font-bold shadow-md shadow-violet-200 active:scale-95 transition-all disabled:opacity-60"
          >
            {generatingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            {generatingPdf ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-20">
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-5 text-white shadow-[0_18px_40px_rgba(124,58,237,0.28)]">
          <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_20%_30%,white_2px,transparent_3px),radial-gradient(circle_at_80%_20%,white_1px,transparent_2px)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[13px] font-extrabold">Hello, {reportData.profile.name}</p>
                <p className="text-[11px] text-white/70">{reportData.date}</p>
              </div>
            </div>

            {displayContent ? (
              <>
                <p className="text-[14px] font-semibold leading-relaxed text-white/90">{displayContent.summary}</p>

                {enhancingAI && !aiContent && (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium text-white/60 backdrop-blur-sm">
                    <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Personalizing...
                  </div>
                )}

                {aiContent && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-200">
                    <Sparkles className="w-3 h-3" />
                    AI-enhanced
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span className="text-[13px] text-white/70">Loading analysis...</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Score Overview */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="grid grid-cols-3 gap-2">
          {[
            { label: "Meal Quality", value: reportData.mealQuality.score, max: 100, icon: Star, color: "violet" },
            { label: "Consistency", value: Math.round(reportData.consistency.percentage), max: 100, icon: CalendarCheck, color: "emerald" },
            { label: "Streak", value: reportData.consistency.streak, max: reportData.consistency.bestStreak || 7, icon: Flame, color: "amber" },
          ].map((metric) => (
            <div key={metric.label} className="bg-white rounded-2xl p-3 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)] ring-1 ring-slate-100/80">
              <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-${metric.color}-100 mb-1.5`}>
                <metric.icon className={`w-4 h-4 text-${metric.color}-600`} />
              </div>
              <p className="text-[20px] font-black text-slate-900 leading-none">{metric.value}</p>
              <p className="text-[9px] font-semibold text-slate-400">/ {metric.max}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1">{metric.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Macros Card */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
          <div className="flex items-center gap-2 mb-4">
            <Apple className="w-4 h-4 text-emerald-500" />
            <h2 className="text-[15px] font-extrabold text-slate-950">Macro Breakdown</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: "Protein", data: reportData.macros.protein, unit: "g", color: "rose" },
              { label: "Carbs", data: reportData.macros.carbs, unit: "g", color: "amber" },
              { label: "Fat", data: reportData.macros.fat, unit: "g", color: "blue" },
            ].map((macro) => (
              <div key={macro.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-bold text-slate-700">{macro.label}</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {macro.data.consumed} / {macro.data.target} {macro.unit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${scoreBg(macro.data.percentage)}`}
                    style={{ width: `${Math.min(macro.data.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Calories Trend */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-500" />
            <h2 className="text-[15px] font-extrabold text-slate-950">Calories</h2>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[32px] font-black leading-none text-slate-900">{reportData.calories.avg}</p>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">
                avg daily / {reportData.calories.target} target
              </p>
            </div>
            <div className={`flex items-center gap-1 text-[13px] font-bold ${reportData.calories.trend === "up" ? "text-red-500" : reportData.calories.trend === "down" ? "text-emerald-600" : "text-slate-400"}`}>
              {reportData.calories.trend === "up" ? <TrendingUp className="w-4 h-4" /> : reportData.calories.trend === "down" ? <TrendingDown className="w-4 h-4" /> : null}
              {reportData.calories.change > 0 ? "+" : ""}{reportData.calories.change}%
            </div>
          </div>
        </motion.div>

        {/* Water & Hydration */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="w-4 h-4 text-blue-500" />
            <h2 className="text-[15px] font-extrabold text-slate-950">Hydration</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="27" fill="none" stroke="#E2E8F0" strokeWidth="5" />
                <circle cx="32" cy="32" r="27" fill="none" stroke="#3B82F6" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${(reportData.water.percentage / 100) * 169.6} 169.6`} />
              </svg>
              <Droplets className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <p className="text-[24px] font-black text-slate-900">{reportData.water.avg}</p>
              <p className="text-[11px] font-semibold text-slate-400">glasses / {reportData.water.target} target</p>
            </div>
          </div>
        </motion.div>

        {/* Today's Snapshot */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
          <div className="flex items-center gap-2 mb-4">
            <UtensilsCrossed className="w-4 h-4 text-emerald-500" />
            <h2 className="text-[15px] font-extrabold text-slate-950">Today's Snapshot</h2>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Cal", value: reportData.today.calories, unit: "kcal", color: "text-orange-600" },
              { label: "Protein", value: reportData.today.protein, unit: "g", color: "text-rose-600" },
              { label: "Carbs", value: reportData.today.carbs, unit: "g", color: "text-amber-600" },
              { label: "Fat", value: reportData.today.fat, unit: "g", color: "text-blue-600" },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-2.5">
                <p className={`text-[16px] font-black ${item.color}`}>{item.value}</p>
                <p className="text-[9px] font-bold text-slate-400">{item.unit}</p>
                <p className="text-[10px] font-semibold text-slate-600 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Smart Recommendations */}
        {reportData.recommendations.length > 0 && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-500" />
              <h2 className="text-[15px] font-extrabold text-slate-950">Recommendations</h2>
            </div>
            <div className="space-y-2">
              {reportData.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-violet-50/50 rounded-xl">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    rec.priority === "high" ? "bg-red-100" : rec.priority === "medium" ? "bg-amber-100" : "bg-slate-100"
                  }`}>
                    <Star className={`w-4 h-4 ${
                      rec.priority === "high" ? "text-red-600" : rec.priority === "medium" ? "text-amber-600" : "text-slate-500"
                    }`} />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-slate-800">{rec.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{rec.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="text-center py-6">
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-100">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-[11px] font-bold text-violet-600">
              {aiContent ? "AI-Enhanced Report" : "Rule-Based Analysis"}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Report generated on {reportData.date}</p>
        </motion.div>
      </div>
    </div>
  );
}
