import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConsumption: vi.fn(),
  recordConsumption: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ isRTL: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/order-consumption", async () => {
  const actual = await vi.importActual<typeof import("@/lib/order-consumption")>(
    "@/lib/order-consumption",
  );
  return {
    ...actual,
    getOrderMealConsumption: mocks.getConsumption,
    recordOrderMealConsumption: mocks.recordConsumption,
  };
});

import { MealConsumptionSheet } from "@/components/MealConsumptionSheet";

describe("MealConsumptionSheet", () => {
  beforeEach(() => {
    mocks.getConsumption.mockReset().mockResolvedValue(null);
    mocks.recordConsumption.mockReset().mockResolvedValue({
      success: true,
      already_processed: false,
      consumption_id: "consumption-1",
      event_version: 1,
      status: "partial",
      portion_percent: 75,
      nutrition: {
        calories: 300,
        protein_g: 30,
        carbs_g: 24,
        fat_g: 9,
        fiber_g: 3,
      },
    });
  });

  it("submits the selected partial portion", async () => {
    render(
      <MealConsumptionSheet
        open
        onOpenChange={vi.fn()}
        sourceType="meal_schedule"
        sourceId="schedule-1"
        sourceMealId="meal-1"
        meal={{
          meal_id: "meal-1",
          meal_name: "Chicken bowl",
          calories: 400,
          protein_g: 40,
          carbs_g: 32,
          fat_g: 12,
          fiber_g: 4,
        }}
      />,
    );

    await screen.findByRole("radio", { name: /I ate part of it/i });
    fireEvent.click(screen.getByRole("radio", { name: /I ate part of it/i }));
    fireEvent.click(screen.getByRole("button", { name: "75%" }));
    fireEvent.click(screen.getByRole("button", { name: /Save consumption/i }));

    await waitFor(() => {
      expect(mocks.recordConsumption).toHaveBeenCalledWith(expect.objectContaining({
        sourceType: "meal_schedule",
        sourceId: "schedule-1",
        sourceMealId: "meal-1",
        status: "partial",
        portionPercent: 75,
      }));
    });
  });
});

