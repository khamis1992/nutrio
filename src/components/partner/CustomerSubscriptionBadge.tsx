import { Clock, Snowflake, Utensils } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PartnerCustomerRetentionStatus } from "@/lib/partner-customer-retention";
import { cn } from "@/lib/utils";

interface CustomerSubscriptionBadgeProps {
  status?: PartnerCustomerRetentionStatus | null;
  compact?: boolean;
}

export function CustomerSubscriptionBadge({
  status,
  compact = false,
}: CustomerSubscriptionBadgeProps) {
  if (!status) return null;

  const subscriptionActive = status.subscriptionStatus === "active";
  const freeze = status.activeFreeze;

  if (freeze) {
    return (
      <Badge
        variant="outline"
        className="border-sky-200 bg-sky-50 text-sky-700"
        title={`Freeze ${freeze.status}: ${freeze.startDate} to ${freeze.endDate}`}
      >
        <Snowflake className="mr-1 h-3 w-3" />
        {freeze.status === "active" ? "Frozen" : "Freeze scheduled"}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        subscriptionActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
      title={[
        status.planType,
        status.tier,
        typeof status.remainingMeals === "number" ? `${status.remainingMeals} meals left` : null,
      ].filter(Boolean).join(" • ")}
    >
      {subscriptionActive ? (
        <Utensils className="mr-1 h-3 w-3" />
      ) : (
        <Clock className="mr-1 h-3 w-3" />
      )}
      {compact
        ? subscriptionActive ? "Active" : "Inactive"
        : subscriptionActive
          ? `${status.tier ?? "Active"}${typeof status.remainingMeals === "number" ? ` • ${status.remainingMeals} meals` : ""}`
          : status.subscriptionStatus ?? "No active plan"}
    </Badge>
  );
}
