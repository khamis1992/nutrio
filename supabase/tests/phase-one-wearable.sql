BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions, pg_temp;

SELECT plan(22);

SELECT ok(
  'search_path=public, pg_temp' = any(coalesce((select proconfig from pg_proc where oid = 'public.wearable_metric_source_precedence(text,text)'::regprocedure), array[]::text[])),
  'provider precedence helper pins its search path'
);
SELECT ok(not has_function_privilege('anon', 'public.wearable_metric_source_precedence(text,text)', 'EXECUTE'), 'anonymous users cannot call provider precedence directly');
SELECT ok(not has_function_privilege('anon', 'public.refresh_my_wearable_sync_staleness(interval)', 'EXECUTE'), 'anonymous users cannot refresh wearable state');

CREATE TEMP TABLE wearable_test_results (
  result_key TEXT PRIMARY KEY,
  result JSONB NOT NULL
);
GRANT SELECT, INSERT, UPDATE ON wearable_test_results TO authenticated;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'a4000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'wearable-owner@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a4000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'wearable-other@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

INSERT INTO wearable_test_results (result_key, result)
SELECT 'first', public.ingest_wearable_metric_samples($json$
[
  {
    "provider":"apple_health", "provider_user_id":"apple-user-1",
    "metric_type":"steps", "metric_date":"2026-11-01",
    "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
    "value":8000, "unit":"count", "external_id":"apple-steps-dst",
    "dedupe_key":"wearable:apple_health:steps:apple-steps-dst", "checksum":"apple-steps-v1",
    "source_app":"HealthKit", "source_timezone":"America/New_York",
    "received_at":"2026-11-01T07:00:00Z", "quality_state":"accepted",
    "ingestion_version":"2", "sync_status":"synced", "raw":{"dst":"fall-back"}
  },
  {
    "provider":"apple_health", "provider_user_id":"apple-user-1",
    "metric_type":"workouts_count", "metric_date":"2026-11-01",
    "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
    "value":1, "unit":"count", "external_id":"apple-workout-dst",
    "dedupe_key":"wearable:apple_health:workouts_count:apple-workout-dst", "checksum":"apple-workout-v1",
    "source_app":"HealthKit", "source_timezone":"America/New_York",
    "received_at":"2026-11-01T07:00:00Z", "quality_state":"accepted",
    "ingestion_version":"2", "sync_status":"synced", "raw":{}
  },
  {
    "provider":"sporthub", "provider_user_id":"sporthub-user-1",
    "metric_type":"workouts_count", "metric_date":"2026-11-01",
    "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
    "value":1, "unit":"count", "external_id":"sporthub-workout-dst",
    "dedupe_key":"wearable:sporthub:workouts_count:sporthub-workout-dst", "checksum":"sporthub-workout-v1",
    "source_app":"SportHub", "source_timezone":"Asia/Qatar",
    "received_at":"2026-11-01T07:05:00Z", "quality_state":"accepted",
    "ingestion_version":"2", "sync_status":"synced", "raw":{}
  }
]
$json$::jsonb);

SELECT ok(
  (SELECT (result->>'inserted_or_updated')::int = 3 AND (result->>'rejected')::int = 0
   FROM wearable_test_results WHERE result_key = 'first'),
  'valid event samples are ingested with complete provenance'
);

