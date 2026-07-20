import { describe, expect, it } from "vitest";

import { didMeetSetTarget, parseRepTarget, rpeToRir } from "@/lib/workout-set-prescription";

describe("workout set prescription helpers", () => {
  it("parses fixed and ranged repetition targets", () => {
    expect(parseRepTarget("10")).toEqual({ min: 10, max: 10 });
    expect(parseRepTarget("8-12 reps")).toEqual({ min: 8, max: 12 });
    expect(parseRepTarget("12 / 10")).toEqual({ min: 10, max: 12 });
  });

  it("does not treat timed prescriptions as repetitions", () => {
    expect(parseRepTarget("30 sec")).toBeNull();
    expect(parseRepTarget("1 minute hold")).toBeNull();
  });

  it("derives reps in reserve from RPE", () => {
    expect(rpeToRir(8)).toBe(2);
    expect(rpeToRir(8.5)).toBe(1.5);
    expect(rpeToRir(11)).toBeNull();
  });

  it("compares performed values with the prescription snapshot", () => {
    const target = {
      reps: 10,
      weightKg: 40,
      rpe: 8,
      targetRepsMin: 10,
      targetWeightKg: 40,
      targetRpe: 8.5,
    };
    expect(didMeetSetTarget(target)).toBe(true);
    expect(didMeetSetTarget({ ...target, reps: 8 })).toBe(false);
    expect(didMeetSetTarget({ ...target, targetRepsMin: null, targetWeightKg: null, targetRpe: null })).toBeNull();
  });
});
