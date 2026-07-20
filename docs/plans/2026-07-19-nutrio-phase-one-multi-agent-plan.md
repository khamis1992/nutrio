# Nutrio Phase One Multi-Agent Implementation Plan

## 1. Objective

Build a closed loop for prepared restaurant meals:

`goal + health data + activity + preferences -> safe meal ranking -> order/schedule -> delivery -> consumption confirmation -> nutrition progress -> recommendation update`

The result must make Nutrio better at selecting, delivering, and measuring prepared meals. It must not add home cooking, recipes, pantry inventory, or grocery shopping.

## 2. Definition of success

- A customer sees meals ranked against today's actual remaining needs, availability, delivery time, preferences, allergies, and medicine constraints.
- A committed order stores an immutable nutrition snapshot.
- Delivery never implies consumption. The customer can confirm full, partial, skipped, or substituted consumption.
- Confirming consumption updates nutrition exactly once and can be safely edited or reversed.
- Wearable and activity data has a source, external ID, sync status, and deduplication key.
- Recommendations explain their score and disclose missing or stale data.
- Existing workout progression, RPE/RIR, rest timer, rewards ledger, and challenge infrastructure are extended rather than rebuilt.
- Arabic and English flows pass mobile viewport, RTL, accessibility, RLS, and end-to-end tests.

## 3. Scope

### Included

1. Order-to-consumption nutrition lifecycle.
2. Restaurant meal nutrition completeness and micronutrient adequacy.
3. Deterministic personalized meal ranking with explainable reasons.
4. Unified wearable ingestion and source provenance.
5. Outdoor activity capture/import and activity guidance.
6. Strength-training usability additions that complement current progression.
7. Flexible adherence, team challenges, and ledger-backed rewards.
8. Optional health journal and cycle-aware context.
9. Notification, analytics, privacy, security, and release controls.

### Excluded

- Home recipes, recipe URL import, cooking instructions, pantry, grocery lists, household food expenses, and food-expiry management.
- Diagnosis, treatment, fertility prediction, or unrestricted AI changes to nutrition targets.
- Reverse engineering proprietary WHOOP, Garmin, Oura, or Apple scoring formulas.
- Replacing the existing order, wallet, XP, workout progression, or notification systems.

## 4. Mandatory agent workflow

Every implementation agent must complete these steps before coding:

1. Read the external sources assigned in this document.
2. Read the listed Nutrio files and migrations.
3. Write `docs/research/<workstream>-review.md` containing:
   - feature behavior learned from each source;
   - the Nutrio gap;
   - the smallest phase-one implementation;
   - data/privacy risks;
   - license notes;
   - behavior intentionally not copied.
4. Submit a contract note to Agent 0 before creating a migration or shared type.
5. Implement only inside the assigned ownership boundary.
6. Add unit, integration/RPC, RLS, and mobile UI tests appropriate to the change.
7. Run `npm run lint` and `npm run typecheck` before handoff.

No agent may claim completion from UI screenshots alone.

## 5. Shared architecture contracts

Agent 0 freezes these contracts before feature branches begin:

### 5.1 Meal facts

- `planned`: appears in a schedule and is a forecast only.
- `ordered`: commercially committed and stores a nutrition snapshot.
- `delivered`: available to consume but contributes zero actual intake.
- `consumed`: explicit customer fact with portion from `0` to `1`.
- `substituted`: links the consumed meal to the original planned/ordered meal.
- `reversed`: compensating event; history is not destructively rewritten.

The canonical idempotency identity is `(user_id, source_type, source_id, meal_id, event_type, event_version)`.

### 5.2 Nutrition snapshots

An order item snapshot contains calories, protein, carbs, fat, fiber, sugar, sodium, available micronutrients, allergens, serving quantity, source meal ID, and nutrition version. Historical reporting reads the snapshot, not the current partner menu.

### 5.3 Health measurements

Every imported sample has provider, provider user, external record ID, metric type, value, unit, start/end time, timezone, received time, raw checksum, and quality state. Daily aggregates are derived and rebuildable.

### 5.4 Recommendation result

Each result stores engine version, input freshness, hard exclusions, component scores, final score, explanation codes, and selected availability/price context. The UI translates explanation codes; it does not persist generated prose as truth.

