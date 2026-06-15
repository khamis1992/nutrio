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
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (pct / 100) * circumference;

  const stats = [
    {
      icon: CalendarCheck,
      label: isRTL ? "الأيام المكملة" : "Done Days",
      value: hasMeals ? weekProgress.completed : 0,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: Utensils,
      label: isRTL ? "الوجبات الإجمالية" : "Total Meals",
      value: weekProgress.total,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Target,
      label: isRTL ? "متوسط الالتزام" : "Avg Commit",
      value: `${pct}%`,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      icon: Flame,
      label: isRTL ? "سلسلة الأيام" : "Day Streak",
      value: hasMeals ? weekProgress.completed : 0,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="mb-3 overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-50">
        <p className="text-[11px] font-semibold text-slate-400">
          {isRTL ? "تقدمك نحو أهدافك" : "Progress toward your goals"}
        </p>
        <h3 className="text-[15px] font-extrabold text-slate-900">
          {isRTL ? "ملخص الأسبوع" : "Week Summary"}
        </h3>
      </div>

      {/* Body: stats + circular progress */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* 4 stats grid */}
        <div className="flex flex-1 flex-wrap gap-y-3">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="flex w-1/2 flex-col items-end gap-0.5 pr-2">
                <span className="text-[10px] font-semibold text-slate-400">{stat.label}</span>
                <div className="flex items-center gap-1.5">
                  <motion.span
                    key={String(stat.value)}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-[18px] font-black ${stat.color}`}
                  >
                    {stat.value}
                  </motion.span>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md ${stat.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${stat.color}`} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Circular progress */}
        <div className="relative flex h-[80px] w-[80px] shrink-0 items-center justify-center">
          <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <motion.circle
              cx="40" cy="40" r={radius}
              fill="none"
              stroke="#10b981"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - strokeDash }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-[16px] font-black text-emerald-600">{pct}%</span>
          </div>
        </div>
      </div>

      {/* No meals message */}
      {!hasMeals && (
        <div className="border-t border-slate-50 px-4 py-3 flex items-center justify-end gap-2">
          <span className="text-[12px] font-semibold text-slate-400">
            {isRTL ? "لا توجد وجبات مجدولة هذا الأسبوع" : "No meals scheduled this week"}
          </span>
          <span className="text-lg">🌿</span>
        </div>
      )}
    </div>
  );
};

export default WeeklyProgressBar;
