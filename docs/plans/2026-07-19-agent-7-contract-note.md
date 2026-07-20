# Agent 7 Contract Note for Agent 0

## Implemented additive contract

- Adherence/team migration: `20260720140000_flexible_adherence_and_reward_compensation.sql`.
- Wallet settlement follow-up: `20260720181000_community_challenge_reward_settlement.sql`.
- New private table: `adherence_goals`.
- New owner-bound RPCs:
  - `ensure_my_adherence_goals()`
  - `upsert_my_adherence_goal(metric, frequency_per_week, target_value)`
  - `get_my_adherence_summary()`
- Additive challenge participant columns for reward version and compensation
  state; no shared enum is introduced.
- Existing `sync_my_community_challenges`, `calculate_community_challenge_progress`,
  `apply_community_challenge_progress`, and `get_challenge_team_state` signatures
  remain compatible.

## Shared dependencies

- Agent 1 owns the future consumption projection. Agent 7 reads the current
  explicit intake ledger as a compatibility adapter and must switch to Agent 1's
  projection during Wave 4 integration.
- Agent 9 owns notification delivery. Agent 7 adds no notification worker.
- Agent 0 remains the only owner of generated Supabase types, central routes,
  feature-flag registration, and shared translation files.

## Privacy and idempotency

- No direct client write can change challenge progress or XP.
- Completion and reversal use versioned source IDs in `xp_transactions`.
- Wallet rewards use immutable per-version settlement rows linked to wallet and
  reward transactions. Reversal debits available credit and carries any
  unrecovered remainder in `customer_wallets.reward_adjustment_due`, where future
  reward grants offset it before crediting spendable balance.
- Team responses expose aggregate contribution only, never raw health evidence.
- UI copy is kept local to Agent 7 components for handoff; Agent 0 receives a
  translation-key manifest rather than edits to `src/i18n/en.json` or `ar.json`.

## Feature-flag behavior

- `cooperativeChallenges` is default-off and continues to honor its registered
  phase-one dependencies.
- Off: adherence and team UI do not mount and no Agent 7 query or mutation can
  execute; legacy challenge rendering, leaderboard reads, and challenge join
  behavior remain available.
- On: English/Arabic and RTL-aware adherence, trusted-evidence, team contribution,
  standings, and wallet reward presentation are enabled.

## Translation key manifest for Agent 0

- `adherence_title`, `adherence_subtitle`, `adherence_strength`
- `adherence_meal_logging`, `adherence_activity`, `adherence_water`
- `adherence_days_this_week`, `adherence_on_track`, `adherence_remaining`
- `challenge_progress_reason_meals`, `challenge_progress_reason_activity`
- `challenge_progress_reason_water`, `challenge_progress_reason_generic`
- `challenge_team_contribution`, `challenge_verified_progress`
