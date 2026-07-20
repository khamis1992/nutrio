# Phase One Architecture and Integration Review

## Scope

This review covers the shared contracts owned by Agent 0. It is based on the
phase-one research notes, the central customer routes, generated Supabase
types, and the three existing order, scheduling, and delivered-meal
migrations listed in the execution plan.

## Source findings

### Existing Nutrio behavior

- `schedule_meals_atomic` already provides request-level scheduling
  idempotency. It remains authoritative for creating schedules.
- The delivery lifecycle migration validates order and delivery transitions,
  records status history, and protects operations with RLS and role checks.
- `add_delivered_meal_to_progress` is an explicit customer action rather than
  an automatic delivery side effect. It is idempotent for an order/meal pair,
  but reads current menu nutrition and assumes full consumption.
- Delivery notifications currently contain an action that invites the user to
  add a delivered meal to progress. This is a useful bridge, not the canonical
  phase-one consumption model.
- PostHog feature flags are already exposed through `src/lib/analytics.ts`.
  A second flag service would add inconsistency without adding capability.

### External references

- OpenNutriTracker supports separating diary actions from source food data and
  treating portions as user-entered facts.
- Open Food Facts demonstrates explicit nutrient provenance, units, and
  missing-data handling.
- Open Wearables demonstrates provider adapters, external identifiers, sync
  cursors, and replay-safe normalized records.
- wger demonstrates stable structured entities and versioned calculations;
  Nutrio recommendations still require its own deterministic safety gates.

## Nutrio gaps

1. Delivered-meal logging does not preserve an immutable order-item nutrition
   snapshot or partial portions.
2. Health aggregates exist without one frozen event-level provenance contract
   shared by every provider.
3. Recommendation explanations and input freshness are not represented by one
   versioned result contract.
4. Feature work can currently write notification rows directly, bypassing a
   consistent domain-event vocabulary.
5. Parallel migrations and central route/type edits need explicit ownership
   and automated collision checks.

## Smallest phase-one implementation

- Freeze the five ADRs in `docs/architecture/adr/` before feature migrations.
- Use additive schemas and append-only facts. Preserve existing RPCs as legacy
  bridges until their replacements pass replay, RLS, and upgrade tests.
- Use the existing PostHog integration with eight independent, default-off
  flags registered in `src/lib/phase-one-feature-flags.ts`.
- Reserve non-overlapping migration timestamp windows and validate them with
  `npm run phase1:contracts`.
- Regenerate Supabase types and integrate central routes once in Wave 4.

## Data, privacy, and operational risks

- Delivery must never imply consumption.
- Missing nutrient values must remain `null`; zero means a measured zero.
- Health payloads and sensitive context must not enter analytics, push bodies,
  community features, or recommendation prose.
- Event consumers must be replay-safe. Repeated webhooks, taps, and reward jobs
  must converge on one business result.
- Historical reads must use snapshots rather than mutable partner menu rows.

## License notes

External repositories are architectural and product references only. No GPL
or AGPL implementation is copied. Any future dependency or code import needs a
separate license review even when development is currently local.

## Behavior intentionally not copied

- Home cooking, pantry, grocery, and household-expense workflows.
- External projects' persistence schemas or scoring formulas.
- AI-selected safety overrides.
- Direct provider integrations without credentials, consent, deletion, and
  replay behavior.
- Automatic calorie credit equal to 100% of activity expenditure.