INSERT INTO wearable_test_results (result_key, result)
SELECT 'replay', public.ingest_wearable_metric_samples($json$
[
  {
    "provider":"apple_health", "provider_user_id":"apple-user-1",
    "metric_type":"steps", "metric_date":"2026-11-01",
    "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
    "value":8000, "unit":"count", "external_id":"apple-steps-dst",
    "dedupe_key":"wearable:apple_health:steps:apple-steps-dst", "checksum":"apple-steps-v1",
    "source_timezone":"America/New_York", "received_at":"2026-11-01T07:00:00Z",
    "quality_state":"accepted", "ingestion_version":"2", "sync_status":"synced"
  },
  {
    "provider":"apple_health", "provider_user_id":"apple-user-1",
    "metric_type":"workouts_count", "metric_date":"2026-11-01",
    "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
    "value":1, "unit":"count", "external_id":"apple-workout-dst",
    "dedupe_key":"wearable:apple_health:workouts_count:apple-workout-dst", "checksum":"apple-workout-v1",
    "source_timezone":"America/New_York", "received_at":"2026-11-01T07:00:00Z",
    "quality_state":"accepted", "ingestion_version":"2", "sync_status":"synced"
  },
  {
    "provider":"sporthub", "provider_user_id":"sporthub-user-1",
    "metric_type":"workouts_count", "metric_date":"2026-11-01",
    "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
    "value":1, "unit":"count", "external_id":"sporthub-workout-dst",
    "dedupe_key":"wearable:sporthub:workouts_count:sporthub-workout-dst", "checksum":"sporthub-workout-v1",
    "source_timezone":"Asia/Qatar", "received_at":"2026-11-01T07:05:00Z",
    "quality_state":"accepted", "ingestion_version":"2", "sync_status":"synced"
  }
]
$json$::jsonb);

SELECT is(
  (SELECT (result->>'unchanged')::int FROM wearable_test_results WHERE result_key = 'replay'),
  3,
  'replaying identical provider records does not rewrite samples'
);

SELECT is(
  (SELECT count(*) FROM public.wearable_metric_samples),
  3::bigint,
  'replay identity leaves one row per provider event and metric'
);

SELECT is(
  (SELECT workouts_count FROM public.health_daily_metrics WHERE metric_date = '2026-11-01'),
  1,
  'two-provider projection chooses one workout source instead of summing providers'
);

SELECT is(
  (SELECT selected_source_metadata #>> '{workouts_count,provider}'
   FROM public.health_daily_metrics WHERE metric_date = '2026-11-01'),
  'sporthub',
  'metric-specific precedence selects SportHub for workouts'
);

SELECT ok(
  (SELECT (selected_source_metadata #> '{workouts_count,available_providers}') ?& array['sporthub','apple_health']
   FROM public.health_daily_metrics WHERE metric_date = '2026-11-01'),
  'projection metadata discloses all providers considered'
);

SELECT ok(
  (SELECT provider_user_id = 'apple-user-1'
      AND source_timezone = 'America/New_York'
      AND received_at = '2026-11-01T07:00:00Z'::timestamptz
      AND quality_state = 'accepted'
   FROM public.wearable_metric_samples WHERE external_id = 'apple-steps-dst'),
  'stored event provenance matches ADR 0003'
);

SELECT is(
  (SELECT metric_date FROM public.wearable_metric_samples WHERE external_id = 'apple-steps-dst'),
  '2026-11-01'::date,
  'source timezone resolves the repeated DST hour to the correct local date'
);

INSERT INTO wearable_test_results (result_key, result)
SELECT 'malformed', public.ingest_wearable_metric_samples('[{
  "provider":"apple_health", "metric_type":"steps", "metric_date":"2026-11-01",
  "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
  "value":1, "unit":"count", "dedupe_key":"malformed", "checksum":"malformed",
  "source_timezone":"America/New_York", "received_at":"2026-11-01T07:00:00Z",
  "quality_state":"accepted", "ingestion_version":"2"
}]'::jsonb);

SELECT is(
  (SELECT (result->>'rejected')::int FROM wearable_test_results WHERE result_key = 'malformed'),
  1,
  'malformed payloads missing provider identity are rejected'
);

INSERT INTO wearable_test_results (result_key, result)
SELECT 'timezone-mismatch', public.ingest_wearable_metric_samples('[{
  "provider":"apple_health", "provider_user_id":"apple-user-1",
  "metric_type":"steps", "metric_date":"2026-10-31",
  "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
  "value":1, "unit":"count", "dedupe_key":"timezone-mismatch", "checksum":"timezone-mismatch",
  "source_timezone":"America/New_York", "received_at":"2026-11-01T07:00:00Z",
  "quality_state":"accepted", "ingestion_version":"2"
}]'::jsonb);

