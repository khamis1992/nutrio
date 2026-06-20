import { KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

interface EmptyMealSlotProps {
  config: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    gradient: string;
    bgGradient: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    ringColor: string;
    shadowColor: string;
    nutritionBg: string;
    nutritionBorder: string;
  };
  mealTypeName: string;
  timeLabel: string;
  noMealsLeft: boolean;
  isFirstSlot: boolean;
  onSwipeRight: () => void;
  onBuyCredits: () => void;
  onSwipeLeft?: () => void;
}

const EmptyMealSlot = ({
  config,
  mealTypeName,
  timeLabel,
  noMealsLeft,
  onSwipeRight,
  onBuyCredits,
}: EmptyMealSlotProps) => {
  const { t, isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const activate = () => {
    if (noMealsLeft) {
      onBuyCredits();
      return;
    }
    onSwipeRight();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={handleKeyDown}
      aria-label={`${t("schedule_add_meal")}: ${mealTypeName}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      className="group mb-2 flex cursor-pointer items-center gap-4 rounded-[24px] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.09)] active:bg-white/80"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${config.bgGradient} ring-1 ring-white/70`}>
        <config.icon className={`h-5 w-5 ${config.textColor}`} />
      </div>

      <div className={`min-w-0 flex-1 ${isRTL ? "text-right" : "text-left"}`}>
        <span className="text-[16px] font-black text-slate-950">
          {noMealsLeft
            ? isRTL
              ? `أضف ${mealTypeName} - لا رصيد`
              : `Add ${mealTypeName} - no credits`
            : `${t("add") || "Add"} ${mealTypeName}`}
        </span>
        <p className="mt-1 text-[13px] font-semibold leading-tight text-slate-500">
          {noMealsLeft ? "Buy a meal credit to schedule this slot" : `${timeLabel} delivery window`}
        </p>
      </div>

      {!noMealsLeft ? (
        <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-950 px-4 text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition group-hover:bg-emerald-600">
          <Plus className="h-4 w-4" strokeWidth={2.7} />
          {t("add")}
        </span>
      ) : (
        <Chevron className="h-5 w-5 shrink-0 text-slate-300" strokeWidth={2.5} />
      )}
    </motion.div>
  );
};

export default EmptyMealSlot;
