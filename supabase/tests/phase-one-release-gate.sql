BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, security, extensions, pg_temp;

SELECT plan(10);

CREATE TEMP TABLE phase_one_gate_observations (
  observation_key TEXT PRIMARY KEY,
  observed_count BIGINT NOT NULL
);
GRANT SELECT, INSERT ON phase_one_gate_observations TO authenticated;

CREATE TEMP TABLE phase_one_gate_ids (
  entity_key TEXT PRIMARY KEY,
  entity_id UUID NOT NULL
);
GRANT SELECT ON phase_one_gate_ids TO service_role;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'phase-one-owner@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111112',
    'authenticated', 'authenticated', 'phase-one-other@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'phase-one-arabic@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, preferred_language)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'en'::public.language_code),
  ('11111111-1111-4111-8111-111111111112', 'en'::public.language_code),
  ('22222222-2222-4222-8222-222222222222', 'ar'::public.language_code)
ON CONFLICT (user_id) DO UPDATE SET
  preferred_language = EXCLUDED.preferred_language;

INSERT INTO public.notification_preferences (user_id, system_alerts)
VALUES
  ('11111111-1111-4111-8111-111111111111', true),
  ('11111111-1111-4111-8111-111111111112', true);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*) FROM public.notification_preferences),
  1::BIGINT,
  'RLS exposes only the authenticated user notification preferences'
);

WITH changed AS (
  UPDATE public.notification_preferences
  SET system_alerts = false
  WHERE user_id = '11111111-1111-4111-8111-111111111112'
  RETURNING 1
)
INSERT INTO phase_one_gate_observations (observation_key, observed_count)
SELECT 'other-user-update', count(*) FROM changed;

SELECT is(
  (SELECT observed_count FROM phase_one_gate_observations WHERE observation_key = 'other-user-update'),
  0::BIGINT,
  'RLS rejects an update to another user notification preferences'
);

RESET ROLE;

INSERT INTO security.notification_event_templates (
  event_type, template_key, notification_type, preference_key, channels,
  quiet_hours_policy, deep_link_type, title_en, title_ar, body_en, body_ar, active
) VALUES (
  'challenge.reward_granted.v1', 'challenge_reward_granted_v1', 'achievement',
  'achievements', ARRAY['in_app', 'push'], 'respect', 'notifications',
  'Challenge reward earned', 'حصلت على مكافأة التحدي',
  'Your verified challenge reward is now available.',
  'مكافأة التحدي المؤكدة أصبحت متاحة الآن.', true
)
ON CONFLICT (event_type) DO UPDATE SET
  template_key = EXCLUDED.template_key,
  notification_type = EXCLUDED.notification_type,
  preference_key = EXCLUDED.preference_key,
  channels = EXCLUDED.channels,
  quiet_hours_policy = EXCLUDED.quiet_hours_policy,
  deep_link_type = EXCLUDED.deep_link_type,
  title_en = EXCLUDED.title_en,
  title_ar = EXCLUDED.title_ar,
  body_en = EXCLUDED.body_en,
  body_ar = EXCLUDED.body_ar,
  active = EXCLUDED.active;

INSERT INTO public.notification_preferences (
  user_id, push_notifications, achievements, quiet_hours_enabled,
  quiet_hours_start, quiet_hours_end, timezone
) VALUES (
  '22222222-2222-4222-8222-222222222222', true, true, true,
  (((now() AT TIME ZONE 'Asia/Qatar') - interval '1 minute')::TIME),
  (((now() AT TIME ZONE 'Asia/Qatar') + interval '1 hour')::TIME),
  'Asia/Qatar'
);

