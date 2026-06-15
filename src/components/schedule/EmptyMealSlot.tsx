import { KeyboardEvent } from "react";
import { Clock } from "lucide-react";

interface EmptyMealSlotProps {
  config: {
    icon: React.ComponentType<{ className?: string }>;
    label: string; gradient: string; bgGradient: string; textColor: string;
    bgColor: string; borderColor: string; ringColor: string; shadowColor: string;
    nutritionBg: string; nutritionBorder: string;
  };
  mealTypeName: string; timeLabel: string; noMealsLeft: boolean; isFirstSlot: boolean;
  onSwipeRight: () => void; onSwipeLeft: () => void; onBuyCredits: () => void;
}

const EmptyMealSlot = ({
  config, mealTypeName, timeLabel, noMealsLeft, onSwipeRight, onSwipeLeft, onBuyCredits,
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
      className="flex h-[72px] w-full cursor-pointer items-center rounded-[18px] bg-white ring-1 ring-slate-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)] px-3 text-left transition-all active:scale-[0.99]"
      dir="rtl"
    >
      {/* Icon — right side (RTL) */}
      <div className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full ${config.bgGradient}`}>
        <MealIcon className={`h-5 w-5 stroke-[2.5] ${config.textColor}`} />
      </div>

      {/* Text — middle */}
      <div className="mr-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-[14px] font-extrabold text-slate-900">{mealTypeName}</span>
          <span className={`h-2 w-2 rounded-full ${config.bgColor}`} />
        </div>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[11px] font-medium text-slate-400">{timeLabel}</span>
          <Clock className="h-3 w-3 text-slate-400 stroke-[2.5]" />
        </div>
      </div>

      {/* Action buttons — left side (RTL) */}
      <div className="flex items-center gap-2 mr-2">
        {!noMealsLeft && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwipeLeft(); }}
            className="flex h-[40px] items-center justify-center gap-1.5 rounded-full bg-slate-100 text-slate-600 px-3 hover:bg-slate-200 transition-colors text-[12px] font-bold"
            aria-label={`Search ${mealTypeName}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            تصفح
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (noMealsLeft) { onBuyCredits(); return; }
            onSwipeRight();
          }}
          className="flex h-[40px] items-center justify-center gap-1.5 rounded-full bg-emerald-500 text-white px-3 shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600 transition-all active:scale-95 text-[12px] font-bold"
          aria-label={noMealsLeft ? "Buy credits" : `Add ${mealTypeName}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          إضافة
        </button>
      </div>
    </div>
  );
};

export default EmptyMealSlot;
