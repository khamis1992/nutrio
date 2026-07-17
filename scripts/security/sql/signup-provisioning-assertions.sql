\set ON_ERROR_STOP on

SELECT set_config('request.jwt.claim.role', 'service_role', false);

INSERT INTO auth.users (id, email) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin@nutrio.test'),
  ('10000000-0000-0000-0000-000000000002', 'fleet@nutrio.test'),
  ('10000000-0000-0000-0000-000000000003', 'ordinary@nutrio.test'),
  ('20000000-0000-0000-0000-000000000001', 'manager@nutrio.test'),
  ('20000000-0000-0000-0000-000000000002', 'super@nutrio.test');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin');

INSERT INTO public.fleet_managers (
  auth_user_id, email, full_name, role, is_active
) VALUES (
  '10000000-0000-0000-0000-000000000002',
  'fleet@nutrio.test',
  'Fleet Operator',
  'fleet_manager',
  true
);

DO $do$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.issue_signup_provisioning_grant(
      repeat('0', 64),
      'blocked@nutrio.test',
      'partner_invitation',
      '10000000-0000-0000-0000-000000000003',
      300
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'An ordinary actor issued a privileged grant';
  END IF;
END;
$do$;

SELECT public.issue_signup_provisioning_grant(
  repeat('a', 64),
  'Partner@Nutrio.Test',
  'partner_invitation',
  '10000000-0000-0000-0000-000000000001',
  300
);

DO $do$
BEGIN
  IF public.consume_signup_provisioning_grant(
    repeat('a', 64),
    'wrong@nutrio.test',
    'partner_invitation',
    'wrong-email',
    '203.0.113.10'
  ) THEN
    RAISE EXCEPTION 'A grant was consumed with the wrong email';
  END IF;

  IF NOT public.consume_signup_provisioning_grant(
    repeat('a', 64),
    'partner@nutrio.test',
    'partner_invitation',
    'correct-email',
    '203.0.113.10'
  ) THEN
    RAISE EXCEPTION 'The matching grant was not consumed';
  END IF;

  IF public.consume_signup_provisioning_grant(
    repeat('a', 64),
    'partner@nutrio.test',
    'partner_invitation',
    'replay',
    '203.0.113.10'
  ) THEN
    RAISE EXCEPTION 'A consumed grant was replayed';
  END IF;
END;
$do$;

SELECT public.issue_signup_provisioning_grant(
  repeat('b', 64),
  'driver@nutrio.test',
  'fleet_driver_invitation',
  '10000000-0000-0000-0000-000000000002',
  300
);

DO $do$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.issue_signup_provisioning_grant(
      repeat('c', 64),
      'partner2@nutrio.test',
      'partner_invitation',
      '10000000-0000-0000-0000-000000000002',
      300
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'A fleet operator issued a partner grant';
  END IF;
END;
$do$;

SELECT public.issue_signup_provisioning_grant(
  repeat('d', 64),
  'expired@nutrio.test',
  'partner_invitation',
  '10000000-0000-0000-0000-000000000001',
  30
);
UPDATE security.signup_provisioning_grants
SET created_at = clock_timestamp() - interval '2 minutes',
    expires_at = clock_timestamp() - interval '1 minute'
WHERE token_hash = repeat('d', 64);

DO $do$
BEGIN
  IF public.consume_signup_provisioning_grant(
    repeat('d', 64),
    'expired@nutrio.test',
    'partner_invitation',
    'expired',
    '203.0.113.10'
  ) THEN
    RAISE EXCEPTION 'An expired grant was consumed';
  END IF;
END;
$do$;

SELECT public.issue_signup_provisioning_grant(
  repeat('e', 64),
  'ip-test@nutrio.test',
  'partner_invitation',
  '10000000-0000-0000-0000-000000000001',
  300
);

DO $do$
BEGIN
  IF public.consume_signup_provisioning_grant(
    repeat('e', 64),
    'ip-test@nutrio.test',
    'partner_invitation',
    'bad-ip',
    'not-an-ip'
  ) THEN
    RAISE EXCEPTION 'A malformed IP was accepted';
  END IF;

  IF NOT public.consume_signup_provisioning_grant(
    repeat('e', 64),
    'ip-test@nutrio.test',
    'partner_invitation',
    'valid-ip',
    '2001:db8::5'
  ) THEN
    RAISE EXCEPTION 'Malformed IP handling consumed or corrupted the grant';
  END IF;
END;
$do$;

SELECT public.admin_finalize_fleet_manager_invitation(
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'manager@nutrio.test',
  'Scoped Manager',
  NULL,
  'fleet_manager',
  'QA',
  'manager-request',
  NULL,
  NULL,
  '203.0.113.15',
  'QA',
  'integration-test'
);

SELECT public.admin_finalize_fleet_manager_invitation(
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'super@nutrio.test',
  'Super Admin',
  NULL,
  'super_admin',
  NULL,
  'super-request',
  NULL,
  NULL,
  '203.0.113.16',
  'QA',
  'integration-test'
);

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '20000000-0000-0000-0000-000000000001'
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'A scoped fleet manager received global admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '20000000-0000-0000-0000-000000000002'
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'A super admin did not receive the admin role';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.issue_signup_provisioning_grant(text,text,text,uuid,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated users can execute the grant issuer';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.issue_signup_provisioning_grant(text,text,text,uuid,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Service role cannot execute the grant issuer';
  END IF;

  IF (SELECT count(*) FROM security.test_events) < 7 THEN
    RAISE EXCEPTION 'Expected forensic events were not recorded';
  END IF;
END;
$do$;

DO $do$
DECLARE
  v_posture JSONB;
BEGIN
  v_posture := public.admin_security_posture();
  IF v_posture ->> 'release_version' <> '20260717120000' THEN
    RAISE EXCEPTION 'Signup attestation release version is not active';
  END IF;
  IF COALESCE((v_posture ->> 'failure_count')::INTEGER, -1) <> 0 THEN
    RAISE EXCEPTION 'Signup attestation reported an unexpected control failure: %', v_posture;
  END IF;
  IF v_posture ->> 'status' <> 'review' THEN
    RAISE EXCEPTION 'Missing hosted-hook canaries should keep posture in review';
  END IF;
END;
$do$;

SELECT
  'signup provisioning integration assertions passed' AS result,
  count(*) AS evidence_events
FROM security.test_events;
