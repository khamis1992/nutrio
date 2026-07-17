import { describe, expect, it, vi } from "vitest";

import { parseFoodTextInput, resolveFoodText } from "@/lib/food-text-parser";

describe("food text parser", () => {
  it("parses Arabic food phrases and normalizes searchable aliases", () => {
    expect(parseFoodTextInput("أكلت ١٥٠ غ دجاج و 2 كوب رز")).toEqual([
      expect.objectContaining({ query: "chicken", amount: 150, unit: "gram" }),
      expect.objectContaining({ query: "rice", amount: 2, unit: "cup" }),
    ]);
  });

  it("parses English serving quantities", () => {
    expect(parseFoodTextInput("I ate 2 eggs, 1 serving chicken salad")).toEqual([
      expect.objectContaining({ query: "eggs", amount: 2, unit: "serving" }),
      expect.objectContaining({ query: "chicken salad", amount: 1, unit: "serving" }),
    ]);
  });

  it("understands Arabic dual nouns and an attached conjunction", () => {
    expect(parseFoodTextInput("بيضتين وخبز")).toEqual([
      expect.objectContaining({ query: "egg", amount: 2, unit: "piece" }),
      expect.objectContaining({ query: "bread", amount: 1, unit: "serving" }),
    ]);
  });

  it("marks measurements without catalog serving weights for review", async () => {
    const search = vi.fn().mockResolvedValue([{
      id: "nutrio:1",
      name: "Grilled Chicken",
      source: "nutrio",
      calories: 300,
      protein_g: 40,
      carbs_g: 5,
      fat_g: 10,
    }]);

    const [result] = await resolveFoodText("150g chicken", { search });
    expect(result.usesServingEstimate).toBe(true);
    expect(result.quantity).toBe(1);
    expect(result.confidence).toBe("low");
  });
});
