# Agent 4 Wearable Contract Note

## Scope

Agent 4 owns normalized wearable samples, provider sync state, source selection,
and rebuildable `health_daily_metrics` projections. The additive
`20260720193000` migration completes the foundation in `20260720110000`; it does
not rewrite the applied migration or introduce shared enums.

## Event contract

Every new `wearable_metric_samples` row includes:

- `provider`, `provider_user_id`, and `connection_id`;
- provider-scoped external identity and deterministic `dedupe_key`;
- canonical metric value/unit and source start/end timestamps;
- IANA `source_timezone`, `received_at`, and raw checksum;
- `quality_state`, optional `quality_reason`, and `ingestion_version`.

Accepted quality states match ADR 0003: `accepted`, `duplicate`, `invalid`,
`stale`, and `revoked`. Ingestion rejects missing provenance, invalid values,
unknown timezones, and a `metric_date` that disagrees with the source-local
start date. Raw payload retention remains minimized in adapter output.

## Replay and projection

Replay identity remains unique on `(user_id, dedupe_key)`. Identical checksums
are counted as unchanged; corrected provider records update the existing event.
Only accepted, synced, non-revoked samples participate in projections.

Source precedence is metric-specific and versioned. SportHub wins workout and
active-calorie projections; Apple Health wins Apple/Google physiological and
sleep overlaps; body scales win body composition. Each daily projection stores
`selected_source_metadata` per metric with the selected provider, precedence,
precedence version, sample count, receive time, and all considered providers.

## Rollout and fallback

`wearableNormalization` remains default-off through the shared phase-one flag
registry. While off, native sync writes the legacy `health_daily_metrics` path
only. While on, normalized ingestion is authoritative, with legacy writes used
only for empty or failed normalized sync. Existing `health_sync_data` history is
preserved in both modes.

## Provider lifecycle

Server source state is `connected`, `syncing`, `synced`, `stale`, `error`, or
`revoked`. The settings UI reads that state and offers retry/reconnect actions.
Revocation tombstones provider events, records `quality_state = revoked`, and
rebuilds affected dates from the next eligible source. Re-ingesting after
consent restores the connection and replayed events. Server staleness is updated
by the auth-scoped `refresh_my_wearable_sync_staleness()` RPC.

## Adapters

Apple Health and Google Fit daily aggregates and glucose events emit the shared
provenance contract. Completed SportHub sessions normalize to workout and
active-calorie events. Existing GPX, TCX, and Garmin FIT imports feed the same
historical `file_import` adapter using their format/fingerprint replay identity.

## Verification

- `src/lib/wearable-normalization.test.ts`: replay, provenance, metric
  precedence, SportHub, malformed events, source timezone/DST, and historical
  import normalization.
- `src/lib/wearable-sync.test.ts`: batching, cursor replay overlap, partial
  failure, and cursor advancement.
- `src/lib/wearable-disconnect.test.ts`: provider credential revoke ordering.
- `supabase/tests/phase-one-wearable.sql`: database replay, two-provider
  precedence metadata, malformed/timezone rejection, RLS, revoke, rebuild,
  reconnect, and stale lifecycle.
