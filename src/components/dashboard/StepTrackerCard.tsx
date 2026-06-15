import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Footprints, Target } from "lucide-react";
import { getStepData, mergeHealthSteps, setDailyGoal, type StepData } from "@/lib/stepStore";
import { getCachedHealthData } from "@/lib/healthKit";

export function StepTrackerCard() {
  const { t } = useLanguage();
  const [data, setData] = useState<StepData>(() => getStepData());
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(data.dailyGoal));

  useEffect(() => {
    const health = getCachedHealthData();
    if (health?.steps) {
      const merged = mergeHealthSteps(health.steps);
      setData(merged);
    }
  }, []);

  const pct = Math.min(100, Math.round((data.today.steps / data.dailyGoal) * 100));
  const remaining = Math.max(0, data.dailyGoal - data.today.steps);

  const handleSaveGoal = () => {
    const goal = parseInt(goalInput, 10);
    if (!isNaN(goal) && goal >= 1000 && goal <= 50000) {
      const updated = setDailyGoal(goal);
      setData(updated);
    }
    setEditingGoal(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-sm">
            <Footprints className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] font-extrabold text-slate-900">{t("steps")}</p>
            {editingGoal ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onBlur={handleSaveGoal}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveGoal()}
                  className="w-16 h-5 text-[11px] font-semibold px-1 rounded border border-slate-200 text-slate-600"
                  autoFocus
                />
              </div>
            ) : (
              <button
                onClick={() => { setEditingGoal(true); setGoalInput(String(data.dailyGoal)); }}
                className="text-[11px] text-slate-400 flex items-center gap-1 hover:text-purple-500 transition-colors"
              >
                <Target className="h-3 w-3" />
                Goal: {data.dailyGoal.toLocaleString()}
              </button>
            )}
          </div>
        </div>
        <span className="text-[28px] font-extrabold tabular-nums text-slate-900">
          {data.today.steps.toLocaleString()}
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500"
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] font-semibold text-slate-400">
          {pct}% of daily goal
        </p>
        {data.today.synced && (
          <span className="text-[10px] text-purple-400 font-medium">
            synced from health app
          </span>
        )}
        {remaining > 0 ? (
          <p className="text-[11px] font-semibold text-purple-500">
            {t("steps_to_go", { count: String(remaining) })}
          </p>
        ) : (
          <p className="text-[11px] font-semibold text-emerald-500">{t("goal_reached")}</p>
        )}
      </div>
    </motion.div>
  );
}
