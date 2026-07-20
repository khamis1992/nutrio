# Agent 9 Contract Note for Agent 0

## Request

Agent 9 needs Agent 0 approval before adding shared notification migrations or
types. This note proposes the smallest phase-one contract that lets feature
agents emit events while keeping delivery, preferences, privacy, and telemetry
centralized.

## Proposed shared contracts

### Domain event envelope

Use ADR 0005 as the source of truth. Every phase-one producer inserts a
versioned, past-tense event with:

- `event_id`
- `event_type`
- `schema_version`
- `occurred_at`
- `aggregate_type`
- `aggregate_id`
- `actor_user_id`
- `audience_user_id`
- `producer_idempotency_key`
- `correlation_id`
- `causation_id`
- `payload`
- `privacy_classification`

### Phase-one event names

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

### Notification template fields

Each template should define:

- `template_key`
- `event_type`
- `notification_type`
- `preference_key`
- `channels`
- `urgency`
- `quiet_hours_policy`
- `title_i18n_key`
- `body_i18n_key`
- `deep_link_type`
- `deep_link_params_schema`
- `analytics_event`
- `privacy_classification`

### Preference resolution

Phase one should read preferences in this order:

1. `public.notification_preferences` row when present.
2. `public.profiles.notification_preferences` JSONB for legacy channel flags.
3. Conservative defaults from the template registry.

Agent 0 should confirm whether phase one may add missing columns to
`public.notification_preferences`: `timezone`, `quiet_hours_enabled`,
`quiet_hours_start`, `quiet_hours_end`, `push_notifications`, and per-template
preference keys not already represented.

### Delivery state

Agent 9 proposes one event delivery ledger, separate from provider-level claims:

- `event_id`
- `template_key`
- `user_id`
- `channel`
- `status`
- `dedupe_key`
- `deferred_until`
- `suppressed_at`
- `suppression_reason`
- `attempt_count`
- `last_error_code`
- `provider_message_id`
- `created_at`
- `updated_at`

Allowed statuses: `pending`, `deferred`, `suppressed`, `processing`,
`delivered`, `failed`, `dead_letter`.

Provider sends should continue using existing `claim_notification_delivery` and
`complete_notification_delivery` RPCs for channel/idempotency protection.

### Deep links

Agent 9 proposes reusing the existing safe deep-link registry in
`src/hooks/usePushNotificationDeepLink.ts` as the canonical client route
allowlist. Feature agents should request new route types through Agent 9 rather
than writing raw paths in event payloads.

### Analytics and observability dictionary

Initial event names:

- `notification_created`
- `notification_suppressed`
- `notification_deferred`
- `notification_delivery_attempted`
- `notification_delivery_succeeded`
- `notification_delivery_failed`
- `notification_dead_lettered`
- `notification_cta_opened`
- `notification_action_tapped`
- `notification_deep_link_rejected`

Allowed analytics properties:

- `event_type`
- `template_key`
- `notification_type`
- `channel`
- `preference_key`
- `quiet_hours_policy`
- `deep_link_type`
- `outcome`
- `error_code`
- `attempt_count`
- `retryable`

Disallowed analytics properties include names, email, phone, address, location,
message/body text, coach/support content, raw health values, raw nutrition
values, payment details, device tokens, provider response bodies, and arbitrary
payload JSON.

## Agent 0 integration decisions

Status: integrated and approved

1. `public.notification_preferences` is the canonical preference source.
2. Quiet hours remain disabled for existing users until explicitly configured.
3. Only templates explicitly classified as security/transactional may bypass quiet hours.
4. New notification copy is rendered from versioned English/Arabic template keys.
5. The delivery ledger remains in `security`; the customer inbox remains a separate public projection.
6. Provider errors are reduced to a fixed operational allowlist. Raw provider messages, identifiers, credentials, and PII are never retained in telemetry.

## Implementation boundaries

- Agent 9 owns shared delivery workers, preference mapping, template registry,
  telemetry dictionary, delivery receipts, and dead-letter visibility.
- Feature agents own only event emission inside their workstream.
- No feature agent should call push, WhatsApp, or email workers directly for new
  phase-one flows.
- No migration should use Agent 9's reserved timestamp range
  `20260720160000`-`20260720165959` except Agent 9.
