import { useNavigate } from "react-router-dom";
import { CalendarCheck, Droplet, Flame, Lock, Minus, Plus, Target } from "lucide-react";
import { format } from "date-fns";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWeekdayData } from "@/hooks/useWeekdayData";
import { computeNutritionScore } from "@/lib/nutrition-score";
import { DualDonut } from "@/components/progress/DualDonut";
import { PROGRESS_COLORS } from "./progress-colors";

interface ProgressTodayTabProps {
  selectedDate: Date;
  calendarDate: string;
  setCalendarDate: (v: string) => void;
  showCalendar: boolean;
  setShowCalendar: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export default function ProgressTodayTab({
  selectedDate,
  calendarDate,
  setCalendarDate,
  showCalendar,
  setShowCalendar,
}: ProgressTodayTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { streaks } = useStreak(user?.id);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, 0);
  const { dailySummary: waterSummary, addWater: addWaterIntake, decrementWater } = useWaterIntake(user?.id, selectedDate);
  const { days: weekdayData } = useWeekdayData(user?.id, activeGoal?.daily_calorie_target ?? 2000);
  const { toast } = useToast();
  const { t, language, isRTL } = useLanguage();

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const isSelectedToday = selectedDateKey === format(new Date(), "yyyy-MM-dd");
  const waterGlasses = waterSummary?.total ?? 0;
  const waterTarget = waterSummary?.target ?? 8;

  const handleWaterAdd = async () => {
    if (!user?.id) return;
    try {
      await addWaterIntake(1);
      toast({ description: t("progress_water_added"), duration: 1200 });
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
    toast({ description: t("progress_water_removed"), duration: 1200 });
  };

  return (
    <>
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

      {showCalendar && (
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

      {(() => {
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
        const nutritionScore = computeNutritionScore({
          caloriePct: dailyPct,
          proteinPct,
          hydrationPct,
          weeklyConsistencyPct: isSelectedToday ? weeklyConsistencyPct : undefined,
        });
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
                    <DualDonut
                      outerPct={proteinPct}
                      outerColor="#818CF8"
                      innerPct={Math.min(dailyPct, 100)}
                      innerColor={dailyPct > 100 ? PROGRESS_COLORS.fat : PROGRESS_COLORS.calories}
                      centerValue={calConsumed > 999 ? `${(calConsumed/1000).toFixed(1)}k` : calConsumed}
                      centerUnit={t("progress_kcal_unit")}
                      legend={[
                        { color: dailyPct > 100 ? PROGRESS_COLORS.fat : PROGRESS_COLORS.calories, label: t("cal_label_short") },
                        { color: PROGRESS_COLORS.protein, label: t("protein_label") }
                      ]}
                    />

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

          </div>
        );
      })()}
    </>
  );
}
