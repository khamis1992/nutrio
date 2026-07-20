import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schedulePage = readFileSync(resolve(process.cwd(), "src/pages/Schedule.tsx"), "utf8");

describe("schedule consumption integration", () => {
  it("routes scheduled meals through the canonical consumption sheet", () => {
    expect(schedulePage).toContain('sourceType="meal_schedule"');
    expect(schedulePage).toContain("<MealConsumptionSheet");
    expect(schedulePage).toContain("handleConsumptionSaved(result.status)");
  });

  it("does not call the legacy completion RPCs", () => {
    expect(schedulePage).not.toContain("complete_meal_atomic");
    expect(schedulePage).not.toContain("uncomplete_meal_atomic");
  });

  it("does not allow consumption before delivery", () => {
    expect(schedulePage).toContain('["delivered", "completed"].includes(schedule.order_status)');
  });
});
