import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720202000_meal_response_notifications.sql"),
  "utf8",
);

describe("meal-response notification migration", () => {
  it("registers sparse templates on the safe meal-response deep link", () => {
    expect(migration).toContain("'meal.response_checkin_due.v1'");
    expect(migration).toContain("'meal.response_insight_ready.v1'");
    expect(migration.match(/'meal_response'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("'respect'");
  });

  it("gates producers on consent and emits no domain payload data", () => {
    expect(migration).toContain("preferences.post_meal_prompts_enabled");
    expect(migration).toContain("preferences.meal_response_enabled");
    expect(migration.match(/'\{\}'::JSONB/g)).toHaveLength(2);
    expect(migration).not.toMatch(/jsonb_build_object\s*\(/i);
  });

  it("deduplicates episodes and cancels check-ins before delivery", () => {
    expect(migration).toContain("'meal-response-insight-ready:' || NEW.episode_id::TEXT");
    expect(migration).toContain("ON CONFLICT (event_type, idempotency_key)");
    expect(migration).toContain("AND status IN ('pending', 'failed')");
  });
});
