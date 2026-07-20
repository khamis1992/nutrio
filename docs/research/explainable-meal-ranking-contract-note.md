# Agent 3 Contract Note: Explainable Meal Ranking

Status: integrated by Agent 0

## Recommendation result contract

Engine version: `meal-ranking-v2.0.0`

Each ranking run returns:

- `engineVersion`
- `generatedAt`
- `ranked[]`: meal, final score, component scores, explanation codes, input freshness
- `excluded[]`: meal ID and ordered hard-exclusion codes
- `inputFreshness`: `fresh`, `stale`, or `missing` per input family
- `activityAllowanceApplied`: capped calories actually included in remaining needs
- `offline`: whether the result came from the last successful local snapshot

The UI translates explanation codes. Generated prose is not part of the factual contract.

## Hard-exclusion order

1. `unavailable`
2. `restaurant_invalid`
3. `allergen_conflict`
4. `medicine_conflict`
5. `diet_rule_mismatch`
6. `commercially_ineligible`
7. `delivery_window_unavailable`

The first failing gate is the primary exclusion; all failed gates may be retained for audit. Excluded meals never enter scoring.

## Score components

All components are deterministic values from `0` to `100`:

- nutrition alignment: 40%
- preference history: 15%
- rating/quality: 10%
- variety: 10%
- delivery fit: 10%
- price/credit value: 10%
- micronutrient fit: 5%

The final score is the rounded weighted sum. Meal ID is the stable final tie-breaker.

## Proposed audit schema

One immutable row per ranking run:

- owner `user_id`
- `request_id`
- engine version and generation timestamp
- input freshness JSON
- excluded meal IDs with exclusion codes
- ranked meal IDs with final/component scores and explanation codes
- sanitized commercial context and activity allowance
- offline flag

The audit must not contain raw profile data, medication/allergen names, ingredient text, health samples, or generated prose. Authenticated users can read their own rows. Inserts go through a bounded security-definer RPC; updates/deletes are denied.

## Ownership and compatibility

- No central route, generated Supabase type, shared enum, or translation JSON change is required from Agent 3.
- Existing recommendation section shapes remain available during rollout.
- Agent 0 can regenerate database types and apply the translation-key manifest during integration.
- Production activation remains behind the phase-one `ranking v2` feature flag owned by Agent 0.
- `/recommendations` now renders the protected detailed explainable ranking page.
- Commercial gates use live subscription, snack-credit, and wallet-purchase eligibility.
- Delivery gates use the authenticated branch-routing result, customer default address, operating hours, branch capacity, distance, and preparation time.

## Translation key manifest

- `meal_rank_calorie_fit`
- `meal_rank_protein_gap`
- `meal_rank_macro_balance`
- `meal_rank_preference_match`
- `meal_rank_variety`
- `meal_rank_high_rating`
- `meal_rank_delivery_fit`
- `meal_rank_good_value`
- `meal_rank_micronutrient_fit`
- `meal_rank_stale_activity`
- `meal_rank_missing_safety_data`
- `meal_rank_offline_result`
