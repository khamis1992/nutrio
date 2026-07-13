import { PlanCard, type PlanCardData } from "@/components/subscription/PlanCard";

interface SubscriptionPlansTabProps {
  plans: PlanCardData[];
  currentTier?: string;
  onSelectPlan: (plan: PlanCardData) => void;
}

export function SubscriptionPlansTab({
  plans,
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
    </div>
  );
}
