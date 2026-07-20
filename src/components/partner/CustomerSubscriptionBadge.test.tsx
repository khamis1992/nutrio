import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerSubscriptionBadge } from "@/components/partner/CustomerSubscriptionBadge";
import type { PartnerCustomerRetentionStatus } from "@/lib/partner-customer-retention";

const baseStatus: PartnerCustomerRetentionStatus = {
  userId: "user-1",
  subscriptionStatus: "active",
  planType: "monthly",
  tier: "Premium",
  remainingMeals: 12,
  rolloverCredits: 2,
  activeFreeze: null,
};

describe("CustomerSubscriptionBadge", () => {
  it("renders active subscription details with remaining meals", () => {
    render(<CustomerSubscriptionBadge status={baseStatus} />);

    expect(screen.getByText(/Premium/)).toBeInTheDocument();
    expect(screen.getByText(/12 meals/)).toBeInTheDocument();
  });

  it("prioritizes active freeze state over subscription details", () => {
    render(
      <CustomerSubscriptionBadge
        status={{
          ...baseStatus,
          activeFreeze: {
            id: "freeze-1",
            startDate: "2026-07-20",
            endDate: "2026-07-22",
            days: 3,
            status: "active",
          },
        }}
      />,
    );

    expect(screen.getByText("Frozen")).toBeInTheDocument();
    expect(screen.queryByText(/Premium/)).not.toBeInTheDocument();
  });

  it("renders nothing when no status is available", () => {
    const { container } = render(<CustomerSubscriptionBadge status={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
