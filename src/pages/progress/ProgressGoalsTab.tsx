import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Leaf,
  Lock,
  Scale,
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
  Dot
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
  const { profile } = useProfile();
  const { activeGoal } = useNutritionGoals(user?.id);
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

  const currentWeight = profile?.current_weight_kg ?? null;
  const height = profile?.height_cm ?? null;
  const hasBodyData = currentWeight != null && height != null && height > 0;
  const goalWeight = activeGoal?.target_weight_kg ?? currentWeight;
  const goalType = activeGoal?.goal_type ?? "weight_loss";
  const goalName = t(goalTypeLabelKey[goalType] ?? "goal_weight_loss");
  const weightDiff = currentWeight != null && goalWeight != null ? Math.abs(currentWeight - goalWeight) : 0;
  const bmi = currentWeight != null && height != null && height > 0 ? Number((currentWeight / Math.pow(height / 100, 2)).toFixed(1)) : 0;
  const bmiLabel = !hasBodyData ? "" : bmi < 18.5 ? t("progress_bmi_underweight") : bmi < 25 ? t("progress_bmi_healthy") : bmi < 30 ? t("progress_bmi_overweight") : t("progress_bmi_high");

  const progressPct = useMemo(() => {
    if (!activeGoal || weightHistory.length === 0 || goalWeight == null || goalWeight <= 0 || currentWeight == null) return 0;
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
    const weightDisplay = currentWeight != null ? currentWeight.toFixed(1) : "—";
    switch (goalType) {
      case "weight_loss": return { label: t("current_weight_label2"), value: weightDisplay, unit: "kg ▾" };
      case "muscle_gain": return { label: t("weekly_avg_protein"), value: `${weeklySummary?.macros?.protein?.consumed ?? 0}`, unit: "g" };
      case "maintenance": return { label: t("current_weight_label2"), value: weightDisplay, unit: "kg ▾" };
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

  if (!activeGoal) {
    return (
      <section id="progress-panel-goals" role="tabpanel" className="flex flex-col items-center justify-center rounded-[32px] bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/20">
          <Target className="h-8 w-8" strokeWidth={2.2} />
        </div>
        <h2 className="mt-5 text-[22px] font-black tracking-tight text-slate-900">{t("progress_no_goal_title")}</h2>
        <p className="mt-2 text-[14px] font-medium text-slate-500">{t("progress_no_goal_desc")}</p>
        <button type="button" onClick={() => navigate("/edit-goal")} className="mt-6 h-14 w-full rounded-full bg-slate-900 text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)] transition-all active:scale-[0.98]">
          {t("progress_set_goal")}
        </button>
      </section>
    );
  }

  return (
    <motion.div
      id="progress-panel-goals"
      role="tabpanel"
      className="space-y-4"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, staggerChildren: 0.1 }}
    >
      {!hasBodyData && (
        <section className="flex flex-col items-center justify-center rounded-[32px] bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-100">
            <Scale className="h-8 w-8" strokeWidth={2.2} />
          </div>
          <h2 className="mt-5 text-[22px] font-black tracking-tight text-slate-900">{t("progress_no_body_data_title")}</h2>
          <p className="mt-2 text-[14px] font-medium text-slate-500">{t("progress_no_body_data_desc")}</p>
          <button type="button" onClick={() => navigate("/body-metrics")} className="mt-6 h-14 w-full rounded-full bg-slate-900 text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)] transition-all active:scale-[0.98]">
            {t("progress_add_body_data")}
          </button>
        </section>
      )}

      {/* ── Goals Hero Card ── */}
      <section>
        {(() => {
          const goalColors2: Record<string, string> = { weight_loss: PROGRESS_COLORS.carbs, muscle_gain: PROGRESS_COLORS.protein, maintenance: PROGRESS_COLORS.calories, general: PROGRESS_COLORS.fat };
          const goalColor = goalColors2[goalType] ?? PROGRESS_COLORS.calories;
          const goalLightBg: Record<string, string> = { weight_loss: '#FFF7ED', muscle_gain: '#F3F4FF', maintenance: '#EFFFFA', general: '#FFF0F2' };
          const goalBg = goalLightBg[goalType] ?? '#EFFFFA';
          if (!hasBodyData || currentWeight == null || goalWeight == null) return null;
          const calTarget3 = activeGoal?.daily_calorie_target ?? 2000;
          const protTarget3 = activeGoal?.protein_target_g ?? 120;
          const carbTarget3 = activeGoal?.carbs_target_g ?? 240;
          const fatTarget3 = activeGoal?.fat_target_g ?? 70;
          
          return (
            <motion.article className="relative overflow-hidden rounded-[32px] bg-[#0F172A] p-6 shadow-[0_8px_32px_rgba(15,23,42,0.12)] ring-1 ring-slate-800">
              <div className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl" />

              {/* ── Top banner ── */}
              <div className="relative flex items-center justify-between mb-6">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("progress_active_goal")}</span>
                <div className="flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1.5 ring-1 ring-white/10">
                  {(() => { const GIcon = goalTypeIcon[goalType] ?? Leaf; return <GIcon className="h-3.5 w-3.5" style={{ color: goalColor }} strokeWidth={2.5} />; })()}
                  <span className="text-[11px] font-bold text-slate-300">{goalName}</span>
                </div>
              </div>

              {/* ── Dual donut + right stats ── */}
              <div className="relative mt-6 flex items-center gap-5">
                <div className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.2)] ring-4 ring-white/5" dir="ltr">
                  <div className="flex items-center justify-center scale-[1.25] origin-center">
                    <svg className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-lg" viewBox="0 0 200 200" aria-hidden="true">
                      <defs>
                        <linearGradient id="goal-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#22C7A1" />
                          <stop offset="25%" stopColor="#7C83F6" />
                          <stop offset="50%" stopColor="#38BDF8" />
                          <stop offset="75%" stopColor="#FB6B7A" />
                          <stop offset="100%" stopColor="#F97316" />
                        </linearGradient>
                      </defs>
                      <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
                      <motion.circle
                        cx="100"
                        cy="100"
                        r="84"
                        fill="none"
                        stroke="url(#goal-ring-gradient)"
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, goalRingValue) * 5.277} 527.7`}
                        pathLength="100"
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    </svg>
                    <div className="flex flex-col items-center justify-center text-center z-10">
                      <span className="text-[32px] font-black leading-none tracking-tight text-slate-900" dir="ltr">
                        {goalRingValue}%
                      </span>
                      <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">{t("progress_completed")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  <div className="rounded-2xl bg-slate-800/50 p-4 ring-1 ring-white/5 text-start">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{goalRightMetric.label}</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-[24px] font-black leading-none tracking-tight text-white" dir="ltr">{goalRightMetric.value}</span>
                      <span className="text-[11px] font-bold text-slate-500" dir="ltr">{goalRightMetric.unit.replace(' ▾', '')}</span>
                    </div>
                    {goalWeight !== currentWeight && (
                      <p className="mt-1 text-[10px] font-bold bg-gradient-to-r from-[#A3E635] to-[#22C7A1] bg-clip-text text-transparent" dir="ltr">
                        {t("progress_target_label")} {goalWeight.toFixed(1)} {t("progress_kg_unit")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-800/50 p-4 ring-1 ring-white/5">
                    <div className="text-start">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("progress_bmi_label", { label: bmiLabel })}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-slate-500">{goalSubLabel}</p>
                    </div>
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[14px] font-black shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                      style={{ backgroundColor: goalBg, color: goalColor }}
                      dir="ltr"
                    >
                      {bmi.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Nutrition targets row ── */}
              <div className="relative mt-6 grid grid-cols-4 gap-3 border-t border-white/10 pt-5">
                {[
                  { label: t('calories'), value: calTarget3.toLocaleString(), unit: 'kcal', color: '#22C7A1', gradient: 'from-[#22C7A1] to-[#10B981]', shadow: 'shadow-[0_4px_12px_-4px_rgba(34,199,161,0.35)]' },
                  { label: t('protein'), value: `${protTarget3}`, unit: 'g', color: '#7C83F6', gradient: 'from-[#7C83F6] to-[#636BF4]', shadow: 'shadow-[0_4px_12px_-4px_rgba(124,131,246,0.35)]' },
                  { label: t('carbs'), value: `${carbTarget3}`, unit: 'g', color: '#F97316', gradient: 'from-[#F97316] to-[#FB923C]', shadow: 'shadow-[0_4px_12px_-4px_rgba(249,115,22,0.35)]' },
                  { label: t('fat_label'), value: `${fatTarget3}`, unit: t('progress_gram_unit'), color: '#FB6B7A', gradient: 'from-[#FB6B7A] to-[#F43F5E]', shadow: 'shadow-[0_4px_12px_-4px_rgba(251,107,122,0.35)]' },
                ].map((m) => (
                  <div key={m.label} className={cn("flex flex-col items-center rounded-2xl bg-gradient-to-br p-3 ring-1 ring-white/10 text-white", m.gradient, m.shadow)}>
                    <p className="text-[16px] font-black" dir="ltr">{m.value}</p>
                    <p className="mt-0.5 text-[9px] font-bold text-white/70" dir="ltr">{m.unit}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/90">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Weight input strip ── */}
              <div className="relative mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/body-metrics")}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-slate-800/80 text-[13px] font-bold text-white ring-1 ring-white/10 transition-all hover:bg-slate-700 active:scale-95"
                >
                  <Scale className="h-4 w-4 text-slate-400" strokeWidth={2.4} />
                  {t("update_weight")}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/edit-goal")}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#A3E635] to-[#22C7A1] text-[13px] font-bold text-[#0F172A] shadow-[0_4px_12px_rgba(163,230,53,0.25)] transition-all hover:opacity-90 active:scale-95"
                >
                  <Target className="h-4 w-4" strokeWidth={2.4} />
                  {t("edit_goal")}
                </button>
              </div>

            </motion.article>
          );
        })()}
      </section>

      {/* ── Goal Details Section ── */}
      <section className="space-y-4">
        {(() => {
          const goalColors: Record<string, string> = { weight_loss: PROGRESS_COLORS.carbs, muscle_gain: PROGRESS_COLORS.protein, maintenance: PROGRESS_COLORS.calories, general: PROGRESS_COLORS.fat };
          const goalLightBg: Record<string, string> = { weight_loss: '#FFF7ED', muscle_gain: '#F3F4FF', maintenance: '#EFFFFA', general: '#FFF0F2' };
          const goalColor = goalColors[goalType] ?? PROGRESS_COLORS.calories;
          const goalBg = goalLightBg[goalType] ?? '#EFFFFA';
          if (!hasBodyData || currentWeight == null || goalWeight == null) return null;
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
              <article className="rounded-[24px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
                <div className="mb-5 flex items-center justify-between">
                  <div className="text-start">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("progress_goal_timeline")}</p>
                    <h3 className="mt-0.5 text-[16px] font-black tracking-tight text-slate-900">
                      {goalType === "maintenance" ? t("progress_stay_consistent") : t("progress_week_estimate", { count: estimatedWeeks })}
                    </h3>
                  </div>
                  <div className="rounded-2xl px-3 py-2 text-end" style={{ backgroundColor: goalBg }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: goalColor }}>{t("progress_pace")}</p>
                    <p className="text-[13px] font-black text-slate-900" dir="ltr">{paceLabel}</p>
                  </div>
                </div>

                <div className="relative mt-6 grid grid-cols-3 gap-2">
                  <div className="absolute left-[16%] right-[16%] top-[18px] h-1.5 rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" />
                  <div className="absolute left-[16%] top-[18px] h-1.5 rounded-full transition-all duration-700 bg-gradient-to-r from-[#22C7A1] to-[#A3E635]" style={{ width: `${Math.min(goalRingValue, 100) * 0.68}%` }} />
                  {timelineItems.map((item, i) => {
                    const colors = ["#22C7A1", "#7C83F6", "#38BDF8", "#FB6B7A", "#F97316", "#A3E635"];
                    const itemColor = colors[i % colors.length];
                    return (
                      <div key={item.label} className="relative z-10 flex flex-col items-center text-center">
                        <div
                          className={`grid h-10 w-10 place-items-center rounded-full text-white shadow-[0_2px_8px_rgba(15,23,42,0.12)] ${item.done ? "" : "bg-white text-slate-300 ring-1 ring-slate-200"}`}
                          style={item.done ? { backgroundColor: itemColor, boxShadow: `0 4px 12px ${itemColor}40` } : undefined}
                        >
                          {item.done ? <Check className="h-5 w-5" strokeWidth={3} /> : <Target className="h-5 w-5" />}
                        </div>
                        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{item.label}</p>
                        <p className="mt-0.5 text-[13px] font-black text-slate-900" dir="ltr">{item.value}</p>
                      </div>
                    );
                  })}
                </div>

                {goalType !== "maintenance" && (
                  <p className="mt-5 text-center text-[12px] font-bold text-slate-400">
                    {t("progress_estimated_target", { date: formatLocaleDate(targetDate, language, { month: "short", day: "numeric" }) })}
                  </p>
                )}
              </article>

              <article className="rounded-[24px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-start">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("progress_milestone_ladder")}</p>
                    <h3 className="mt-0.5 text-[16px] font-black tracking-tight text-slate-900">{t("progress_small_wins")}</h3>
                  </div>
                  <span className="rounded-full px-3 py-1.5 text-[12px] font-black" style={{ backgroundColor: goalBg, color: goalColor }} dir="ltr">
                    {milestones.filter((m) => m.done).length}/{milestones.length}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {milestones.map((milestone, i) => {
                    const colors = ["#22C7A1", "#7C83F6", "#38BDF8", "#FB6B7A", "#F97316", "#A3E635"];
                    const itemColor = colors[i % colors.length];
                    return (
                      <div key={milestone.label} className={`flex flex-col items-center justify-center rounded-2xl p-3 text-center transition-all ${milestone.done ? "bg-slate-50" : "bg-slate-50 ring-1 ring-slate-100/50"}`} style={milestone.done ? { backgroundColor: `${itemColor}15` } : undefined}>
                        <div className={`grid h-8 w-8 place-items-center rounded-full ${milestone.done ? "text-white shadow-sm" : "bg-white text-slate-300 ring-1 ring-slate-200"}`} style={milestone.done ? { backgroundColor: itemColor, boxShadow: `0 2px 8px ${itemColor}40` } : undefined}>
                          {milestone.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Lock className="h-3.5 w-3.5" />}
                        </div>
                        <p className="mt-2 text-[10px] font-bold leading-tight text-slate-700">{milestone.label}</p>
                      </div>
                    );
                  })}
                </div>
              </article>
            </>
          );
        })()}
      </section>

      <section className="mb-5">
        <details className="group rounded-[24px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 py-3 [&::-webkit-details-marker]:hidden">
            <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-500">{t("progress_your_plan")}</h3>
            <span className="flex items-center gap-1 text-[12px] font-bold text-brand">
              {t("view")}
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" strokeWidth={2.5} />
            </span>
          </summary>

          <div className="flex items-center gap-3 overflow-x-auto border-t border-slate-100 px-5 py-4 scrollbar-hide">
            {[
              { label: t("calories"), value: activeGoal?.daily_calorie_target ?? 2000, unit: t("progress_kcal_unit"), pct: activeGoal?.daily_calorie_target ? Math.min(100, Math.round(((weeklySummary?.calories?.thisWeekAvg ?? 0) / activeGoal.daily_calorie_target) * 100)) : 0 },
              { label: t("protein"), value: activeGoal?.protein_target_g ?? 120, unit: t("progress_gram_unit"), pct: weeklySummary?.macros?.protein?.percentage ?? 0 },
              { label: t("carbs"), value: activeGoal?.carbs_target_g ?? 250, unit: t("progress_gram_unit"), pct: weeklySummary?.macros?.carbs?.percentage ?? 0 },
              { label: t("fat_label"), value: activeGoal?.fat_target_g ?? 65, unit: t("progress_gram_unit"), pct: weeklySummary?.macros?.fat?.percentage ?? 0 },
              { label: t("fiber"), value: activeGoal?.fiber_target_g ?? 25, unit: t("progress_gram_unit"), pct: 0 },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3 shrink-0 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100/50">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: m.pct >= 80 ? PROGRESS_COLORS.calories : m.pct >= 50 ? PROGRESS_COLORS.carbs : m.pct > 0 ? PROGRESS_COLORS.fat : PROGRESS_COLORS.track }}
                />
                <div className="text-start">
                  <span className="block text-[16px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{m.value.toLocaleString()}</span>
                  <span className="mt-0.5 block text-[10px] font-bold text-slate-500">{m.label} ({m.unit})</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* ── Weight Trend Chart ── */}
      {weightHistory.length >= 2 && (
        <section className="rounded-[24px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <SectionHeader title={t("progress_weight_trend")} />
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightHistory} margin={{ left: -22, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="weight-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#22C7A1" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} tickFormatter={(val) => format(new Date(val), "MMM d")} />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)} kg`, t("weight")]}
                  labelFormatter={(label) => format(new Date(label), "MMM d, yyyy")}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #F1F5F9', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontWeight: 'bold', fontSize: '12px' }}
                />
                {goalWeight && <ReferenceLine y={goalWeight} stroke="#22C7A1" strokeDasharray="4 4" strokeWidth={1.5} opacity={0.5} />}
                <Line type="monotone" dataKey="actual" stroke="url(#weight-line-gradient)" strokeWidth={3} dot={<Dot r={4} fill="#22C7A1" stroke="#fff" strokeWidth={2} />} activeDot={{ r: 6, fill: "#10B981" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Coach Recommendation ── */}
      <section className="mb-5">
        <article className="relative overflow-hidden rounded-[24px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <span className="absolute inset-y-5 left-0 w-1.5 rounded-r-full bg-gradient-to-b from-[#22C7A1] to-[#A3E635] rtl:left-auto rtl:right-0 rtl:rounded-l-full rtl:rounded-r-none" aria-hidden="true" />
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/20">
              <Target className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1 text-start">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                  {t("next_best_action")}
                </p>
                <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200">
                  {t("progress_today_focus")}
                </span>
              </div>
              <p className="mt-2 text-[14px] font-black leading-tight text-slate-900">
                {coachRecommendation}
              </p>
            </div>
          </div>
        </article>
      </section>

      {/* ── Coach Proposals ── */}
      {coachProposals.length > 0 && (
        <section className="mb-5">
          <SectionHeader title={t("progress_coach_goals")} />
          <div className="space-y-4">
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
                  className={cn(
                    "overflow-hidden rounded-[24px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1",
                    isProposed ? "ring-amber-200" : "ring-slate-100"
                  )}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "grid h-12 w-12 shrink-0 place-items-center rounded-full ring-1",
                        isProposed ? "bg-amber-50 text-amber-500 ring-amber-200" : "bg-brand-soft text-brand ring-brand/20"
                      )}>
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1 text-start">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[16px] font-black tracking-tight text-slate-900">
                            {goalTypeDisplay[proposal.goal_type] ?? proposal.goal_type}
                          </h4>
                          <span className={cn(
                            "rounded-full px-2.5 py-0.5 text-[9px] font-bold",
                            isProposed ? "bg-amber-100 text-amber-700" : "bg-brand-soft text-brand"
                          )}>
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

                    <div className="mt-5 flex items-center gap-4">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center ring-1 ring-slate-100/50">
                        <p className="text-[20px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{prog?.currentValue ?? "—"}</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{t("progress_current")}</p>
                      </div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" dir="ltr">
                          <div
                            className={cn("h-full rounded-full transition-all duration-700", isProposed ? "bg-amber-400" : "bg-brand")}
                            style={{ width: `${prog?.progressPct ?? 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="rounded-2xl bg-brand-soft px-4 py-3 text-center ring-1 ring-brand/20">
                        <p className="text-[20px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{proposal.target_value}</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-brand">{t("progress_target")}</p>
                      </div>
                    </div>

                    {prog && (
                      <p className="mt-3 text-center text-[11px] font-bold text-slate-500" dir="ltr">
                        {t("progress_of_goal_reached", { pct: prog.progressPct, unit: prog.unit })}
                      </p>
                    )}

                    {proposal.notes && (
                      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-start ring-1 ring-slate-100/50">
                        <p className="text-[13px] font-medium italic text-slate-600">"{proposal.notes}"</p>
                      </div>
                    )}

                    {isProposed && (
                      <div className="mt-5 flex gap-3">
                        <button
                          type="button"
                          onClick={() => acceptCoachGoal(proposal.id)}
                          className="flex h-12 flex-1 items-center justify-center rounded-full bg-slate-900 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(15,23,42,0.12)] transition-all hover:bg-slate-800 active:scale-95"
                        >
                          {t("progress_accept_goal")}
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectCoachGoal(proposal.id)}
                          className="flex h-12 items-center justify-center rounded-full bg-slate-50 px-6 text-[13px] font-bold text-slate-600 ring-1 ring-slate-200 transition-all hover:bg-slate-100 active:scale-95"
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
    </motion.div>
  );
}
