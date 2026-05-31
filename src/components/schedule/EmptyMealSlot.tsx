import { KeyboardEvent, MouseEvent } from "react";
import { Clock, X } from "lucide-react";

interface EmptyMealSlotProps {
  config: { icon: React.ComponentType<{ className?: string }>; label: string; gradient: string; bgGradient: string; textColor: string; bgColor: string; borderColor: string; ringColor: string; shadowColor: string; nutritionBg: string; nutritionBorder: string; };
  mealTypeName: string; timeLabel: string; noMealsLeft: boolean; isFirstSlot: boolean;
  onSwipeRight: () => void; onSwipeLeft: () => void; onBuyCredits: () => void;
}

const EmptyMealSlot = ({ config, mealTypeName, timeLabel, noMealsLeft, isFirstSlot, onSwipeRight, onSwipeLeft, onBuyCredits }: EmptyMealSlotProps) => {
  const MealIcon = config.icon;
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSwipeRight(); } };

  return (
    <div role="button" tabIndex={0} onClick={onSwipeRight} onKeyDown={handleCardKeyDown}
      className="flex h-[72px] w-full cursor-pointer items-center rounded-2xl bg-white px-2 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 transition-all active:scale-[0.99]" aria-label={`Add ${mealTypeName}`}>
      <div className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl ${config.bgGradient}`}>
        <MealIcon className={`h-6 w-6 stroke-[2.5] ${config.textColor}`} />
      </div>
      <div className="ml-3.5 min-w-0 flex-1">
        <span className="block text-[12px] font-extrabold uppercase text-slate-800">{mealTypeName}</span>
        <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-400"><Clock className="h-3 w-3 stroke-[2.5]" />{timeLabel}</span>
      </div>

      <div className="flex items-center gap-2 pr-1">
        {!noMealsLeft && (
          <button onClick={(e) => { e.stopPropagation(); onSwipeLeft(); }} className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" aria-label={`Search ${mealTypeName}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); if (noMealsLeft) { onBuyCredits(); return; } onSwipeRight(); }} className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_3px_8px_rgba(16,185,129,0.2)] hover:bg-emerald-600 transition-colors" aria-label={noMealsLeft ? "Buy credits" : `Add ${mealTypeName}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        </button>
      </div>
    </div>
  );
};

export default EmptyMealSlot;