### 5.5 Notifications

Agents emit domain events. The notification workstream maps them to in-app, push, and deep links through existing preferences and delivery workers. Feature agents do not create one-off push pipelines.

## 6. Agent topology

### Agent 0: Architecture and Integration Lead

**Mission:** Own shared contracts, merge order, migration allocation, generated types, central routes, and final integration.

**Reads first:**

- `src/App.tsx`, `src/customer/routes.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260712130000_secure_order_delivery_lifecycle.sql`
- `supabase/migrations/20260712135000_atomic_meal_scheduling.sql`
- `supabase/migrations/20260712138500_secure_delivered_meal_progress.sql`
- Research notes accompanying this plan

**Deliverables:** ADRs for meal facts, nutrition snapshots, health event provenance, recommendation contract, and domain notifications; migration registry; feature flags; merge checklist.

**Exclusive ownership:** `src/App.tsx`, `src/customer/routes.tsx`, generated Supabase types, shared database enums, and cross-feature schema contracts.

### Agent 1: Order-to-Consumption Lifecycle

**Mission:** Make planned, ordered, delivered, consumed, partial, skipped, substituted, edited, and reversed states consistent and idempotent.

**Sources:** [OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker) for diary behavior; existing Nutrio atomic order and meal logging migrations are authoritative for local behavior.

**Primary Nutrio files:**

- `src/pages/Schedule.tsx`, `src/pages/OrderDetail.tsx`, `src/pages/Notifications.tsx`
- `src/hooks/useMealCompletion.ts`, `src/hooks/useUserOrders.ts`, `src/hooks/useOrderModification.ts`
- `src/lib/meal-log-service.ts`, `src/lib/schedule-meals.ts`
- delivered meal, atomic scheduling, manual logging, completion, and reversal migrations

**Deliverables:** consumption-event schema/RPCs; immutable order-item nutrition snapshot; confirmation sheet; partial portion control; substitution link; reversal; idempotency and concurrency tests.

**Acceptance:** delivery alone changes no consumed calories; repeated confirmation produces one result; partial consumption scales nutrients; edit/reverse preserves an audit trail; unauthorized users fail RLS/RPC tests.

### Agent 2: Meal Nutrition Quality and Micronutrients

**Mission:** Ensure partner meals contain reliable nutrition data and expose daily/weekly micronutrient adequacy.

