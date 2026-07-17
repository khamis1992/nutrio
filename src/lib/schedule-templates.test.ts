import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listScheduleTemplates,
  saveScheduleTemplate,
  templateToScheduleItems,
} from "@/lib/schedule-templates";

describe("schedule templates", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000010");
  });

  it("captures relative week positions and applies them to another week", () => {
    const template = saveScheduleTemplate("user-1", "Training week", new Date("2026-07-12T00:00:00"), [{
      scheduled_date: "2026-07-14",
      meal_type: "lunch",
      meal_id: "meal-1",
      delivery_time_slot: "1:00 PM",
      meal: { name: "Chicken Bowl", calories: 420, protein_g: 35 },
    }]);

    expect(template.slots[0]).toMatchObject({ dayOffset: 2, mealName: "Chicken Bowl" });
    expect(templateToScheduleItems(template, new Date("2026-07-19T00:00:00"))[0]).toMatchObject({
      scheduled_date: "2026-07-21",
      meal_id: "meal-1",
    });
    expect(listScheduleTemplates("user-1")).toHaveLength(1);
  });
});
