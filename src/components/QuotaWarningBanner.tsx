import { AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

export function QuotaWarningBanner() {
  const navigate = useNavigate();
  const { remainingMeals, totalMeals, isUnlimited, hasActiveSubscription } = useSubscription();

  if (!hasActiveSubscription || isUnlimited) return null;

  const usagePercent = ((totalMeals - remainingMeals) / totalMeals) * 100;

  if (usagePercent < 75) return null; // Only show at 75%+ usage

  const isExhausted = remainingMeals === 0;

  return (
    <Alert variant={isExhausted ? "destructive" : "default"} className="mb-4">
      {isExhausted ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
      <AlertTitle>
        {isExhausted ? "Meal Quota Exhausted" : `${remainingMeals} Meals Remaining`}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          {isExhausted
            ? "You've used all your meals for this period. Upgrade or wait for renewal."
            : `You've used ${usagePercent.toFixed(0)}% of your monthly meals.`}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/subscription")}>
            {isExhausted ? "Upgrade Plan" : "View Options"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
