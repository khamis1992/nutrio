import { BellRing, AlertCircle, BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BillingIntervalToggle, type BillingInterval } from "@/components/BillingIntervalToggle";
import { PlanCard, type PlanCardData } from "@/components/subscription/PlanCard";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface SubscriptionPlansTabProps {
  plans: PlanCardData[];
  billingInterval: BillingInterval;
  onBillingIntervalChange: (interval: BillingInterval) => void;
  vipAnnualSavings: number;
  currentTier?: string;
  autoRenew: boolean;
  autoRenewLoading: boolean;
  onToggleAutoRenew: (value: boolean) => void;
  onSelectPlan: (plan: PlanCardData) => void;
  endDate?: string;
  status?: string;
}

export function SubscriptionPlansTab({
  plans,
  billingInterval,
  onBillingIntervalChange,
  vipAnnualSavings,
  currentTier,
  autoRenew,
  autoRenewLoading,
  onToggleAutoRenew,
  onSelectPlan,
  endDate,
  status,
}: SubscriptionPlansTabProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="text-center pb-1">
        <h3 className="font-bold text-foreground">{t("available_plans")}</h3>
        <p className="text-xs text-muted-foreground">{t("upgrade_anytime")}</p>
      </div>

      <BillingIntervalToggle
        value={billingInterval}
        onChange={onBillingIntervalChange}
        savingsPercent={17}
      />

      {billingInterval === "annual" && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-2xl px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BadgePercent className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Save 17% — 2 months free</p>
            <p className="text-xs text-muted-foreground">Save up to {vipAnnualSavings.toLocaleString()} QAR per year</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={currentTier === plan.tier}
            billingInterval={billingInterval}
            variant="upgrade"
            onSelect={() => onSelectPlan(plan)}
          />
        ))}
      </div>

      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BellRing className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{t("auto_renewal_title")}</p>
              <p className="text-xs text-muted-foreground">
                {autoRenew ? t("auto_renewal_on_desc") : t("auto_renewal_off_desc")}
              </p>
            </div>
          </div>
          <Switch
            checked={autoRenew}
            onCheckedChange={onToggleAutoRenew}
            disabled={autoRenewLoading || status === "cancelled"}
          />
        </div>
        {!autoRenew && status !== "cancelled" && (
          <div className="flex items-start gap-2 bg-warning/5 border border-warning/15 rounded-2xl px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning font-semibold">
              {t("subscription_expire_warning")}{" "}
              <span className="font-bold">
                {endDate ? format(new Date(endDate), "MMM dd, yyyy") : t("end_of_billing_period")}
              </span>{" "}
              and will not renew automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
