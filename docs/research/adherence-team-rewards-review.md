# Adherence, Team Challenges, and Rewards Review

## Scope

This review covers Agent 7 in the phase-one plan: flexible adherence goals,
habit-strength feedback, cooperative team contribution, trusted challenge
evidence, and ledger-backed rewards.

## External source findings

### [Loop Habit Tracker](https://github.com/iSoron/uhabits)

- Flexible schedules support goals such as several repetitions per week rather
  than requiring an unbroken daily chain.
- Habit strength grows with repeated evidence and decays gradually. Missing one
  day after a long period of consistency does not erase prior progress.
- The useful product behavior is the forgiving feedback model, not Loop's exact
  formula or persistence design.
- License: GPL-3.0. Nutrio does not copy source code, formulas, UI assets, or
  database structures.

### [Habitica](https://github.com/HabitRPG/habitica)

- Shared goals work when each member's verified contribution advances a common
  outcome and individual responsibility remains visible.
- Rewards make progress motivating, but punitive health mechanics and fantasy
  economy complexity do not fit Nutrio's health context.
- License and contribution rules require treating Habitica as a behavioral
  reference only. No source code or assets are copied.

## Nutrio baseline and gap

Nutrio now has server-calculated challenge progress, team membership, team
standings, an append-only XP ledger, wallet transactions, reward transactions,
and versioned wallet settlement records. Clients cannot directly write team
scores or settle rewards. The remaining product gaps addressed by Agent 7 are:

1. adherence is expressed mainly as daily streaks rather than flexible weekly
   frequency;
2. a missed day has no forgiving strength score;
3. challenge completion XP is idempotent, but a deleted or reversed source
   event does not clear completion and compensate the XP;
4. team UI does not clearly show each member's privacy-safe contribution;
5. challenge cards show a number without explaining which trusted evidence
   category produced it.

## Smallest phase-one implementation

- Add owner-bound adherence goals for meal logging, activity, and water with a
  frequency of 1-7 qualifying days per week.
- Calculate a 12-week recency-weighted strength score. Recent weeks matter more,
  while one missed day only reduces the score gradually.
- Keep challenge progress derived from existing canonical tables and count each
  row/day once. No client-supplied progress value is accepted.
- Version challenge completion rewards. If canonical progress falls below the
  target after deletion or reversal, append a compensating negative XP ledger
  entry and clear completion. Re-achievement uses a new reward version.
- Advertise XP and wallet rewards only from the server-derived completion path.
  Migration `20260720181000_community_challenge_reward_settlement.sql` now grants
  wallet credit idempotently, records an immutable per-version settlement, and
  appends a compensating reversal when source evidence is invalidated. If spent
  credit cannot be fully recovered without making the wallet negative, the
  remainder becomes `reward_adjustment_due` and offsets future reward credit.
- Show evidence-category explanations and per-member progress without exposing
  calories, weight, water volume, medical information, or other private health
  details on leaderboards.

## Data and privacy risks

- Delivery cannot be treated as meal consumption. Phase one uses explicit
  `meal_history` intake rows as the compatibility adapter until Agent 1's
  append-only consumption projection is available.
- Direct writes to adherence or challenge progress tables could allow
  self-awarding. Mutations therefore use owner-bound RPCs, while challenge
  progress remains server-derived.
- Leaderboards expose only display name, avatar, aggregate progress, and rank.
- Reward replay is prevented by `(action_type, versioned source_id)` in the
  existing XP ledger.
- Wallet challenge credit is settled by owner-only database functions. Grant and
  reversal are keyed by participant completion version, linked to wallet and
  reward transaction rows, and never mutate historical ledger entries in place.

## Rollout boundary

- `cooperativeChallenges` remains default-off and depends on the consumption and
  wearable phase-one flags.
- While off, adherence and team components do not mount, so their queries and
  mutations cannot execute. The legacy challenge card, leaderboard reads, reward
  presentation, and existing challenge join mutation remain unchanged.
- Enabling the flag reveals localized adherence feedback, trusted evidence copy,
  team enrollment, privacy-safe member contribution, and team standings UI.

## Behavior intentionally not copied

- Punishment, lost health points, shame messaging, fantasy equipment, and
  competitive mechanics based on sensitive health values.
- Loop's exact habit score formula, source code, or local-only database model.
- Habitica's economy, quests, UI, assets, or source code.
- Client-awarded progress, XP, or wallet balances.
