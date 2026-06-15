import { KeyboardEvent } from "react";
import { Clock } from "lucide-react";

interface EmptyMealSlotProps {
  config: { icon: React.ComponentType<{ className?: string }>; label: string; gradient: string; bgGradient: string; textColor: string; bgColor: string; borderColor: string; ringColor: string; shadowColor: string; nutritionBg: string; nutritionBorder: string; };
  mealTypeName: string; timeLabel: string; noMealsLeft: boolean; isFirstSlot: boolean;
  onSwipeRight: () => void; onSwipeLeft: () => void; onBuyCredits: () => void;
}

const EmptyMealSlot = ({ config, mealTypeName, timeLabel, noMealsLeft, isFirstSlot, onSwipeRight, onSwipeLeft, onBuyCredits }: EmptyMealSlotProps) => {
  const MealIcon = config.icon;
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSwipeRight(); } };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSwipeRight}
      onKeyDown={handleCardKeyDown}
      className="group flex h-[68px] w-full cursor-pointer items-center rounded-[18px] bg-gradient-to-r from-slate-50 to-white px-3.5 text-left ring-1 ring-slate-200 transition-all active:scale-[0.99] active:shadow-[0_0_0_2px_rgba(16,185,129,0.25)] active:ring-emerald-300 active:from-emerald-50/40 active:to-white"
      aria-label={`Add ${mealTypeName}`}
    >
      <div className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full ${config.bgGradient} ring-1 ring-white/60 shadow-sm`}>
        <MealIcon className={`h-5 w-5 stroke-[2.5] ${config.textColor}`} />
      </div>

      <div className="ml-3.5 min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-slate-800">{mealTypeName}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <Clock className="h-3 w-3 stroke-[2.5]" />
          {timeLabel}
        </span>
      </div>

      <div className="flex items-center gap-1.5 pr-0.5">
        {!noMealsLeft && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwipeLeft();
            }}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-all hover:bg-emerald-100 active:scale-90"
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
            if (noMealsLeft) {
              onBuyCredits();
              return;
            }
            onSwipeRight();
          }}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_3px_8px_rgba(16,185,129,0.25)] transition-all hover:shadow-[0_4px_12px_rgba(16,185,129,0.35)] active:scale-90"
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
