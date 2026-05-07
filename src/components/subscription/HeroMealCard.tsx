import { Crown, Zap, Utensils, Apple, Clock, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroMealCardProps {
  planName: string;
  status: string;
  statusLabel: string;
  isVip: boolean;
  isUnlimited: boolean;
  isPaused: boolean;
  effectiveMealsLeft: number;
  totalMeals: number;
  mealsUsed: number;
  daysRemaining: number;
  snacksPerMonth: number;
  snacksUsed: number;
  remainingSnacks: number;
  hasSnacks: boolean;
  rolloverCredits: number;
  remainingMeals: number;
  endDate?: string;
}

export function HeroMealCard({
  planName,
  status,
  statusLabel,
  isVip,
  isUnlimited,
  isPaused,
  effectiveMealsLeft,
  totalMeals,
  mealsUsed,
  daysRemaining,
  snacksPerMonth,
  snacksUsed,
  remainingSnacks,
  hasSnacks,
  rolloverCredits,
  remainingMeals,
  endDate,
}: HeroMealCardProps) {
  const statusLine = (() => {
    if (isPaused) return "Paused · Frozen";
    if (status === "cancelled") return `Cancelled·ends ${endDate || ""}`;
    return statusLabel + (isVip ? " · VIP" : "");
  })();

  return (
    <div
      className={cn(
        "rounded-[28px] px-5 py-6 text-white shadow-lg shadow-primary/15 overflow-hidden relative",
        isVip
          ? "bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600"
          : "bg-gradient-to-br from-primary via-primary to-emerald-600"
      )}
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4" />

      <div className="relative">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {isVip ? (
                <Crown className="h-6 w-6 text-white" />
              ) : isPaused ? (
                <Snowflake className="h-6 w-6 text-white" />
              ) : (
                <Zap className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                {planName} Plan
              </h2>
              <p className="text-xs text-white/75 font-medium capitalize">
                {statusLine}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-5xl font-extrabold leading-none tabular-nums">
              {isUnlimited ? "∞" : isPaused ? "❄" : effectiveMealsLeft}
            </p>
            <p className="text-xs text-white/70 mt-1 font-medium">
              {isUnlimited ? "unlimited" : isPaused ? "Paused" : "meals left"}
            </p>
            {!isUnlimited && rolloverCredits > 0 && remainingMeals === 0 && (
              <p className="text-xs text-white/60 mt-0.5">({rolloverCredits} rollover)</p>
            )}
          </div>
        </div>

        {!isUnlimited && !isPaused && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <Utensils className="h-4 w-4 text-white/90 shrink-0" />
                <div className="flex gap-1 flex-1">
                  {Array.from({ length: totalMeals }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-2.5 flex-1 rounded-full transition-all duration-500",
                        i < mealsUsed ? "bg-white shadow-sm" : "bg-white/20"
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/70 pl-7">
                <span className="font-semibold">
                  {mealsUsed} of {totalMeals} meals used
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="font-semibold">{daysRemaining}d until reset</span>
                </span>
              </div>
            </div>

            {hasSnacks && snacksPerMonth > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <Apple className="h-4 w-4 text-white/90 shrink-0" />
                  <div className="flex gap-1 flex-1">
                    {Array.from({ length: snacksPerMonth }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-2.5 flex-1 rounded-full transition-all duration-500",
                          i < snacksUsed
                            ? "bg-gradient-to-r from-orange-400 to-yellow-300 shadow-sm"
                            : "bg-white/20"
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/70 pl-7">
                  <span className="font-semibold">{snacksUsed} of {snacksPerMonth} snacks used</span>
                  <span className="font-semibold">{remainingSnacks} left</span>
                </div>
              </div>
            )}
          </div>
        )}

        {isPaused && (
          <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3 mt-2">
            <Snowflake className="h-5 w-5 text-white/80 shrink-0" />
            <p className="text-sm text-white/80 font-medium">
              Your subscription is currently frozen. Meal ordering is paused.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
