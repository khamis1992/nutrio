import type { LucideIcon } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock3,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Leaf,
  Lock,
  MapPin,
  Minus,
  Plus,
  Scale,
  Target,
  Trophy,
  TrendingUp,
  TrendingDown,
  UserRound,
  Wheat,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useWeightChartData } from "@/hooks/useWeightChartData";
import { useClientGoalProposals } from "@/hooks/useClientGoalProposals";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWeekdayData } from "@/hooks/useWeekdayData";
import { useHealthDailyMetrics } from "@/hooks/useHealthDailyMetrics";
import { cn } from "@/lib/utils";

type RingMetric = {
  label: string;
  value: number;
  status: string;
  Icon: LucideIcon;
  color: string;
  track: string;
};

const PROGRESS_COLORS = {
  text: "#020617",
  mutedText: "#94A3B8",
  surface: "#F6F8FB",
  track: "#E5EAF1",
  calories: "#22C7A1",
  protein: "#7C83F6",
  carbs: "#F97316",
  fat: "#FB6B7A",
  water: "#38BDF8",
};



function MetricRing({ metric }: { metric: RingMetric }) {
  const size = 72;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (metric.value / 100) * circumference;
  const Icon = metric.Icon;

  return (
    <article className="overflow-hidden rounded-[18px] border border-slate-100 bg-white p-2 text-center shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
      <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }}>
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF2F7" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={metric.color}
            strokeLinecap="round"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <div className="flex flex-col items-center gap-0.5">
          <Icon className="h-4 w-4" style={{ color: metric.color }} strokeWidth={2.4} />
          <span className="text-[16px] font-black leading-none tracking-[-0.04em] text-[#111827]">{metric.value}%</span>
        </div>
      </div>
      <p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{metric.label}</p>
      <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">{metric.status}</p>
      <div className="mx-auto mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${metric.value}%`, backgroundColor: metric.color }} />
      </div>
    </article>
  );
}

