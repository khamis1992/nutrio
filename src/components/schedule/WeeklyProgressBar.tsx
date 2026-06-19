import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Check, Flame, Utensils } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface WeeklyProgressBarProps {
  weekProgressPct: number;
  weekProgress: { total: number; completed: number; calories: number };
  remainingMeals: number;
  isUnlimited: boolean;
  hasActiveSubscription: boolean;
}

const AnimatedNumber = ({ target, duration = 1.2, delay = 0, className }: { target: number; duration?: number; delay?: number; className?: string }) => {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(0, target, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, duration, delay, reduceMotion]);

  return <span className={className}>{value.toLocaleString()}</span>;
};

const cardItem = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.35 + i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const WeeklyProgressBar = ({ weekProgressPct, weekProgress, remainingMeals, isUnlimited, hasActiveSubscription }: WeeklyProgressBarProps) => {
  const { isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(100, weekProgressPct || 0));
  const hasMeals = weekProgress.total > 0;

  const ringSize = 76;
  const strokeW = 6;
  const radius = (ringSize - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  const statusLabel = isRTL
    ? pct >= 75 ? "إنجاز رائع"
      : pct >= 50 ? "في منتصف الطريق"
      : pct > 0 ? "ابدأ الآن"
      : "لا توجد وجبات بعد"
    : pct >= 75 ? "Great progress"
      : pct >= 50 ? "Halfway there"
      : pct > 0 ? "Just getting started"
      : "No meals yet";

  const statusColor =
    pct >= 75 ? "text-emerald-600"
    : pct >= 50 ? "text-emerald-500"
    : pct > 0 ? "text-amber-500"
    : "text-slate-400";

  const tiles = [
    {
      icon: Check,
      labelEN: "Done",
      labelAR: "تم",
      value: hasMeals ? `${weekProgress.completed}/${weekProgress.total}` : "0/0",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: Flame,
      labelEN: "kcal",
      labelAR: "سعرة",
      value: hasMeals ? weekProgress.calories.toLocaleString() : "0",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      icon: Utensils,
      labelEN: "Meals",
      labelAR: "وجبات",
      value: weekProgress.total,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="mb-4 overflow-hidden rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between mb-4" dir={isRTL ? "rtl" : "ltr"}>
        <h3 className="text-[18px] font-black text-slate-950 tracking-tight">
          {isRTL ? "ملخص الأسبوع" : "Week Summary"}
        </h3>

        {hasActiveSubscription && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-[0_4px_12px_rgba(15,23,42,0.04)] ${
              remainingMeals <= 0 && !isUnlimited
                ? "bg-red-50 ring-1 ring-red-100"
                : remainingMeals <= 3 && !isUnlimited
                ? "bg-amber-50 ring-1 ring-amber-100"
                : "bg-emerald-50 ring-1 ring-emerald-100"
            }`}
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
              remainingMeals <= 0 && !isUnlimited
                ? "bg-red-100"
                : remainingMeals <= 3 && !isUnlimited
                ? "bg-amber-100"
                : "bg-emerald-100"
            }`}>
              <Utensils className={`h-3.5 w-3.5 ${
                remainingMeals <= 0 && !isUnlimited
                  ? "text-red-600"
                  : remainingMeals <= 3 && !isUnlimited
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className={`text-[16px] font-black tabular-nums ${
                remainingMeals <= 0 && !isUnlimited
                  ? "text-red-600"
                  : remainingMeals <= 3 && !isUnlimited
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}>
                {isUnlimited ? "∞" : remainingMeals}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-wide ${
                remainingMeals <= 0 && !isUnlimited
                  ? "text-red-500"
                  : remainingMeals <= 3 && !isUnlimited
                  ? "text-amber-500"
                  : "text-emerald-500"
              }`}>
                {isRTL ? "متاح" : "meals left"}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="#ECFDF5"
              strokeWidth={strokeW}
            />
            <motion.circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="#10B981"
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={reduceMotion ? false : { strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-black tabular-nums text-slate-950 leading-none">
              <AnimatedNumber target={pct} delay={0.3} />
            </span>
            <span className="text-[9px] font-bold text-slate-400 leading-none mt-0.5">%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-black ${statusColor}`}>
            {statusLabel}
          </p>
          <p className="text-[13px] font-semibold text-slate-400 mt-0.5">
            {hasMeals
              ? (isRTL
                ? `${weekProgress.completed} من ${weekProgress.total} وجبة مجدولة اكتملت`
                : `${weekProgress.completed} of ${weekProgress.total} scheduled meals completed`)
              : (isRTL ? "لا توجد وجبات مجدولة هذا الأسبوع" : "No meals scheduled this week yet")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          const label = isRTL ? tile.labelAR : tile.labelEN;
          return (
            <motion.div
              key={i}
              custom={i}
              variants={cardItem}
              initial={reduceMotion ? "visible" : "hidden"}
              animate="visible"
              className="flex flex-col items-center justify-center gap-1 rounded-[20px] border border-white/60 bg-white/80 px-2 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] backdrop-blur-sm"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-2xl ${tile.bg} mb-0.5`}>
                <Icon className={`h-4 w-4 ${tile.color}`} strokeWidth={2.5} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 leading-tight">
                {label}
              </span>
              <span className="text-[16px] font-black leading-tight text-slate-950 tabular-nums">
                {tile.value}
              </span>
            </motion.div>
          );
        })}
      </div>

      {!hasMeals && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-[20px] border border-white/60 bg-white/50 py-3">
          <span className="text-lg">🌿</span>
          <span className="text-[12px] font-bold text-slate-400">
            {isRTL
              ? "لا توجد وجبات مجدولة هذا الأسبوع"
              : "No meals scheduled this week"}
          </span>
        </div>
      )}
    </motion.div>
  );
};

export default WeeklyProgressBar;