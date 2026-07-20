# Agent 2 Contract Note: Nutrition Quality and Micronutrients

Status: integrated and approved by Agent 0

## Ownership

Agent 2 owns nutrition completeness calculation, normalized nutrient facts and provenance, immutable nutrition revisions used by committed meals, partner correction workflows, customer adequacy projections, and the admin missing-data queue.

## Data contract

- Missing is distinct from measured zero.
- Units are normalized before persistence and aggregation.
- Nutrition versions advance transactionally when measured facts change.
- Committed meal/order snapshots retain the version and source used at commitment.
- Customer adequacy displays only measured nutrients and exposes missing coverage honestly.

## Runtime contract

- Feature flag: `phase1-micronutrients`, default off.
- Flag-off behavior: existing macro experiences remain unchanged and new micronutrient UI/writes are suppressed.
- Partner corrections are restaurant-scoped; admin review uses role-scoped access.

## Rollback

Disable the flag and hide new capture/adequacy surfaces. Preserve captured facts, provenance, and historical snapshots for auditability.

