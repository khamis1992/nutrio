import { Crown, Utensils, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MealsRemainingWidgetProps {
  remainingMeals: number;
  totalMeals: number;
  isUnlimited?: boolean;
  isVip?: boolean;
  className?: string;
  variant?: "compact" | "full" | "banner";
}

export function MealsRemainingWidget({
  remainingMeals,
  totalMeals,
  isUnlimited = false,
  isVip = false,
  className,
  variant = "full",
}: MealsRemainingWidgetProps) {
  // Percentage of meals already used (bar fills as meals are consumed)
  const usedMeals = totalMeals - remainingMeals;
  const usedPercentage = isUnlimited ? 0 : Math.round((usedMeals / totalMeals) * 100);
  // Percentage remaining (used in labels only)
  const percentage = isUnlimited ? 100 : Math.round((remainingMeals / totalMeals) * 100);
  
  // Determine status color based on remaining meals
  const getStatusColor = () => {
    if (isUnlimited || isVip) return "text-violet-500";
    if (remainingMeals === 0) return "text-destructive";
    if (remainingMeals <= 2) return "text-orange-500";
    if (remainingMeals <= Math.ceil(totalMeals * 0.3)) return "text-yellow-500";
    return "text-emerald-500";
  };

  const getProgressColor = () => {
    if (isUnlimited || isVip) return "bg-violet-500";
    if (remainingMeals === 0) return "bg-destructive";
    if (remainingMeals <= 2) return "bg-orange-500";
    if (remainingMeals <= Math.ceil(totalMeals * 0.3)) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const getBgColor = () => {
    if (isUnlimited || isVip) return "bg-violet-500/10 border-violet-500/30";
    if (remainingMeals === 0) return "bg-destructive/10 border-destructive/30";
    if (remainingMeals <= 2) return "bg-orange-500/10 border-orange-500/30";
    if (remainingMeals <= Math.ceil(totalMeals * 0.3)) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-emerald-500/10 border-emerald-500/30";
  };

  const statusColor = getStatusColor();
  const progressColor = getProgressColor();
  const bgColor = getBgColor();

  // Compact variant for headers/badges
  if (variant === "compact") {
    return (
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm",
        bgColor,
        className
      )}>
        {isUnlimited || isVip ? (
          <Crown className="w-3.5 h-3.5 text-violet-500" />
        ) : (
          <Utensils className={cn("w-3.5 h-3.5", statusColor)} />
        )}
        <span className={cn("text-sm font-semibold", statusColor)}>
          {isUnlimited ? "Unlimited" : `${remainingMeals}/${totalMeals} meals`}
        </span>
      </div>
    );
  }

  // Banner variant for meal detail pages
  if (variant === "banner") {
    return (
      <Card className={cn("border-2", bgColor, className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                isUnlimited || isVip ? "bg-violet-500/20" : "bg-background"
              )}>
                {isUnlimited || isVip ? (
                  <Crown className="w-6 h-6 text-violet-500" />
                ) : (
                  <div className="relative">
                    <Utensils className={cn("w-6 h-6", statusColor)} />
                    {remainingMeals <= 2 && remainingMeals > 0 && (
                      <AlertCircle className="w-4 h-4 text-orange-500 absolute -top-1 -right-1" />
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-base">
                  {isUnlimited ? (
                    <span className="text-violet-500">Unlimited Meals</span>
                  ) : (
                    <span className={statusColor}>
                      {remainingMeals} of {totalMeals} meals remaining
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isUnlimited 
                    ? "Enjoy unlimited meals with your VIP plan!"
                    : remainingMeals === 0 
                      ? "You've used all your meals for this week"
                      : remainingMeals <= 2
                        ? "Running low! Order wisely"
                        : `${percentage}% of your weekly meals remaining`
                  }
                </p>
              </div>
            </div>
            {!isUnlimited && (
              <div className="text-right">
                <div className={cn("text-2xl font-bold", statusColor)}>
                  {remainingMeals}
                </div>
                <div className="text-xs text-muted-foreground">left</div>
              </div>
            )}
          </div>
          
          {!isUnlimited && (
            <div className="mt-3">
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-500 rounded-full", progressColor)}
                  style={{ width: `${usedPercentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>0 used</span>
                <span>{usedMeals} used</span>
                <span>{totalMeals} total</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full variant (default) - Most detailed
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
              isUnlimited || isVip ? "bg-violet-500/10" : "bg-muted"
            )}>
              {isUnlimited || isVip ? (
                <Crown className="w-7 h-7 text-violet-500" />
              ) : (
                <div className="relative">
                  <Utensils className={cn("w-7 h-7", statusColor)} />
                  {remainingMeals <= 2 && remainingMeals > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {isUnlimited ? "Unlimited Meals" : "Weekly Meals"}
              </h3>
                <p className="text-sm text-muted-foreground">
                {isUnlimited
                  ? "VIP Plan - No limits"
                  : `Resets weekly`
                }
              </p>
            </div>
          </div>
          
          {!isUnlimited && (
            <div className="text-right">
              <div className={cn("text-4xl font-bold leading-none", statusColor)}>
                {remainingMeals}
              </div>
              <div className="text-sm text-muted-foreground mt-1">remaining</div>
            </div>
          )}
        </div>

        {!isUnlimited && (
          <>
            {/* Progress Bar - fills as meals are used */}
            <div className="relative">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-700 ease-out rounded-full relative", progressColor)}
                  style={{ width: `${usedPercentage}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
              
              {/* Progress markers */}
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-muted-foreground">
                  {totalMeals - remainingMeals} used
                </span>
                <span className={cn("font-medium", statusColor)}>
                  {percentage}% remaining
                </span>
                <span className="text-muted-foreground">
                  {totalMeals} total
                </span>
              </div>
            </div>

            {/* Status message */}
            <div className={cn(
              "mt-4 p-3 rounded-lg text-sm flex items-start gap-2",
              remainingMeals <= 2 ? "bg-orange-500/10 text-orange-700" :
              remainingMeals <= Math.ceil(totalMeals * 0.3) ? "bg-yellow-500/10 text-yellow-700" :
              "bg-emerald-500/10 text-emerald-700"
            )}>
              {remainingMeals === 0 ? (
                <>
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>You've used all your meals for this week.</span>
                </>
              ) : remainingMeals <= 2 ? (
                <>
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Running low! Only {remainingMeals} meal{remainingMeals !== 1 ? 's' : ''} left. Choose your next meals wisely.</span>
                </>
              ) : remainingMeals <= Math.ceil(totalMeals * 0.3) ? (
                <>
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Getting low on meals. You have {remainingMeals} remaining out of {totalMeals}.</span>
                </>
              ) : (
                <>
                  <Utensils className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Doing great! You have plenty of meals remaining this week.</span>
                </>
              )}
            </div>
          </>
        )}

        {isUnlimited && (
          <div className="mt-4 p-3 rounded-lg bg-violet-500/10 text-violet-700 text-sm">
            <span>Enjoy unlimited meals with your VIP subscription! No restrictions, order whenever you want.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Add shimmer animation to CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
`;
document.head.appendChild(style);
