import { Activity, Droplets, Loader2, Minus, Plus, Salad, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAdherenceGoals } from "@/hooks/useAdherenceGoals";
import { adherenceProgressPercent } from "@/lib/adherence";
import type { AdherenceGoalSummary } from "@/lib/adherence";

const icons = { meal_logging: Salad, activity: Activity, water: Droplets };

const adherenceCopy = {
  en: {
    eyebrow: "Flexible goals",
    title: "Adherence strength",
    description: "Choose a weekly frequency. One missed day will not reset your progress; recent weeks carry more weight.",
    retry: "Try again",
    error: "Could not load adherence goals.",
    complete: "This week's goal is complete",
    remaining: (days: number) => `${days} day(s) remaining this week`,
    days: (completed: number, frequency: number) => `${completed}/${frequency} days`,
    decrease: (name: string) => `Decrease ${name} frequency`,
    increase: (name: string) => `Increase ${name} frequency`,
    metric: { meal_logging: "Meal logging", activity: "Activity", water: "Hydration" },
  },
  ar: {
    eyebrow: "أهداف مرنة",
    title: "قوة الالتزام",
    description: "اختر عدد الأيام الأسبوعية. لن يعيد يوم فائت تقدمك إلى الصفر؛ وتحظى الأسابيع الحديثة بوزن أكبر.",
    retry: "إعادة المحاولة",
    error: "تعذر تحميل أهداف الالتزام.",
    complete: "اكتمل هدف هذا الأسبوع",
    remaining: (days: number) => `متبقي ${days} يوم هذا الأسبوع`,
    days: (completed: number, frequency: number) => `${completed}/${frequency} أيام`,
    decrease: (name: string) => `تقليل تكرار ${name}`,
    increase: (name: string) => `زيادة تكرار ${name}`,
    metric: { meal_logging: "تسجيل الوجبات", activity: "النشاط", water: "شرب الماء" },
  },
} as const;

type AdherenceCopy = (typeof adherenceCopy)["en" | "ar"];

export function AdherenceStrengthCard() {
  const { language, isRTL } = useLanguage();
  const { data, isLoading, isError, refetch, updateGoal } = useAdherenceGoals();
  const labels: AdherenceCopy = adherenceCopy[language];

  const changeFrequency = async (goal: AdherenceGoalSummary, delta: number) => {
    const frequency = Math.min(7, Math.max(1, goal.frequency_per_week + delta));
    if (frequency === goal.frequency_per_week) return;
    try {
      await updateGoal.mutateAsync({ ...goal, frequency_per_week: frequency });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.error);
    }
  };

  return (
    <section dir={isRTL ? "rtl" : "ltr"} className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(12,18,34,0.055)]">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-[#EAFBF6] text-[#20C7A5]">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#20A98D]">{labels.eyebrow}</p>
          <h2 className="mt-1 text-[18px] font-black text-[#0C1222]">{labels.title}</h2>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-[#6E7689]">{labels.description}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid h-28 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#20C7A5]" /></div>
      ) : isError ? (
        <div className="mt-4 rounded-[18px] bg-[#FFF4F5] p-3 text-center">
          <p className="text-[12px] font-bold text-[#C43F52]">{labels.error}</p>
          <button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 px-4 text-[12px] font-black text-[#0C1222]">{labels.retry}</button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {(data?.goals ?? []).map((goal) => (
            <GoalRow key={goal.id || goal.metric} goal={goal} labels={labels} disabled={updateGoal.isPending} onChange={changeFrequency} />
          ))}
        </div>
      )}
    </section>
  );
}

function GoalRow({ goal, labels, disabled, onChange }: {
  goal: AdherenceGoalSummary;
  labels: AdherenceCopy;
  disabled: boolean;
  onChange: (goal: AdherenceGoalSummary, delta: number) => Promise<void>;
}) {
  const Icon = icons[goal.metric];
  const name = labels.metric[goal.metric];
  const progress = adherenceProgressPercent(goal);
  const explanation = goal.remaining_days === 0 ? labels.complete : labels.remaining(goal.remaining_days);

  return (
    <div className="rounded-[22px] bg-[#F6F8FC] p-3 ring-1 ring-[#E5EAF1]">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-white text-[#6674F4] ring-1 ring-[#E5EAF1]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] font-black text-[#0C1222]">{name}</p>
            <p className="text-[13px] font-black text-[#20A98D]">{goal.strength}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#20C7A5] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] font-bold text-[#6E7689]">{explanation}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#E5EAF1] pt-3">
        <p className="text-[11px] font-extrabold text-[#6E7689]">{labels.days(goal.completed_days, goal.frequency_per_week)}</p>
        <div className="flex items-center gap-1.5">
          <button type="button" disabled={disabled || goal.frequency_per_week <= 1} onClick={() => void onChange(goal, -1)} aria-label={labels.decrease(name)} className="grid h-11 w-11 place-items-center rounded-[15px] bg-white text-[#0C1222] ring-1 ring-[#E5EAF1] disabled:opacity-35"><Minus className="h-4 w-4" /></button>
          <span className="min-w-8 text-center text-[13px] font-black text-[#0C1222]">{goal.frequency_per_week}</span>
          <button type="button" disabled={disabled || goal.frequency_per_week >= 7} onClick={() => void onChange(goal, 1)} aria-label={labels.increase(name)} className="grid h-11 w-11 place-items-center rounded-[15px] bg-white text-[#0C1222] ring-1 ring-[#E5EAF1] disabled:opacity-35"><Plus className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
