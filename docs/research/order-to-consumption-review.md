# Order-to-Consumption Source Review

## Scope

This review covers Agent 1 in the phase-one plan: the lifecycle from an external restaurant order through delivery and customer-confirmed consumption.

## External Reference

- Source: [OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker)
- License: GPL-3.0. Nutrio uses the project only as a product-behavior reference; no source code is copied.
- Relevant behavior reviewed:
  - A diary separates planned food from food that the user actually records.
  - Intake is organized by meal and date.
  - Nutrients are shown per entry and aggregated for the day.
  - Users can adjust or remove entries after logging.

## Nutrio Baseline

Nutrio already has the important safety foundations:

- `meal_schedules.order_status` and `orders.status` represent commercial delivery state.
- Delivery creates an actionable notification instead of automatically adding nutrition.
- `add_delivered_meal_to_progress` is owner-bound and idempotent for a full meal.
- `meal_history` is the intake ledger used by the customer experience.
- `progress_logs` stores the daily aggregate.
- XP is routed through `award_xp`, which provides a centralized transaction ledger.

The remaining gap is that the delivered-meal action supports only one result: consume the complete meal using the meal's current nutrition values.

## Decisions for Nutrio Phase One

1. Delivery and consumption remain separate facts.
2. Each ordered meal receives an immutable nutrition snapshot.
3. The customer can record `full`, `partial`, `skipped`, or `substituted` consumption.
4. A partial portion scales calories, protein, carbohydrates, fat, and fiber by the recorded percentage.
5. Editing a confirmation updates daily totals by the nutrient delta; it never adds the meal twice.
6. Reversing a confirmation writes a new audit event and removes only the previously applied delta.
7. Skipped meals remain visible in the audit trail but add no nutrition or XP.
8. A substitution must identify the replacement meal and stores its own immutable nutrition snapshot.
9. Only the owning customer can read or write consumption records. Direct table writes are denied; changes go through an owner-bound RPC.
10. Repeated requests with the same request ID return the existing result.

## Data Contract

The consumption record is keyed by `(user_id, source_type, source_id, source_meal_id)` and stores the current state. An append-only event row is added for every accepted change.

The RPC response must include:

- current status and portion percentage;
- scaled nutrition applied to the daily total;
- whether the request was a duplicate;
- the current event version;
- the related `meal_history` row when nutrition is applied.

## Acceptance Checks

- Marking an order delivered does not change `progress_logs`.
- Full consumption applies the immutable snapshot once.
- A 50% portion applies half of every tracked nutrient.
- Repeating the same request is a no-op.
- Editing 100% to 50% subtracts exactly half of the original values.
- Skipping or reversing removes the previously applied values without deleting the audit trail.
- Another authenticated user cannot read or mutate the record.
- Nutrition changes made to the live meal catalog after ordering do not change historical intake.

