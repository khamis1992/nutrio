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
      className="group mb-2 flex min-h-[76px] cursor-pointer items-center gap-3 rounded-[20px] border border-dashed border-[#CBD5E1] bg-white/70 p-3 transition active:scale-[0.99] active:bg-white"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${config.bgGradient}`}>
        <config.icon className={`h-5 w-5 ${config.textColor}`} />
      </div>

      <div className={`min-w-0 flex-1 ${isRTL ? "text-right" : "text-left"}`}>
        <span className="text-[14px] font-black text-[#020617]">
          {noMealsLeft
            ? isRTL
              ? `أضف ${mealTypeName} - لا رصيد`
              : `Add ${mealTypeName} - no credits`
            : `${t("add") || "Add"} ${mealTypeName}`}
        </span>
        <p className="mt-0.5 text-[11px] font-semibold leading-tight text-[#94A3B8]">
          {noMealsLeft ? "Buy a meal credit to schedule this slot" : `${timeLabel} delivery window`}
        </p>
      </div>

      {!noMealsLeft ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white shadow-[0_8px_18px_rgba(2,6,23,0.16)]">
          <Plus className="h-4 w-4" strokeWidth={2.7} />
        </span>
      ) : (
        <Chevron className="h-5 w-5 shrink-0 text-[#94A3B8]" strokeWidth={2.5} />
      )}
    </motion.div>
  );
};

export default EmptyMealSlot;
