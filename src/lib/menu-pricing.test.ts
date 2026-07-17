import { describe, expect, it } from "vitest";

import {
  getAvailableMenuPeriods,
  getMenuPrice,
  type MenuOffering,
} from "@/lib/menu-pricing";

const offerings: MenuOffering[] = [
  { meal_type: "breakfast", price: 28, is_available: true },
  { meal_type: "dinner", price: 35, is_available: true },
];

describe("menu pricing", () => {
  it("keeps legacy meals available all day at their base price", () => {
    expect(getAvailableMenuPeriods([])).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ]);
    expect(getMenuPrice(30, [], "lunch")).toBe(30);
  });

  it("returns the selected period price and the lowest price for browse mode", () => {
    expect(getMenuPrice(30, offerings, "dinner")).toBe(35);
    expect(getMenuPrice(30, offerings, "all")).toBe(28);
    expect(getAvailableMenuPeriods(offerings)).toEqual(["breakfast", "dinner"]);
  });
});
