import { BadgePercent } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BillingIntervalToggle, type BillingInterval } from "@/components/BillingIntervalToggle";
import { PlanCard, type PlanCardData } from "@/components/subscription/PlanCard";
import { useLanguage } from "@/contexts/LanguageContext";

interface SubscriptionPlansTabProps {
  plans: PlanCardData[];
  billingInterval: BillingInterval;
  onBillingIntervalChange: (interval: BillingInterval) => void;
  currentTier?: string;
  onSelectPlan: (plan: PlanCardData) => void;
}

export function SubscriptionPlansTab({
  plans,
  billingInterval,
  onBillingIntervalChange,
  currentTier,
  onSelectPlan,
}: SubscriptionPlansTabProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      {/* Plans list */}
      <div className="space-y-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={currentTier === plan.tier}
            onSelect={() => onSelectPlan(plan)}
          />
        ))}
      </div>

      {/* Annual billing toggle */}
      <div className="mx-4 rounded-[18px] border border-slate-100 bg-white px-4 py-4 shadow-sm">
        <BillingIntervalToggle
          value={billingInterval}
          onChange={onBillingIntervalChange}
          savingsPercent={17}
        />
      </div>
    </div>
  );
}
