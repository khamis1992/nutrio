import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = readRepoFile("supabase/migrations/20260718090000_ai_coach_conversations_and_memory.sql");
const coachFunction = readRepoFile("supabase/functions/ai-coach/index.ts");
const routerFunction = readRepoFile("supabase/functions/ai-router/index.ts");

describe("AI Coach security boundary", () => {
  it("stores private conversations and memory behind forced RLS", () => {
    expect(migration).toContain("ALTER TABLE public.ai_coach_conversations FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.ai_coach_messages FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.ai_coach_memories FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("user_id = (SELECT auth.uid())");
    expect(migration).toContain("REVOKE ALL ON TABLE public.ai_coach_messages FROM anon, authenticated");
    expect(migration).toContain("GRANT SELECT ON TABLE public.ai_coach_messages TO authenticated");
    expect(migration).not.toContain("GRANT INSERT ON TABLE public.ai_coach_messages TO authenticated");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_ai_coach_consent");
    expect(migration).toContain("'nutrition_coaching'");
  });

  it("derives identity from the authenticated request and scopes every owned resource", () => {
    expect(coachFunction).toContain("authenticateRequest(req)");
    expect(coachFunction).toContain('.eq("user_id", userId)');
    expect(coachFunction).toContain('.eq("user_id", principal.user.id)');
    expect(coachFunction).not.toMatch(/body\.userId|body\.user_id/);
    expect(coachFunction).toContain("enforceRateLimit");
    expect(coachFunction).toContain("health_ai_consent_required");
  });

  it("loads nutrition records server-side and constrains long-term memory", () => {
    for (const table of ["profiles", "nutrition_goals", "progress_logs", "water_entries", "nutrition_logs"]) {
      expect(coachFunction).toContain(`from("${table}")`);
    }
    expect(routerFunction).toContain('task === "nutrition_coach"');
    expect(routerFunction).toContain('service.rpc("reserve_ai_coach_request"');
    expect(routerFunction).toContain('service.rpc("complete_ai_coach_request"');
    expect(routerFunction).toContain("Only create memory updates for stable facts the user explicitly stated");
    expect(routerFunction).toContain("Do not diagnose");
  });
});
