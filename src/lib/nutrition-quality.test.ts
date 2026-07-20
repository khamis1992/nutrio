import { describe, expect, it } from "vitest";

import {
  calculateMicronutrientAdequacy,
  calculateNutrientCompleteness,
  createNutritionSnapshot,
  buildNutrientProvenance,
  normalizeNutrientValue,
} from "@/lib/nutrition-quality";

describe("nutrition quality and micronutrients", () => {
  it("keeps missing values distinct from measured zero", () => {
    const missing = normalizeNutrientValue("fiber_g", null, "g", "g", "partner_entered");
    const measuredZero = normalizeNutrientValue("fiber_g", 0, "g", "g", "partner_entered");

    expect(missing).toMatchObject({ value: null, state: "missing" });
    expect(measuredZero).toMatchObject({ value: 0, state: "measured" });
  });

  it("normalizes units without pretending unsupported conversions are valid", () => {
    expect(normalizeNutrientValue("sodium_mg", 1.2, "g", "mg", "nutrition_label_ocr")).toMatchObject({
      value: 1200,
      unit: "mg",
      state: "measured",
    });
    expect(normalizeNutrientValue("fiber_g", 40, "mg", "kcal", "nutrition_label_ocr").state).toBe("invalid");
    expect(normalizeNutrientValue("vitamin_b12_mcg", 0.0024, "mg", "mcg", "manual")).toMatchObject({
      value: 2.4,
      unit: "mcg",
      state: "measured",
    });
    expect(normalizeNutrientValue("calcium_mg", 0.5, "g", "mg", "manual").value).toBe(500);
  });

  it("scores nutrient completeness from required macros and quality nutrients", () => {
    const complete = calculateNutrientCompleteness({
      calories: 520,
      protein_g: 42,
      carbs_g: 58,
      fat_g: 18,
      fiber_g: 7,
      sugar_g: 4,
      sodium_mg: 680,
      potassium_mg: 900,
      calcium_mg: 240,
      iron_mg: 3.5,
      vitamin_d_mcg: 4,
      vitamin_b12_mcg: 1.2,
      magnesium_mg: 110,
    });
    const partial = calculateNutrientCompleteness({
      calories: 520,
      protein_g: 42,
      carbs_g: 58,
      fat_g: 18,
      fiber_g: null,
      sugar_g: null,
      sodium_mg: null,
    });

    expect(complete.score).toBe(100);
    expect(partial.score).toBe(70);
    expect(partial.missingCodes).toEqual([
      "fiber_g",
      "sugar_g",
      "sodium_mg",
      "potassium_mg",
      "calcium_mg",
      "iron_mg",
      "vitamin_d_mcg",
      "vitamin_b12_mcg",
      "magnesium_mg",
    ]);
  });

  it("calculates micronutrient adequacy with minimum and maximum targets", () => {
    const adequacy = calculateMicronutrientAdequacy([
      { code: "fiber_g", value: 12 },
      { code: "fiber_g", value: 8 },
      { code: "sodium_mg", value: 2400 },
      { code: "sugar_g", value: 0 },
    ]);

    expect(adequacy.find((item) => item.code === "fiber_g")).toMatchObject({
      value: 20,
      percentage: 67,
      status: "low",
    });
    expect(adequacy.find((item) => item.code === "sodium_mg")).toMatchObject({
      value: 2400,
      status: "over_limit",
    });
    expect(adequacy.find((item) => item.code === "sugar_g")).toMatchObject({
      value: 0,
      status: "on_track",
    });
  });

  it("scales every reference target across an inclusive weekly range", () => {
    const adequacy = calculateMicronutrientAdequacy(
      [
        { code: "potassium_mg", value: 24_500 },
        { code: "calcium_mg", value: 0 },
        { code: "iron_mg", value: null },
        { code: "vitamin_d_mcg", value: 105 },
        { code: "vitamin_b12_mcg", value: 16.8 },
        { code: "magnesium_mg", value: 2_800 },
      ],
      undefined,
      7,
    );

    expect(adequacy.find((item) => item.code === "potassium_mg")).toMatchObject({
      target: 24_500,
      percentage: 100,
      status: "on_track",
    });
    expect(adequacy.find((item) => item.code === "calcium_mg")).toMatchObject({
      value: 0,
      target: 7_000,
      status: "low",
    });
    expect(adequacy.find((item) => item.code === "iron_mg")).toMatchObject({
      value: null,
      percentage: null,
      status: "missing",
    });
    expect(adequacy.find((item) => item.code === "vitamin_b12_mcg")?.target).toBe(16.8);
  });

  it("creates versioned snapshots with missing nutrient codes", () => {
    const snapshot = createNutritionSnapshot(
      { calories: 400, protein_g: 30, carbs_g: 40, fat_g: 12, fiber_g: null },
      buildNutrientProvenance("partner_entered", "meal-1", 3, "2026-07-19T12:00:00.000Z"),
    );

    expect(snapshot.nutrition_version).toBe(3);
    expect(snapshot.completeness_score).toBe(70);
    expect(snapshot.missing_nutrient_codes).toContain("fiber_g");
    expect(snapshot.nutrients.fiber_g).toBeNull();
    expect(snapshot.provenance.sourceRecordId).toBe("meal-1");
  });
});
