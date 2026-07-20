# Nutrio Daily Performance Program

## Goal

Turn Nutrio's existing workout plan, nutrition state, recovery metrics, meal
ranking, and coach communication into one auditable daily decision. The coach
sets bounded, structured constraints; the server resolves the decision; every
client surface reads the same result.

## Product contract

The customer sees one **Today's performance decision** with:

- mode: train, recover, or rest;
- today's prescribed workout and any intensity cap;
- the nutrition envelope for the day and the best matching meal;
- one active, pinned coach directive;
- reasons, evidence freshness, and confidence;
- direct actions to start the workout, open the meal, sync recovery data, or
  message the coach.

The coach can publish a time-bounded directive with hard recommendation limits
and soft preferences. Hard limits filter/rerank recommendations but do not block
the customer from browsing or buying outside the plan. Medical safety,
allergies, and medicine conflicts always outrank coach preferences.

## Decision precedence

1. medical, allergy, and food-medicine safety;
2. active coach hard constraints;
3. recovery/readiness and the prescribed workout;
4. active nutrition goals;
5. delivery and commercial availability;
6. soft coach and customer preferences.

Soft rules may be relaxed when no candidate matches. Hard rules are never
silently relaxed. Missing or stale recovery data lowers confidence and keeps the
prescribed workout rather than inventing a recovery downgrade.

## Data model

### `coach_performance_directives`

Owner-bound structured directives with calorie range, protein minimum,
carbohydrate focus, hydration minimum, workout intensity cap, excluded meal
types, explanatory message, priority, status, and validity window. Only the
active assigned coach can create or change a directive for a client.

### `daily_performance_decisions`

One versioned decision per customer/date. It stores the resolved mode, source
workout/day, nutrition envelope, coach directive, reasons, evidence freshness,
confidence, recommended meal reference, and timestamps. The customer and active
coach can read; only server RPCs write.

## Server flow

`resolve_daily_performance_decision(date, user)` validates the actor, refreshes
the canonical daily performance snapshot for self-service requests, reads the
active workout day, health metrics, nutrition state, and active coach directive,
then upserts a versioned decision. Client-provided scores or macro totals are
never accepted.

Coach RPCs are assignment-bound:

- `upsert_coach_performance_directive(...)`
- `archive_coach_performance_directive(id)`
- `get_client_daily_performance_decision(client, date)`

Customer RPC:

- `get_my_daily_performance_decision(date)`
- `set_my_daily_performance_meal(date, meal)` after the existing safety-aware
  ranking engine chooses the candidate.

## User experience

The Dashboard renders the decision above the existing daily score. It does not
duplicate analytics: it summarizes the workout, nutrition, recovery, and coach
directive and links to the existing detailed experiences.

The coach client page gets a Performance Directive panel with validated fields,
an impact preview, publish/archive controls, and the currently resolved customer
decision.

## Failure behavior

- No health data: confidence is low, data is marked missing, planned workout is
  retained, and the user is prompted to sync.
- No workout: the decision defaults to recover/rest according to readiness and
  explains that no workout is prescribed.
- No active coach: the customer still receives a system decision with baseline
  nutrition goals.
- No matching meal: show the nutrition envelope and open the ranked meal list;
  never invent a meal or weaken hard safety rules.
- Expired directive: ignored deterministically and preserved for audit.

## Verification

- RPC/RLS tests for customer isolation and active coach assignment.
- Unit tests for precedence, confidence, nutrition envelope, and hard/soft meal
  matching.
- UI tests for Arabic/RTL, missing data, no meal, coach publish, and 44px touch
  targets.
- Production build, lint, typecheck, migration dry-run, remote migration apply,
  and remote migration-history verification.

