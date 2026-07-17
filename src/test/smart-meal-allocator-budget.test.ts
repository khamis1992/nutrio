import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createAllocationExecutionBudget } from "../../supabase/functions/smart-meal-allocator/execution-budget";

const allocatorSource = readFileSync(
  join(process.cwd(), "supabase/functions/smart-meal-allocator/index.ts"),
  "utf8",
);

function functionSource(name: string, nextName: string): string {
  const start = allocatorSource.indexOf(`async function ${name}`);
  const end = allocatorSource.indexOf(`async function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return allocatorSource.slice(start, end);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("smart meal allocator execution budget", () => {
  it("keeps deadline checkpoints inside every daily allocation stage", () => {
    const dailySource = functionSource("generateDailyPlan", "generateWeeklyPlan");

    expect(dailySource).toContain('budget.check("daily.start")');
    expect(dailySource).toContain('budget.check("daily.meal_slot")');
    expect(dailySource).toContain('"daily.filter_available"');
    expect(dailySource).toContain('"daily.score_meals"');
    expect(dailySource).toContain('budget.check("daily.calculate_totals")');
  });

  it("keeps deadline checkpoints inside every weekly allocation stage", () => {
    const weeklySource = functionSource("generateWeeklyPlan", "saveWeeklyPlan");

    expect(weeklySource).toContain('budget.check("weekly.start")');
    expect(weeklySource).toContain('budget.check("weekly.day")');
    expect(weeklySource).toContain('budget.check("weekly.meal_slot")');
    expect(weeklySource).toContain('"weekly.filter_available"');
    expect(weeklySource).toContain('"weekly.score_meals"');
    expect(weeklySource).toContain('budget.check("weekly.calculate_totals")');
    expect(weeklySource).toContain('budget.check("weekly.calculate_variety")');
  });

  it("returns a controlled error at an injected-clock checkpoint", () => {
    let now = 0;
    const budget = createAllocationExecutionBudget(10, () => now);
    budget.check("daily.start");

    now = 10;
    expect(() => budget.check("daily.meal_slot")).toThrowError(
      expect.objectContaining({
        status: 503,
        code: "allocation_budget_exceeded",
        stage: "daily.meal_slot",
      }),
    );
  });

  it("aborts an in-flight operation and returns the controlled timeout error", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const budget = createAllocationExecutionBudget(20_000, Date.now);
    let operationSignal: AbortSignal | undefined;

    const result = budget.run("database.meals", (signal) => {
      operationSignal = signal;
      return new Promise<never>(() => undefined);
    });
    const rejection = expect(result).rejects.toMatchObject({
      status: 503,
      code: "allocation_budget_exceeded",
      stage: "database.meals",
    });

    await vi.advanceTimersByTimeAsync(20_000);
    await rejection;
    expect(operationSignal?.aborted).toBe(true);
  });
});
