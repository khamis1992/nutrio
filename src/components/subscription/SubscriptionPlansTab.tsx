import { BillingIntervalToggle, type BillingInterval } from "@/components/BillingIntervalToggle";
import { PlanCard, type PlanCardData } from "@/components/subscription/PlanCard";

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
  return (
    <div className="space-y-3">
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
      <div className="rounded-[24px] bg-white px-4 py-4 shadow-sm ring-1 ring-[#E5EAF1]">
        <BillingIntervalToggle
          value={billingInterval}
          onChange={onBillingIntervalChange}
          savingsPercent={17}
        />
      </div>
    </div>
  );
}