SELECT security.enqueue_domain_event(
  'challenge.reward_granted.v1',
  'community_challenge',
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'phase-one-local-db-gate',
  '{"challenge_id":"33333333-3333-4333-8333-333333333333"}'::JSONB,
  NULL, NULL, NULL, 'standard', now()
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.process_notification_domain_events(10, 120);
RESET ROLE;

SELECT is(
  (
    SELECT status
    FROM security.domain_event_outbox
    WHERE idempotency_key = 'phase-one-local-db-gate'
  ),
  'completed',
  'domain event is expanded exactly once'
);

SELECT is(
  (
    SELECT rendered_title
    FROM security.notification_event_deliveries delivery
    JOIN security.domain_event_outbox event ON event.id = delivery.event_id
    WHERE event.idempotency_key = 'phase-one-local-db-gate'
      AND delivery.channel = 'in_app'
  ),
  'حصلت على مكافأة التحدي',
  'Arabic profile receives the Arabic server template'
);

SELECT is(
  (
    SELECT delivery.status
    FROM security.notification_event_deliveries delivery
    JOIN security.domain_event_outbox event ON event.id = delivery.event_id
    WHERE event.idempotency_key = 'phase-one-local-db-gate'
      AND delivery.channel = 'in_app'
  ),
  'delivered',
  'in-app notification is materialized immediately'
);

SELECT is(
  (
    SELECT delivery.status
    FROM security.notification_event_deliveries delivery
    JOIN security.domain_event_outbox event ON event.id = delivery.event_id
    WHERE event.idempotency_key = 'phase-one-local-db-gate'
      AND delivery.channel = 'push'
  ),
  'deferred',
  'push delivery respects user quiet hours'
);

INSERT INTO phase_one_gate_ids (entity_key, entity_id)
SELECT 'push-delivery', delivery.id
FROM security.notification_event_deliveries delivery
JOIN security.domain_event_outbox event ON event.id = delivery.event_id
WHERE event.idempotency_key = 'phase-one-local-db-gate'
  AND delivery.channel = 'push';

UPDATE security.notification_event_deliveries delivery
SET status = 'processing',
    attempt_count = 4,
    lease_token = '44444444-4444-4444-8444-444444444444',
    lease_expires_at = now() + interval '2 minutes'
FROM security.domain_event_outbox event
WHERE event.id = delivery.event_id
  AND event.idempotency_key = 'phase-one-local-db-gate'
  AND delivery.channel = 'push';

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.complete_notification_event_delivery(
  (SELECT entity_id FROM phase_one_gate_ids WHERE entity_key = 'push-delivery'),
  '44444444-4444-4444-8444-444444444444',
  false, true, 'provider_unavailable', NULL
);

RESET ROLE;

SELECT is(
  (
    SELECT delivery.status
    FROM security.notification_event_deliveries delivery
    JOIN security.domain_event_outbox event ON event.id = delivery.event_id
    WHERE event.idempotency_key = 'phase-one-local-db-gate'
      AND delivery.channel = 'push'
  ),
  'failed',
  'retryable push failure returns to the bounded retry queue'
);

UPDATE security.notification_event_deliveries delivery
SET status = 'processing',
    attempt_count = 5,
    lease_token = '55555555-5555-4555-8555-555555555555',
    lease_expires_at = now() + interval '2 minutes'
FROM security.domain_event_outbox event
WHERE event.id = delivery.event_id
  AND event.idempotency_key = 'phase-one-local-db-gate'
  AND delivery.channel = 'push';

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT public.complete_notification_event_delivery(
  (SELECT entity_id FROM phase_one_gate_ids WHERE entity_key = 'push-delivery'),
  '55555555-5555-4555-8555-555555555555',
  false, true, 'provider_unavailable', NULL
);

RESET ROLE;

SELECT is(
  (
    SELECT delivery.status
    FROM security.notification_event_deliveries delivery
    JOIN security.domain_event_outbox event ON event.id = delivery.event_id
    WHERE event.idempotency_key = 'phase-one-local-db-gate'
      AND delivery.channel = 'push'
  ),
  'dead_letter',
  'fifth failed attempt is routed to dead letter'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_notification_event_delivery(
      '66666666-6666-4666-8666-666666666666',
      '77777777-7777-4777-8777-777777777777',
      true, false, NULL, NULL
    )
  $sql$,
  'P0001',
  'service_role_required',
  'customers cannot complete or forge notification deliveries'
);

RESET ROLE;

SELECT is(
  has_table_privilege('authenticated', 'security.domain_event_outbox', 'SELECT'),
  false,
  'domain event payloads remain private from customers'
);

SELECT * FROM finish();
ROLLBACK;
