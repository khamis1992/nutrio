import type { ReactNode } from "react";
import { ArrowLeft, Droplets, Salad } from "lucide-react";

import trackActionsArtwork from "@/assets/rewards/track-actions.webp";
import { cn } from "@/lib/utils";

type EarnActionsImageCardProps = {
  mealLabel: string;
  mealDescription: string;
  waterLabel: string;
  waterDescription: string;
  isRTL: boolean;
  onLogMeal: () => void;
  onTrackWater: () => void;
  className?: string;
};

export function EarnActionsImageCard({
  mealLabel,
  mealDescription,
  waterLabel,
  waterDescription,
  isRTL,
  onLogMeal,
  onTrackWater,
  className,
}: EarnActionsImageCardProps) {
  if (isRTL) {
    return (
      <div dir="rtl" className={cn("grid grid-cols-2 gap-3", className)}>
        <ActionCard
          label={mealLabel}
          description={mealDescription}
          icon={<Salad className="h-7 w-7" />}
          tone="text-[#15977F] bg-[#E9FBF7]"
          onClick={onLogMeal}
          testId="rewards-log-meal-action"
        />
        <ActionCard
          label={waterLabel}
          description={waterDescription}
          icon={<Droplets className="h-7 w-7" />}
          tone="text-[#1A86E8] bg-[#ECF6FF]"
          onClick={onTrackWater}
          testId="rewards-track-water-action"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-[1448/1086] w-full overflow-hidden rounded-[22px] bg-white shadow-[0_14px_34px_rgba(24,48,72,0.07)]",
        className,
      )}
    >
      <img
        src={trackActionsArtwork}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        draggable={false}
      />

      <button
        type="button"
        onClick={onLogMeal}
        aria-label={mealLabel}
        data-testid="rewards-log-meal-action"
        className="absolute bottom-[8.5%] left-[5.2%] top-[10.2%] w-[43.2%] rounded-[18px] transition-colors hover:bg-[#20C7A5]/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20C7A5]/55 active:bg-[#20C7A5]/[0.055]"
      />

      <button
        type="button"
        onClick={onTrackWater}
        aria-label={waterLabel}
        data-testid="rewards-track-water-action"
        className="absolute bottom-[8.5%] right-[4.6%] top-[10.2%] w-[43.2%] rounded-[18px] transition-colors hover:bg-[#1A86E8]/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1A86E8]/55 active:bg-[#1A86E8]/[0.055]"
      />
    </div>
  );
}

function ActionCard({ label, description, icon, tone, onClick, testId }: {
  label: string;
  description: string;
  icon: ReactNode;
  tone: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-[210px] flex-col items-start rounded-[22px] bg-white p-4 text-start shadow-[0_14px_34px_rgba(24,48,72,0.07)] ring-1 ring-[#E5EAF1] active:scale-[0.98]"
    >
      <span className={cn("grid h-14 w-14 place-items-center rounded-[18px]", tone)}>{icon}</span>
      <span className="mt-5 text-[17px] font-black text-[#0C1222]">{label}</span>
      <span className="mt-2 text-[11px] font-semibold leading-5 text-[#6E7689]">{description}</span>
      <span className="mt-auto flex items-center gap-2 pt-4 text-[12px] font-black text-[#20A98D]">
        {label}
        <ArrowLeft className="h-4 w-4" />
      </span>
    </button>
  );
}
