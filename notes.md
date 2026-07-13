# Notes: Nutrio x SportHub Integration

## Current State
- Dashboard Activity displays Nutrio-local workout sessions.
- SportHub outbound links include campaign and referral code.
- Account linking currently stores only a local `pending` row.
- SportHub webhook currently stores raw events with no user association or activity projection.
- Referral signup tracking exists but can lose attribution on transient failures.

## Implementation Notes
- `workout_sessions` supports `source`; it needs a stable external ID for idempotent SportHub projection.
- Webhook gateway JWT verification must be disabled because SportHub authenticates with HMAC, not a Supabase JWT.
- OAuth callback must be public but protected by one-time, expiring state.
- Linking status and external IDs must be server-managed.

## Completed Implementation
- OAuth 2.0 Authorization Code + PKCE start and callback functions.
- AES-GCM encryption for stored access and refresh tokens.
- Server-owned unlink flow.
- Timestamped HMAC webhook verification and idempotent event handling.
- Booking/activity projection with cancellation and no-show reversal.
- Manual pull synchronization for the previous 30 and next 90 days.
- Activity UI integration status, upcoming activity, refresh, and SportHub source labels.
- Reliable referral completion markers and preservation of the external referral user ID.
- Developer contract in Markdown and Word formats.

## Deployment Constraint
- Remote Supabase migration history is behind multiple unrelated local migrations. Use an isolated reviewed migration deployment; do not run `db push --include-all` blindly.
