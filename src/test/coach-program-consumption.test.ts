import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720201500_coach_program_consumption.sql"),
  "utf8",
);
const hook = readFileSync(resolve(process.cwd(), "src/hooks/useProgramCompletions.ts"), "utf8");

describe("coach program canonical consumption", () => {
  it("exposes a secure program-meal-only RPC and blocks direct projection writes", () => {
    expect(migration).toContain("record_coach_program_meal_consumption");
    expect(migration).toContain("cp.client_id = v_actor");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path TO ''");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.program_meal_completions");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.record_coach_program_meal_consumption");
  });

  it("keeps nutrition immutable while applying full and reversed deltas", () => {
    expect(migration).toContain("v_snapshot := COALESCE(v_consumption.source_snapshot, v_consumption.nutrition_snapshot)");
    expect(migration).toContain("v_new_calories - v_old_calories");
    expect(migration).toContain("IF v_status = 'full'");
    expect(migration).toContain("ELSE 'reversed' END");
    expect(migration).toContain("INSERT INTO public.program_meal_completions");
    expect(migration).toContain("DELETE FROM public.program_meal_completions");
  });

  it("routes hook checkoffs exclusively through the canonical RPC", () => {
    expect(hook).toContain('"record_coach_program_meal_consumption"');
    expect(hook).not.toContain('.from("program_meal_completions")\n            .delete()');
    expect(hook).not.toContain('.from("program_meal_completions")\n            .insert(');
  });
});
