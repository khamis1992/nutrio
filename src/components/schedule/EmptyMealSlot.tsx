import { KeyboardEvent, MouseEvent } from "react";
import {
  Clock,
  X,
} from "lucide-react";

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
  isFirstSlot,
  onSwipeRight,
  onSwipeLeft,
  onBuyCredits,
}: EmptyMealSlotProps) => {
  const MealIcon = config.icon;

  const handleActionClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (noMealsLeft) {
      onBuyCredits();
      return;
    }
    onSwipeLeft();
  };

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
      className="flex h-[75px] w-full cursor-pointer items-center rounded-[24px] border border-[#EDF0F4] bg-white px-[8px] text-left shadow-[0_10px_28px_rgba(15,23,42,0.055)] transition-all active:scale-[0.99]"
      aria-label={`Add ${mealTypeName}`}
    >
      <div className={`flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[20px] ${config.bgGradient}`}>
        <MealIcon className={`h-[27px] w-[27px] stroke-[2.5] ${config.textColor}`} />
      </div>

      <div className="ml-[15px] min-w-0 flex-1">
        <span className="block text-[12px] font-black uppercase leading-none tracking-[-0.03em] text-[#142033]">
          {mealTypeName}
        </span>
        <span className="mt-[10px] flex items-center gap-[5px] text-[12px] font-bold leading-none text-[#98A2B4]">
          <Clock className="h-[12px] w-[12px] stroke-[2.4]" />
          {timeLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={handleActionClick}
        className="mr-[5px] flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F4F6F8] text-[#6E7888] transition-all active:scale-95"
        aria-label={noMealsLeft ? "Buy meal credits" : isFirstSlot ? "Auto fill meals" : `Auto fill ${mealTypeName}`}
      >
        <X className="h-[18px] w-[18px] stroke-[2.5]" />
      </button>
    </div>
  );
};

export default EmptyMealSlot;
