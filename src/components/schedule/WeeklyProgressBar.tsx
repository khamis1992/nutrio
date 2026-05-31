import { motion } from "framer-motion";
import { CheckCircle2, Flame, Utensils } from "lucide-react";

interface WeeklyProgressBarProps { weekProgressPct: number; weekProgress: { total: number; completed: number; calories: number; }; }

const WeeklyProgressBar = ({ weekProgressPct, weekProgress }: WeeklyProgressBarProps) => {
  return (
    <div className="mb-3 rounded-2xl bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[13px] font-extrabold text-slate-800">Weekly Progress</span>
        <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-[18px] font-extrabold text-transparent">{weekProgressPct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <motion.div initial={{ width: 0 }} animate={{ width: `${weekProgressPct}%` }} transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
          className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </motion.div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50"><CheckCircle2 className="h-[14px] w-[14px] text-emerald-600" /></div>
          <div className="min-w-0"><p className="text-[13px] font-extrabold text-slate-800">{weekProgress.completed}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">Completed</p></div>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50"><Flame className="h-[14px] w-[14px] text-amber-500" /></div>
          <div className="min-w-0"><p className="text-[13px] font-extrabold text-slate-800">{weekProgress.calories.toLocaleString()}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">kcal</p></div>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="flex items-center justify-end gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50"><Utensils className="h-[14px] w-[14px] text-blue-500" /></div>
          <div className="min-w-0"><p className="text-[13px] font-extrabold text-slate-800">{weekProgress.total}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">meals</p></div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyProgressBar;
