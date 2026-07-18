import trackActionsArtwork from "@/assets/rewards/track-actions.png";
import { cn } from "@/lib/utils";

type EarnActionsImageCardProps = {
  mealLabel: string;
  waterLabel: string;
  onLogMeal: () => void;
  onTrackWater: () => void;
  className?: string;
};

export function EarnActionsImageCard({
  mealLabel,
  waterLabel,
  onLogMeal,
  onTrackWater,
  className,
}: EarnActionsImageCardProps) {
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
