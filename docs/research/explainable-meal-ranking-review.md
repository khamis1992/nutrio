# Explainable Meal Ranking Review

## Scope

Phase one ranks prepared restaurant meals against the customer's current day. It does not recommend recipes, groceries, pantry items, or home cooking.

## Sources reviewed

### wger

Source: https://github.com/wger-project/wger

- Nutrition is represented as structured plans and food/ingredient facts rather than generated prose.
- The project combines nutrition tracking with reusable plan concepts and a multilingual product surface.
- Nutrio should copy the behavior of explicit structured inputs and repeatable calculations, not source code or its home-food workflow.

License: application code is AGPL-3.0-or-later; documentation is CC-BY-SA-4.0; ingredient data has per-entry licensing. No wger code or data is copied into Nutrio.

### Open Food Facts

Sources:

- https://github.com/openfoodfacts/openfoodfacts-server
- https://github.com/openfoodfacts/api-documentation/issues/64

- Food attributes distinguish normalized tags, allergens, ingredients, serving facts, values per serving, and values per 100 g/ml.
- Missing nutrition facts are not equivalent to measured zero.
- Provenance and data freshness matter because the database is collaboratively maintained.
- Nutrio should retain structured attributes and disclose missing coverage instead of deriving safety claims from an aggregate nutrition score.

License: server code is AGPL-3.0 and the Open Food Facts database is ODbL. This work uses architecture and data-model concepts only; it does not copy code or import the database.

### Existing Nutrio ranking

Files reviewed:

- `src/lib/mealRanking.ts`
- `src/lib/recommendation-engine.ts`
- `src/hooks/useMealRecommendations.ts`
- `src/hooks/useHealthFilteredMeals.ts`
- `src/pages/recommendations/SmartMealRecommendations.tsx`
- `supabase/functions/recommend-meals/index.ts`
- `src/lib/meal-impact-preview.ts`
- `src/lib/nutrition-performance.ts`

The current system has three independent ranking paths. They use different weights and reasons, one labels the result as AI-matched, and unavailable/allergen meals can receive a score of zero instead of being removed. Remaining daily intake is only partially used. Medicine conflicts, input freshness, commercial eligibility, deterministic tie-breaking, component decomposition, and offline behavior are not consistently represented.

## Nutrio gap

1. Safety and commercial rules are mixed with scoring or omitted.
2. Results do not expose an engine version or a stable explanation-code contract.
3. The same inputs can be ordered differently because time is read inside scoring and ties have no stable key.
4. Daily remaining needs are not the authoritative nutrition input.
5. Missing and stale health/safety data are not disclosed.
6. Recommendation UI persists or receives prose instead of translating stable reason codes.
7. There is no privacy-minimized ranking audit record or offline fallback.

## Smallest phase-one implementation

- Add one pure, versioned TypeScript ranking library.
- Run hard gates in this order: availability, restaurant validity, allergens, medicine conflicts, diet rules, credit/budget eligibility, delivery window.
- Score only eligible meals using remaining macros, preferences, quality, variety, delivery, value, and available micronutrients.
- Cap activity allowance deterministically and disclose stale/missing activity data.
- Return component scores, final score, reason codes, hard exclusions, and input freshness.
- Use meal ID as the final deterministic tie-breaker.
- Cache the last successful result per user for a clearly marked offline fallback.
- Store a privacy-minimized audit through an authenticated RPC; never store medication names, allergen names, or raw health samples.
- Translate reason codes in the UI and emit sanitized experiment events.

## Data and privacy risks

- Allergy and medication inputs are health data. They must remain client-private or server-protected and must not enter analytics payloads.
- Missing safety mappings can create false reassurance. The UI must disclose incomplete coverage and avoid claiming that a meal is universally safe.
- Activity calories can over-inflate a meal budget. The allowance is capped and ignored when stale.
- Audit payloads can become a shadow health profile. Store IDs, counts, freshness states, scores, and codes only.
- Client-side audit writes are not trustworthy. Use an authenticated RPC with bounded JSON payloads and immutable rows.

## Behavior intentionally not copied

- No wger code, ingredient dataset, recipe workflow, or nutrition-plan UI is copied.
- No Open Food Facts data, Nutri-Score algorithm, crowdsourcing workflow, or package-scanning behavior is copied.
- No AI-generated ranking or generated safety explanation is introduced.
- No automatic nutrition-target changes are made.

