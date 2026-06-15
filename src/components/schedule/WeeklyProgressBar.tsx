import { motion } from "framer-motion";
import { CheckCircle2, Flame, Utensils } from "lucide-react";

interface WeeklyProgressBarProps {
  weekProgressPct: number;
  weekProgress: { total: number; completed: number; calories: number; };
}

const WeeklyProgressBar = ({ weekProgressPct, weekProgress }: WeeklyProgressBarProps) => {
  return (
    <div className="mb-3 overflow-hidden rounded-[20px] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[13px] font-extrabold text-slate-800">Weekly Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-[20px] font-extrabold text-transparent leading-none">
            {weekProgressPct}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${weekProgressPct}%` }}
            transition={{ duration: 0.9, type: "spring", bounce: 0.25 }}
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </motion.div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 mt-3 h-px bg-slate-100" />

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 px-0 py-3">
        {/* Completed */}
        <div className="flex flex-col items-center gap-1.5 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-[15px] w-[15px] text-emerald-600" />
          </div>
          <p className="text-[15px] font-extrabold text-slate-800 leading-none">{weekProgress.completed}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Done</p>
        </div>

        {/* Calories */}
        <div className="flex flex-col items-center gap-1.5 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50">
            <Flame className="h-[15px] w-[15px] text-amber-500" />
          </div>
          <p className="text-[15px] font-extrabold text-slate-800 leading-none">{weekProgress.calories.toLocaleString()}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">kcal</p>
        </div>

        {/* Total meals */}
        <div className="flex flex-col items-center gap-1.5 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
            <Utensils className="h-[15px] w-[15px] text-blue-500" />
          </div>
          <p className="text-[15px] font-extrabold text-slate-800 leading-none">{weekProgress.total}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Meals</p>
        </div>
      </div>
    </div>
  );
};

export default WeeklyProgressBar;
