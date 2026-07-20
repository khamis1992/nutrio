# ADR 0003: Event-Level Health Provenance

- Status: Accepted for phase-one implementation
- Owner: Agent 0
- Consumers: Agents 3, 4, 5, 8, and 10

## Decision

Every imported health sample is an event-level record with:

- provider and provider user ID;
- external record ID;
- metric type, value, and canonical unit;
- source start/end time and source timezone;
- received time;
- raw checksum;
- quality state and optional quality reason;
- sync connection ID and ingestion version.

The replay identity is provider-scoped. Prefer
`(connection_id, external_record_id, metric_type)` when an external ID is
stable; otherwise use a documented deterministic fingerprint of provider,
metric, times, normalized value/unit, and source device.

Daily metrics are derived projections. They must retain source coverage and be
rebuildable from accepted samples. Provider precedence is metric-specific,
versioned, and visible in the aggregate metadata.

## Quality states

The shared logical values are `accepted`, `duplicate`, `invalid`, `stale`, and
`revoked`. Feature migrations may use a check constraint initially; only Agent
0 may introduce or edit a shared database enum.

## Privacy and lifecycle

- Raw provider payloads are minimized, encrypted where retained, and never
  sent to analytics or community surfaces.
- Revocation stops sync immediately and marks/deletes data according to the
  user's consent policy.
- Recommendation inputs disclose stale or missing source data.
- Timezone and DST boundaries are resolved from source timestamps, not the
  server timezone.

## Consequences

Agent 4 owns adapters, sync cursors, samples, and rebuildable projections.
Agents 3, 5, and 8 consume normalized records only. Agent 10 tests replay, two
providers for one metric, DST, stale data, revoke, and rebuild behavior.

