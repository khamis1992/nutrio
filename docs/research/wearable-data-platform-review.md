# Wearable Data Platform Review

## Sources Reviewed

- Open Wearables: unified provider API, normalized health data, provider connection lifecycle, sync jobs, and privacy through self-hosting. Nutrio should copy the normalization boundary and provider lifecycle shape, not its full platform.
- Gadgetbridge: local-first device syncing, no vendor account requirement, and a privacy posture that avoids sending unnecessary health data to clouds. Nutrio should adopt the provenance and revoke/delete expectations, not reuse AGPL code.
- openScale: body-scale measurements, user-controlled metric visibility, manual entry/import, and CSV portability. Nutrio should keep a body-scale capability path, not introduce scale pairing in phase one.

## Nutrio Gap

Nutrio already syncs Apple Health and Google Fit/Health Connect into `health_sync_data` and `health_daily_metrics`, but the current path stores daily aggregates directly. That makes replay dedupe, source precedence, sync cursors, revoke behavior, and aggregate rebuilds hard to verify.

## Smallest Phase-One Implementation

- Add a provider adapter contract in app code.
- Convert existing Apple/Google daily payloads into normalized metric samples.
- Store samples with provider, external ID, dedupe key, checksum, sync status, and raw source payload.
- Track provider sync state and cursors.
- Rebuild `health_daily_metrics` from accepted samples using documented provider precedence.
- Keep existing `health_daily_metrics` readers unchanged so dashboard/readiness UI continues to work.

## Source Precedence

For the same metric and day, Nutrio uses one provider aggregate rather than summing across providers:

1. `body_scale` for body metrics.
2. `apple_health`.
3. `google_fit`.
4. `sporthub`.
5. `file_import`.
6. `nutrio_activity`.
7. `manual`.

Within the selected provider, additive metrics are summed and sample metrics are averaged. This prevents Apple Health plus Google Fit from double counting steps or calories.

## Data and Privacy Risks

- Health data is sensitive and must stay user-scoped through RLS and RPC `auth.uid()`.
- Replays must not create duplicate samples or inflate daily totals.
- Revoking a provider must exclude its samples from rebuilt aggregates.
- Raw payloads should be retained only for debugging provenance and should not be sent to analytics.

## License Notes

- Open Wearables is MIT and can inform architecture.
- Gadgetbridge is AGPL/GPL family; do not copy implementation.
- openScale is GPL-3.0; do not copy implementation.

## Intentionally Not Copied

- No Garmin/WHOOP/Oura/Fitbit/Ultrahuman production adapters without credentials and API approval.
- No Bluetooth scale pairing in this phase.
- No proprietary readiness score cloning.
- No new AI interpretation of raw wearable data.
