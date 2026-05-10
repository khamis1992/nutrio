/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Utensils, ArrowRight, TrendingUp } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { posthog } from "posthog-js";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { captureError } from "@/lib/sentry";

interface MealLimitUpsellBannerProps {
  threshold?: number; // Default 0.8 (80%)
  className?: string;
}

export function MealLimitUpsellBanner({
  threshold = 0.8,
  className = "",
}: MealLimitUpsellBannerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { subscription, mealsUsed, totalMeals, remainingMeals, loading } = useSubscription();
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);

  // Check if we should show the banner
  const usageRatio = totalMeals > 0 ? mealsUsed / totalMeals : 0;
  const shouldShow = !loading && 
    subscription?.status === "active" && 
    !subscription?.isUnlimited && 
    usageRatio >= threshold && 
    !hasBeenDismissed;

  // Track impression
  useEffect(() => {
    if (shouldShow && !impressionTracked && user) {
      posthog.capture("meal_limit_banner_impression", {
        user_id: user.id,
        usage_percent: Math.round(usageRatio * 100),
        meals_used: mealsUsed,
        meals_remaining: remainingMeals,
        total_meals: totalMeals,
        subscription_tier: subscription?.tier,
        threshold: threshold,
      });
      setImpressionTracked(true);
    }
  }, [shouldShow, impressionTracked, user, usageRatio, mealsUsed, remainingMeals, totalMeals, subscription, threshold]);

  const handleUpgradeClick = () => {
    if (!user) return;

    // Track click
    posthog.capture("meal_limit_banner_click", {
      user_id: user.id,
      usage_percent: Math.round(usageRatio * 100),
      current_tier: subscription?.tier,
    });

    navigate("/subscription");
  };

  const handleDismiss = () => {
    if (!user) return;

    // Track dismiss
    posthog.capture("meal_limit_banner_dismiss", {
      user_id: user.id,
      usage_percent: Math.round(usageRatio * 100),
    });

    setHasBeenDismissed(true);
  };

  if (!shouldShow) {
    return null;
  }

  const usagePercent = Math.round(usageRatio * 100);
  const isCritical = usageRatio >= 0.95; // 95%+

  return (
    <Alert 
      className={`relative overflow-hidden ${isCritical ? 'border-amber-500 bg-amber-50' : 'border-blue-500 bg-blue-50'} ${className}`}
    >
      {/* Background decoration */}
      <div className={`absolute right-0 top-0 h-full w-1/3 opacity-10 ${isCritical ? 'bg-amber-500' : 'bg-blue-500'}`}>
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 0 L100 0 L100 100 L0 100 Z" fill="currentColor" />
        </svg>
      </div>

      <div className="relative z-10">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isCritical ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
            <Utensils className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <AlertTitle className={`text-base font-semibold ${isCritical ? 'text-amber-900' : 'text-blue-900'}`}>
              {isCritical 
                ? t("mealLimit.almostOut") 
                : t("mealLimit.usagePercent", { percent: usagePercent })}
            </AlertTitle>

            <AlertDescription className={`mt-1 text-sm ${isCritical ? 'text-amber-700' : 'text-blue-700'}`}>
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{t("mealLimit.mealUsage")}</span>
                    <span className="font-medium">{t("mealLimit.mealsCount", { used: mealsUsed, total: totalMeals })}</span>
                  </div>
                  <Progress 
                    value={usagePercent} 
                    className={`h-2 ${isCritical ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
                  />
                  <p className={`text-xs ${isCritical ? 'text-amber-600' : 'text-blue-600'}`}>
                    {subscription?.next_renewal_date 
                      ? t("mealLimit.mealsRemainingUntil", { 
                          count: remainingMeals, 
                          date: new Date(subscription.next_renewal_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        })
                      : t("mealLimit.mealsRemainingUntilNextRenewal", { count: remainingMeals })}
                  </p>
                </div>

                {/* CTA Section */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-2">
                  <p className={`text-xs ${isCritical ? 'text-amber-800 font-medium' : 'text-blue-800'}`}>
                    {isCritical 
                      ? t("mealLimit.criticalUpgradeMessage")
                      : t("mealLimit.lowUpgradeMessage")}
                  </p>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      className={`text-xs ${isCritical ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-100' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-100'}`}
                    >
                      {t("common.dismiss")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpgradeClick}
                      className={`text-xs ${isCritical 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                    >
                      <TrendingUp className="mr-1 h-3 w-3" />
                      {t("mealLimit.upgradePlan")}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </div>
        </div>
      </div>
    </Alert>
  );
}

// Hook for tracking meal limit banner conversion
export function useMealLimitTracking() {
  const trackConversion = (fromTier: string, toTier: string, source: string) => {
    posthog.capture("meal_limit_banner_conversion", {
      from_tier: fromTier,
      to_tier: toTier,
      source,
      conversion_type: "upgrade",
    });
  };

  return { trackConversion };
}

// Hook to check if user should see the banner
export function useShouldShowMealLimitBanner(threshold = 0.8) {
  const { subscription, mealsUsed, totalMeals, loading } = useSubscription();
  
  if (loading) return false;
  if (!subscription) return false;
  if (subscription.status !== "active") return false;
  if (subscription.isUnlimited) return false;
  if (totalMeals === 0) return false;
  
  const usageRatio = mealsUsed / totalMeals;
  return usageRatio >= threshold;
}
