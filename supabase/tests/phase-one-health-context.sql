begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions, pg_temp;

select plan(34);

select has_table('public', 'health_context_preferences', 'health-context preferences are installed');
select has_table('public', 'health_context_entries', 'health-context entries are installed');
select has_table('public', 'health_context_consent_events', 'health-context consent audit is installed');
select is(
  (select (value ->> 'enabled')::boolean from public.platform_settings where key = 'phase1-health-context'),
  false,
  'the final deployed feature flag is disabled by default'
);
select is(
  (select (value ->> 'rollout_percent')::integer from public.platform_settings where key = 'phase1-health-context'),
  0,
  'the final deployed rollout is zero percent'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a8000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'agent-8-owner@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a8000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'agent-8-other@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into public.health_context_preferences (
  user_id, journal_enabled, cycle_tracking_enabled, recommendation_context_enabled
) values
  ('a8000000-0000-4000-8000-000000000001', false, false, false),
  ('a8000000-0000-4000-8000-000000000002', true, false, false);

insert into public.health_context_entries (
  user_id, entry_date, mood, stress, appetite, energy, cycle_phase, bleeding_flow, note
) values
  ('a8000000-0000-4000-8000-000000000001', current_date, 4, 5, 2, 2, 'luteal', 'light', 'private current note'),
  ('a8000000-0000-4000-8000-000000000001', current_date - 1, 3, 4, 3, 3, 'luteal', 'medium', 'private prior note'),
  ('a8000000-0000-4000-8000-000000000001', current_date - 2, 4, 3, 4, 4, null, null, 'private note'),
  ('a8000000-0000-4000-8000-000000000001', current_date - 3, 5, 2, 5, 5, null, null, 'private note'),
  ('a8000000-0000-4000-8000-000000000002', current_date, 2, 2, 2, 2, null, null, 'other user note');

insert into public.health_context_consent_events (
  user_id, event_type, policy_version
) values
  ('a8000000-0000-4000-8000-000000000001', 'granted', 'phase-one-owner-test'),
  ('a8000000-0000-4000-8000-000000000002', 'granted', 'phase-one-other-test');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is((select count(*) from public.health_context_preferences), 1::bigint, 'owner RLS exposes only owner preferences to the export boundary');
select is((select count(*) from public.health_context_entries), 4::bigint, 'owner RLS exposes only owner entries to the export boundary');
select is(
  (select count(*) from public.health_context_entries where user_id = 'a8000000-0000-4000-8000-000000000002'),
  0::bigint,
  'owner RLS hides a non-owner entry'
);
select ok(has_table_privilege('authenticated', 'public.health_context_entries', 'SELECT'), 'authenticated owners may read their RLS-filtered entries');
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'health_context_entries' and cmd in ('INSERT', 'ALL')),
  0::bigint,
  'authenticated users have no direct insert policy for health entries'
);
select is(
  (select count(*) from public.health_context_consent_events),
  1::bigint,
  'the owner can read only their own consent audit event'
);
select is(
  (
    select count(*)
    from public.health_context_consent_events
    where user_id = 'a8000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'the owner cannot read another user consent audit event'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('health_context_entries', 'health_context_consent_events')
      and ('anon' = any(roles) or 'public' = any(roles))
  ),
  0::bigint,
  'anonymous and public surfaces receive no health-context read policy'
);
select is(public.health_context_feature_enabled(), false, 'the runtime gate observes the default-off correction');
select throws_ok(
  $$select public.set_health_context_preferences(true, false, false)$$,
  'P0001', 'HEALTH_CONTEXT_DISABLED',
  'flag-off rejects health-context collection even through the RPC'
);

reset role;
update public.platform_settings
set value = value || '{"enabled":true,"rollout_percent":100}'::jsonb
where key = 'phase1-health-context';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.upsert_health_context_entry(current_date, 3::smallint)$$,
  'P0001', 'HEALTH_CONTEXT_OPT_IN_REQUIRED',
  'journal collection requires owner opt-in'
);
select throws_ok(
  $$select public.set_health_context_ai_consent(true, '2026-07-health-context-ai-v1')$$,
  'P0001', 'HEALTH_CONTEXT_OPT_IN_REQUIRED',
  'AI summary consent cannot be granted before journal opt-in'
);
select public.set_health_context_preferences(true, false, true);
select is(
  (select journal_enabled from public.health_context_preferences),
  true,
  'owner can explicitly opt in after rollout'
);
select throws_ok(
  $$select public.upsert_health_context_entry(current_date, 4::smallint, 4::smallint, 4::smallint, 4::smallint, '{}'::text[], null::smallint, 'menstrual'::text, 'light'::text, null::text)$$,
  'P0001', 'CYCLE_CONTEXT_OPT_IN_REQUIRED',
  'cycle and bleeding values require separate cycle opt-in'
);
select is(
  (public.get_health_context_recommendation_input(current_date) ->> 'available')::boolean,
  true,
  'fresh deterministic context is available only after recommendation opt-in'
);
select is(
  public.get_health_context_recommendation_input(current_date) -> 'cycle_phase',
  'null'::jsonb,
  'recommendation output hides stored cycle context while cycle tracking is off'
);
select is(public.get_health_context_ai_summary(30), null::jsonb, 'AI summary is withheld without independent consent');

select public.set_health_context_ai_consent(true, '2026-07-health-context-ai-v1');
select isnt(public.get_health_context_ai_summary(30), null::jsonb, 'consented owner receives a bounded aggregate summary');
select ok(
  public.get_health_context_ai_summary(30) ?& array[
    'window_days', 'days_logged', 'average_mood', 'average_stress',
    'average_appetite', 'average_energy', 'digestive_discomfort_days',
    'cycle_phase_observations'
  ],
  'AI summary contains only the reviewed aggregate shape'
);
select ok(
  not (public.get_health_context_ai_summary(30) ?| array['note', 'entry_date', 'bleeding_flow', 'user_id']),
  'AI summary excludes notes, dates, bleeding details, and identity'
);
select is(
  public.get_health_context_ai_summary(30) -> 'cycle_phase_observations',
  '[]'::jsonb,
  'cycle observations below the three-entry privacy threshold are suppressed'
);
select is(public.get_health_context_ai_summary(6), null::jsonb, 'AI summary rejects an undersized reporting window');

select set_config(
  'request.jwt.claims',
  '{"sub":"a8000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is((select count(*) from public.health_context_entries), 1::bigint, 'a non-owner sees only their own health entry');

select set_config(
  'request.jwt.claims',
  '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select is(
  (public.delete_health_context_dataset() ->> 'deleted_entries')::integer,
  4,
  'dataset deletion reports every deleted owner entry'
);
select is((select count(*) from public.health_context_entries), 0::bigint, 'dataset deletion removes all owner entries');
select is((select count(*) from public.health_context_preferences), 0::bigint, 'dataset deletion removes owner preferences');
select is(
  (select status from public.ai_data_consents where purpose = 'health_context_summary'),
  'revoked',
  'dataset deletion revokes AI consent in the same transaction'
);

reset role;
select is(
  (select count(*) from public.health_context_consent_events where user_id = 'a8000000-0000-4000-8000-000000000001' and event_type = 'dataset_deleted'),
  1::bigint,
  'dataset deletion leaves a non-sensitive audit event'
);
select is(
  (select count(*) from public.health_context_entries where user_id = 'a8000000-0000-4000-8000-000000000002'),
  1::bigint,
  'owner deletion cannot delete another user dataset'
);

select * from finish();
rollback;
