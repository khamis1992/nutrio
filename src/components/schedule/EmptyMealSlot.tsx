import { KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface EmptyMealSlotProps {
  config: {
    icon: React.ComponentType<{ className?: string }>;
    label: string; gradient: string; bgGradient: string; textColor: string;
    bgColor: string; borderColor: string; ringColor: string; shadowColor: string;
    nutritionBg: string; nutritionBorder: string;
  };
  mealTypeName: string; timeLabel: string; noMealsLeft: boolean; isFirstSlot: boolean;
  onSwipeRight: () => void; onBuyCredits: () => void; onSwipeLeft?: () => void;
}

const EmptyMealSlot = ({
  config, mealTypeName, timeLabel, noMealsLeft, onSwipeRight, onBuyCredits,
}: EmptyMealSlotProps) => {
  const { t, isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (noMealsLeft) { onBuyCredits(); return; }
      onSwipeRight();
    }
  };

  const handleClick = () => {
    if (noMealsLeft) { onBuyCredits(); return; }
    onSwipeRight();
  };

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${t("schedule_add_meal")}: ${mealTypeName}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      className="mb-2 flex cursor-pointer items-center gap-4 rounded-[24px] border border-white/80 bg-white/90 p-4 backdrop-blur-xl transition-all hover:bg-white/95 active:bg-white/80"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${config.bgGradient}`}>
        <config.icon className={`h-5 w-5 ${config.textColor}`} />
      </div>

      <div className={`flex-1 min-w-0 ${isRTL ? "text-right" : "text-left"}`}>
        <span className="text-[16px] font-bold text-slate-900">
          {noMealsLeft
            ? (isRTL ? `أضف ${mealTypeName} — لا رصيد` : `Add ${mealTypeName} — no credits`)
            : `${t("schedule_add_meal")} ${mealTypeName}`}
        </span>
        <p className="text-[13px] text-slate-400 font-medium leading-tight mt-0.5">{timeLabel}</p>
      </div>

      {!noMealsLeft && (
        <span className="flex h-9 shrink-0 items-center rounded-full bg-emerald-500 px-4 text-[14px] font-bold text-white shadow-lg shadow-emerald-500/30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t("add")}
        </span>
      )}
      {noMealsLeft && <Chevron className="h-5 w-5 text-slate-300" strokeWidth={2.5} />}
    </motion.div>
  );
};

export default EmptyMealSlot;