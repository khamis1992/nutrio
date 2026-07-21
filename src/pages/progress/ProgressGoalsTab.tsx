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
  Zap,
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
import { DualDonut } from "@/components/progress/DualDonut";
import { PROGRESS_COLORS } from "./progress-colors";
import { SectionHeader } from "./ProgressWeekTab";

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
      <section id="progress-panel-goals" role="tabpanel" className="rounded-[26px] border border-[#D9F8EF] bg-white p-5 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[#EFFFFA] text-[#22C7A1]">
          <Target className="h-7 w-7" strokeWidth={2.3} />
        </div>
        <h2 className="mt-4 text-[20px] font-black text-[#020617]">{t("progress_no_goal_title")}</h2>
        <p className="mx-auto mt-2 max-w-[280px] text-[13px] font-semibold leading-5 text-[#64748B]">{t("progress_no_goal_desc")}</p>
        <button type="button" onClick={() => navigate("/edit-goal")} className="mt-5 h-12 w-full rounded-[16px] bg-[#020617] text-[13px] font-black text-white active:scale-[0.98]">{t("progress_set_goal")}</button>
      </section>
    );
  }

  return (
    <div id="progress-panel-goals" role="tabpanel">
      {!hasBodyData && (
        <section className="mb-5 rounded-[26px] border border-slate-100 bg-white p-5 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-slate-100 text-slate-500">
            <Scale className="h-7 w-7" strokeWidth={2.3} />
          </div>
          <h2 className="mt-4 text-[20px] font-black text-[#020617]">{t("progress_no_body_data_title")}</h2>
          <p className="mx-auto mt-2 max-w-[280px] text-[13px] font-semibold leading-5 text-[#64748B]">{t("progress_no_body_data_desc")}</p>
          <button type="button" onClick={() => navigate("/body-metrics")} className="mt-5 h-12 w-full rounded-[16px] bg-[#020617] text-[13px] font-black text-white active:scale-[0.98]">{t("progress_add_body_data")}</button>
        </section>
      )}

      {/* Goals Hero Card */}
      <section className="mb-5">
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
                <DualDonut
                  outerPct={goalRingValue}
                  outerColor={goalColor}
                  innerPct={Math.min(bmi, 40) * (100 / 40)}
                  innerColor={bmi < 18.5 ? PROGRESS_COLORS.water : bmi < 25 ? PROGRESS_COLORS.calories : bmi < 30 ? PROGRESS_COLORS.carbs : PROGRESS_COLORS.fat}
                  centerValue={goalRingValue}
                  centerUnit="%"
                  legend={[
                    { color: goalColor, label: t("progress_goal_legend") },
                    { color: bmi < 18.5 ? PROGRESS_COLORS.water : bmi < 25 ? PROGRESS_COLORS.calories : bmi < 30 ? PROGRESS_COLORS.carbs : PROGRESS_COLORS.fat, label: t("progress_bmi") }
                  ]}
                />

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

      {coachProposals.length > 0 && (
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
    </div>
  );
}
