import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = source("supabase/migrations/20260720210000_safe_smart_meal_substitutions.sql");
const hook = source("src/hooks/useSmartSubstitutions.ts");

describe("safe smart meal substitutions", () => {
  it("binds candidate lookup and substitution to the authenticated schedule owner", () => {
    expect(migration).toContain("v_actor UUID := auth.uid()");
    expect(migration).toContain("ms.id = p_schedule_id AND ms.user_id = v_actor");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("UNIQUE (user_id, request_id)");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("enforces safety, dietary, commercial-state and delivery gates on the server", () => {
    expect(migration).toContain("public.user_dietary_preferences");
    expect(migration).toContain("public.meal_allergens");
    expect(migration).toContain("public.user_medications");
    expect(migration).toContain("public.food_medicine_interactions");
    expect(migration).toContain("SUBSTITUTION_ADDONS_REQUIRE_SUPPORT");
    expect(migration).toContain("public.route_meal_schedule_branch");
    expect(migration).toContain("IN ('routed', 'single_kitchen')");
  });

  it("blocks direct meal changes and records immutable substitution evidence", () => {
    expect(migration).toContain("guard_direct_meal_schedule_substitution_trigger");
    expect(migration).toContain("USE_SAFE_MEAL_SUBSTITUTION");
    expect(migration).toContain("meal_schedule_substitution_events");
    expect(migration).toContain("previous_state");
    expect(migration).toContain("result_state");
  });

  it("uses the server RPC instead of client-side ranking or direct schedule updates", () => {
    expect(hook).toContain('rpcClient.rpc("get_safe_meal_substitutes"');
    expect(hook).toContain('rpcClient.rpc("perform_safe_meal_substitution"');
    expect(hook).not.toContain("computeSimilarity");
    expect(hook).not.toContain('.update({ meal_id:');
  });
});
