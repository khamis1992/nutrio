import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface WeeklyProgressBarProps {
  weekProgressPct: number;
  weekProgress: { total: number; completed: number; calories: number };
}

const getStreakLabel = (pct: number) => {
  if (pct >= 100) return "Perfect week!";
  if (pct >= 75) return "Almost there";
  if (pct >= 50) return "Halfway done";
  if (pct >= 25) return "Good start";
  return "Getting started";
};

const WeeklyProgressBar = ({ weekProgressPct, weekProgress }: WeeklyProgressBarProps) => {
  const pct = Math.max(0, Math.min(100, weekProgressPct || 0));
  const streakLabel = getStreakLabel(pct);
  const hasMeals = weekProgress.total > 0;

  return (
    <div className="mb-3 overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
      <div className="px-4 pt-4 pb-0.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50">
            <Flame className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Week</span>
          <div className="h-px flex-1 bg-slate-100" />
          {hasMeals && (
            <motion.span
              key={pct}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[13px] font-bold text-slate-700"
            >
              {streakLabel}
            </motion.span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, #34D399 0%, #10B981 50%, #059669 100%)",
                boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
              }}
            />
            <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0))" }} />
          </div>
          <motion.div
            key={pct}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="shrink-0 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
          >
            {pct}%
          </motion.div>
        </div>

        {hasMeals && (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[17px] font-black text-slate-900">{weekProgress.completed}</span>
              <span className="text-[10px] font-semibold text-slate-400">/ {weekProgress.total} meals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-black text-emerald-600">{weekProgress.calories.toLocaleString()}</span>
              <span className="text-[10px] font-semibold text-slate-400">kcal</span>
            </div>
          </div>
        )}

        {!hasMeals && (
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="text-center text-[12px] font-semibold text-slate-400">No meals scheduled this week</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyProgressBar;
