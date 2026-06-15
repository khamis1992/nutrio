import { KeyboardEvent } from "react";
import { Clock } from "lucide-react";

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
  onSwipeLeft: () => void;
  onBuyCredits: () => void;
}

const EmptyMealSlot = ({
  config,
  mealTypeName,
  timeLabel,
  noMealsLeft,
  onSwipeRight,
  onSwipeLeft,
  onBuyCredits,
}: EmptyMealSlotProps) => {
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
      aria-label={`Add ${mealTypeName}`}
      className="flex h-[76px] w-full cursor-pointer items-center rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-3 text-left backdrop-blur-sm transition-all active:scale-[0.99] hover:border-emerald-300 hover:bg-emerald-50/30"
    >
      {/* Icon */}
      <div className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] ${config.bgGradient} opacity-80`}>
        <MealIcon className={`h-5 w-5 stroke-[2.5] ${config.textColor}`} />
      </div>

      {/* Text */}
      <div className="ml-3.5 min-w-0 flex-1">
        <span className={`block text-[11px] font-extrabold uppercase tracking-wider ${config.textColor} opacity-80`}>
          {mealTypeName}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <Clock className="h-3 w-3 stroke-[2.5]" />
          {timeLabel}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pr-1">
        {!noMealsLeft && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwipeLeft(); }}
            className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            aria-label={`Search ${mealTypeName}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (noMealsLeft) { onBuyCredits(); return; }
            onSwipeRight();
          }}
          className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600 transition-all active:scale-95"
          aria-label={noMealsLeft ? "Buy credits" : `Add ${mealTypeName}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default EmptyMealSlot;