**Sources:** [Open Food Facts](https://github.com/openfoodfacts/openfoodfacts-server) for taxonomy/provenance and [OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker) for micronutrient presentation.

**Primary Nutrio files:**

- `src/pages/partner/PartnerMenu.tsx`, `src/pages/MealDetail.tsx`
- `src/lib/nutrition-types.ts`, `src/lib/meal-log-service.ts`, `src/lib/meal-health-tagger.ts`
- `src/components/NutritionLabelScanSheet.tsx`
- `20260714175922_extended_manual_nutrition.sql` and nutrition knowledge migrations

**Deliverables:** nutrient completeness score; required partner validation; nutrient provenance/version; daily/weekly adequacy RPC; customer micronutrient panel; admin/partner missing-data queue.

**Acceptance:** no fake zero is shown as measured data; missing differs from zero; snapshots retain historical values; units normalize correctly; Arabic nutrient labels and RTL layouts pass tests.

### Agent 3: Explainable Meal Ranking

**Mission:** Rank available restaurant meals for the customer's current day without using AI as the decision authority.

**Sources:** [wger](https://github.com/wger-project/wger) for structured nutrition/plan concepts, [Open Food Facts](https://github.com/openfoodfacts/openfoodfacts-server) for food attributes, and Nutrio's existing ranking logic.

**Primary Nutrio files:**

- `src/pages/recommendations/SmartMealRecommendations.tsx`, `src/pages/Meals.tsx`
- `src/hooks/useMealRecommendations.ts`, `src/hooks/useHealthFilteredMeals.ts`
- `src/lib/mealRanking.ts`, `src/lib/meal-impact-preview.ts`, `src/lib/nutrition-performance.ts`

**Hard-gate order:** availability -> ownership/restaurant validity -> allergens -> medicine conflicts -> diet rules -> remaining credits/budget -> scoring.

**Scoring inputs:** remaining calories/macros/micronutrients, active goal, consumed facts, activity allowance cap, preference history, ratings, variety, delivery window, availability, and price/credit eligibility.

**Deliverables:** versioned deterministic scoring library; explanation codes; input freshness; ranking audit table; UI reasons; offline fallback; experiment events.

**Acceptance:** the same inputs/version return the same ordering; excluded meals never re-enter through AI; stale health data is disclosed; no recommendation exceeds commercial availability; every score is decomposable.

### Agent 4: Wearable Data Platform

**Mission:** Normalize wearable data once and make provider sync trustworthy.

**Sources:** [Open Wearables](https://github.com/the-momentum/open-wearables), [Gadgetbridge](https://github.com/Freeyourgadget/Gadgetbridge), and [openScale](https://github.com/oliexdev/openScale).

**Primary Nutrio files:**

- `src/hooks/useHealthIntegration.ts`, `useHealthKitIntegration.ts`, `useHealthDailyMetrics.ts`
- `src/lib/health-integrations.ts`, `health-service.ts`, `health-daily-metrics.ts`
- `src/services/health/healthkit.ts`
- `health_sync_data`, `health_daily_metrics`, and SportHub migrations

**Provider rollout:** existing Apple/Google flows first; SportHub normalization second; historical file import third; Garmin/WHOOP/Oura/Fitbit/Ultrahuman adapters only after credentials and API approval.

**Deliverables:** provider adapter interface; event-level samples; dedupe/checksum policy; sync cursors; source precedence; stale/error UI; reconnect/revoke; body-scale capability spike.

**Acceptance:** replayed payloads do not double count; two providers for the same metric follow a documented precedence rule; delete/revoke behavior is verified; aggregates can be rebuilt from samples.

### Agent 5: Outdoor Activity Experience

**Mission:** Add mobile-native walking/running/cycling capture without duplicating general workout logging.

**Sources:** [OpenTracks](https://github.com/OpenTracksApp/OpenTracks), [RunnerUp](https://github.com/jonasoreland/runnerup), [FitTrackee](https://github.com/SamR1/FitTrackee), and [Endurain](https://github.com/joaovitoriasilva/endurain).

**Primary Nutrio files:**

- `src/pages/LogActivity.tsx`, dashboard activity/progress pages
- `src/hooks/useAutoWorkoutDetection.ts`, `useGoogleFitWorkouts.ts`, `useWorkoutSession.ts`
- `src/lib/google-fit-workout-service.ts`, `src/lib/sporthubIntegration.ts`

**Deliverables:** recording state machine; foreground/background permission UX; local checkpointing; GPS route; pause/resume/auto-pause; pace/distance/time; optional HR zones; audio cues; GPX/TCX/FIT import contract; route privacy.

**Acceptance:** interrupted sessions recover locally; background permission denial has a safe fallback; routes are private by default; imported and synced activities dedupe; calories identify their calculation/source.

### Agent 6: Strength and Training Intelligence

**Mission:** Extend the existing workout engine with high-value usability, not another progression implementation.

**Sources:** [Liftosaur](https://github.com/astashov/liftosaur), [GoldenCheetah](https://github.com/GoldenCheetah/GoldenCheetah), and [wger](https://github.com/wger-project/wger).

**Primary Nutrio files:**

- `src/pages/nutrio/GuidedWorkout.tsx`, `WorkoutHistory.tsx`
- `src/pages/coach/CoachClientDetail.tsx`
- `src/lib/workout-progression.ts`, `workout-analytics.ts`, `workout-sequence.ts`
- current workout migrations from `20260718124000` onward

**Deliverables:** plate calculator; equipment profiles; muscle map; weekly prescribed-vs-completed volume; safe exercise substitutions; reusable templates; optional advanced training-load view.

**Acceptance:** current RPE/RIR, rest timer, day locks, progression, and coach prescriptions remain authoritative; substitutions preserve target intent; calculations have unit tests; no migration duplicates existing workout fields.

**Implementation status (2026-07-19):** Implemented and deployed. The guided workout now includes a profile-aware plate calculator and equipment inventory; in-session substitutions are restricted to matching primary muscle intent, body area/training category, and available equipment. Reusable templates continue to use the existing workout template implementation. Coach progress now shows a muscle map with prescribed-versus-completed weekly working sets, while workout history exposes an optional session-RPE training-load view. Pure calculations for plate loading, substitution safety, weekly volume, and training load are covered by unit tests. Additive migration `20260720130000_strength_equipment_profiles.sql` was applied to the linked Supabase project and is recorded in remote migration history. Generated Supabase type consolidation remains assigned to Agent 0 as required by the integration plan.

### Agent 7: Adherence, Team Challenges, and Rewards

**Mission:** Improve consistency without punishing one missed day and make community challenges genuinely cooperative.

**Sources:** [Loop Habit Tracker](https://github.com/iSoron/uhabits) and [Habitica](https://github.com/HabitRPG/habitica).

**Primary Nutrio files:**

- `src/pages/Community.tsx`, `src/pages/Rewards.tsx`, admin challenge pages
- `src/hooks/useCommunityChallenges.ts`, `useChallengeTeam.ts`
- `src/lib/community-challenge-service.ts`, `challenge-teams.ts`
- XP/reward ledger and team challenge migrations

**Deliverables:** flexible frequency goals; habit-strength score; cooperative team contribution; challenge evidence adapters for consumed meals/activity/water; ledger-only rewards; anti-duplication; transparent progress reasons.

**Acceptance:** no client can self-award progress or XP; the same source event counts once; deleted/reversed source events compensate correctly; private health details never appear on leaderboards.

### Agent 8: Health Context and Cycle-Aware Personalization

**Mission:** Add optional context that explains changes in appetite, recovery, symptoms, and performance.

**Sources:** [Nomie](https://github.com/open-nomie/nomie6-oss) and [Drip](https://github.com/bloodyhealth/drip).

**Primary Nutrio files:** health dashboard, profile privacy/consent settings, recommendation inputs, AI report generator, and existing health AI consent migrations.

**Deliverables:** configurable journal fields; mood/stress/appetite/digestive symptom entries; opt-in cycle phase logging; private trend correlations; consent and delete/export controls; recommendation explanation inputs.

**Acceptance:** feature is off by default; data is never social; AI receives only consented summaries; no fertility prediction or diagnosis; users can delete/export the complete dataset.

### Agent 9: Notifications, Analytics, and Observability

**Mission:** Provide one event-to-notification path and measurable product outcomes for every workstream.

**Sources:** Nutrio notification workers and [Loop Habit Tracker](https://github.com/iSoron/uhabits) for actionable reminder behavior.

**Primary Nutrio files:**

- `src/hooks/useNotifications.ts`, `usePushNotificationDeepLink.ts`
- `src/lib/notifications.ts`, `pushNotificationActions.ts`
- `src/pages/Notifications.tsx`
- notification preference, workflow, and delivery-runtime migrations

**Deliverables:** domain event catalogue; notification templates; preference mapping; quiet hours; deep links; delivery receipts; retry/dead-letter visibility; PostHog/Sentry event dictionary and dashboards.

**Acceptance:** notifications honor language, timezone, preferences, and quiet hours; retries are idempotent; every CTA deep-links to a valid route; sensitive values are absent from analytics payloads.

### Agent 10: QA, Security, and Release Gate

**Mission:** Independently validate contracts and prevent individually correct branches from creating a broken system.

**Starts in Wave 0:** creates contract tests and fixtures before feature merges.

**Deliverables:** migration/RLS tests; concurrency and replay tests; Arabic/English mobile E2E; accessibility; performance budgets; offline/interrupted-sync cases; feature flag rollback; release runbook.

**Mandatory scenarios:** duplicate delivery webhook, repeated consumption tap, meal changed after checkout, substitute meal, cancelled/refunded order, two wearable sources, timezone/DST boundary, stale health data, revoked provider, offline activity crash recovery, reward replay, and Arabic RTL overflow.

## 7. Parallel execution waves

### Wave 0: Contract freeze

Agents 0 and 10 work first. Agents 1-9 perform source review only. No feature migrations merge until the five shared contracts are approved.

### Wave 1: Foundations

Run Agents 1, 2, 4, and 9 in parallel:

- Agent 1 establishes actual consumption facts.
- Agent 2 establishes trustworthy meal nutrient snapshots.
- Agent 4 establishes trustworthy health facts.
- Agent 9 establishes the shared event/notification vocabulary.

Agent 10 builds fixtures and tests against all four contracts.

### Wave 2: Customer intelligence

Run Agents 3, 5, 6, and 7 in parallel after Wave 1 contracts are stable. Agent 3 may prototype earlier with fixtures but cannot ship until Agents 1, 2, and 4 provide production inputs.

### Wave 3: Sensitive personalization

Agent 8 implements journal/cycle context behind a disabled feature flag. Agent 3 consumes it only after consent and privacy tests pass.

### Wave 4: Integration and release

Agent 0 regenerates Supabase types once, integrates routes and translations, resolves shared-file changes, and freezes migrations. Agent 10 runs the full release matrix and signs off each feature flag separately.

## 8. Conflict prevention

- Each agent uses an isolated branch/worktree named `codex/phase1-<workstream>`.
- Only Agent 0 edits central routes, generated Supabase types, or shared enums.
- Only Agent 9 edits shared notification delivery workers.
- Each agent receives a migration timestamp range before coding; no reused timestamps.
- Agents do not modify `src/i18n/en.json` or `ar.json` directly. They submit a key manifest; Agent 0 applies both languages together.
- Shared function signatures are contract-tested before branches merge.
- Schema changes are additive in feature branches. Destructive cleanup happens only in a later reviewed migration.
- Every branch rebases after its dependency wave is merged and reruns focused tests.

## 9. Suggested migration allocation

| Owner | Reserved range |
|---|---|
| Agent 1 | `20260720080000`-`20260720085959` |
| Agent 2 | `20260720090000`-`20260720095959` |
| Agent 3 | `20260720100000`-`20260720105959` |
| Agent 4 | `20260720110000`-`20260720115959` |
| Agent 5 | `20260720120000`-`20260720125959` |
| Agent 6 | `20260720130000`-`20260720135959` |
| Agent 7 | `20260720140000`-`20260720145959` |
| Agent 8 | `20260720150000`-`20260720155959` |
| Agent 9 | `20260720160000`-`20260720165959` |
| Agent 0 integration fixes | `20260720170000`-`20260720175959` |

These ranges are reservations, not permission to create unnecessary migrations.

## 10. Release metrics

### Customer value

- Meal recommendation open-to-order conversion.
- Percentage of ranked meals with a visible explanation.
- Delivered meals with consumption outcome recorded.
- Nutrition logging correction/reversal rate.
- Weekly active nutrition trackers and connected health sources.
- Challenge participation and completion without reward duplication.

### Data quality

- Partner meals with complete calories/macros/fiber/sodium.
- Recommendation inputs that are fresh versus stale/missing.
- Duplicate wearable/event rejection rate.
- Order snapshot coverage.
- Notifications delivered, opened, failed, and dead-lettered.

### Guardrails

- Allergy/medicine hard-gate violations: zero.
- Unauthorized RLS/RPC access: zero.
- Duplicate consumption or reward transactions: zero.
- Health data appearing in analytics/social payloads: zero.
- P95 meal ranking latency and dashboard query count remain within the budget set in Wave 0.

## 11. Feature flags and rollout

Use independent flags for consumption lifecycle, micronutrients, ranking v2, wearable normalization, outdoor recording, training enhancements, cooperative challenges, and health context.

Roll out in this order:

1. Internal accounts and seeded fixtures.
2. Staff/partner nutrition validation.
3. Five percent customer cohort with shadow ranking.
4. Twenty-five percent after data-quality and safety review.
5. Full rollout per feature, not as one large release.

Every flag needs an owner, rollback action, monitoring query, and expiration date.

## 12. Final completion gate

The program is complete only when:

- all workstream research reviews exist;
- shared ADRs and contracts are approved;
- migrations apply cleanly to a fresh and upgraded database;
- generated types match the deployed schema;
- lint and typecheck pass;
- focused and full test suites pass;
- Arabic and English E2E pass on mobile viewport;
- RLS, replay, concurrency, privacy, and rollback tests pass;
- documentation identifies what shipped, what remains flagged, and what was deferred.
