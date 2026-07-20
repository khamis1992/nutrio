BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions, pg_temp;

SELECT plan(9);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.health_program_baselines'::regclass),
  'baseline table has RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.health_program_checkins'::regclass),
  'check-in table has RLS enabled'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM pg_policies WHERE schemaname = 'public' AND tablename = 'health_program_checkins' AND policyname ILIKE '%admin%'),
  0,
  'administrators have no raw check-in read policy'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM pg_policies WHERE schemaname = 'public' AND tablename = 'health_program_baselines' AND policyname ILIKE '%admin%'),
  0,
  'administrators have no raw baseline read policy'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.health_program_review_gates),
  4,
  'four independent publication gates are required'
);

SELECT is(
  (SELECT status FROM public.health_program_versions ORDER BY version DESC LIMIT 1),
  'draft',
  'unreviewed protocol remains draft'
);

SELECT has_function('public', 'complete_health_program_onboarding', ARRAY['uuid'], 'onboarding completion RPC exists');
SELECT has_function('public', 'delete_my_health_program_data', ARRAY['uuid'], 'program-data deletion RPC exists');

SELECT is(
  has_function_privilege('anon', 'public.complete_health_program_onboarding(uuid)', 'EXECUTE'),
  false,
  'anonymous role cannot execute health-program onboarding RPCs'
);

SELECT * FROM finish();
ROLLBACK;
