# ADR 0004: Deterministic Recommendation Results

- Status: Accepted for phase-one implementation
- Owner: Agent 0
- Consumers: Agents 2, 3, 4, 8, and 10

## Decision

Meal recommendation authority is a deterministic, versioned engine. It applies
hard gates in this order:

1. availability;
2. ownership and restaurant validity;
3. allergens;
4. medicine conflicts;
5. diet rules;
6. remaining credits and budget;
7. scoring.

AI may translate or summarize approved explanation codes. It cannot restore an
excluded meal, change the score, or persist generated prose as decision truth.

Each stored/audited result contains:

- engine version and evaluation time;
- input snapshot/hash and per-source freshness states;
- hard exclusions with stable reason codes;
- component scores, weights, final score, and rank;
- stable explanation codes with structured parameters;
- selected availability, delivery window, price, and credit context;
- fallback mode when required inputs are stale, missing, or offline.

Equal inputs and engine version must produce equal ordering. Ties use a
documented stable key. Sensitive health/context values are represented by
coarse eligibility or explanation codes, not copied into analytics events.

## Consequences

Agent 3 owns the engine and audit implementation. Agent 2 supplies trustworthy
nutrition; Agent 4 supplies freshness-qualified health facts; Agent 8 may add
opt-in context only behind its flag. Agent 10 tests gate precedence,
determinism, stale data, commercial availability, and score decomposition.

