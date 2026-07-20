import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("nutrition quality UI integration", () => {
  it("preserves missing partner nutrients and records their provenance", () => {
    const source = readSource("src/pages/partner/PartnerMenu.tsx");

    expect(source).toContain("sugar_g: formData.sugar_g");
    expect(source).toContain("sodium_mg: formData.sodium_mg");
    expect(source).toContain("potassium_mg: formData.potassium_mg");
    expect(source).toContain("vitamin_b12_mcg: formData.vitamin_b12_mcg");
    expect(source).toContain('event.target.value === "" ? null');
    expect(source).toContain("nutrition_provenance");
    expect(source).toContain("nutrition_source_record_id");
    expect(source).toContain('isPhaseOneFeatureEnabled("micronutrients")');
    expect(source).not.toContain("Math.max(1, editingMeal.nutrition_version) + 1");
  });

  it("exposes the admin nutrition queue as a routed workspace", () => {
    const page = readSource("src/pages/admin/AdminNutritionQuality.tsx");
    const app = readSource("src/App.tsx");
    const sidebar = readSource("src/components/AdminSidebar.tsx");

    expect(page).toContain('from("partner_meal_nutrition_missing_queue")');
    expect(page).toContain("requestCorrection");
    expect(page).toContain('"request_meal_nutrition_correction"');
    expect(app).toContain('path="nutrition-quality"');
    expect(sidebar).toContain('to: "/admin/nutrition-quality"');
  });

  it("renders the measured daily and weekly nutrient card in progress", () => {
    const progress = readSource("src/pages/ProgressRedesigned.tsx");
    const card = readSource(
      "src/components/progress/MicronutrientAdequacyCard.tsx",
    );

    expect(progress).toContain("<MicronutrientAdequacyCard");
    expect(card).toContain("useMicronutrientAdequacy");
    expect(card).toContain('row.status === "missing"');
    expect(card).toContain("بيانات مقاسة غير كافية");
    expect(card).toContain("vitamin_b12_mcg");
    expect(card).toContain('isPhaseOneFeatureEnabled("micronutrients")');
  });
});
