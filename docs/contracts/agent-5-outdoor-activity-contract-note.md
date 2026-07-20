# Agent 5 Contract Note: Outdoor Activity

Status: integrated and approved by Agent 0

## Ownership

Agent 5 owns the recorder state machine, local checkpoint lifecycle, GPX/TCX/FIT adapters, native background-location bridge, outdoor activity page, completion service, and additive outdoor schema/RPCs. Existing workout sessions, health metrics, and challenge ledgers remain authoritative downstream projections.

## Runtime contract

- Feature flag: `phase1-outdoor-recording`, default off.
- Dependency: `phase1-wearable-normalization`.
- Flag-off behavior: no outdoor launch card, direct navigation returns to `/log-activity`, and no outdoor write path is reachable.
- Route visibility defaults to `private`.
- Completion and import operations are idempotent by user-scoped activity fingerprint.

## Localization and accessibility

All copy is provided through Nutrio translation keys. Arabic renders with RTL direction, directional icons reverse, controls retain a 44 px minimum target, and the 360 px viewport must not overflow.

## Rollback

Disable the flag. Existing completed records remain available to historical projections; local unfinished checkpoints remain recoverable until the user discards them or the feature is re-enabled.

