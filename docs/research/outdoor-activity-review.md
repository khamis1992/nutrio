# Agent 5 Research Review: Outdoor Activity Experience

Status: integrated and approved for phase-one closure

## Sources reviewed

- Nutrio activity logging, health daily metrics, challenge synchronization, and native Capacitor lifecycle code.
- Apple Core Location background-session behavior and Android foreground-location service constraints.
- GPX 1.1 and Training Center XML activity interchange formats.
- Garmin FIT as a binary import format handled through a dedicated adapter.
- Existing phase-one health-event provenance and domain-event ADRs.

## Existing Nutrio strengths retained

- `workout_sessions` remains the canonical completed-activity projection.
- Health daily metrics and community challenges are synchronized only after a successful, idempotent completion.
- Browser sessions remain foreground-only when native background tracking is unavailable.
- Checkpoints are local, recoverable, user-scoped, and cleared after save or explicit discard.

## Phase-one decisions

1. Recording supports walking, running, and cycling with explicit start, pause, resume, and finish states.
2. GPS points with invalid accuracy, impossible speed, or duplicate timestamps are rejected before distance is accumulated.
3. Auto-pause changes active duration without discarding the route.
4. Imported GPX, TCX, and FIT activities use a deterministic fingerprint for replay protection.
5. Routes are private by default and visibility changes are explicit.
6. The whole entry point and direct route are controlled by `phase1-outdoor-recording`, which is default-off and depends on wearable normalization.
7. All user-visible copy is available in English and Arabic, and the page sets a local RTL direction for Arabic.

## Rejected shortcuts

- Treating delivery or step totals as an outdoor workout.
- Continuing browser GPS silently in an unsupported background environment.
- Uploading every location point before the user finishes or recovers the session.
- Marking imports successful before database replay protection confirms the write.
- Exposing a route when the feature flag is disabled.

## Verification obligations

- Pure recorder tests cover noisy GPS, auto-pause, recovery, import parsing, and duplicate fingerprints.
- Route and launch surfaces must preserve the legacy activity logger while the flag is off.
- Mobile E2E covers Arabic/RTL rendering and no horizontal overflow at 360 px.
- Database release tests cover ownership, replay, and private-by-default storage.

