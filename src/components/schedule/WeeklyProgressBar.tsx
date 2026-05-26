import { motion } from "framer-motion";
import { CheckCircle2, Flame, Utensils } from "lucide-react";

interface WeeklyProgressBarProps {
  weekProgressPct: number;
  weekProgress: {
    total: number;
    completed: number;
    calories: number;
  };
}

const WeeklyProgressBar = ({ weekProgressPct, weekProgress }: WeeklyProgressBarProps) => {
  return (
    <div className="mb-[12px] rounded-[26px] border border-[#EEF1F5] bg-white px-[15px] pb-[16px] pt-[15px] shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
      <div className="mb-[16px] flex items-center justify-between">
        <span className="text-[13px] font-black leading-none tracking-[-0.03em] text-[#101B2D]">Weekly Progress</span>
        <span className="bg-gradient-to-r from-[#11C884] to-[#03A96E] bg-clip-text text-[18px] font-black leading-none tracking-[-0.04em] text-transparent">{weekProgressPct}%</span>
      </div>

      <div className="h-[10px] overflow-hidden rounded-full bg-[#EDF0F5]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${weekProgressPct}%` }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
          className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#11C884] via-[#04B978] to-[#03A96E]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </motion.div>
      </div>

      <div className="mt-[18px] grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-[13px]">
        <div className="flex items-center gap-[10px]">
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-[#D8F8E5]">
            <CheckCircle2 className="h-[15px] w-[15px] text-[#00A96E]" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black leading-none text-[#101B2D]">{weekProgress.completed}</p>
            <p className="mt-[5px] text-[11px] font-bold leading-none text-[#939CAE]">Completed</p>
          </div>
        </div>
        <div className="h-[31px] w-px bg-[#EDF0F5]" />
        <div className="flex items-center justify-center gap-[10px]">
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-[#FFF0CF]">
            <Flame className="h-[15px] w-[15px] text-[#F6A400]" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black leading-none text-[#101B2D]">{weekProgress.calories.toLocaleString()}</p>
            <p className="mt-[5px] text-[11px] font-bold leading-none text-[#939CAE]">kcal</p>
          </div>
        </div>
        <div className="h-[31px] w-px bg-[#EDF0F5]" />
        <div className="flex items-center justify-end gap-[10px]">
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-[#E5EEFF]">
            <Utensils className="h-[15px] w-[15px] text-[#2F7BEA]" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black leading-none text-[#101B2D]">{weekProgress.total}</p>
            <p className="mt-[5px] text-[11px] font-bold leading-none text-[#939CAE]">meals</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyProgressBar;
