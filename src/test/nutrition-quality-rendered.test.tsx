import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MicronutrientAdequacyCard } from "@/components/progress/MicronutrientAdequacyCard";
import { AdminNutritionCorrectionButton } from "@/pages/admin/AdminNutritionQuality";
import { PartnerNutritionQueueBanner } from "@/pages/partner/PartnerMenu";

const state = vi.hoisted(() => ({ enabled: true }));
const useMicronutrientAdequacy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/phase-one-feature-flags", () => ({
  isPhaseOneFeatureEnabled: () => state.enabled,
}));

vi.mock("@/hooks/useMicronutrientAdequacy", () => ({
  useMicronutrientAdequacy,
}));

describe("nutrition quality rendered rollout surfaces", () => {
  beforeEach(() => {
    state.enabled = true;
    useMicronutrientAdequacy.mockReset();
    useMicronutrientAdequacy.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("suppresses the customer query and card while micronutrients are disabled", () => {
    state.enabled = false;

    const { container } = render(
      <MicronutrientAdequacyCard
        endDate={new Date(2026, 6, 20)}
        initialRange="day"
        isRTL={false}
        userId="customer-1"
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(useMicronutrientAdequacy).toHaveBeenCalledWith(
      undefined,
      expect.any(Date),
      "day",
    );
  });

  it("renders expanded customer micronutrients in Arabic and RTL", () => {
    useMicronutrientAdequacy.mockReturnValue({
      data: [
        {
          nutrient_code: "magnesium_mg",
          label_en: "Magnesium",
          label_ar: "المغنيسيوم",
          unit: "mg",
          target: 400,
          direction: "minimum",
          consumed: 0,
          percentage: 0,
          status: "low",
          measured_entries: 1,
          missing_entries: 0,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = render(
      <MicronutrientAdequacyCard
        endDate={new Date(2026, 6, 20)}
        initialRange="week"
        isRTL
        userId="customer-1"
      />,
    );

    expect(screen.getByText("فجوات المغذيات")).toBeInTheDocument();
    expect(screen.getByText("المغنيسيوم")).toBeInTheDocument();
    expect(screen.getByText("أقل من الهدف المرجعي")).toBeInTheDocument();
    expect(container.querySelector('section[dir="rtl"]')).toBeInTheDocument();
  });

  it("renders the partner correction queue in Arabic and RTL", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <PartnerNutritionQueueBanner
        count={3}
        isRTL
        queueOnly={false}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText("بيانات غذائية تحتاج تصحيحًا")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /عرض قائمة التصحيح/ }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(container.querySelector('section[dir="rtl"]')).toBeInTheDocument();
  });

  it("renders the admin correction command in Arabic and RTL", () => {
    const onClick = vi.fn();
    const { container } = render(
      <AdminNutritionCorrectionButton
        isRTL
        pending={false}
        requested={false}
        onClick={onClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "طلب تصحيح" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(container.querySelector('button[dir="rtl"]')).toBeInTheDocument();
  });
});
