import { motion } from "framer-motion";
import { Flame, Target, Utensils, CalendarCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface WeeklyProgressBarProps {
  weekProgressPct: number;
  weekProgress: { total: number; completed: number; calories: number };
}

const WeeklyProgressBar = ({ weekProgressPct, weekProgress }: WeeklyProgressBarProps) => {
  const { isRTL } = useLanguage();
  const pct = Math.max(0, Math.min(100, weekProgressPct || 0));
  const hasMeals = weekProgress.total > 0;

  // Stroke dash for circular progress
  const radius = 30;
  const circumference = 2 * Math.PI * radius;

  const stats = [
    {
      icon: CalendarCheck,
      labelKey: "schedule_done_days",
      labelAR: "الأيام المكتملة",
      labelEN: "Done Days",
      value: hasMeals ? weekProgress.completed : 0,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: Utensils,
      labelKey: "schedule_total_meals",
      labelAR: "إجمالي الوجبات",
      labelEN: "Total Meals",
      value: weekProgress.total,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Target,
      labelKey: "schedule_avg_commit",
      labelAR: "متوسط الالتزام",
      labelEN: "Avg Commit",
      value: `${pct}%`,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      icon: Flame,
      labelKey: "schedule_day_streak",
      labelAR: "سلسلة الأيام",
      labelEN: "Day Streak",
      value: hasMeals ? weekProgress.completed : 0,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-center px-4 pt-4 pb-3 border-b border-slate-50">
        <h3 className="text-[15px] font-extrabold text-slate-900 text-center">
          {isRTL ? "ملخص الأسبوع" : "Week Summary"}
        </h3>
      </div>

      {/* ── Body: 2-col stats grid + circular progress ── */}
      <div className={`flex items-center gap-4 px-4 py-4 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
        {/* KPI Grid — CSS Grid for perfect alignment */}
        <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            const label = isRTL ? stat.labelAR : stat.labelEN;
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 ${isRTL ? "flex-row-reverse text-right" : "flex-row text-left"}`}
              >
                {/* Icon badge */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}
                >
                  <Icon className={`h-4 w-4 ${stat.color}`} strokeWidth={2.5} />
                </div>
                {/* Label + value stacked */}
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-semibold text-slate-400 leading-tight truncate">
                    {label}
                  </span>
                  <motion.span
                    key={String(stat.value)}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-[17px] font-black leading-tight ${stat.color}`}
                  >
                    {stat.value}
                  </motion.span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Circular progress — perfectly centered in its column */}
        <div className="relative flex h-[80px] w-[80px] shrink-0 items-center justify-center">
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            className="-rotate-90"
          >
            {/* Track */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="7"
            />
            {/* Progress arc */}
            <motion.circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="#10b981"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{
                strokeDashoffset: circumference - (pct / 100) * circumference,
              }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
          </svg>
          {/* Percentage label centered inside the ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-black text-emerald-600 leading-none">
              {pct}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Empty-state message ── */}
      {!hasMeals && (
        <div className="border-t border-slate-50 px-4 py-3 flex items-center justify-center gap-2">
          <span className="text-lg">🌿</span>
          <span className="text-[12px] font-semibold text-slate-400">
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
