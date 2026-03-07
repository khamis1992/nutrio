import { AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export function QuotaWarningBanner() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { remainingMeals, totalMeals, isUnlimited, hasActiveSubscription } = useSubscription();

  if (!hasActiveSubscription || isUnlimited) return null;

  const usagePercent = ((totalMeals - remainingMeals) / totalMeals) * 100;

  if (usagePercent < 75) return null;

  const isExhausted = remainingMeals === 0;

  return (
    <Alert variant={isExhausted ? "destructive" : "default"} className="mb-4">
      {isExhausted ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
      <AlertTitle>
        {isExhausted
          ? t("quota_exhausted_title")
          : t("meals_remaining_title").replace("{count}", String(remainingMeals))}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          {isExhausted
            ? t("quota_exhausted_desc")
            : t("meals_used_desc").replace("{percent}", usagePercent.toFixed(0))}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/subscription")}>
            {isExhausted ? t("upgrade_plan") : t("view_options")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
