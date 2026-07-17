import { describe, expect, it } from "vitest";

import { normalizeTeamCode } from "@/lib/challenge-teams";

describe("normalizeTeamCode", () => {
  it("normalizes pasted team codes", () => {
    expect(normalizeTeamCode(" ab-12 cd34 ")).toBe("AB12CD34");
  });

  it("limits codes to the server length", () => {
    expect(normalizeTeamCode("1234567890")).toBe("12345678");
  });
});
