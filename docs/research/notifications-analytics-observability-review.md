# Notifications, Analytics, and Observability Review

## Scope

This review covers Agent 9 in the phase-one plan: mapping domain events to
notifications, preferences, quiet hours, deep links, delivery receipts, retries,
dead-letter visibility, and privacy-safe PostHog/Sentry telemetry.

## External reference

- Source: [Loop Habit Tracker](https://github.com/iSoron/uhabits)
- FAQ source: [Loop Habit Tracker reminders FAQ](https://github.com/iSoron/uhabits/discussions/689)
- License: GPL-3.0. Nutrio uses the project only as product-behavior reference;
  no source code, schemas, or algorithms are copied.
- Relevant behavior reviewed:
  - Each habit can have its own reminder time.
  - Reminder notifications can be acted on directly.
  - Reminder eligibility depends on whether the task is already complete and
    which days reminders are allowed.
  - The app emphasizes offline/private operation and does not require account
    data to make reminders useful.

## Nutrio baseline

Nutrio already has several useful foundations:

- `docs/architecture/adr/0005-domain-events-and-notifications.md` accepts the
  domain-event-first approach and says Agent 9 owns event-to-notification
  mapping.
- `src/hooks/useNotifications.ts` fetches unread notification count and uses
  Supabase realtime to invalidate the count.
- `src/hooks/usePushNotificationDeepLink.ts` validates push deep links, route
  types, UUID route parameters, allowed query keys, and pending notification
  taps before navigation.
- `src/lib/notifications.ts` creates in-app notifications and includes helper
  methods for order status, assigned driver, and driver delivery notices.
- `src/lib/pushNotificationActions.ts` centralizes several rich action groups,
  including meal reminder, streak risk, order update, challenge invite, weekly
  report, and delivery update actions.
- `src/pages/Notifications.tsx` supports grouped notification inbox views,
  mark-read/delete actions, coach-message replies, and smart-goal deep links.
- `supabase/migrations/20240101000000_add_notification_preferences.sql` adds
  profile-level channel preferences and push tokens.
- `supabase/migrations/20260105174543_02e39a14-0de2-4f25-b3bf-5744c01290d3.sql`
  adds a `notification_preferences` table for user-controlled settings.
- `supabase/migrations/20260716125000_secure_notification_workflows.sql` adds
  provider delivery claims, WhatsApp queue claiming, retries, and recovery
  notification leases.
- `supabase/migrations/20260717090000_harden_notification_delivery_runtime.sql`
  hardens WhatsApp delivery, verified recipients, preference enforcement, and
  post-expiry recovery notification claims.
- `supabase/migrations/20260717134000_harden_edge_quotas_and_delivery.sql`
  adds `notifications.dedupe_key` and a protected unique delivery identity.
- `supabase/functions/send-push-notification/index.ts` persists canonical
  notification rows, enforces idempotency claims, sends FCM pushes, deactivates
  invalid tokens, and records security events.
- `supabase/functions/process-whatsapp-notifications/index.ts` claims bounded
  WhatsApp batches, validates provider success receipts, retries completion,
  and records security events.
- `src/lib/analytics.ts` initializes PostHog only after consent, disables
  autocapture/session replay, and sanitizes event properties.
- `src/lib/sentry.ts` disables Sentry PII and session replay, strips request
  bodies/query strings, redacts sensitive keys, and masks IDs in URLs.

## Nutrio gaps

1. There is no central domain event catalogue yet, and no shared event-to-
   notification template map for phase-one workstreams.
2. Preference state is split between `profiles.notification_preferences` JSONB
   and the `notification_preferences` table. The delivery workers mainly read
   profile JSONB, while the settings page writes the table.
3. Quiet hours are present in generated Supabase types but not installed by the
   visible preference migrations and not enforced in the push, in-app, or
   WhatsApp delivery path.
4. Language and timezone are not part of the delivery decision contract. Client
   language is localStorage-based, while profile language exists separately.
5. Push templates exist client-side, but server delivery accepts arbitrary title
   and message strings. Localized copy is not consistently resolved from a
   trusted template key.
6. Some notification helpers contain mojibake copy in `src/lib/notifications.ts`,
   which can leak broken user-facing text.
7. The inbox supports generic actions, but notification rows do not have one
   canonical CTA contract tying `type`, `template_key`, `deep_link`, and action
   telemetry together.
8. Provider delivery idempotency exists, but there is no operator-facing
   notification delivery dashboard or normalized dead-letter view for product
   notifications.
9. PostHog has privacy guards, but there is no event dictionary for phase-one
   notification, deep-link, retry, delivery, and CTA outcomes.
10. Rich push actions include some no-op placeholders such as snooze actions,
    but action receipts are not recorded.

## Smallest phase-one implementation

1. Freeze a small domain event catalogue and notification mapping contract
   before adding migrations. The catalogue should start with phase-one events
   that already have clear CTAs:
   - `order.delivered.v1`
   - `meal.consumption_recorded.v1`
   - `meal.consumption_prompt_due.v1`
   - `health.sync_failed.v1`
   - `health.weekly_report_ready.v1`
   - `goal.adjustment_recommended.v1`
   - `challenge.reward_granted.v1`
   - `subscription.expired.v1`
   - `subscription.recovery_due.v1`
   - `coach.message_received.v1`
2. Define one notification template registry keyed by template id. Store
   localized title/body keys, preference key, allowed channels, quiet-hours
   policy, urgency, CTA route type, and safe analytics event name.
3. Use the existing safe deep-link types from
   `src/hooks/usePushNotificationDeepLink.ts` as the canonical allowed route
   list. Add missing route types only through Agent 9.
4. Make preference resolution explicit:
   - read `notification_preferences` table first for phase-one user settings;
   - fall back to `profiles.notification_preferences` JSONB for legacy channel
     settings;
   - write compatibility updates while both systems exist.
5. Add quiet-hour columns if absent: `timezone`, `quiet_hours_enabled`,
   `quiet_hours_start`, and `quiet_hours_end`. Default timezone should be
   `Asia/Qatar` until a user-specific timezone is saved.
6. Enforce quiet hours at claim/send time for non-critical notifications. Store
   `suppressed_at` for disabled channels and `deferred_until` for quiet-hour
   deferrals.
7. Keep provider sends replay-safe by using the existing
   `claim_notification_delivery` and `complete_notification_delivery` RPCs.
8. Add delivery/action receipts with no raw health, location, message, phone, or
   address data:
   - notification created;
   - channel suppressed;
   - channel deferred;
   - provider attempted;
   - provider delivered;
   - provider failed;
   - CTA opened;
   - action tapped.
9. Create a service-role-only status view for notification operations that
   exposes counts, oldest pending item, retries, exhausted rows, and suppression
   reasons without recipient PII.
10. Add a PostHog/Sentry dictionary for Agent 9 events and use only sanitized
    IDs, event types, template ids, channel names, outcome codes, and retry
    counts.

## Data, privacy, and operational risks

- Push and analytics payloads must not include raw measurements, meal journal
  text, medication context, blood-work details, driver location, recipient
  phone/email, customer names, addresses, or free-form support/coach message
  bodies.
- User-visible copy should be resolved from trusted template keys, not stored as
  arbitrary event payload text, except for existing legacy rows.
- Quiet-hours deferrals must be idempotent and bounded so they do not create an
  infinite retry loop.
- High-priority security and transactional delivery alerts need an explicit
  bypass policy; marketing, habit, weekly report, coach, and achievement nudges
  should respect quiet hours.
- The split preference model can cause opt-out drift. Phase one should choose a
  canonical read order and record the compatibility period in the contract.
- Deep links must continue to reject arbitrary paths, untrusted query keys, and
  invalid UUIDs.
- Provider receipts should store provider-safe message identifiers only, never
  whole provider response bodies.

## Acceptance checks

- A user who disables a preference does not receive in-app, push, WhatsApp, or
  email delivery for that preference key, unless the template is explicitly
  marked mandatory/security.
- Non-critical notifications during quiet hours are deferred to the next
  allowed local time using the user's timezone.
- Template output follows the user's language preference and falls back to
  English when a translation key is missing.
- Replaying the same domain event creates at most one notification row per
  user/type/dedupe key and at most one provider send per channel/idempotency key.
- Every CTA deep link validates through the existing safe deep-link registry and
  opens a known route.
- Provider failures move through bounded retries and expose exhausted/dead-letter
  counts to operators without recipient PII.
- Analytics payloads contain template ids, event names, route types, outcomes,
  retry counts, and channel names only.
- Tests cover preference suppression, quiet-hour deferral, duplicate replay,
  invalid deep-link rejection, provider retry exhaustion, and analytics
  sanitization.

## License notes

Loop Habit Tracker is GPL-3.0. It is a behavior reference only. Nutrio must not
copy Loop source code, schemas, notification implementations, scoring formulas,
assets, or tests into this proprietary codebase without a separate license
review.

## Behavior intentionally not copied

- Loop's habit score formula and automatic schedule inference.
- Home-screen widgets.
- Offline-only data storage model.
- Android-specific reminder troubleshooting behavior.
- Direct check/dismiss notification implementation details.
