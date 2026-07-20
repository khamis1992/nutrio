import { describe, expect, it } from "vitest";

import { buildMicronutrientRange } from "@/hooks/useMicronutrientAdequacy";

describe("buildMicronutrientRange", () => {
  const endDate = new Date(2026, 6, 19, 12, 0, 0);

  it("uses one local date for the daily view", () => {
    expect(buildMicronutrientRange(endDate, "day")).toEqual({
      start: "2026-07-19",
      end: "2026-07-19",
    });
  });

  it("uses an inclusive seven-day window for the weekly view", () => {
    expect(buildMicronutrientRange(endDate, "week")).toEqual({
      start: "2026-07-13",
      end: "2026-07-19",
    });
  });
});
