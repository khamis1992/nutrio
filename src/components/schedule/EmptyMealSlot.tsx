import { KeyboardEvent } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Clock } from "lucide-react";

interface EmptyMealSlotProps {
  config: {
    icon: React.ComponentType<{ className?: string }>;
    label: string; gradient: string; bgGradient: string; textColor: string;
    bgColor: string; borderColor: string; ringColor: string; shadowColor: string;
    nutritionBg: string; nutritionBorder: string;
  };
  mealTypeName: string; timeLabel: string; noMealsLeft: boolean; isFirstSlot: boolean;
  onSwipeRight: () => void; onBuyCredits: () => void;
}

const EmptyMealSlot = ({
  config, mealTypeName, timeLabel, noMealsLeft, onSwipeRight, onBuyCredits,
}: EmptyMealSlotProps) => {
  const { t, isRTL } = useLanguage();
  const MealIcon = config.icon;

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSwipeRight();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSwipeRight}
      onKeyDown={handleCardKeyDown}
      aria-label={`${t("schedule_add_meal")}: ${mealTypeName}`}
      className={`flex h-[72px] w-full cursor-pointer items-center rounded-[18px] bg-white ring-1 ring-slate-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)] px-3 ${isRTL ? "text-right" : "text-left"} transition-all active:scale-[0.99]`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Icon — right side (RTL) */}
      <div className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full ${config.bgGradient}`}>
        <MealIcon className={`h-5 w-5 stroke-[2.5] ${config.textColor}`} />
      </div>

      {/* Text — middle */}
      <div className={`${isRTL ? "ml-3" : "mr-3"} flex-1 min-w-0`}>
        <div className={`flex items-center gap-1.5 ${isRTL ? "justify-start" : "justify-end"}`}>
          <span className="text-[14px] font-extrabold text-slate-900">{mealTypeName}</span>
          <span className={`h-2 w-2 rounded-full ${config.bgColor}`} />
        </div>
        <div className={`flex items-center gap-1 mt-0.5 ${isRTL ? "justify-start" : "justify-end"}`}>
          <span className="text-[11px] font-medium text-slate-400">{timeLabel}</span>
          <Clock className="h-3 w-3 text-slate-400 stroke-[2.5]" />
        </div>
      </div>

      {/* Action button */}
      <div className="flex items-center gap-2 mr-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (noMealsLeft) { onBuyCredits(); return; }
            onSwipeRight();
          }}
          className="flex h-[40px] items-center justify-center gap-1.5 rounded-full bg-emerald-500 text-white px-3 shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600 transition-all active:scale-95 text-[12px] font-bold"
          aria-label={noMealsLeft ? t("schedule_buy_credits") : `${t("schedule_add_meal")}: ${mealTypeName}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          {t("schedule_add_meal")}
        </button>
      </div>
    </div>
  );
};

export default EmptyMealSlot;
