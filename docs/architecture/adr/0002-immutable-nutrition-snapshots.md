# ADR 0002: Immutable Nutrition Snapshots

- Status: Accepted for phase-one implementation
- Owner: Agent 0
- Consumers: Agents 1, 2, 3, and 10

## Decision

Every commercially committed order item stores an immutable nutrition
snapshot. Historical reporting and consumption projections read this snapshot,
not the current partner menu.

The snapshot contract contains:

- source meal ID, order item ID, serving quantity, serving unit;
- calories, protein, carbohydrate, fat, fiber, sugar, and sodium;
- available micronutrients as normalized `{ nutrient_code, value, unit }`
  entries;
- allergens and diet attributes known at commitment time;
- nutrition version, provenance/source type, source record ID, captured time;
- completeness score and explicit missing nutrient codes.

Values use canonical units before storage. Unknown is `null` or listed as
missing; it must never be converted to a fake zero. Snapshots are versioned
objects and are not updated after commitment.

## Capture boundary

The snapshot is created in the same transaction that makes an order item
commercially committed. Scheduling without commitment may retain a forecast,
but it is not historical nutrition truth.

Consumption facts reference the snapshot and store the portion. Derived intake
is calculated deterministically from snapshot values and portion. A menu edit
therefore changes future commitments only.

## Compatibility

Existing delivered-meal progress reads current `meals` values. It is a legacy
path behind the consumption-lifecycle flag and must not be used for new
historical reports. Backfilled historical records must declare provenance and
may be marked incomplete; they must not pretend to be checkout-time snapshots.

## Consequences

Agent 2 defines normalization and completeness rules. Agent 1 creates and
references snapshots transactionally. Agent 10 tests a meal changed after
checkout, missing versus zero, unit normalization, and partial portions.

