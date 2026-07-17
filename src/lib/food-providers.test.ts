import { describe, expect, it } from "vitest";

import { FoodProviderRegistry, type FoodProvider } from "@/lib/food-providers";

const provider = (id: FoodProvider["id"], items: Awaited<ReturnType<FoodProvider["search"]>>): FoodProvider => ({
  id,
  search: async () => items,
});

describe("FoodProviderRegistry", () => {
  it("merges providers, prioritizes prefix matches, and removes duplicate foods", async () => {
    const registry = new FoodProviderRegistry([
      provider("nutrio", [
        { id: "1", source: "nutrio", name: "Chicken Bowl", calories: 420, protein_g: 35, carbs_g: 44, fat_g: 12 },
        { id: "2", source: "nutrio", name: "Spicy Chicken", calories: 390, protein_g: 32, carbs_g: 40, fat_g: 10 },
      ]),
      provider("recent", [
        { id: "3", source: "recent", name: "Chicken Bowl", calories: 420, protein_g: 35, carbs_g: 44, fat_g: 12 },
      ]),
    ]);

    const result = await registry.search("chicken");

    expect(result.map((item) => item.name)).toEqual(["Chicken Bowl", "Spicy Chicken"]);
    expect(result[0].source).toBe("recent");
  });

  it("keeps working when one provider fails", async () => {
    const failing: FoodProvider = { id: "recent", search: async () => { throw new Error("offline"); } };
    const registry = new FoodProviderRegistry([
      failing,
      provider("nutrio", [
        { id: "1", source: "nutrio", name: "Falafel", calories: 300, protein_g: 12, carbs_g: 42, fat_g: 9 },
      ]),
    ]);

    await expect(registry.search("falafel")).resolves.toHaveLength(1);
  });
});
