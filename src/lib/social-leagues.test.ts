import { describe, expect, it } from "vitest";

import { getLeagueDaysRemaining, getLeagueZone } from "@/lib/social-leagues";

describe("social leagues", () => {
  it("classifies promotion, safe, and demotion ranks", () => {
    expect(getLeagueZone(3, 3, 8)).toBe("promotion");
    expect(getLeagueZone(5, 3, 8)).toBe("safe");
    expect(getLeagueZone(8, 3, 8)).toBe("demotion");
  });

  it("never returns a negative countdown", () => {
    expect(getLeagueDaysRemaining("2026-07-19", new Date("2026-07-18T12:00:00"))).toBe(2);
    expect(getLeagueDaysRemaining("2026-07-10", new Date("2026-07-18T12:00:00"))).toBe(0);
  });
});