SELECT is(
  (SELECT (result->>'rejected')::int FROM wearable_test_results WHERE result_key = 'timezone-mismatch'),
  1,
  'metric dates that disagree with source timezone are rejected'
);

SELECT is(
  (SELECT count(*) FROM public.wearable_metric_samples),
  3::bigint,
  'owner RLS exposes the owner samples only'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*) FROM public.wearable_metric_samples),
  0::bigint,
  'RLS hides wearable samples from another authenticated user'
);

SELECT throws_ok(
  $sql$SELECT public.rebuild_health_daily_metrics_from_wearables(
    'a4000000-0000-4000-8000-000000000001', '2026-11-01'
  )$sql$,
  '42501',
  'AUTH_REQUIRED',
  'another user cannot rebuild the owner projection'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

INSERT INTO wearable_test_results (result_key, result)
SELECT 'revoke', public.revoke_wearable_provider('sporthub');

SELECT is(
  (SELECT (result->>'revoked_samples')::int FROM wearable_test_results WHERE result_key = 'revoke'),
  1,
  'revoke marks every active sample for the provider'
);

SELECT ok(
  (SELECT quality_state = 'revoked' AND deleted_at IS NOT NULL
   FROM public.wearable_metric_samples WHERE external_id = 'sporthub-workout-dst'),
  'revoked events retain lifecycle provenance and leave projections'
);

SELECT is(
  (SELECT selected_source_metadata #>> '{workouts_count,provider}'
   FROM public.health_daily_metrics WHERE metric_date = '2026-11-01'),
  'apple_health',
  'revoke rebuilds the day using the next eligible provider'
);

INSERT INTO wearable_test_results (result_key, result)
SELECT 'reconnect', public.ingest_wearable_metric_samples('[{
  "provider":"sporthub", "provider_user_id":"sporthub-user-1",
  "metric_type":"workouts_count", "metric_date":"2026-11-01",
  "start_at":"2026-11-01T05:30:00Z", "end_at":"2026-11-01T06:30:00Z",
  "value":1, "unit":"count", "external_id":"sporthub-workout-dst",
  "dedupe_key":"wearable:sporthub:workouts_count:sporthub-workout-dst", "checksum":"sporthub-workout-v1",
  "source_timezone":"Asia/Qatar", "received_at":"2026-11-01T08:00:00Z",
  "quality_state":"accepted", "ingestion_version":"2", "sync_status":"synced"
}]'::jsonb);

SELECT ok(
  (SELECT (result->>'inserted_or_updated')::int = 1 FROM wearable_test_results WHERE result_key = 'reconnect')
  AND (SELECT status = 'connected' AND provider_user_id = 'sporthub-user-1'
       FROM public.wearable_sync_sources WHERE provider = 'sporthub'),
  'reconnect restores a revoked source without replacing its provider identity'
);

SELECT is(
  (SELECT selected_source_metadata #>> '{workouts_count,provider}'
   FROM public.health_daily_metrics WHERE metric_date = '2026-11-01'),
  'sporthub',
  'reconnect rebuilds the selected source metadata'
);

RESET ROLE;
UPDATE public.wearable_sync_sources
SET status = 'synced', last_success_at = now() - interval '2 hours'
WHERE user_id = 'a4000000-0000-4000-8000-000000000001' AND provider = 'sporthub';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SELECT public.refresh_my_wearable_sync_staleness();

SELECT is(
  (SELECT status FROM public.wearable_sync_sources WHERE provider = 'sporthub'),
  'stale',
  'server lifecycle marks an overdue provider stale'
);

SELECT * FROM finish();
ROLLBACK;
