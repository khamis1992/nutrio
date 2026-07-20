import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260720201000_unify_manual_meal_consumption.sql"), "utf8");
const client = readFileSync(resolve(process.cwd(), "src/lib/meal-log-service.ts"), "utf8");

describe("manual meal canonical consumption", () => {
  it("writes one canonical consumption for one submission", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.log_manual_meal_items_v3");
    expect(migration).toContain("'items', p_items");
    expect(migration).toContain("INSERT INTO public.meal_consumptions");
    expect(migration).toContain("INSERT INTO public.meal_consumption_events");
  });
  it("is request-id idempotent and keeps a rollout fallback", () => {
    expect(migration).toContain("consumptions.source_id = p_request_id");
    expect(client).toContain('"log_manual_meal_items_v3"');
    expect(client).toContain('"log_manual_meal_items_v2"');
  });
});