function SectionHeader({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-black tracking-[-0.04em] text-[#111827]">{title}</h2>
      {action ? (
        <button className="flex items-center gap-1 text-[13px] font-extrabold text-[#22C7A1]" type="button" onClick={onClick}>
          {action}
          <ChevronRight className="h-4 w-4" strokeWidth={3} />
        </button>
      ) : null}
    </div>
  );
}

function HumanSilhouette() {
  return (
    <div className="relative mx-auto h-[92px] w-[50px] opacity-70">
      <div className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full bg-[#A7F3E5]" />
      <div className="absolute left-1/2 top-[19px] h-[48px] w-[24px] -translate-x-1/2 rounded-t-full rounded-b-[18px] bg-[#EFFFFA]" />
      <div className="absolute left-[7px] top-[24px] h-[48px] w-2 rotate-12 rounded-full bg-[#EFFFFA]" />
      <div className="absolute right-[7px] top-[24px] h-[48px] w-2 -rotate-12 rounded-full bg-[#EFFFFA]" />
      <div className="absolute left-[17px] top-[62px] h-[30px] w-2 rotate-6 rounded-full bg-[#EFFFFA]" />
      <div className="absolute right-[17px] top-[62px] h-[30px] w-2 -rotate-6 rounded-full bg-[#EFFFFA]" />
    </div>
  );
}

const goalTypeLabelKey: Record<string, string> = {
  weight_loss: "goal_weight_loss",
  muscle_gain: "goal_muscle_gain",
  maintenance: "goal_maintenance",
  general_health: "goal_healthy_lifestyle",
};

const goalTypeIcon: Record<string, LucideIcon> = {
  weight_loss: Scale,
  muscle_gain: Dumbbell,
  maintenance: Leaf,
  general_health: Leaf,
};

interface ProgressRedesignedProps {
  embedded?: boolean;
}

export default function ProgressRedesigned({ embedded = false }: ProgressRedesignedProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const selectedDate = useMemo(() => new Date(`${calendarDate}T12:00:00`), [calendarDate]);
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { activeGoal, loading: goalsLoading } = useNutritionGoals(user?.id);
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { streaks } = useStreak(user?.id);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, 0);
  const { dailySummary: waterSummary, addWater: addWaterIntake, decrementWater } = useWaterIntake(user?.id, selectedDate);
  const { days: weekdayData } = useWeekdayData(user?.id, activeGoal?.daily_calorie_target ?? 2000);
  const { rangeMetrics: healthRangeMetrics } = useHealthDailyMetrics(user?.id);
  const calorieTarget = activeGoal?.daily_calorie_target ?? 2000;
  const { toast } = useToast();
  const { t, isRTL, language } = useLanguage();
  useEffect(() => {
    if (!embedded) document.title = `${t("progress_title")} — Nutrio`;
  }, [embedded, t]);
  const queryTab = searchParams.get("tab");
  const activeQueryTab: "today" | "week" | "goals" =
    queryTab === "week" || queryTab === "goals" ? queryTab : "today";
  const activeTab = activeQueryTab;
  const [showWeekDetails, setShowWeekDetails] = useState(false);
  const {
    proposals: coachProposals,
    progress: coachGoalProgress,
    acceptGoal: acceptCoachGoal,
    rejectGoal: rejectCoachGoal,
  } = useClientGoalProposals(user?.id);
  const { weightChartData: weightHistory } = useWeightChartData(user?.id);
  const handleTabChange = (tabKey: "today" | "week" | "goals") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabKey === "today") {
        next.delete("tab");
      } else {
        next.set("tab", tabKey);
      }
      return next;
    }, { replace: true });
  };

  const currentWeight = profile?.current_weight_kg ?? 75;
  const goalWeight = activeGoal?.target_weight_kg ?? currentWeight;
  const height = profile?.height_cm ?? 175;
  const goalType = activeGoal?.goal_type ?? "weight_loss";
  const goalName = t(goalTypeLabelKey[goalType] ?? "goal_weight_loss");
  const weightDiff = Math.abs(currentWeight - goalWeight);
  const bmi = height > 0 ? Number((currentWeight / Math.pow(height / 100, 2)).toFixed(1)) : 24.5;
  const bmiLabel = bmi < 18.5 ? t("progress_bmi_underweight") : bmi < 25 ? t("progress_bmi_healthy") : bmi < 30 ? t("progress_bmi_overweight") : t("progress_bmi_high");

  const progressPct = useMemo(() => {
    if (!activeGoal || weightHistory.length === 0 || goalWeight <= 0) return 0;
    const startWeight = weightHistory[0]?.actual ?? currentWeight;
    if (goalType === "weight_loss" && startWeight > goalWeight) {
      return Math.max(0, Math.min(100, Math.round(((startWeight - currentWeight) / (startWeight - goalWeight)) * 100)));
    }
    if (goalType === "muscle_gain" && startWeight < goalWeight) {
      return Math.max(0, Math.min(100, Math.round(((currentWeight - startWeight) / (goalWeight - startWeight)) * 100)));
    }
    if (goalType === "maintenance") return weeklySummary?.consistency?.percentage ?? 0;
    return currentWeight === goalWeight ? 100 : 0;
  }, [activeGoal, weightHistory, goalWeight, goalType, currentWeight, weeklySummary]);

  const goalRingValue = useMemo(() => {
    const proteinPct = weeklySummary?.macros?.protein?.percentage ?? 0;
    const consistencyPct = weeklySummary?.consistency?.percentage ?? 0;
    switch (goalType) {
      case "weight_loss": return progressPct;
      case "muscle_gain": return proteinPct;
      case "maintenance": return consistencyPct;
      default: return Math.round((progressPct + proteinPct + consistencyPct) / 3);
    }
  }, [goalType, progressPct, weeklySummary]);

  const goalRightMetric = useMemo(() => {
    switch (goalType) {
      case "weight_loss": return { label: t("current_weight_label2"), value: `${currentWeight.toFixed(1)}`, unit: "kg ▾" };
      case "muscle_gain": return { label: t("weekly_avg_protein"), value: `${weeklySummary?.macros?.protein?.consumed ?? 0}`, unit: "g" };
      case "maintenance": return { label: t("current_weight_label2"), value: `${currentWeight.toFixed(1)}`, unit: "kg ▾" };
      default: return { label: t("daily_streak"), value: `${streaks.logging?.currentStreak ?? 0}`, unit: "days" };
    }
  }, [goalType, currentWeight, weeklySummary, streaks, t]);

  const goalSubLabel = useMemo(() => {
    switch (goalType) {
      case "weight_loss": return t("progress_kg_left_target", { kg: weightDiff.toFixed(0) });
      case "muscle_gain": return t("progress_target_grams", { value: activeGoal?.protein_target_g ?? 120 });
      case "maintenance": return t("progress_stay_within_range");
      default: return t("progress_best_days", { value: streaks.logging?.bestStreak ?? 0 });
    }
  }, [goalType, weightDiff, activeGoal, streaks, t]);

  const isLoading = profileLoading || goalsLoading;

  const weeklyMetrics: RingMetric[] = useMemo(() => {
    const macros = weeklySummary?.macros;
    const cals = weeklySummary?.calories;
    const calTarget = activeGoal?.daily_calorie_target ?? 2000;
    const calPct = calTarget > 0 ? Math.min(100, Math.round(((cals?.thisWeekAvg ?? 0) / calTarget) * 100)) : 0;
    const getStatus = (pct: number) => (pct >= 80 ? t("progress_excellent") : pct >= 60 ? t("progress_on_track_status") : t("progress_improve"));
    return [
      { label: t("calories"), value: calPct, status: getStatus(calPct), Icon: Flame, color: "#F97316", track: "#FFEDD5" },
      { label: t("protein"), value: macros?.protein?.percentage ?? 0, status: getStatus(macros?.protein?.percentage ?? 0), Icon: Target, color: PROGRESS_COLORS.protein, track: "#F3F4FF" },
      { label: t("carbs"), value: macros?.carbs?.percentage ?? 0, status: getStatus(macros?.carbs?.percentage ?? 0), Icon: Wheat, color: "#F7B731", track: "#FEF3C7" },
      { label: t("fat_label"), value: macros?.fat?.percentage ?? 0, status: getStatus(macros?.fat?.percentage ?? 0), Icon: Droplet, color: PROGRESS_COLORS.fat, track: "#FFF0F2" },
    ];
  }, [weeklySummary, activeGoal?.daily_calorie_target, t]);

  const coachRecommendation = useMemo(() => {
    const protein = activeGoal?.protein_target_g ?? 120;
    const macros = weeklySummary?.macros;
    const proteinPct = macros?.protein?.percentage ?? 0;
    if (goalType === "muscle_gain") {
      if (proteinPct < 70) return t("progress_coach_muscle_low_protein", { protein, consumed: macros?.protein?.consumed ?? 0 });
      return t("progress_coach_muscle_good", { protein });
    }
    if (goalType === "weight_loss") {
      return t("progress_coach_weight_loss", { protein });
    }
    return t("progress_coach_balanced", { protein, carbs: activeGoal?.carbs_target_g ?? 200, fat: activeGoal?.fat_target_g ?? 65 });
  }, [goalType, activeGoal, weeklySummary, t]);


  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const isSelectedToday = selectedDateKey === format(new Date(), "yyyy-MM-dd");
  const waterGlasses = waterSummary?.total ?? 0;
  const waterTarget = 8;
  const healthMetricsByDate = useMemo(() => {
    return new Map(healthRangeMetrics.map((item) => [item.metric_date, item]));
  }, [healthRangeMetrics]);
  const weeklyActivityRows = useMemo(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    return weekdayData.map((day) => {
      const health = healthMetricsByDate.get(day.date);
      const steps = health?.steps ?? 0;
      const activeCalories = health?.active_calories ?? day.workoutCalories;
      const workoutMinutes = day.workoutMinutes;
      const distanceKm = Number(((steps * 0.000762) || 0).toFixed(1));

      return {
        ...day,
        steps,
        activeCalories,
        workoutMinutes,
        distanceKm,
        isToday: day.date === todayKey,
      };
    });
  }, [healthMetricsByDate, weekdayData]);
  const weeklyActivityTotals = useMemo(() => {
    return weeklyActivityRows.reduce(
      (total, day) => ({
        steps: total.steps + day.steps,
        workoutMinutes: total.workoutMinutes + day.workoutMinutes,
        activeCalories: total.activeCalories + day.activeCalories,
        distanceKm: total.distanceKm + day.distanceKm,
      }),
      { steps: 0, workoutMinutes: 0, activeCalories: 0, distanceKm: 0 }
    );
  }, [weeklyActivityRows]);
  const trendLoggedDays = weekdayData.filter((day) => day.calories > 0).length;
  const hasEnoughTrendData = trendLoggedDays >= 3;
  const showWeightForecastCard = false;
  const showBodyMetricsCard = false;

  const handleWaterAdd = async () => {
    if (!user?.id) return;
    try {
      await addWaterIntake(1);
      toast({ description: "+1 glass", duration: 1200 });
    } catch {
      toast({ description: t("failed_to_update"), variant: "destructive" });
    }
  };

  const handleWaterRemove = async () => {
    if (!user?.id || waterGlasses <= 0) return;
    const didDecrement = await decrementWater();
    if (!didDecrement) {
      toast({ description: t("failed_to_update"), variant: "destructive" });
      return;
    }
    toast({ description: "-1 glass", duration: 1200 });
  };

  if (isLoading) {
    return (
      <main className={embedded ? "text-[#101827]" : "min-h-screen bg-[#FAFBFC] text-[#101827]"}>
        <div className={embedded ? "w-full" : "mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-20 pt-[calc(env(safe-area-inset-top,0px)+20px)] shadow-[0_24px_80px_rgba(15,23,42,0.06)]"}>
          {!embedded && (
            <div className="mb-6 flex items-center justify-between px-0.5">
              <div className="h-10 w-10 rounded-full bg-slate-100" />
              <div className="h-6 w-28 rounded-full bg-slate-100" />
              <div className="h-10 w-10 rounded-full bg-slate-100" />
            </div>
          )}
          <div className="animate-pulse space-y-4">
            <div className="grid h-[58px] grid-cols-3 gap-1 rounded-full bg-slate-100 p-1">
              <div className="rounded-full bg-white" />
              <div className="rounded-full bg-slate-200/70" />
              <div className="rounded-full bg-slate-200/70" />
            </div>
            <div className="h-20 rounded-[24px] bg-slate-100" />
            <div className="h-72 rounded-[28px] bg-slate-100" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 rounded-[18px] bg-slate-100" />
              ))}
            </div>
            <div className="h-36 rounded-[24px] bg-slate-100" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={embedded ? "text-[#101827]" : "min-h-screen bg-[#FAFBFC] text-[#101827]"}>
      <div className={embedded ? "w-full" : "mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-20 pt-[calc(env(safe-area-inset-top,0px)+20px)] shadow-[0_24px_80px_rgba(15,23,42,0.06)]"}>
        {!embedded && (
        <header className="mb-6 flex items-center justify-between px-0.5">
          <button
            aria-label="Go back"
            data-testid="progress-back-btn"
            className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] active:bg-slate-100"
            onClick={() => navigate(-1)}
            type="button"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={2.6} />
          </button>
          <h1 className="text-[23px] font-black tracking-[-0.06em] text-[#111827]">{t("progress_title")}</h1>
          <button
            aria-label="Open calendar"
            data-testid="progress-calendar-btn"
            className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] active:bg-slate-100"
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
          >
            <CalendarCheck className="h-[26px] w-[26px]" strokeWidth={2.4} />
          </button>
        </header>
        )}

        <div
          className={cn(
            `${embedded ? "mb-4" : "mb-6"} grid h-14 grid-cols-3 rounded-[20px] border border-white/90 bg-[#EEF2F7]/95 p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl`,
            embedded ? "sticky top-[132px] z-20" : "sticky top-2 z-20"
          )}
          role="tablist"
          aria-label={t("progress_title")}
        >
          {[
            { key: "today", label: t("progress_overview"), Icon: CalendarCheck, accent: PROGRESS_COLORS.calories },
            { key: "week", label: t("progress_trends"), Icon: TrendingUp, accent: PROGRESS_COLORS.protein },
            { key: "goals", label: t("progress_goal_tab"), Icon: Target, accent: PROGRESS_COLORS.carbs },
          ].map((tab) => {
            const tabKey = tab.key as "today" | "week" | "goals";
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tab.key}
                data-testid={`progress-tab-${tab.key}`}
                onClick={() => handleTabChange(tabKey)}
                className={cn(
                  "relative flex min-w-0 items-center justify-center gap-1.5 rounded-[15px] px-2 text-[12px] font-extrabold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C83F6]/40",
                  isActive
                    ? "bg-white text-[#020617] shadow-[0_5px_14px_rgba(15,23,42,0.10)] ring-1 ring-[#E5EAF1]"
                    : "text-[#64748B] active:bg-white/70"
                )}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`progress-panel-${tabKey}`}
              >
                <tab.Icon
                  className="h-4 w-4 shrink-0 transition-colors"
                  strokeWidth={isActive ? 2.6 : 2.2}
                  style={{ color: isActive ? tab.accent : PROGRESS_COLORS.mutedText }}
                  aria-hidden="true"
                />
                <span className="truncate">{tab.label}</span>
                {isActive && (
                  <span
                    className="absolute bottom-1 h-0.5 w-5 rounded-full"
                    style={{ backgroundColor: tab.accent }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "today" && (
          <button
            type="button"
            onClick={() => setShowCalendar((open) => !open)}
            className="mb-3 flex min-h-11 w-full items-center justify-between rounded-[18px] border border-[#E5EAF1] bg-white px-4 text-left shadow-[0_8px_20px_rgba(15,23,42,0.04)] active:scale-[0.99]"
            aria-expanded={showCalendar}
          >
            <span className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EFFFFA] text-[#22C7A1]">
                <CalendarCheck className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">{t("progress_today")}</span>
                <span className="block text-[13px] font-black text-[#020617]">{formatLocaleDate(selectedDate, language, { month: "short", day: "numeric", year: "numeric" })}</span>
              </span>
            </span>
            <span className="text-[11px] font-black text-[#22C7A1]">{t("progress_select_date")}</span>
          </button>
        )}

        {activeTab === "today" && showCalendar && (
          <div className="mb-4 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-2">
              <input
                data-testid="progress-date-input"
                type="date"
                max={format(new Date(), "yyyy-MM-dd")}
                value={calendarDate}
                onChange={(e) => setCalendarDate(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3 text-[14px] font-semibold text-slate-800"
              />
              <button
                data-testid="progress-view-btn"
                className="h-11 rounded-[12px] bg-[#020617] px-4 text-[13px] font-black text-white active:scale-95"
                type="button"
                onClick={() => setShowCalendar(false)}
              >
                {t("view")}
              </button>
            </div>
          </div>
        )}

        {activeTab === "today" && (() => {
          if (!activeGoal) {
            return (
              <section id="progress-panel-today" role="tabpanel" className="rounded-[26px] border border-[#D9F8EF] bg-white p-5 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[#EFFFFA] text-[#22C7A1]">
                  <Target className="h-7 w-7" strokeWidth={2.3} />
                </div>
                <h2 className="mt-4 text-[20px] font-black text-[#020617]">{t("progress_no_goal_title")}</h2>
                <p className="mx-auto mt-2 max-w-[280px] text-[13px] font-semibold leading-5 text-[#64748B]">{t("progress_no_goal_desc")}</p>
                <button type="button" onClick={() => navigate("/edit-goal")} className="mt-5 h-12 w-full rounded-[16px] bg-[#020617] text-[13px] font-black text-white active:scale-[0.98]">
                  {t("progress_set_goal")}
                </button>
              </section>
            );
          }
          const calTarget = activeGoal.daily_calorie_target;
          const proteinTarget = activeGoal.protein_target_g;
          const carbsTarget = activeGoal.carbs_target_g;
          const fatTarget = activeGoal.fat_target_g;
          const calConsumed = todayProgress.calories ?? 0;
          const proteinConsumed = todayProgress.protein ?? 0;
          const carbsConsumed = todayProgress.carbs ?? 0;
          const fatConsumed = todayProgress.fat ?? 0;
          const dailyPct = calTarget > 0 ? Math.min(100, Math.round((calConsumed / calTarget) * 100)) : 0;
          const proteinPct = proteinTarget > 0 ? Math.min(100, Math.round((proteinConsumed / proteinTarget) * 100)) : 0;
          const carbsPct = carbsTarget > 0 ? Math.min(100, Math.round((carbsConsumed / carbsTarget) * 100)) : 0;
          const fatPct = fatTarget > 0 ? Math.min(100, Math.round((fatConsumed / fatTarget) * 100)) : 0;
          const hydrationPct = Math.min(100, waterSummary?.percentage ?? 0);
          const weeklyLoggedDays = weeklySummary?.consistency?.daysLogged ?? weekdayData.filter((d) => d.calories > 0).length;
          const weeklyConsistencyPct = weeklySummary?.consistency?.percentage ?? Math.round((weeklyLoggedDays / 7) * 100);
          const nutritionScore = Math.round(
            isSelectedToday
              ? (dailyPct * 0.38) + (proteinPct * 0.32) + (hydrationPct * 0.2) + (weeklyConsistencyPct * 0.1)
              : (dailyPct * 0.45) + (proteinPct * 0.35) + (hydrationPct * 0.2)
          );
          const dayName = formatLocaleDate(selectedDate, language, { weekday: "long", month: "long", day: "numeric" });
          return (
            <div id="progress-panel-today" role="tabpanel">
              <section className="mb-5">
                  <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">

                    {/* ── Top banner: date + streak ── */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-3">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{t("progress_today")}</p>
                        <p className="text-[15px] font-black text-slate-900">{dayName}</p>
                      </div>
                      {!isSelectedToday ? (
                        <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-100">
                          <Lock className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-500">{t("progress_read_only")}</span>
                        </div>
                      ) : (streaks.logging?.currentStreak ?? 0) > 0 ? (
                        <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 ring-1 ring-orange-100">
                          <Flame className="h-3.5 w-3.5 text-orange-500" />
                          <span className="text-[12px] font-black text-orange-600">{streaks.logging?.currentStreak}d</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-100">
                          <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-500">{t("progress_start_streak")}</span>
                        </div>
                      )}
                    </div>

                    {/* ── Calorie donut section ── */}
                    <div className="relative flex items-center gap-4 px-5 pb-7">
                      {/* Large donut */}
                      <div className="relative shrink-0">
                        <svg width="110" height="110" viewBox="0 0 110 110">
                          {/* Background track */}
                          <circle cx="55" cy="55" r="46" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                          {/* Protein arc */}
                          <circle cx="55" cy="55" r="46" fill="none" stroke="#818CF8" strokeLinecap="round" strokeWidth="10"
                            strokeDasharray={`${(proteinPct / 100) * (2 * Math.PI * 46)} ${2 * Math.PI * 46}`}
                            transform="rotate(-90 55 55)"
                          />
                          {/* Calorie arc (inner) */}
                          <circle cx="55" cy="55" r="34" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                          <circle cx="55" cy="55" r="34" fill="none"
                            stroke={dailyPct > 100 ? PROGRESS_COLORS.fat : PROGRESS_COLORS.calories}
                            strokeLinecap="round" strokeWidth="8"
                            strokeDasharray={`${(Math.min(dailyPct, 100) / 100) * (2 * Math.PI * 34)} ${2 * Math.PI * 34}`}
                            transform="rotate(-90 55 55)"
                          />
                          {/* Center text */}
                          <text x="55" y="50" textAnchor="middle" fontSize="18" fontWeight="900" fill="#0F172A" fontFamily="system-ui">{calConsumed > 999 ? `${(calConsumed/1000).toFixed(1)}k` : calConsumed}</text>
                          <text x="55" y="63" textAnchor="middle" fontSize="9" fontWeight="700" fill="#94A3B8" fontFamily="system-ui">{t("progress_kcal_unit")}</text>
                        </svg>
                        {/* Legend dots */}
                        <div className="absolute -bottom-2 left-1/2 flex w-max -translate-x-1/2 items-center justify-center gap-4">
                          <span className="flex items-center gap-1.5 text-[10px] font-black leading-none text-slate-400">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: dailyPct > 100 ? PROGRESS_COLORS.fat : PROGRESS_COLORS.calories }}
                            />
                            {t("cal_label_short")}
                          </span>
                          <span className="flex items-center gap-1.5 text-[10px] font-black leading-none text-slate-400">
                            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PROGRESS_COLORS.protein }} />
                            {t("protein_label")}
                          </span>
                        </div>
                      </div>

                      {/* Right side stats */}
                      <div className="flex-1 min-w-0 space-y-2.5">
                        {/* Calorie remaining */}
                        <div className="rounded-[14px] bg-slate-50 px-3 py-2.5">
                          <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">
                            {calTarget - calConsumed > 0 ? t("progress_remaining") : t("progress_over_target")}
                          </p>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-[22px] font-black leading-none ${calTarget - calConsumed > 0 ? 'text-slate-900' : 'text-rose-500'}`}>
                              {Math.abs(calTarget - calConsumed).toLocaleString()}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">/ {calTarget.toLocaleString()} kcal</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${dailyPct}%`, backgroundColor: dailyPct > 100 ? PROGRESS_COLORS.fat : PROGRESS_COLORS.calories }}
                            />
                          </div>
                        </div>

                        {/* Score badge */}
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-black text-white"
                            style={{ backgroundColor: nutritionScore >= 80 ? PROGRESS_COLORS.calories : nutritionScore >= 50 ? PROGRESS_COLORS.carbs : PROGRESS_COLORS.fat }}
                          >
                            {nutritionScore}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-slate-900">
                              {nutritionScore >= 80 ? t("progress_great_day") : nutritionScore >= 50 ? t("progress_on_track") : t("progress_keep_going")}
                            </p>
                            <p className="text-[9px] text-slate-400">{t("progress_daily_score")}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Divider ── */}
                    <div className="mx-5 h-px bg-slate-100" />

                    {/* ── Macro bars ── */}
                    <div className="grid grid-cols-3 gap-px bg-slate-100">
                      {[
                        { label: t('protein'), current: proteinConsumed, target: proteinTarget, unit: 'g', pct: proteinPct, color: '#818CF8', light: '#EEF2FF' },
                        { label: t('carbs'), current: carbsConsumed, target: carbsTarget, unit: 'g', pct: carbsPct, color: '#FB923C', light: '#FFF7ED' },
                        { label: t('fat_label'), current: fatConsumed, target: fatTarget, unit: 'g', pct: fatPct, color: '#F472B6', light: '#FDF2F8' },
                      ].map((m) => (
                        <div key={m.label} className="flex flex-col items-center bg-white px-2 py-3">
                          <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                          </div>
                          <div className="flex items-baseline gap-0.5">
                            <span className="text-[15px] font-black text-slate-900">{m.current}</span>
                            <span className="text-[9px] font-bold text-slate-400">/{m.target}{m.unit}</span>
                          </div>
                          <p className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wide" style={{ color: m.color }}>{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Hydration artwork with live tracking controls */}
                    <div className="relative isolate min-h-[154px] overflow-hidden border-t border-[#D8F4F6] bg-[#ECFAFA]">
                      <img
                        src="/progress-hydration-card.png"
                        alt=""
                        className="absolute inset-0 -z-20 h-full w-full scale-[1.03] object-cover"
                        aria-hidden="true"
                      />
                      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white/90 via-white/45 to-transparent" aria-hidden="true" />

                      <div className="flex min-h-[154px] w-[59%] flex-col justify-center px-5 py-3" dir={isRTL ? "rtl" : "ltr"}>
                        <div className="flex items-center gap-1.5 text-[#0891B2]">
                          <Droplet className="h-4 w-4 fill-current/10" strokeWidth={2.5} />
                          <p className="text-[10px] font-black uppercase tracking-[0.12em]">{t("progress_hydration_today")}</p>
                        </div>

                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-[29px] font-black leading-none tracking-[-0.05em] text-[#020617]">{hydrationPct}%</span>
                          <span className="text-[10px] font-bold text-[#64748B]">{t("progress_hydration_goal")}</span>
                        </div>
                        <p className="mt-1 text-[11px] font-extrabold text-[#334155]">
                          {t("progress_water_glasses_status", { current: waterGlasses, target: waterTarget })}
                        </p>

                        <div className="mt-2.5 flex items-center gap-2">
                          {isSelectedToday && (
                            <button
                              type="button"
                              onClick={handleWaterRemove}
                              disabled={waterGlasses <= 0}
                              aria-label={t("progress_remove_water")}
                              title={t("progress_remove_water")}
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/90 bg-white/85 text-[#0891B2] shadow-[0_5px_14px_rgba(8,145,178,0.12)] backdrop-blur-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus className="h-4 w-4" strokeWidth={2.6} />
                            </button>
                          )}
                          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/80 shadow-inner" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hydrationPct}>
                            <div className="h-full rounded-full bg-[#38BDF8] transition-all duration-500" style={{ width: `${hydrationPct}%` }} />
                          </div>
                          {isSelectedToday && (
                            <button
                              type="button"
                              onClick={handleWaterAdd}
                              aria-label={t("progress_add_water")}
                              title={t("progress_add_water")}
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0891B2] text-white shadow-[0_7px_16px_rgba(8,145,178,0.24)] transition active:scale-95"
                            >
                              <Plus className="h-4 w-4" strokeWidth={2.8} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                  </article>
              </section>

              {!isSelectedToday && (
                <section className="mb-5 rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("progress_past_snapshot")}</p>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748B]">{t("progress_past_snapshot_desc")}</p>
                </section>
              )}

              {/* Detailed nutrient values are consolidated into the primary daily card above. */}
              {activeGoal ? (
                <section className="hidden">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: Flame, label: t("calories"), current: calConsumed, target: calTarget, unit: t("progress_kcal_unit"), color: "#F97316", bg: "#FFF7ED" },
                      { icon: Target, label: t("protein"), current: proteinConsumed, target: proteinTarget, unit: t("progress_gram_unit"), color: PROGRESS_COLORS.protein, bg: "#F3F4FF" },
                      { icon: Leaf, label: t("carbs"), current: carbsConsumed, target: carbsTarget, unit: t("progress_gram_unit"), color: PROGRESS_COLORS.carbs, bg: "#FFF7ED" },
                      { icon: Droplet, label: t("fat_label"), current: fatConsumed, target: fatTarget, unit: t("progress_gram_unit"), color: PROGRESS_COLORS.fat, bg: "#FFF0F2" },
                    ].map((n) => {
                      const NIcon = n.icon;
                      const pct = n.target > 0 ? Math.min(100, Math.round((n.current / n.target) * 100)) : 0;
                      return (
                        <article key={n.label} className="rounded-[14px] border border-slate-100 bg-white p-2.5 text-center shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
                          <div className="mx-auto mb-1.5 grid h-7 w-7 place-items-center rounded-full" style={{ backgroundColor: n.bg }}>
                            <NIcon className="h-3.5 w-3.5" style={{ color: n.color }} />
                          </div>
                          <p className="text-[9px] font-bold text-slate-500">{n.label}</p>
                          <p className="text-[14px] font-black tracking-[-0.03em] text-slate-900">{n.current}<span className="text-[9px] font-bold text-slate-500">/{n.target}</span></p>
                          <p className="text-[8px] font-semibold text-slate-500">{n.unit}</p>
                          <div className="mx-auto mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: n.color }} />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="hidden">
                {(() => {
                  const weekStart = weeklyActivityRows[0]?.date ? new Date(`${weeklyActivityRows[0].date}T00:00:00`) : new Date();
                  const weekEnd = weeklyActivityRows[6]?.date ? new Date(`${weeklyActivityRows[6].date}T00:00:00`) : new Date();
                  const todayActivity = weeklyActivityRows.find((day) => day.isToday) ?? weeklyActivityRows[0];
                  const hasActivityData = weeklyActivityTotals.steps > 0 || weeklyActivityTotals.workoutMinutes > 0 || weeklyActivityTotals.activeCalories > 0;

                  return (
                    <article className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[19px] font-black leading-none tracking-[-0.03em] text-[#020617]">{t("progress_this_week")}</p>
                          <p className="mt-1 text-[11px] font-semibold text-[#94A3B8]">
                            {formatLocaleDate(weekStart, language, { month: "short", day: "numeric" })} - {formatLocaleDate(weekEnd, language, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <div className="rounded-full bg-[#EFFFFA] px-3 py-1 text-[11px] font-black text-[#22C7A1]">
                          {t("progress_today_focus")}
                        </div>
                      </div>

                      {todayActivity ? (
                        <div className="mb-2 rounded-[16px] border border-[#22C7A1]/30 bg-[#EFFFFA] px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#22C7A1]">{t("progress_today")}</p>
                              <p className="text-[13px] font-black text-[#020617]">
                                {todayActivity.steps.toLocaleString()} {t("steps").toLowerCase()}
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center" dir="ltr">
                              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#020617]">{todayActivity.workoutMinutes}m</span>
                              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#F97316]">{todayActivity.activeCalories}</span>
                              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#020617]">{todayActivity.distanceKm.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="overflow-hidden rounded-[18px] border border-[#E5EAF1]">
                        {weeklyActivityRows.map((day) => {
                          const dayDate = new Date(`${day.date}T00:00:00`);
                          const dayLabel = formatLocaleDate(dayDate, language, { weekday: "short" });

                          return (
                            <div
                              key={day.date}
                              className={cn(
                                "grid grid-cols-[46px_1fr] items-center gap-2 border-b border-[#E5EAF1] px-3 py-2 last:border-b-0",
                                day.isToday ? "bg-[#EFFFFA]" : "bg-[#F6F8FB]"
                              )}
                            >
                              <div className="min-w-0">
                                <p className={cn("text-[11px] font-extrabold", day.isToday ? "text-[#22C7A1]" : "text-[#94A3B8]")}>{dayLabel}</p>
                                {day.isToday ? (
                                  <p className="mt-0.5 text-[8px] font-black uppercase tracking-wide text-[#22C7A1]">{t("progress_today")}</p>
                                ) : null}
                              </div>
                              <div className="grid grid-cols-4 items-center gap-1 text-[12px] font-black text-[#020617]" dir="ltr">
                                <span className="flex items-center justify-end gap-1">
                                  <Footprints className="h-3.5 w-3.5 text-[#020617]" />
                                  {day.steps.toLocaleString()}
                                </span>
                                <span className="flex items-center justify-end gap-1">
                                  <Clock3 className="h-3.5 w-3.5 text-[#020617]" />
                                  {day.workoutMinutes}m
                                </span>
                                <span className="flex items-center justify-end gap-1 text-[#F97316]">
                                  <Flame className="h-3.5 w-3.5" />
                                  {day.activeCalories}
                                </span>
                                <span className="flex items-center justify-end gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-[#020617]" />
                                  {day.distanceKm.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-2 rounded-[16px] bg-[#F6F8FB] px-3 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">{t("steps_total")}</p>
                          {!hasActivityData ? (
                            <p className="text-[10px] font-bold text-[#94A3B8]">{t("progress_activity_week_hint")}</p>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-4 items-center gap-1 text-[12px] font-black text-[#020617]" dir="ltr">
                          <span className="flex items-center justify-end gap-1">
                            <Footprints className="h-3.5 w-3.5" />
                            {weeklyActivityTotals.steps.toLocaleString()}
                          </span>
                          <span className="flex items-center justify-end gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {weeklyActivityTotals.workoutMinutes}m
                          </span>
                          <span className="flex items-center justify-end gap-1 text-[#F97316]">
                            <Flame className="h-3.5 w-3.5" />
                            {weeklyActivityTotals.activeCalories}
                          </span>
                          <span className="flex items-center justify-end gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {weeklyActivityTotals.distanceKm.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })()}
              </section>

              {/* Weight Forecast */}
              {showWeightForecastCard && (() => {
                const actualPoints = weightHistory.filter((p) => p.actual !== null);
                const predictedPoints = weightHistory.filter((p) => p.predicted !== null);
                const allPoints = weightHistory.filter((p) => p.actual !== null || p.predicted !== null);

                if (allPoints.length < 2) {
                  return (
                    <section className="mb-5">
                      <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[14px] font-black text-slate-900">{t("progress_weight_forecast")}</h3>
                          <span className="text-[11px] font-bold text-[#22C7A1]">{t("progress_target_label")} {goalWeight} {t("progress_kg_unit")}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 py-4 text-center">{t("progress_log_weight_msg")}</p>
                      </article>
                    </section>
                  );
                }

                const weights = actualPoints.map((p) => p.actual!);
                const minW = Math.min(...weights);
                const maxW = Math.max(...weights);
                const padding = Math.max(1, (maxW - minW) * 0.3);
                const yMin = minW - padding;
                const yMax = maxW + padding;
                const yRange = yMax - yMin || 1;

                const toX = (i: number) => (i / Math.max(allPoints.length - 1, 1)) * 200;
                const toY = (w: number) => 60 - ((w - yMin) / yRange) * 48;

                const actualLinePoints = actualPoints
                  .map((p) => {
                    const allIdx = allPoints.indexOf(p);
                    return `${toX(allIdx)},${toY(p.actual!)}`;
                  })
                  .join(" ");

                const predictedLinePoints = predictedPoints
                  .map((p, i) => {
                    const allIdx = allPoints.indexOf(p);
                    const prevActual = actualPoints[actualPoints.length - 1];
                    if (i === 0 && prevActual) {
                      return `${toX(allPoints.indexOf(prevActual))},${toY(prevActual.actual!)} ${toX(allIdx)},${toY(p.predicted!)}`;
                    }
                    return `${toX(allIdx)},${toY(p.predicted!)}`;
                  })
                  .join(" ");

                const slope = actualPoints.length >= 2
                  ? (weights[weights.length - 1] - weights[0]) / Math.max(1, weights.length - 1)
                  : 0;
                const weeklyChange = slope * 7;
                const daysToGoal = goalWeight && slope !== 0
                  ? Math.round((goalWeight - currentWeight) / slope)
                  : null;

                return (
                  <section className="mb-5">
                    <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[14px] font-black text-slate-900">{t("progress_weight_forecast")}</h3>
                        <span className="text-[11px] font-bold text-[#22C7A1]">{t("progress_target_label")} {goalWeight} {t("progress_kg_unit")}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="rounded-full bg-[#EFFFFA] px-2 py-0.5 text-[10px] font-bold text-[#22C7A1]">{currentWeight} {t("progress_kg_unit")} {t("progress_today")}</span>
                      </div>
                      <svg className="w-full h-16" viewBox="0 0 200 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22C7A1" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#22C7A1" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={`M${actualLinePoints.split(" ")[0]} L${actualLinePoints.split(" ").slice(-1)[0]} L200,60 L0,60 Z`} fill="url(#wg)" />

                        {actualLinePoints && (
                          <polyline
                            fill="none"
                            stroke="#22C7A1"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={actualLinePoints}
                          />
                        )}

                        {predictedLinePoints && (
                          <polyline
                            fill="none"
                            stroke="#22C7A1"
                            strokeWidth="2"
                            strokeDasharray="4,3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={predictedLinePoints}
                          />
                        )}

                        {actualPoints.map((p) => {
                          const allIdx = allPoints.indexOf(p);
                          return (
                            <circle key={p.date} cx={toX(allIdx)} cy={toY(p.actual!)} r="3" fill={PROGRESS_COLORS.calories} />
                          );
                        })}
                      </svg>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] font-semibold text-slate-600">
                          {weeklyChange !== 0
                            ? `${weeklyChange < 0 ? t("progress_losing") : t("progress_gaining")} ${Math.abs(weeklyChange).toFixed(1)} ${t("progress_kg_unit")}/${t("progress_week").toLowerCase()}`
                            : t("progress_weight_stable")}
                          {daysToGoal && daysToGoal > 0 ? ` · ${t("progress_days_to_goal", { days: daysToGoal })}` : ""}
                        </p>
                        <p className="text-[10px] font-medium text-slate-500">
                          {weeklyChange < 0 ? t("progress_on_track") : weeklyChange > 0 ? t("progress_trending_up") : t("progress_steady")}
                        </p>
                      </div>
                    </article>
                  </section>
                );
              })()}


            </div>
          );
        })()}

        {activeTab === "week" && !hasEnoughTrendData && (
          <section className="mb-3 flex items-center gap-3 rounded-[18px] border border-[#E5EAF1] bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#F3F4FF] text-[#7C83F6]">
              <TrendingUp className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="truncate text-[13px] font-black text-[#020617]">{t("progress_collecting_title")}</h2>
                <span className="shrink-0 text-[11px] font-black text-[#7C83F6]">{Math.min(trendLoggedDays, 3)}/3</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-[#64748B]">{t("progress_collecting_desc", { count: trendLoggedDays })}</p>
              <div className="mt-2 flex gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((index) => <span key={index} className={cn("h-1.5 flex-1 rounded-full", index < trendLoggedDays ? "bg-[#22C7A1]" : "bg-[#E5EAF1]")} />)}
              </div>
            </div>
          </section>
        )}

        {activeTab === "week" && (
          <div id="progress-panel-week" role="tabpanel">
            {/* Weekly Score Card - same spirit as Today card */}
            <section className={cn("mb-5", !hasEnoughTrendData && "hidden")}>
              {(() => {
                const pct = weeklySummary?.consistency?.percentage ?? 0;
                const protPct = weeklySummary?.macros?.protein?.percentage ?? 0;
                const waterDays = weekdayData.filter(d => d.waterGlasses >= 8).length;
                const waterPct = Math.round((waterDays / 7) * 100);
                const weekScore = Math.round((pct + protPct + waterPct) / 3);
                const change = weeklySummary?.calories?.changePercent ?? 0;
                const streak = streaks.logging?.currentStreak ?? 0;
                const calAvg = weeklySummary?.calories?.thisWeekAvg ?? 0;
                const calTarget2 = activeGoal?.daily_calorie_target ?? 2000;
                const calPct2 = calTarget2 > 0 ? Math.min(100, Math.round((calAvg / calTarget2) * 100)) : 0;
                const daysLogged2 = weekdayData.filter(d => d.calories > 0).length;
                const scoreColor = weekScore >= 80 ? PROGRESS_COLORS.calories : weekScore >= 60 ? PROGRESS_COLORS.carbs : PROGRESS_COLORS.fat;
                const scoreLabel = weekScore >= 80 ? t("progress_excellent_week") : weekScore >= 60 ? t("progress_good_progress_status") : t("progress_keep_going");
                const weekCircumference = 2 * Math.PI * 46;
                const consistencyCircumference = 2 * Math.PI * 34;
                return (
              <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">

                {/* ── Top banner ── */}
                <div className="flex items-center justify-between px-5 pt-4 pb-5">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{t("progress_this_week")}</p>
                    <p className="text-[15px] font-black text-slate-900">{t("progress_weekly_performance")}</p>
                  </div>
                  {streak > 0 ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 ring-1 ring-orange-100">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />
                      <span className="text-[12px] font-black text-orange-600">{streak}d</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-100">
                      <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500">{daysLogged2}/7 days</span>
                    </div>
                  )}
                </div>

                {/* ── Dual donut + right stats ── */}
                <div className="flex items-center gap-4 px-5 pb-7 pt-1">
                  {/* Dual donut: outer = consistency, inner = weekly score */}
                  <div className="relative shrink-0">
                    <svg width="110" height="110" viewBox="0 0 110 110">
                      {/* Outer track */}
                      <circle cx="55" cy="55" r="46" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                      {/* Outer arc = consistency */}
                      <circle cx="55" cy="55" r="46" fill="none" stroke="#818CF8" strokeLinecap="round" strokeWidth="10"
                        strokeDasharray={`${(pct / 100) * weekCircumference} ${weekCircumference}`}
                        transform="rotate(-90 55 55)"
                      />
                      {/* Inner track */}
                      <circle cx="55" cy="55" r="34" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                      {/* Inner arc = weekly score */}
                      <circle cx="55" cy="55" r="34" fill="none"
                        stroke={scoreColor}
                        strokeLinecap="round" strokeWidth="8"
                        strokeDasharray={`${(weekScore / 100) * consistencyCircumference} ${consistencyCircumference}`}
                        transform="rotate(-90 55 55)"
                      />
                      {/* Center */}
                      <text x="55" y="50" textAnchor="middle" fontSize="18" fontWeight="900" fill="#0F172A" fontFamily="system-ui">{weekScore}</text>
                      <text x="55" y="63" textAnchor="middle" fontSize="9" fontWeight="700" fill="#94A3B8" fontFamily="system-ui">{t("progress_score_label")}</text>
                    </svg>
                    {/* Legend */}
                    <div className="absolute -bottom-2 left-1/2 flex w-max -translate-x-1/2 items-center justify-center gap-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-black leading-none text-slate-400">
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PROGRESS_COLORS.protein }} />
                        {t("progress_consistency_short")}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] font-black leading-none text-slate-400">
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: scoreColor }} />
                        {t("progress_score")}
                      </span>
                    </div>
                  </div>

                  {/* Right stats */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    {/* Score label */}
                    <div className="rounded-[14px] bg-slate-50 px-3 py-2.5">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{t("progress_weekly_score")}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[22px] font-black leading-none" style={{ color: scoreColor }}>{weekScore}</span>
                        <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${weekScore}%`, backgroundColor: scoreColor }} />
                      </div>
                    </div>

                    {/* Score badge + trend */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                        style={{ backgroundColor: `${scoreColor}18` }}
                      >
                        {weekScore >= 80 ? <Trophy className="h-4 w-4" style={{ color: scoreColor }} /> : weekScore >= 60 ? <TrendingUp className="h-4 w-4" style={{ color: scoreColor }} /> : <TrendingDown className="h-4 w-4" style={{ color: scoreColor }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-900">{scoreLabel}</p>
                        <p className="text-[9px] text-slate-400">
                          {change >= 0 ? `↑ +${Math.round(change)}%` : `↓ ${Math.round(change)}%`} vs last week
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="mx-5 h-px bg-slate-100" />

                {/* ── Metric bars row ── */}
                <div className="grid grid-cols-3 gap-px bg-slate-100">
                  {[
                    { label: t('calories'), value: `${calPct2}%`, sub: `${calAvg.toLocaleString()} avg`, pct: calPct2, color: '#FB923C' },
                    { label: t('protein'), value: `${protPct}%`, sub: 'of target', pct: protPct, color: '#818CF8' },
                    { label: t('progress_hydration'), value: `${waterDays}/7`, sub: 'days met goal', pct: Math.round((waterDays / 7) * 100), color: '#38BDF8' },
                  ].map((m) => (
                    <div key={m.label} className="flex flex-col items-center bg-white px-2 py-3">
                      <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                      </div>
                      <p className="text-[15px] font-black text-slate-900">{m.value}</p>
                      <p className="mt-0.5 text-[9px] font-semibold text-slate-400">{m.sub}</p>
                      <p className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wide" style={{ color: m.color }}>{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* ── Days logged strip ── */}
                <div className="flex items-center gap-2 px-5 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 shrink-0">{t("progress_days_logged")}</p>
                  <div className="flex flex-1 items-center gap-1">
                    {['M','T','W','T','F','S','S'].map((d, i) => {
                      const dayData = weekdayData[i];
                      const logged = dayData && dayData.calories > 0;
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className="h-4 w-full rounded-full transition-colors duration-300"
                            style={{ backgroundColor: logged ? PROGRESS_COLORS.calories : PROGRESS_COLORS.track }}
                          />
                          <span className="text-[8px] font-bold text-slate-400">{d}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[12px] font-black text-slate-700 shrink-0">{daysLogged2}<span className="text-[10px] font-semibold text-slate-400">/7</span></span>
                </div>

              </article>
              );
            })()}
            </section>

            {/* Your Week - Calendar Grid with Rows */}
            <section className="mb-5">
              <article className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-black tracking-[-0.04em] text-slate-900">{t("progress_your_week")}</h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22C7A1]" /> {t("progress_on_track_legend")}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> {t("progress_partial_legend")}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> {t("progress_no_data_legend")}</span>
                  </div>
                </div>
                
                {/* Calendar Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-center">
                    <thead>
                      <tr>
                        <th className="pb-2 text-[11px] font-bold text-slate-500 w-20"></th>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                          <th key={day} className="pb-2 text-[11px] font-bold text-slate-500">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Meals Logged Row */}
                      <tr>
                        <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">{t("progress_meals_logged")}</td>
                        {weekdayData.map((day, i) => {
                          const hasData = day.calories > 0;
                          const onTarget = hasData && day.calories >= calorieTarget * 0.9 && day.calories <= calorieTarget * 1.1;
                          const status = !hasData ? "none" : onTarget ? "on" : "partial";
                          return (
                            <td key={i} className="py-2">
                              <div className="flex flex-col items-center gap-1">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${status === 'on' ? 'bg-[#EFFFFA]' : status === 'partial' ? 'bg-orange-100' : 'bg-slate-100'}`}>
                                  {status === 'on' ? <Check className="h-3 w-3 text-[#22C7A1]" strokeWidth={3} /> : status === 'partial' ? <div className="h-2 w-2 rounded-full bg-orange-400" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                                </div>
                                <span className="text-[9px] font-bold text-slate-600">{hasData ? day.calories.toLocaleString() : "—"}</span>
                                <span className="text-[8px] text-slate-500">kcal</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      {/* Workouts Row */}
                      <tr>
                        <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">{t("progress_workouts")}</td>
                        {weekdayData.map((day, i) => (
                          <td key={i} className="py-2">
                            <div className="flex justify-center">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${day.hasWorkout ? 'bg-[#EFFFFA]' : 'bg-slate-100'}`}>
                                {day.hasWorkout ? <Check className="h-3 w-3 text-[#22C7A1]" strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                              </div>
                            </div>
                          </td>
                        ))}
                      </tr>
                      {/* Water Goal Row */}
                      <tr>
                        <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">{t("progress_water_goal")}</td>
                        {weekdayData.map((day, i) => (
                          <td key={i} className="py-2">
                            <div className="flex justify-center">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${day.waterGlasses >= 8 ? 'bg-[#EFF9FF]' : 'bg-slate-100'}`}>
                                {day.waterGlasses >= 8 ? <Check className="h-3 w-3 text-[#38BDF8]" strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                              </div>
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </section>

            {/* Nutrient Trends with Line Graphs */}
            <section className="mb-5">
              <SectionHeader title={t("progress_nutrient_trends")} />
              <div className="grid grid-cols-3 gap-2.5">
                {/* Calories Trend */}
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">{t("progress_calories_avg")}</p>
                  <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                    {weeklySummary?.calories.thisWeekAvg.toLocaleString() ?? "—"}<span className="text-[12px] font-semibold text-slate-500 ml-0.5">{t("progress_kcal_unit")}</span>
                  </p>
                  <svg className="w-full h-10 mt-2" viewBox="0 0 80 40" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={(() => {
                        const vals = weekdayData.map(d => d.calories);
                        const max = Math.max(...vals, 1);
                        const xs = [0, 13, 27, 40, 53, 67, 80];
                        return xs.map((x, i) => `${x},${35 - (vals[i] / max) * 30}`).join(" ");
                      })()}
                    />
                  </svg>
                  {hasEnoughTrendData ? (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold" style={{ color: (weeklySummary?.calories.changePercent ?? 0) >= 0 ? PROGRESS_COLORS.calories : PROGRESS_COLORS.fat }}>
                      {(weeklySummary?.calories.changePercent ?? 0) >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {t("progress_vs_last_week_pct", { change: Math.abs(weeklySummary?.calories.changePercent ?? 0) })}
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] font-bold text-[#94A3B8]">{t("progress_trend_days_ready", { count: trendLoggedDays })}</p>
                  )}
                </article>
                {/* Protein Trend */}
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">{t("progress_protein_avg")}</p>
                  <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                    {weeklySummary?.macros.protein.consumed ?? "—"}<span className="text-[12px] font-semibold text-slate-500 ml-0.5">g</span>
                  </p>
                  <svg className="w-full h-10 mt-2" viewBox="0 0 80 40" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke={PROGRESS_COLORS.protein}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={(() => {
                        const vals = weekdayData.map(d => d.protein);
                        const max = Math.max(...vals, 1);
                        const xs = [0, 13, 27, 40, 53, 67, 80];
                        return xs.map((x, i) => `${x},${35 - (vals[i] / max) * 30}`).join(" ");
                      })()}
                    />
                  </svg>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#7C83F6] mt-1">
                    <ArrowUp className="h-3 w-3" />
                    {t("progress_of_target_pct", { value: weeklySummary?.macros.protein.percentage ?? 0 })}
                  </div>
                </article>
                {/* Water Trend */}
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">{t("progress_water_avg")}</p>
                  <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                    {(() => {
                      const avg = weekdayData.length > 0
                        ? weekdayData.reduce((s, d) => s + d.waterGlasses, 0) / weekdayData.length
                        : 0;
                      return <>{avg.toFixed(1)}<span className="text-[12px] font-semibold text-slate-500 ml-0.5">{t("progress_glasses")}</span></>;
                    })()}
                  </p>
                  <svg className="w-full h-10 mt-2" viewBox="0 0 80 40" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke={PROGRESS_COLORS.water}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={(() => {
                        const vals = weekdayData.map(d => d.waterGlasses);
                        const max = Math.max(...vals, 1);
                        const xs = [0, 13, 27, 40, 53, 67, 80];
                        return xs.map((x, i) => `${x},${35 - (vals[i] / max) * 30}`).join(" ");
                      })()}
                    />
                  </svg>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#38BDF8] mt-1">
                    <Check className="h-3 w-3" />
                    {t("progress_days_hit_goal", { count: weekdayData.filter(d => d.waterGlasses >= 8).length })}
                  </div>
                </article>
              </div>
            </section>

            {/* This Week Highlights - 3 Separate Cards */}
            <section className="mb-5">
              <h3 className="mb-3 text-[14px] font-black text-[#020617]">{t("progress_week_highlights")}</h3>
              <div className="grid grid-cols-3 gap-2">
                <article className="min-w-0 rounded-[20px] border border-[#E5EAF1] bg-white p-2.5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-amber-100 mb-2">
                    <Trophy className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="min-h-[26px] text-[9px] font-black leading-[1.25] text-[#020617]">{t("progress_best_protein")}</p>
                  <p className="truncate text-[9px] font-bold text-[#94A3B8]">
                    {(() => {
                      const best = weekdayData.reduce((a, b) => b.protein > a.protein ? b : a, weekdayData[0]);
                      return best?.dayLabel ?? "—";
                    })()}
                  </p>
                  <p className="mt-1 truncate text-[15px] font-black leading-none text-[#020617]">
                    {(() => {
                      const max = Math.max(...weekdayData.map(d => d.protein));
                      return max > 0 ? `${max} g` : "—";
                    })()}
                  </p>
                </article>
                <article className="min-w-0 rounded-[20px] border border-[#E5EAF1] bg-white p-2.5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-orange-100 mb-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="min-h-[26px] text-[9px] font-black leading-[1.25] text-[#020617]">{t("progress_highest_calories")}</p>
                  <p className="truncate text-[9px] font-bold text-[#94A3B8]">
                    {(() => {
                      const best = weekdayData.reduce((a, b) => b.calories > a.calories ? b : a, weekdayData[0]);
                      return best?.dayLabel ?? "—";
                    })()}
                  </p>
                  <p className="mt-1 truncate text-[15px] font-black leading-none text-[#020617]">
                    {(() => {
                      const max = Math.max(...weekdayData.map(d => d.calories));
                      return max > 0 ? `${max.toLocaleString()} kcal` : "—";
                    })()}
                  </p>
                </article>
                <article className="min-w-0 rounded-[20px] border border-[#E5EAF1] bg-white p-2.5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-[#EFF9FF] mb-2">
                    <Droplet className="h-5 w-5 text-[#38BDF8]" />
                  </div>
                  <p className="min-h-[26px] text-[9px] font-black leading-[1.25] text-[#020617]">{t("progress_most_hydrated")}</p>
                  <p className="truncate text-[9px] font-bold text-[#94A3B8]">
                    {(() => {
                      const best = weekdayData.reduce((a, b) => b.waterGlasses > a.waterGlasses ? b : a, weekdayData[0]);
                      return best?.dayLabel ?? "—";
                    })()}
                  </p>
                  <p className="mt-1 truncate text-[15px] font-black leading-none text-[#020617]">
                    {(() => {
                      const max = Math.max(...weekdayData.map(d => d.waterGlasses));
                      return max > 0 ? `${Number(max.toFixed(1)).toString()} ${t("progress_glasses")}` : "—";
                    })()}
                  </p>
                </article>
              </div>
            </section>

            {/* This Week vs Last Week */}
            <section className={cn("mb-5", !hasEnoughTrendData && "hidden")}>
              <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <h3 className="text-[13px] font-black text-slate-800 mb-3">{t("progress_week_vs_last")}</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4" style={{ color: '#F97316' }} />
                      <span className="text-[11px] font-semibold text-slate-600">{t("progress_calories_compare")}</span>
                    </div>
                    <span className={`text-[11px] font-bold ${(weeklySummary?.calories.changePercent ?? 0) >= 0 ? 'text-[#22C7A1]' : 'text-[#FB6B7A]'}`}>
                      {(weeklySummary?.calories.changePercent ?? 0) >= 0 ? '+' : ''}{weeklySummary?.calories.changePercent ?? 0}% {(weeklySummary?.calories.trend === 'up' ? '↑' : weeklySummary?.calories.trend === 'down' ? '↓' : '→')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" style={{ color: PROGRESS_COLORS.protein }} />
                      <span className="text-[11px] font-semibold text-slate-600">{t("progress_protein_compare")}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#7C83F6]">
                      {t("progress_of_target_pct", { value: weeklySummary?.macros.protein.percentage ?? 0 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4" style={{ color: PROGRESS_COLORS.water }} />
                      <span className="text-[11px] font-semibold text-slate-600">{t("progress_water_compare")}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#38BDF8]">
                      {weekdayData.filter(d => d.waterGlasses >= 8).length}/7 days
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" style={{ color: PROGRESS_COLORS.calories }} />
                      <span className="text-[11px] font-semibold text-slate-600">{t("progress_consistency_compare")}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#22C7A1]">
                      {weeklySummary?.consistency.percentage ?? 0}% {(weeklySummary?.consistency.percentage ?? 0) >= 70 ? '↑' : '→'}
                    </span>
                  </div>
                </div>
              </article>
            </section>

            {/* Habit Consistency & Goal Progress */}
            <section className="mb-5">
              <div className={cn("grid gap-3", hasEnoughTrendData ? "grid-cols-2" : "grid-cols-1")}>
                <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <h3 className="text-[13px] font-black text-slate-800 mb-3">{t("progress_habit_consistency")}</h3>
                  <div className="space-y-3">
                    {(() => {
                      const waterDays = weekdayData.filter(d => d.waterGlasses > 0).length;
                      const workoutDays = weekdayData.filter(d => d.hasWorkout).length;
                      const habits = [
                        { label: t('meal_logging_label'), days: weeklySummary?.consistency.daysLogged ?? 0, pct: weeklySummary?.consistency.percentage ?? 0, color: PROGRESS_COLORS.calories },
                        { label: t('water_tracking_label'), days: waterDays, pct: Math.round((waterDays / 7) * 100), color: PROGRESS_COLORS.water },
                        { label: t('workouts_label'), days: workoutDays, pct: Math.round((workoutDays / 7) * 100), color: PROGRESS_COLORS.protein },
                      ];
                      return habits.map((habit) => (
                        <div key={habit.label}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-semibold text-slate-600">{habit.label}</span>
                            <span className="font-bold text-slate-500">{habit.days}/7 days</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${habit.pct}%`, backgroundColor: habit.color }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </article>
                <article className={cn("rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]", !hasEnoughTrendData && "hidden")}>
                  <h3 className="text-[13px] font-black text-slate-800 mb-2">{t("progress_weekly_goal_progress")}</h3>
                  {(() => {
                    const calOnTarget = weeklySummary && Math.abs(weeklySummary.calories.thisWeekAvg - (activeGoal?.daily_calorie_target ?? 2000)) <= 200;
                    const proteinOnTarget = (weeklySummary?.macros.protein.percentage ?? 0) >= 80;
                    const waterOnTarget = weekdayData.filter(d => d.waterGlasses >= 8).length >= 4;
                    const activityOnTarget = weekdayData.filter(d => d.hasWorkout).length >= 3;
                    const goals = [
                      { label: t('calories_goal'), done: calOnTarget },
                      { label: t('protein_goal_label'), done: proteinOnTarget },
                      { label: t('water_goal'), done: waterOnTarget },
                      { label: t('activity_goal'), done: activityOnTarget },
                    ];
                    const doneCount = goals.filter(g => g.done).length;
                    const goalPct = Math.round((doneCount / goals.length) * 100);
                    const circumference = 2 * Math.PI * 40;
                    const dash = (goalPct / 100) * circumference;
                    return (
                      <>
                        <div className="relative grid h-24 w-24 mx-auto place-items-center">
                          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
                            <circle cx="48" cy="48" r="40" fill="none" stroke="#EEF2F7" strokeWidth="6" />
                            <circle cx="48" cy="48" r="40" fill="none" stroke={PROGRESS_COLORS.calories} strokeLinecap="round" strokeWidth="6" strokeDasharray={`${dash.toFixed(1)} ${(circumference - dash).toFixed(1)}`} />
                          </svg>
                          <div className="text-center">
                            <span className="text-[22px] font-black text-slate-900">{goalPct}%</span>
                            <p className="text-[9px] font-semibold text-slate-500">{t("progress_completed")}</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {goals.map((goal) => (
                            <div key={goal.label} className="flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-slate-600">{goal.label}</span>
                              <div className={`grid h-5 w-5 place-items-center rounded-full ${goal.done ? 'bg-[#EFFFFA] text-[#22C7A1]' : 'border border-slate-200 text-slate-300'}`}>
                                {goal.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="text-[8px]">○</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </article>
              </div>
            </section>

          </div>
        )}

        {activeTab === "goals" && !activeGoal && (
          <section id="progress-panel-goals" role="tabpanel" className="rounded-[26px] border border-[#D9F8EF] bg-white p-5 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[#EFFFFA] text-[#22C7A1]">
              <Target className="h-7 w-7" strokeWidth={2.3} />
            </div>
            <h2 className="mt-4 text-[20px] font-black text-[#020617]">{t("progress_no_goal_title")}</h2>
            <p className="mx-auto mt-2 max-w-[280px] text-[13px] font-semibold leading-5 text-[#64748B]">{t("progress_no_goal_desc")}</p>
            <button type="button" onClick={() => navigate("/edit-goal")} className="mt-5 h-12 w-full rounded-[16px] bg-[#020617] text-[13px] font-black text-white active:scale-[0.98]">{t("progress_set_goal")}</button>
          </section>
        )}

        {activeTab === "goals" && activeGoal && (
          <div id="progress-panel-goals" role="tabpanel">
            <section className="hidden">
              <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("goal_progress_title")}</p>
                  <h2 className="mt-1 text-[22px] font-black leading-tight tracking-[-0.04em] text-[#020617]">{t("goal_progress_heading")}</h2>
                  <p className="mt-1.5 text-[13px] font-semibold leading-5 text-slate-500">{t("goal_progress_subtitle")}</p>
              </div>
            </section>

            {/* Goals Hero Card - same spirit as Today card */}
            <section className="mb-5">
              {/* Main goal card - white card */}
              {(() => {
                const goalColors2: Record<string, string> = { weight_loss: PROGRESS_COLORS.carbs, muscle_gain: PROGRESS_COLORS.protein, maintenance: PROGRESS_COLORS.calories, general: PROGRESS_COLORS.fat };
                const goalColor = goalColors2[goalType] ?? PROGRESS_COLORS.calories;
                const goalLightBg: Record<string, string> = { weight_loss: '#FFF7ED', muscle_gain: '#F3F4FF', maintenance: '#EFFFFA', general: '#FFF0F2' };
                const goalBg = goalLightBg[goalType] ?? '#EFFFFA';
                const outerC = 2 * Math.PI * 46;
                const innerC = 2 * Math.PI * 34;
                const calTarget3 = activeGoal?.daily_calorie_target ?? 2000;
                const protTarget3 = activeGoal?.protein_target_g ?? 120;
                const carbTarget3 = activeGoal?.carbs_target_g ?? 240;
                const fatTarget3 = activeGoal?.fat_target_g ?? 70;
                return (
              <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">

                {/* ── Top banner ── */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{t("progress_active_goal")}</p>
                    <p className="text-[15px] font-black text-slate-900">{goalName}</p>
                  </div>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: goalBg }}
                  >
                    {(() => { const GIcon = goalTypeIcon[goalType] ?? Leaf; return <GIcon className="h-5 w-5" style={{ color: goalColor }} strokeWidth={2.5} />; })()}
                  </div>
                </div>

                {/* ── Dual donut + right stats ── */}
                <div className="flex items-center gap-4 px-5 pb-7">
                  {/* Dual donut: outer = goal ring value, inner = BMI / secondary */}
                  <div className="relative shrink-0">
                    <svg width="110" height="110" viewBox="0 0 110 110">
                      {/* Outer track */}
                      <circle cx="55" cy="55" r="46" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                      {/* Outer arc = goal progress */}
                      <circle cx="55" cy="55" r="46" fill="none" stroke={goalColor} strokeLinecap="round" strokeWidth="10"
                        strokeDasharray={`${(goalRingValue / 100) * outerC} ${outerC}`}
                        transform="rotate(-90 55 55)"
                      />
                      {/* Inner track */}
                      <circle cx="55" cy="55" r="34" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                      {/* Inner arc = BMI normalized (0-40 scale) */}
                      <circle cx="55" cy="55" r="34" fill="none"
                        stroke={bmi < 18.5 ? PROGRESS_COLORS.water : bmi < 25 ? PROGRESS_COLORS.calories : bmi < 30 ? PROGRESS_COLORS.carbs : PROGRESS_COLORS.fat}
                        strokeLinecap="round" strokeWidth="8"
                        strokeDasharray={`${(Math.min(bmi, 40) / 40) * innerC} ${innerC}`}
                        transform="rotate(-90 55 55)"
                      />
                      {/* Center */}
                      <text x="55" y="50" textAnchor="middle" fontSize="18" fontWeight="900" fill="#0F172A" fontFamily="system-ui">{goalRingValue}</text>
                      <text x="55" y="63" textAnchor="middle" fontSize="9" fontWeight="700" fill="#94A3B8" fontFamily="system-ui">%</text>
                    </svg>
                    {/* Legend */}
                    <div className="absolute -bottom-2 left-1/2 flex w-max -translate-x-1/2 items-center justify-center gap-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-black leading-none text-slate-400">
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: goalColor }} />
                        {t("progress_goal_legend")}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] font-black leading-none text-slate-400">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: bmi < 18.5 ? PROGRESS_COLORS.water : bmi < 25 ? PROGRESS_COLORS.calories : bmi < 30 ? PROGRESS_COLORS.carbs : PROGRESS_COLORS.fat }}
                        />
                        {t("progress_bmi")}
                      </span>
                    </div>
                  </div>

                  {/* Right stats */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    {/* Current weight */}
                    <div className="rounded-[14px] bg-slate-50 px-3 py-2.5">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{goalRightMetric.label}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[22px] font-black leading-none text-slate-900">{goalRightMetric.value}</span>
                        <span className="text-[10px] font-bold text-slate-400">{goalRightMetric.unit.replace(' ▾', '')}</span>
                      </div>
                      {goalWeight !== currentWeight && (
                        <p className="mt-0.5 text-[9px] font-semibold" style={{ color: goalColor }}>
                          {t("progress_target_label")} {goalWeight.toFixed(1)} {t("progress_kg_unit")}
                        </p>
                      )}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${goalRingValue}%`, backgroundColor: goalColor }} />
                      </div>
                    </div>

                    {/* BMI badge */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-black"
                        style={{ backgroundColor: goalBg, color: goalColor }}
                      >
                        {bmi.toFixed(1)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-900">{t("progress_bmi_label", { label: bmiLabel })}</p>
                        <p className="text-[9px] text-slate-400">{goalSubLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="mx-5 h-px bg-slate-100" />

                {/* ── Nutrition targets row ── */}
                <div className="grid grid-cols-4 gap-px bg-slate-100">
                  {[
                    { label: t('calories'), value: calTarget3.toLocaleString(), unit: 'kcal', color: PROGRESS_COLORS.calories },
                    { label: t('protein'), value: `${protTarget3}`, unit: 'g', color: PROGRESS_COLORS.protein },
                    { label: t('carbs'), value: `${carbTarget3}`, unit: 'g', color: PROGRESS_COLORS.carbs },
                    { label: t('fat_label'), value: `${fatTarget3}`, unit: t('progress_gram_unit'), color: PROGRESS_COLORS.fat },
                  ].map((m) => (
                    <div key={m.label} className="flex flex-col items-center bg-white px-1 py-3">
                      <p className="text-[13px] font-black text-slate-900">{m.value}</p>
                      <p className="text-[8px] font-semibold text-slate-400">{m.unit}</p>
                      <p className="mt-0.5 text-[8px] font-extrabold uppercase tracking-wide" style={{ color: m.color }}>{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* ── Weight input strip ── */}
                <div className="grid grid-cols-2 gap-2 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => navigate("/body-metrics")}
                    className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-slate-50 text-[12px] font-black text-slate-800 ring-1 ring-slate-200 active:scale-95"
                  >
                    <Scale className="h-4 w-4 text-slate-500" strokeWidth={2.4} />
                    {t("update_weight")}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/edit-goal")}
                    className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#020617] text-[12px] font-black text-white active:scale-95"
                  >
                    <Target className="h-4 w-4" strokeWidth={2.4} />
                    {t("edit_goal")}
                  </button>
                </div>

              </article>
                );
              })()}
            </section>

            <section className="mb-5 space-y-3">
              {(() => {
                const goalColors: Record<string, string> = { weight_loss: PROGRESS_COLORS.carbs, muscle_gain: PROGRESS_COLORS.protein, maintenance: PROGRESS_COLORS.calories, general: PROGRESS_COLORS.fat };
                const goalLightBg: Record<string, string> = { weight_loss: '#FFF7ED', muscle_gain: '#F3F4FF', maintenance: '#EFFFFA', general: '#FFF0F2' };
                const goalColor = goalColors[goalType] ?? PROGRESS_COLORS.calories;
                const goalBg = goalLightBg[goalType] ?? '#EFFFFA';
                const latestWeight = weightHistory[weightHistory.length - 1]?.actual ?? currentWeight;
                const firstWeight = weightHistory[0]?.actual ?? currentWeight;
                const weeklyChange = weightHistory.length >= 2
                  ? latestWeight - (weightHistory[Math.max(0, weightHistory.length - 2)]?.actual ?? latestWeight)
                  : 0;
                const remainingKg = Math.abs(currentWeight - goalWeight);
                const weeklyPace = Math.max(0.1, Math.abs(weeklyChange));
                const estimatedWeeks = goalType === "maintenance" ? 0 : Math.max(1, Math.ceil(remainingKg / weeklyPace));
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + estimatedWeeks * 7);
                const paceLabel = goalType === "maintenance"
                  ? t("progress_pace_hold_range")
                  : weeklyChange === 0
                    ? t("progress_pace_build_momentum")
                    : t("progress_pace_kg_week", { value: Math.abs(weeklyChange).toFixed(1) });
                const timelineItems = [
                  { label: t("progress_start"), value: t("progress_weight_kg_value", { value: firstWeight.toFixed(1) }), done: true },
                  { label: t("today"), value: t("progress_weight_kg_value", { value: currentWeight.toFixed(1) }), done: true },
                  { label: t("target"), value: goalType === "maintenance" ? t("maintain") : t("progress_weight_kg_value", { value: goalWeight.toFixed(1) }), done: goalRingValue >= 100 },
                ];
                const milestones = goalType === "maintenance"
                  ? [
                      { label: t("progress_milestone_steady_days"), done: (weeklySummary?.consistency?.daysLogged ?? 0) >= 3 },
                      { label: t("progress_milestone_protein_steady"), done: (weeklySummary?.macros?.protein?.percentage ?? 0) >= 80 },
                      { label: t("progress_milestone_balanced_week"), done: goalRingValue >= 80 },
                    ]
                  : [25, 50, 75, 100].map((pct) => ({ label: pct === 100 ? t("progress_milestone_target_reached") : t("progress_milestone_percent", { percent: pct }), done: goalRingValue >= pct }));

                return (
                  <>
                    <article className="rounded-[26px] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.055)] ring-1 ring-slate-100">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{t("progress_goal_timeline")}</p>
                          <h3 className="mt-1 text-[17px] font-black text-slate-950">
                            {goalType === "maintenance" ? t("progress_stay_consistent") : t("progress_week_estimate", { count: estimatedWeeks })}
                          </h3>
                        </div>
                        <div className="rounded-2xl px-3 py-2 text-right" style={{ backgroundColor: goalBg }}>
                          <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: goalColor }}>{t("progress_pace")}</p>
                          <p className="text-[12px] font-black text-slate-900">{paceLabel}</p>
                        </div>
                      </div>

                      <div className="relative grid grid-cols-3 gap-2">
                        <div className="absolute left-[16%] right-[16%] top-[18px] h-1 rounded-full bg-slate-100" />
                        <div className="absolute left-[16%] top-[18px] h-1 rounded-full transition-all duration-700" style={{ width: `${Math.min(goalRingValue, 100) * 0.68}%`, backgroundColor: goalColor }} />
                        {timelineItems.map((item) => (
                          <div key={item.label} className="relative z-10 flex flex-col items-center text-center">
                            <div
                              className={`grid h-9 w-9 place-items-center rounded-full text-white shadow-[0_8px_18px_rgba(15,23,42,0.08)] ${item.done ? "" : "bg-white text-slate-300 ring-1 ring-slate-200"}`}
                              style={item.done ? { backgroundColor: goalColor } : undefined}
                            >
                              {item.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Target className="h-4 w-4" />}
                            </div>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{item.label}</p>
                            <p className="mt-0.5 text-[12px] font-black text-slate-900">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {goalType !== "maintenance" && (
                        <p className="mt-4 text-center text-[11px] font-bold text-slate-400">
                          {t("progress_estimated_target", { date: formatLocaleDate(targetDate, language, { month: "short", day: "numeric" }) })}
                        </p>
                      )}
                    </article>

                    <article className="relative overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_10px_26px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                      <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-[#F97316] rtl:left-auto rtl:right-0 rtl:rounded-l-full rtl:rounded-r-none" aria-hidden="true" />
                      <div className="flex items-start gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] bg-[#FFF3E8] text-[#F97316] ring-1 ring-[#FED7AA]">
                          <Zap className="h-5 w-5" strokeWidth={2.4} />
                        </div>
                        <div className="min-w-0 flex-1 text-start">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F97316]">
                              {t("next_best_action")}
                            </p>
                            <span className="shrink-0 rounded-full bg-[#E9FBF7] px-2.5 py-1 text-[9px] font-black text-[#16A884]">
                              {t("progress_today_focus")}
                            </span>
                          </div>
                          <p className="mt-2 text-[14px] font-black leading-[1.45] text-[#020617]">
                            {coachRecommendation}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-[#F6F8FB]" aria-hidden="true">
                        <span className="w-[48%] bg-[#22C7A1]" />
                        <span className="w-[29%] bg-[#7C83F6]" />
                        <span className="w-[23%] bg-[#38BDF8]" />
                      </div>
                    </article>

                    <article className="rounded-[26px] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.055)] ring-1 ring-slate-100">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{t("progress_milestone_ladder")}</p>
                          <h3 className="mt-1 text-[17px] font-black text-slate-950">{t("progress_small_wins")}</h3>
                        </div>
                        <span className="rounded-full px-3 py-1.5 text-[11px] font-black" style={{ backgroundColor: goalBg, color: goalColor }}>
                          {milestones.filter((m) => m.done).length}/{milestones.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {milestones.map((milestone) => (
                          <div key={milestone.label} className={`rounded-2xl px-2 py-3 text-center ${milestone.done ? "" : "bg-slate-50"}`} style={milestone.done ? { backgroundColor: goalBg } : undefined}>
                            <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full ${milestone.done ? "text-white" : "bg-white text-slate-300 ring-1 ring-slate-200"}`} style={milestone.done ? { backgroundColor: goalColor } : undefined}>
                              {milestone.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Lock className="h-3.5 w-3.5" />}
                            </div>
                            <p className="mt-2 text-[10px] font-black leading-tight text-slate-700">{milestone.label}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  </>
                );
              })()}
            </section>

            <section className="mb-5">
              <details className="group rounded-[20px] border border-slate-100 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-[12px] font-black uppercase tracking-wider text-slate-500">{t("progress_your_plan")}</h3>
                  <span className="flex items-center gap-1 text-[11px] font-black text-[#22C7A1]">
                    {t("view")}
                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" strokeWidth={2.5} />
                  </span>
                </summary>

                <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 px-4 py-3 scrollbar-hide">
                  {[
                    { label: t("calories"), value: activeGoal?.daily_calorie_target ?? 2000, unit: t("progress_kcal_unit"), pct: activeGoal?.daily_calorie_target ? Math.min(100, Math.round(((weeklySummary?.calories?.thisWeekAvg ?? 0) / activeGoal.daily_calorie_target) * 100)) : 0 },
                    { label: t("protein"), value: activeGoal?.protein_target_g ?? 120, unit: t("progress_gram_unit"), pct: weeklySummary?.macros?.protein?.percentage ?? 0 },
                    { label: t("carbs"), value: activeGoal?.carbs_target_g ?? 250, unit: t("progress_gram_unit"), pct: weeklySummary?.macros?.carbs?.percentage ?? 0 },
                    { label: t("fat_label"), value: activeGoal?.fat_target_g ?? 65, unit: t("progress_gram_unit"), pct: weeklySummary?.macros?.fat?.percentage ?? 0 },
                    { label: t("fiber"), value: activeGoal?.fiber_target_g ?? 25, unit: t("progress_gram_unit"), pct: 0 },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center gap-2 shrink-0 rounded-[12px] bg-slate-50 px-3 py-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: m.pct >= 80 ? PROGRESS_COLORS.calories : m.pct >= 50 ? PROGRESS_COLORS.carbs : m.pct > 0 ? PROGRESS_COLORS.fat : PROGRESS_COLORS.track }}
                      />
                      <div>
                        <span className="block text-[14px] font-black leading-none text-slate-800">{m.value.toLocaleString()}</span>
                        <span className="block text-[9px] font-bold text-slate-500">{m.label} ({m.unit})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </section>

          </div>
        )}

        {activeTab === "goals" && coachProposals.length > 0 && (
        <section className="mb-5">
          <SectionHeader title={t("progress_coach_goals")} />
          <div className="space-y-3">
            {coachProposals.map((proposal) => {
              const prog = coachGoalProgress.find((p) => p.proposalId === proposal.id);
              const goalTypeDisplay: Record<string, string> = {
                weight_target: t("progress_weight_target"),
                calorie_target: t("progress_calorie_target"),
                macro_target: t("progress_macro_target"),
                meal_adherence: t("progress_meal_adherence"),
                workout_frequency: t("progress_workout_frequency"),
                streak_target: t("progress_streak_target"),
              };
              const goalIcon: Record<string, LucideIcon> = {
                weight_target: Scale,
                calorie_target: Flame,
                macro_target: Target,
                meal_adherence: Leaf,
                workout_frequency: Dumbbell,
                streak_target: CalendarCheck,
              };
              const Icon = goalIcon[proposal.goal_type] ?? Target;
              const isProposed = proposal.status === "proposed";

              return (
                <article
                  key={proposal.id}
                  className={`overflow-hidden rounded-[20px] border bg-white shadow-[0_16px_34px_rgba(15,23,42,0.06)] ${
                    isProposed ? "border-amber-200" : "border-[#22C7A1]/30"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                        isProposed
                          ? "bg-amber-100 text-amber-600"
                          : "bg-[#EFFFFA] text-[#22C7A1]"
                      }`}>
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[15px] font-black tracking-[-0.03em] text-slate-900">
                            {goalTypeDisplay[proposal.goal_type] ?? proposal.goal_type}
                          </h4>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            isProposed
                              ? "bg-amber-100 text-amber-700"
                              : "bg-[#EFFFFA] text-[#22C7A1]"
                          }`}>
                            {isProposed ? "NEW" : "ACTIVE"}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">
                          {t("progress_from_coach", { name: proposal.coach_name ?? t("coach") })}
                          {proposal.deadline && prog?.daysRemaining != null && (
                            <> · {t("progress_days_left", { count: prog.daysRemaining })}</>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="rounded-[12px] bg-slate-50 px-3 py-2 text-center">
                        <p className="text-[18px] font-black text-slate-900">{prog?.currentValue ?? "—"}</p>
                        <p className="text-[9px] font-bold text-slate-500">{t("progress_current")}</p>
                      </div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isProposed ? "bg-amber-400" : "bg-[#22C7A1]"
                            }`}
                            style={{ width: `${prog?.progressPct ?? 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="rounded-[12px] bg-[#EFFFFA] px-3 py-2 text-center">
                        <p className="text-[18px] font-black text-[#020617]">{proposal.target_value}</p>
                        <p className="text-[9px] font-bold text-[#22C7A1]">{t("progress_target")}</p>
                      </div>
                    </div>

                    {prog && (
                      <p className="mt-2 text-[11px] font-semibold text-slate-500">
                        {t("progress_of_goal_reached", { pct: prog.progressPct, unit: prog.unit })}
                      </p>
                    )}

                    {proposal.notes && (
                      <p className="mt-2 text-[12px] text-slate-600 italic">"{proposal.notes}"</p>
                    )}

                    {isProposed && (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => acceptCoachGoal(proposal.id)}
                          className="flex-1 h-11 rounded-[12px] bg-[#020617] text-[13px] font-bold text-white active:scale-95 transition-all hover:bg-[#020617]/90"
                        >
                          {t("progress_accept_goal")}
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectCoachGoal(proposal.id)}
                          className="h-11 rounded-[12px] bg-slate-100 px-5 text-[13px] font-bold text-slate-500 active:scale-95 transition-all hover:bg-slate-200"
                        >
                          {t("progress_decline")}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        )}

        {activeTab === "week" && hasEnoughTrendData && (
        <section className="mb-5">
          <SectionHeader action={showWeekDetails ? t("progress_hide_details") : t("progress_view_details")} title={t("progress_weekly_performance_title")} onClick={() => setShowWeekDetails(!showWeekDetails)} />
          <div className="grid grid-cols-4 gap-2.5">
            {weeklyMetrics.map((metric) => <MetricRing key={metric.label} metric={metric} />)}
          </div>
          {showWeekDetails && weeklySummary && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <article className="rounded-[16px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <span className="text-[11px] font-semibold text-slate-500">{t("progress_avg_calories_day")}</span>
                <p className="text-[26px] font-black tracking-[-0.05em] text-slate-950">{weeklySummary.calories.thisWeekAvg}<span className="ml-1 text-[11px] font-bold text-slate-500">{t("progress_kcal_unit")}</span></p>
                <span className="text-[10px] font-semibold text-slate-500">vs {weeklySummary.calories.lastWeekAvg} last week</span>
              </article>
              <article className="rounded-[16px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <span className="text-[11px] font-semibold text-slate-500">{t("progress_days_logged_label")}</span>
                <p className="text-[26px] font-black tracking-[-0.05em] text-slate-950">{weeklySummary.consistency.daysLogged}<span className="text-slate-500">/7</span></p>
                <span className="text-[10px] font-semibold text-slate-500">{t("progress_streak_label")} {weeklySummary.consistency.streak}</span>
              </article>
            </div>
          )}
        </section>
        )}

        {activeTab === "today" && showBodyMetricsCard && (
        <section className="mb-5">
          <article className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#EFFFFA] text-[#22C7A1]">
                <UserRound className="h-5 w-5" />
              </div>
              <h3 className="text-[16px] font-black tracking-[-0.04em]">{t("progress_body_metrics")}</h3>
            </div>
            <div className="grid grid-cols-[1fr_64px_1fr] items-center gap-3">
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">{t("progress_current_weight")}</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.06em]">{currentWeight}<span className="ml-1 text-[12px] font-bold">{t("progress_kg_unit")}</span></p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">{t("progress_height")}</p>
                  <p className="mt-1 text-[22px] font-black tracking-[-0.05em]">{height}<span className="ml-1 text-[12px] font-bold">{t("units_cm")}</span></p>
                </div>
              </div>
              <HumanSilhouette />
              <div className="space-y-6 text-right">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">{t("progress_goal_weight")}</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.06em]">{activeGoal?.target_weight_kg ? `${goalWeight}` : "—"}<span className="ml-1 text-[12px] font-bold">{t("progress_kg_unit")}</span></p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">{t("progress_bmi")}</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.06em]">{bmi}</p>
                  <p className="text-[11px] font-extrabold text-[#22C7A1]">{bmiLabel}</p>
                </div>
              </div>
            </div>
            {activeGoal?.target_weight_kg && (
            <div className="mt-5 h-2 rounded-full bg-slate-100">
              <div className="relative h-full rounded-full bg-[#22C7A1]" style={{ width: `${progressPct}%` }}>
                <span className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#22C7A1] shadow" />
              </div>
            </div>
            )}
          </article>
        </section>
        )}


      </div>
    </main>
  );
}
