# Agent 3 Ranking Closure Note

## Scope

Agent 3 owns the recommendation hook, ranking implementation, delivery-availability derivation, detailed recommendation screen, and focused tests. No route, locale JSON, migration, or shared feature-flag registry changes are part of this closure.

## Closed contracts

- `rankingV2` remains default-off in the shared registry. When disabled, `useMealRecommendations` executes the legacy query and `generateAllRecommendations` path. It does not execute V2-only safety, delivery, nutrient, activity, health-context, commercial, cache, or audit behavior.
- A failed legacy request cannot restore a cached V2 ranking. V2 cache reads and writes and ranking audits occur only on the enabled path.
- V2 reads the active `nutrition_goals` row. Its `goal_type` changes nutrition weighting, and its calorie, macro, and fiber targets override profile fallback values.
- Candidate fiber, sodium, and nutrient missing codes come from measured meal nutrition fields. Daily measured/missing coverage comes from `get_user_micronutrient_adequacy`; missing sodium or fiber is neutral and is never converted into a favorable measured zero.
- Delivery is fail-closed. A candidate is orderable only when routing and restaurant hours produce `deliveryAvailable === true`; false and unknown states receive `delivery_window_unavailable` and cannot enter the ranked list.
- The V2 screen calls confirmed results orderable, not live. The flag-off screen renders standard legacy recommendations without V2 scores or availability claims.

## Focused verification

- `src/lib/mealRanking.test.ts`: legacy/V2 selection, unknown-delivery exclusion, active goal weighting, and measured nutrient missingness.
- `src/lib/meal-delivery-availability.test.ts`: Qatar slots, operating hours, selected branch ETA, unavailable routing, and unknown operating hours.
- `src/test/recommendation-production-inputs.test.ts`: production subscription, wallet, routing, and recommendation-page wiring.

Run:

```powershell
npm.cmd run test:run -- src/lib/mealRanking.test.ts src/lib/meal-delivery-availability.test.ts src/test/recommendation-production-inputs.test.ts
```
