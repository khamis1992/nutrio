# ADR 0001: Append-Only Meal Facts

- Status: Accepted for phase-one implementation
- Owner: Agent 0
- Consumers: Agents 1, 2, 3, 7, 9, and 10

## Decision

Nutrio records the commercial and nutritional lifecycle as separate facts:

| Fact | Meaning | Actual intake |
|---|---|---|
| `planned` | A schedule forecast that can still change | None |
| `ordered` | Commercially committed and linked to an immutable snapshot | None |
| `delivered` | Available to consume | None |
| `consumed` | Explicit customer confirmation with portion `0..1` | Portion-scaled |
| `substituted` | Consumed item linked to the original planned/ordered item | Portion-scaled |
| `reversed` | Compensating fact for an earlier fact | Removes prior projection |

A skipped meal is a `consumed` outcome with portion `0`, an explicit
`skipped` outcome code, and zero actual intake. It is not a deleted schedule.

Facts are append-only. Corrections create a new version and, when necessary, a
`reversed` fact referencing the superseded fact. Projections may be rebuilt;
facts may not be destructively rewritten.

The canonical idempotency identity is:

`(user_id, source_type, source_id, meal_id, event_type, event_version)`

Each command also accepts a client idempotency key. Database uniqueness is the
final authority; UI button disabling is not an idempotency mechanism.

## Invariants

- Delivery never writes calories or macros into actual intake.
- A portion is finite and between `0` and `1`, inclusive.
- A substitution keeps references to both original and consumed meal/items.
- Replaying a delivery webhook or consumption command has one business result.
- Cancellation/refund facts do not erase audit history.
- The user and source ownership are checked inside the RPC transaction.

## Compatibility

`add_delivered_meal_to_progress` remains a legacy bridge while the new
consumption lifecycle is disabled. When enabled, the customer action must call
the canonical consumption command with portion `1`; no new feature may extend
the legacy RPC or infer consumption from delivery.

## Consequences

Agent 1 owns the additive schema and RPC implementation. Agents 3 and 7 read
projections produced from facts, never schedules or delivery state as proof of
consumption. Agent 10 tests repeated taps, duplicate webhooks, substitutions,
reversals, refunds, and concurrent commands.

