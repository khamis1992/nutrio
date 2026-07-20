import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlateCalculatorSheet } from "@/components/workout/PlateCalculatorSheet";
import type { WorkoutEquipmentProfile } from "@/hooks/useWorkoutEquipmentProfiles";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ isRTL: false, language: "en", t: (key: string) => key }),
}));

const profile: WorkoutEquipmentProfile = {
  id: "gym-1",
  user_id: "user-1",
  name: "Test gym",
  is_default: true,
  bar_weight_kg: 20,
  plate_pairs: [{ weightKg: 20, count: 1 }],
  equipment: ["barbell"],
  created_at: "2026-07-20T00:00:00Z",
  updated_at: "2026-07-20T00:00:00Z",
};

describe("PlateCalculatorSheet", () => {
  it("applies the calculated load to the workout", () => {
    const onApply = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <PlateCalculatorSheet
        open
        onOpenChange={onOpenChange}
        targetWeightKg={60}
        profiles={[profile]}
        defaultProfile={profile}
        onApply={onApply}
        onSaveProfile={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use 60 kg" }));

    expect(onApply).toHaveBeenCalledWith(60);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
