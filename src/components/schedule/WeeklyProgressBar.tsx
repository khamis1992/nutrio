import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { CalendarCheck2, Check, Flame, Gauge, Utensils } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface WeeklyProgressBarProps {
  weekProgressPct: number;
  weekProgress: { total: number; completed: number; calories: number };
  remainingMeals: number;
  isUnlimited: boolean;
  hasActiveSubscription: boolean;
}

const AnimatedNumber = ({ target }: { target: number }) => {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return;
    }

    const controls = animate(value, target, {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setValue(Math.round(latest)),
    });

    return () => controls.stop();
  }, [reduceMotion, target, value]);

  return <>{value.toLocaleString()}</>;
};

const WeeklyProgressBar = ({
  weekProgressPct,
  weekProgress,
  remainingMeals,
  isUnlimited,
  hasActiveSubscription,
}: WeeklyProgressBarProps) => {
  const { isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(100, weekProgressPct || 0));
  const hasMeals = weekProgress.total > 0;
  const statusLabel = pct >= 75 ? "Great progress" : pct >= 40 ? "Building momentum" : hasMeals ? "Week in progress" : "Ready to plan";
  const mealsLeft = isUnlimited ? "Unlimited" : Math.max(remainingMeals, 0).toLocaleString();

  const stats = [
    {
      icon: Check,
      label: "Completed",
      value: hasMeals ? `${weekProgress.completed}/${weekProgress.total}` : "0/0",
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      icon: Flame,
      label: "Logged kcal",
      value: weekProgress.calories.toLocaleString(),
      tone: "bg-amber-50 text-amber-700",
    },
    {
      icon: Utensils,
      label: hasActiveSubscription ? "Meals left" : "Plan status",
      value: hasActiveSubscription ? mealsLeft : "Inactive",
      tone: "bg-sky-50 text-sky-700",
    },
  ];

  return (
    <motion.section
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">
            {isRTL ? "ملخص الأسبوع" : "Week summary"}
          </p>
          <h2 className="mt-1 text-[21px] font-black tracking-normal text-slate-950">{statusLabel}</h2>
          <p className="mt-1 max-w-[360px] text-[13px] font-medium leading-relaxed text-slate-500">
            {hasMeals
              ? `${weekProgress.completed} of ${weekProgress.total} scheduled meals are completed.`
              : "No meals scheduled this week yet. Start with one meal slot below."}
          </p>
        </div>

        <div className="relative flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[22px] bg-slate-950 text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)]">
          <Gauge className="absolute h-11 w-11 text-white/[0.07]" strokeWidth={1.8} />
          <div className="relative z-10 text-center">
            <p className="text-[28px] font-black leading-none tabular-nums text-white drop-shadow-sm">
              <AnimatedNumber target={pct} />
            </p>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/70">%</p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex min-h-[108px] flex-col items-center justify-center rounded-[18px] bg-slate-50 p-3 text-center ring-1 ring-slate-100">
              <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${stat.tone}`}>
                <Icon className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <p className="mt-3 w-full truncate text-[16px] font-black tabular-nums text-slate-950">{stat.value}</p>
              <p className="mt-0.5 w-full truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {!hasMeals && (
        <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-emerald-50 p-3 text-emerald-800 ring-1 ring-emerald-100">
          <CalendarCheck2 className="h-5 w-5 shrink-0" strokeWidth={2.4} />
          <p className="text-[12px] font-bold">Build your week one slot at a time.</p>
        </div>
      )}
    </motion.section>
  );
};

export default WeeklyProgressBar;
