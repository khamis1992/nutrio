import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/BarcodeScanner", () => ({
  BarcodeScanner: () => null,
}));

vi.mock("@/components/FoodPhotoLogSheet", () => ({
  FoodPhotoLogSheet: () => null,
}));

vi.mock("@/components/NutritionLabelScanSheet", () => ({
  NutritionLabelScanSheet: () => null,
}));

vi.mock("@/components/FoodTextLogSheet", () => ({
  FoodTextLogSheet: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/LanguageContext", () => {
  const t = (key: string) => key;
  return { useLanguage: () => ({ t }) };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/lib/meal-images", () => ({
  getMealImage: (imageUrl: string | null) => imageUrl ?? "fallback.jpg",
}));

vi.mock("@/lib/meal-log-service", () => ({
  logMealItemsResilient: vi.fn(),
  flushQueuedMealLogs: vi.fn().mockResolvedValue({ synced: 0, remaining: 0 }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import LogMealModal from "@/components/LogMealModal";
import { supabase } from "@/integrations/supabase/client";
import { logMealItemsResilient } from "@/lib/meal-log-service";
import { toast } from "sonner";

const recentMeal = {
  id: "meal-1",
  name: "Chicken Bowl",
  calories: 420,
  protein_g: 35,
  carbs_g: 44,
  fat_g: 12,
  image_url: "meal.jpg",
  logged_at: "2026-07-12T10:00:00Z",
};

const renderModal = () => {
  const onMealLogged = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LogMealModal
      open
      onMealLogged={onMealLogged}
      onOpenChange={onOpenChange}
    />,
  );
  return { onMealLogged, onOpenChange };
};

const selectRecentMeal = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByText("Chicken Bowl"));
  await user.click(screen.getByRole("button", { name: "Add 1 item" }));
};

describe("LogMealModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [recentMeal], error: null }),
          }),
        }),
      }),
    } as never);
  });

  it("reports success only after the service confirms persistence", async () => {
    vi.mocked(logMealItemsResilient).mockResolvedValue({
      persisted: true,
      loggedCount: 1,
      calories: 420,
      protein: 35,
      carbs: 44,
      fat: 12,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    });
    const { onMealLogged, onOpenChange } = renderModal();

    await selectRecentMeal();

    await waitFor(() => {
      expect(onMealLogged).toHaveBeenCalledTimes(1);
    });
    expect(toast.success).toHaveBeenCalledWith("meal_logged");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not report success without an explicit persisted result", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(logMealItemsResilient).mockResolvedValue({
      loggedCount: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    } as never);
    const { onMealLogged, onOpenChange } = renderModal();

    await selectRecentMeal();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("failed_to_log_meal");
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(onMealLogged).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
