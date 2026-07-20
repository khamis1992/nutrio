import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FreezeSubscriptionModal } from "@/components/subscription/FreezeSubscriptionModal";

const requestFreeze = vi.fn();
let remainingFreezeDays = 7;

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        cancel: "Cancel",
        choose_freeze_days: "Choose up to {count} days",
        confirm_freeze: "Confirm freeze",
        days_left_line1: "days",
        days_left_line2: "left",
        freeze_days_used_desc: "You used all freeze days.",
        freeze_subscription: "Freeze subscription",
        freeze_your_plan: "Freeze your plan",
        no_freeze_days_left: "No freeze days left",
        pause_delivery_days: "Pause delivery days",
        scheduling: "Scheduling",
        select_freeze_dates: "Select freeze dates",
        subscription: "Subscription",
      };
      return labels[key] || key;
    },
  }),
}));

vi.mock("@/hooks/useSubscriptionFreeze", () => ({
  useFreezeDaysRemaining: () => ({
    data: { total: 7, used: 7 - remainingFreezeDays, remaining: remainingFreezeDays },
  }),
  useRequestFreeze: () => ({
    mutateAsync: requestFreeze,
    isPending: false,
  }),
}));

describe("FreezeSubscriptionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remainingFreezeDays = 7;
  });

  it("disables the trigger when no freeze days remain", () => {
    remainingFreezeDays = 0;
    render(<FreezeSubscriptionModal subscriptionId="sub-1" />);

    expect(
      screen.getByRole("button", { name: /freeze subscription/i }),
    ).toBeDisabled();
  });

  it("opens with the real remaining freeze allowance", async () => {
    remainingFreezeDays = 3;
    render(<FreezeSubscriptionModal subscriptionId="sub-1" />);

    fireEvent.click(screen.getByRole("button", { name: /freeze subscription/i }));

    await waitFor(() => {
      expect(screen.getByText("Freeze your plan")).toBeInTheDocument();
    });
    expect(screen.getByText("Choose up to 3 days")).toBeInTheDocument();
  });
});
