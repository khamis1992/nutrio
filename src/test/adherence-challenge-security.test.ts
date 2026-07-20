import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720140000_flexible_adherence_and_reward_compensation.sql"),
  "utf8",
);
const settlementMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720181000_community_challenge_reward_settlement.sql",
  ),
  "utf8",
);

describe("adherence and challenge reward boundaries", () => {
  it("keeps adherence rows private and exposes only authenticated RPCs", () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY[\s\S]*FORCE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/REVOKE ALL ON public\.adherence_goals FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/v_user_id UUID := auth\.uid\(\)/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_my_adherence_summary\(\) TO authenticated/);
  });

  it("does not expose evidence or challenge award helpers to clients", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.adherence_daily_value\(UUID, TEXT, DATE\) FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.apply_community_challenge_progress\(UUID, UUID\) FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.rebuild_xp_profile_from_ledger\(UUID\) FROM PUBLIC, anon, authenticated/);
  });

  it("makes reward completion and compensation replay-safe", () => {
    expect(migration).toContain("p_challenge_id::TEXT || ':v' || v_reward_version");
    expect(migration).toContain("'community_challenge_reversed'");
    expect(migration).toContain("p_user_id, -v_participant.reward_xp_amount");
    expect(migration).toContain("v_challenge.target_value > 0");
    expect(settlementMigration).toContain(
      "UNIQUE (participant_id, completion_version)",
    );
    expect(settlementMigration).toContain(
      "ux_wallet_transactions_user_idempotency_key",
    );
    expect(settlementMigration).toContain(
      "public.reverse_community_challenge_wallet_reward",
    );
    expect(settlementMigration).toContain(
      "reward_adjustment_due = coalesce(reward_adjustment_due, 0) + v_pending_recovery",
    );
  });

  it("re-evaluates ended challenges and keeps settlement helpers private", () => {
    expect(settlementMigration).toMatch(
      /FROM public\.community_challenges\s+WHERE id = p_challenge_id;/,
    );
    expect(settlementMigration).toContain(
      "public.settle_ended_community_challenges",
    );
    expect(settlementMigration).toContain(
      "cp.reward_settlement_finalized_at IS NULL",
    );
    expect(settlementMigration).toMatch(
      /REVOKE ALL ON FUNCTION public\.grant_community_challenge_wallet_reward[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
  });

  it("includes zero-success weeks in the weighted strength denominator", () => {
    expect(migration).toMatch(/count\(\*\) FILTER[\s\S]*GROUP BY age\.week_age/);
    expect(migration).not.toContain("\n      WHERE evidence.day::DATE <= v_today");
  });
});
