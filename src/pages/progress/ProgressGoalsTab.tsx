import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  Leaf,
  Lock,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useWeightChartData } from "@/hooks/useWeightChartData";
import { useClientGoalProposals } from "@/hooks/useClientGoalProposals";
import { useLanguage } from "@/contexts/LanguageContext";
import { PROGRESS_COLORS } from "./progress-colors";
import { SectionHeader } from "./ProgressWeekTab";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Dot,
} from "recharts";
import { format } from "date-fns";

// eslint-disable-next-line react-refresh/only-export-components
export const goalTypeLabelKey: Record<string, string> = {
  weight_loss: "goal_weight_loss",
  muscle_gain: "goal_muscle_gain",
  maintenance: "goal_maintenance",
  general_health: "goal_healthy_lifestyle",
};

// eslint-disable-next-line react-refresh/only-export-components
export const goalTypeIcon: Record<string, LucideIcon> = {
  weight_loss: Scale,
  muscle_gain: Dumbbell,
  maintenance: Leaf,
  general_health: Leaf,
};

export default function ProgressGoalsTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { activeGoal, loading: goalsLoading } = useNutritionGoals(user?.id);
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { streaks } = useStreak(user?.id);
  const { weightChartData: weightHistory } = useWeightChartData(user?.id);
  const {
    proposals: coachProposals,
    progress: coachGoalProgress,
    acceptGoal: acceptCoachGoal,
    rejectGoal: rejectCoachGoal,
  } = useClientGoalProposals(user?.id);
  const { t, language } = useLanguage();
  const isBootstrapping = Boolean(user?.id) && (goalsLoading || profileLoading);

  const currentWeight = profile?.current_weight_kg ?? null;
  const height = profile?.height_cm ?? null;
  const hasBodyData = currentWeight != null && height != null && height > 0;
  const goalWeight = activeGoal?.target_weight_kg ?? currentWeight;
  const goalType = activeGoal?.goal_type ?? "weight_loss";
  const goalName = t(goalTypeLabelKey[goalType] ?? "goal_weight_loss");
  const weightDiff =
    currentWeight != null && goalWeight != null ? Math.abs(currentWeight - goalWeight) : 0;
  const bmi =
    currentWeight != null && height != null && height > 0
      ? Number((currentWeight / Math.pow(height / 100, 2)).toFixed(1))
      : 0;
  const bmiLabel = !hasBodyData
    ? ""
    : bmi < 18.5
      ? t("progress_bmi_underweight")
      : bmi < 25
        ? t("progress_bmi_healthy")
        : bmi < 30
          ? t("progress_bmi_overweight")
          : t("progress_bmi_high");

  const progressPct = useMemo(() => {
    if (!activeGoal || weightHistory.length === 0 || goalWeight == null || goalWeight <= 0 || currentWeight == null)
      return 0;
    const startWeight = weightHistory[0]?.actual ?? currentWeight;
    if (goalType === "weight_loss" && startWeight > goalWeight) {
      return Math.max(
        0,
        Math.min(100, Math.round(((startWeight - currentWeight) / (startWeight - goalWeight)) * 100))
      );
    }
    if (goalType === "muscle_gain" && startWeight < goalWeight) {
      return Math.max(
        0,
        Math.min(100, Math.round(((currentWeight - startWeight) / (goalWeight - startWeight)) * 100))
      );
    }
    if (goalType === "maintenance") return weeklySummary?.consistency?.percentage ?? 0;
    return currentWeight === goalWeight ? 100 : 0;
  }, [activeGoal, weightHistory, goalWeight, goalType, currentWeight, weeklySummary]);

  const goalRingValue = useMemo(() => {
    const proteinPct = weeklySummary?.macros?.protein?.percentage ?? 0;
    const consistencyPct = weeklySummary?.consistency?.percentage ?? 0;
    switch (goalType) {
      case "weight_loss":
        return progressPct;
      case "muscle_gain":
        return proteinPct;
      case "maintenance":
        return consistencyPct;
      default:
        return Math.round((progressPct + proteinPct + consistencyPct) / 3);
    }
  }, [goalType, progressPct, weeklySummary]);

  const goalRightMetric = useMemo(() => {
    const weightDisplay = currentWeight != null ? currentWeight.toFixed(1) : "—";
    switch (goalType) {
      case "weight_loss":
        return { label: t("current_weight_label2"), value: weightDisplay, unit: "kg" };
      case "muscle_gain":
        return {
          label: t("weekly_avg_protein"),
          value: `${weeklySummary?.macros?.protein?.consumed ?? 0}`,
          unit: "g",
        };
      case "maintenance":
        return { label: t("current_weight_label2"), value: weightDisplay, unit: "kg" };
      default:
        return { label: t("daily_streak"), value: `${streaks.logging?.currentStreak ?? 0}`, unit: "days" };
    }
  }, [goalType, currentWeight, weeklySummary, streaks, t]);

  const coachRecommendation = useMemo(() => {
    const protein = activeGoal?.protein_target_g ?? 120;
    const macros = weeklySummary?.macros;
    const proteinPct = macros?.protein?.percentage ?? 0;
    if (goalType === "muscle_gain") {
      if (proteinPct < 70)
        return t("progress_coach_muscle_low_protein", { protein, consumed: macros?.protein?.consumed ?? 0 });
      return t("progress_coach_muscle_good", { protein });
    }
    if (goalType === "weight_loss") return t("progress_coach_weight_loss", { protein });
    return t("progress_coach_balanced", {
      protein,
      carbs: activeGoal?.carbs_target_g ?? 200,
      fat: activeGoal?.fat_target_g ?? 65,
    });
  }, [goalType, activeGoal, weeklySummary, t]);

  if (isBootstrapping) {
    return (
      <section
        id="progress-panel-goals"
        role="tabpanel"
        aria-busy="true"
        aria-label={t("progress_goal_tab")}
        className="space-y-4"
      >
        <div className="animate-pulse rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[14px] bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-24 rounded-full bg-slate-100" />
              <div className="h-4 w-36 rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="mt-4 flex flex-col items-center gap-4 min-[360px]:flex-row">
            <div className="h-28 w-28 shrink-0 rounded-full bg-slate-100" />
            <div className="w-full flex-1 space-y-2">
              <div className="h-20 rounded-[14px] bg-slate-100" />
              <div className="h-16 rounded-[14px] bg-slate-100" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="h-12 rounded-full bg-slate-100" />
            <div className="h-12 rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="animate-pulse rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-3 h-4 w-32 rounded-full bg-slate-100" />
          <div className="space-y-3">
            <div className="h-12 rounded-[14px] bg-slate-100" />
            <div className="h-12 rounded-[14px] bg-slate-100" />
            <div className="h-12 rounded-[14px] bg-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  if (!activeGoal) {
    return (
      <section
        id="progress-panel-goals"
        role="tabpanel"
        className="flex flex-col items-center rounded-[20px] bg-white px-5 py-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
          <Target className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <h2 className="mt-4 text-[20px] font-extrabold text-slate-950">{t("progress_no_goal_title")}</h2>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-slate-500">{t("progress_no_goal_desc")}</p>
        <button
          type="button"
          onClick={() => navigate("/edit-goal")}
          className="mt-5 flex h-12 min-h-[48px] w-full items-center justify-center rounded-full bg-slate-950 text-[15px] font-extrabold text-white shadow-[0_4px_14px_rgba(15,23,42,0.18)] active:scale-[0.98]"
        >
          {t("progress_set_goal")}
        </button>
      </section>
    );
  }

  const firstWeight = weightHistory[0]?.actual ?? currentWeight;
  const latestWeight = weightHistory[weightHistory.length - 1]?.actual ?? currentWeight;
  const weeklyChange =
    weightHistory.length >= 2
      ? (latestWeight ?? 0) - (weightHistory[Math.max(0, weightHistory.length - 2)]?.actual ?? latestWeight ?? 0)
      : 0;
  const remainingKg =
    currentWeight != null && goalWeight != null ? Math.abs(currentWeight - goalWeight) : 0;
  const weeklyPace = Math.max(0.1, Math.abs(weeklyChange));
  const estimatedWeeks =
    goalType === "maintenance" ? 0 : Math.max(1, Math.ceil(remainingKg / weeklyPace));
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + estimatedWeeks * 7);
  const paceLabel =
    goalType === "maintenance"
      ? t("progress_pace_hold_range")
      : weeklyChange === 0
        ? t("progress_pace_build_momentum")
        : t("progress_pace_kg_week", { value: Math.abs(weeklyChange).toFixed(1) });

  const milestones =
    goalType === "maintenance"
      ? [
          { label: t("progress_milestone_steady_days"), done: (weeklySummary?.consistency?.daysLogged ?? 0) >= 3 },
          {
            label: t("progress_milestone_protein_steady"),
            done: (weeklySummary?.macros?.protein?.percentage ?? 0) >= 80,
          },
          { label: t("progress_milestone_balanced_week"), done: goalRingValue >= 80 },
        ]
      : [25, 50, 75, 100].map((pct) => ({
          label:
            pct === 100
              ? t("progress_milestone_target_reached")
              : t("progress_milestone_percent", { percent: pct }),
          done: goalRingValue >= pct,
        }));

  const planTargets = [
    { label: t("calories"), value: activeGoal?.daily_calorie_target ?? 2000, unit: t("progress_kcal_unit"), Icon: Flame, soft: "bg-[#EFFFFA] text-[#22C7A1]" },
    { label: t("protein"), value: activeGoal?.protein_target_g ?? 120, unit: t("progress_gram_unit"), Icon: Target, soft: "bg-[#F3F4FF] text-[#7C83F6]" },
    { label: t("carbs"), value: activeGoal?.carbs_target_g ?? 250, unit: t("progress_gram_unit"), Icon: Leaf, soft: "bg-[#FFF7ED] text-[#F97316]" },
    { label: t("fat_label"), value: activeGoal?.fat_target_g ?? 65, unit: t("progress_gram_unit"), Icon: Droplets, soft: "bg-[#FFF0F2] text-[#FB6B7A]" },
  ];

  const ringSize = 112;
  const stroke = 9;
  const r = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, goalRingValue) / 100) * circ;
  const GIcon = goalTypeIcon[goalType] ?? Target;

  return (
    <motion.div
      id="progress-panel-goals"
      role="tabpanel"
      className="space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      {!hasBodyData && (
        <section className="flex flex-col items-center rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Scale className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <h2 className="mt-4 text-[20px] font-black text-slate-950">{t("progress_no_body_data_title")}</h2>
          <p className="mt-2 text-[14px] font-medium text-slate-500">{t("progress_no_body_data_desc")}</p>
          <button
            type="button"
            onClick={() => navigate("/body-metrics")}
            className="mt-5 h-14 w-full rounded-full bg-slate-950 text-[15px] font-extrabold text-white active:scale-[0.98]"
          >
            {t("progress_add_body_data")}
          </button>
        </section>
      )}

      {hasBodyData && currentWeight != null && goalWeight != null && (
        <section className="rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#EFFFFA] text-[#22C7A1]">
                <GIcon className="h-5 w-5" strokeWidth={2.3} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#22C7A1]">
                  {t("current_goal")}
                </p>
                <h2 className="truncate text-[17px] font-extrabold tracking-tight text-slate-950">{goalName}</h2>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-400">{t("goal_active")}</p>
              </div>
            </div>
            <span className="max-w-[40%] shrink-0 truncate rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600">
              BMI {bmi.toFixed(1)} · {bmiLabel}
            </span>
          </div>

          <div className="mt-4 flex flex-col items-center gap-4 min-[360px]:flex-row min-[360px]:items-center">
            <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }} dir="ltr">
              <svg width={ringSize} height={ringSize} className="-rotate-90">
                <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="#EEF0F3" strokeWidth={stroke} />
                <motion.circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={r}
                  fill="none"
                  stroke={PROGRESS_COLORS.calories}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  initial={{ strokeDasharray: `0 ${circ}` }}
                  animate={{ strokeDasharray: `${dash} ${circ}` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[26px] font-black leading-none text-slate-950">{goalRingValue}%</span>
                <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  {t("progress_completed")}
                </span>
              </div>
            </div>

            <div className="w-full min-w-0 flex-1 space-y-2">
              <div className="rounded-[14px] bg-[#EFFFFA] p-3 text-start ring-1 ring-[#22C7A1]/20">
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#22C7A1]/80">
                  {goalRightMetric.label}
                </p>
                <p className="mt-0.5 text-[20px] font-black text-slate-950" dir="ltr">
                  {goalRightMetric.value}
                  <span className="ms-1 text-[12px] font-bold text-slate-400">{goalRightMetric.unit}</span>
                </p>
                {goalWeight !== currentWeight && (
                  <p className="mt-1 text-[12px] font-bold text-[#1EB493]" dir="ltr">
                    {t("progress_target_label")} {goalWeight.toFixed(1)} {t("progress_kg_unit")}
                  </p>
                )}
              </div>
              <div className="rounded-[14px] bg-slate-50 p-3 text-start ring-1 ring-slate-100">
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{t("progress_pace")}</p>
                <p className="mt-0.5 text-[13px] font-extrabold leading-snug text-slate-900">{paceLabel}</p>
                {goalType !== "maintenance" && (
                  <p className="mt-1 text-[12px] font-semibold text-slate-500">
                    {t("progress_kg_left_target", { kg: weightDiff.toFixed(0) })}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate("/body-metrics")}
              className="flex h-12 min-h-[48px] items-center justify-center gap-1.5 rounded-full bg-slate-100 text-[13px] font-extrabold text-slate-800 active:scale-95"
            >
              <Scale className="h-4 w-4" strokeWidth={2.3} />
              {t("update_weight")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/edit-goal")}
              className="flex h-12 min-h-[48px] items-center justify-center gap-1.5 rounded-full bg-slate-950 text-[13px] font-extrabold text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)] active:scale-95"
            >
              <Target className="h-4 w-4" strokeWidth={2.3} />
              {t("edit_goal")}
            </button>
          </div>
        </section>
      )}

      {/* Vertical timeline */}
      {hasBodyData && currentWeight != null && goalWeight != null && (
        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-start">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {t("progress_goal_timeline")}
              </p>
              <h3 className="text-[16px] font-black text-slate-950">
                {goalType === "maintenance"
                  ? t("progress_stay_consistent")
                  : t("progress_week_estimate", { count: estimatedWeeks })}
              </h3>
            </div>
            {goalType !== "maintenance" && (
              <p className="max-w-[42%] text-end text-[11px] font-bold text-slate-400">
                {t("progress_estimated_target", {
                  date: formatLocaleDate(targetDate, language, { month: "short", day: "numeric" }),
                })}
              </p>
            )}
          </div>

          <div className="relative space-y-0">
            <div className="absolute bottom-4 start-5 top-4 w-0.5 bg-slate-100" aria-hidden="true" />
            {[
              {
                label: t("progress_start"),
                value: t("progress_weight_kg_value", { value: (firstWeight ?? 0).toFixed(1) }),
                done: true,
              },
              {
                label: t("today"),
                value: t("progress_weight_kg_value", { value: currentWeight.toFixed(1) }),
                done: true,
              },
              {
                label: t("target"),
                value:
                  goalType === "maintenance"
                    ? t("maintain")
                    : t("progress_weight_kg_value", { value: goalWeight.toFixed(1) }),
                done: goalRingValue >= 100,
              },
            ].map((item, idx) => (
              <div key={item.label} className="relative flex items-center gap-3.5 py-2.5">
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-black",
                    item.done
                      ? "bg-[#22C7A1] text-white shadow-[0_4px_12px_rgba(34,199,161,0.28)]"
                      : "bg-white text-slate-300 ring-2 ring-slate-200"
                  )}
                >
                  {item.done ? <Check className="h-4.5 w-4.5" strokeWidth={3} /> : idx + 1}
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                  <p className="text-[15px] font-black text-slate-950" dir="ltr">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Milestones */}
      {hasBodyData && (
        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-start">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {t("progress_milestone_ladder")}
              </p>
              <h3 className="text-[16px] font-black text-slate-950">{t("progress_small_wins")}</h3>
            </div>
            <span className="rounded-full bg-[#EFFFFA] px-2.5 py-1 text-[12px] font-black text-[#22C7A1]" dir="ltr">
              {milestones.filter((m) => m.done).length}/{milestones.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {milestones.map((m, i) => (
              <div
                key={m.label}
                className={cn(
                  "flex flex-col items-center rounded-[20px] px-2 py-3.5 text-center ring-1",
                  m.done ? "bg-[#EFFFFA] ring-[#22C7A1]/20" : "bg-slate-50 ring-slate-100"
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    m.done ? "bg-[#22C7A1] text-white" : "bg-white text-slate-300 ring-1 ring-slate-200"
                  )}
                >
                  {m.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Lock className="h-3.5 w-3.5" />}
                </div>
                <p className="mt-2 text-[11px] font-bold leading-snug text-slate-700">{m.label}</p>
                {!m.done && <span className="sr-only">{i + 1}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plan targets */}
      <section>
        <h3 className="mb-2 px-0.5 text-[15px] font-black text-slate-950">{t("progress_your_plan")}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {planTargets.map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-2.5 rounded-[20px] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
            >
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", m.soft)}>
                <m.Icon className="h-4.5 w-4.5" strokeWidth={2.3} />
              </div>
              <div className="min-w-0 text-start">
                <p className="text-[16px] font-black leading-none text-slate-950" dir="ltr">
                  {m.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-500">
                  {m.label} · {m.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weight chart */}
      {weightHistory.length >= 2 && (
        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <SectionHeader title={t("progress_weight_trend")} />
          <div dir="ltr" className="mt-1">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightHistory} margin={{ left: -22, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  tickFormatter={(val) => format(new Date(val), "MMM d")}
                />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)} kg`, t("weight")]}
                  labelFormatter={(label) => format(new Date(label), "MMM d, yyyy")}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #F1F5F9",
                    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                />
                {goalWeight && (
                  <ReferenceLine y={goalWeight} stroke={PROGRESS_COLORS.calories} strokeDasharray="4 4" strokeWidth={1.5} opacity={0.5} />
                )}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={PROGRESS_COLORS.calories}
                  strokeWidth={3}
                  dot={<Dot r={4} fill={PROGRESS_COLORS.calories} stroke="#fff" strokeWidth={2} />}
                  activeDot={{ r: 6, fill: "#1EB493" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Coach insight */}
      <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1]">
            <Sparkles className="h-5 w-5" strokeWidth={2.3} />
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EFFFFA] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#22C7A1]">
                {t("next_best_action")}
              </span>
              <span className="text-[10px] font-bold text-slate-400">{t("progress_today_focus")}</span>
            </div>
            <p className="mt-2 text-[14px] font-extrabold leading-snug text-slate-950">{coachRecommendation}</p>
          </div>
        </div>
      </section>

      {/* Coach proposals */}
      {coachProposals.length > 0 && (
        <section>
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
              const icons: Record<string, LucideIcon> = {
                weight_target: Scale,
                calorie_target: Flame,
                macro_target: Target,
                meal_adherence: Leaf,
                workout_frequency: Dumbbell,
                streak_target: CalendarCheck,
              };
              const Icon = icons[proposal.goal_type] ?? Target;
              const isProposed = proposal.status === "proposed";

              return (
                <article
                  key={proposal.id}
                  className={cn(
                    "rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1",
                    isProposed ? "ring-amber-200" : "ring-slate-100"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                        isProposed ? "bg-amber-50 text-amber-600" : "bg-[#EFFFFA] text-[#22C7A1]"
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1 text-start">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-[15px] font-black text-slate-950">
                          {goalTypeDisplay[proposal.goal_type] ?? proposal.goal_type}
                        </h4>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-extrabold",
                            isProposed ? "bg-amber-100 text-amber-700" : "bg-[#EFFFFA] text-[#22C7A1]"
                          )}
                        >
                          {isProposed ? "NEW" : "ACTIVE"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                        {t("progress_from_coach", { name: proposal.coach_name ?? t("coach") })}
                        {proposal.deadline && prog?.daysRemaining != null && (
                          <> · {t("progress_days_left", { count: prog.daysRemaining })}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[17px] font-black text-slate-950" dir="ltr">
                        {prog?.currentValue ?? "—"}
                      </p>
                      <p className="text-[9px] font-bold uppercase text-slate-400">{t("progress_current")}</p>
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" dir="ltr">
                      <div
                        className={cn("h-full rounded-full", isProposed ? "bg-amber-400" : "bg-[#22C7A1]")}
                        style={{ width: `${prog?.progressPct ?? 0}%` }}
                      />
                    </div>
                    <div className="rounded-2xl bg-[#EFFFFA] px-3 py-2 text-center ring-1 ring-[#22C7A1]/20">
                      <p className="text-[17px] font-black text-slate-950" dir="ltr">
                        {proposal.target_value}
                      </p>
                      <p className="text-[9px] font-bold uppercase text-[#22C7A1]">{t("progress_target")}</p>
                    </div>
                  </div>

                  {prog && (
                    <p className="mt-2 text-center text-[11px] font-bold text-slate-500" dir="ltr">
                      {t("progress_of_goal_reached", { pct: prog.progressPct, unit: prog.unit })}
                    </p>
                  )}

                  {proposal.notes && (
                    <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-start text-[13px] font-medium italic text-slate-600">
                      "{proposal.notes}"
                    </p>
                  )}

                  {isProposed && (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => acceptCoachGoal(proposal.id)}
                        className="flex h-12 flex-1 items-center justify-center rounded-full bg-slate-950 text-[13px] font-extrabold text-white active:scale-95"
                      >
                        {t("progress_accept_goal")}
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectCoachGoal(proposal.id)}
                        className="flex h-12 flex-1 items-center justify-center rounded-full bg-slate-100 text-[13px] font-extrabold text-slate-700 active:scale-95"
                      >
                        {t("progress_decline")}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <span className="sr-only" aria-hidden="true">
        {PROGRESS_COLORS.calories}
      </span>
    </motion.div>
  );
}
