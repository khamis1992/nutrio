import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260720246000_family_profiles_and_safeguards.sql"), "utf8");

describe("Family profiles launch contract", () => {
  it("requires explicit authorization and additional safeguards for minors", () => {
    expect(migration).toContain("FAMILY_PROFILE_AUTHORIZATION_REQUIRED");
    expect(migration).toContain("guardian_consent");
    expect(migration).toContain("MINOR_GUARDIAN_RELATIONSHIP_REQUIRED");
    expect(migration).toContain("family_member_consent_events");
  });

  it("keeps each member's safety, goals, and allowance independent", () => {
    expect(migration).toContain("allergies TEXT[]");
    expect(migration).toContain("calorie_target INTEGER");
    expect(migration).toContain("protein_target_g INTEGER");
    expect(migration).toContain("hydration_target_ml INTEGER");
    expect(migration).toContain("monthly_meal_allowance INTEGER");
  });

  it("checks ownership and structured allergens before schedule assignment", () => {
    expect(migration).toContain("assign_my_schedule_to_family_member");
    expect(migration).toMatch(
      /FROM public\.meal_schedules\s+WHERE id = p_schedule_id AND user_id = v_user_id\s+FOR UPDATE/,
    );
    expect(migration).toContain("JOIN public.meal_allergens");
    expect(migration).toContain("FAMILY_MEMBER_ALLERGEN_CONFLICT");
    expect(migration).toContain("schedule_family_meals_atomic");
    expect(migration).toContain("FAMILY_ALLOWANCE_EXHAUSTED");
    expect(migration).toContain("SCHEDULE_BENEFICIARY_MISMATCH");
  });

  it("removes direct mutations and preserves consent history", () => {
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.family_members FROM authenticated");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("deactivate_my_family_profile");
    expect(migration).toContain("'withdrawn'");
    expect(migration).toContain("WHERE user_id = v_user_id");
    expect(migration).not.toContain("subscriber_id = v_user_id");
    expect(migration).toContain("FAMILY_SCHEDULE_ASSIGNMENT_NOT_ALLOWED");
    expect(migration).toContain("IF v_used_count >= v_member.monthly_meal_allowance");
  });
});
