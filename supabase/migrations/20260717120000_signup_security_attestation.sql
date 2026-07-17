-- Extend the live Admin Security posture with signup-hook and privileged
-- provisioning attestation. Installation alone is insufficient: recent
-- canary evidence is required to prove hosted Auth configuration is active.

BEGIN;

ALTER FUNCTION public.admin_security_posture()
  RENAME TO admin_security_posture_runtime_v3;

REVOKE ALL ON FUNCTION public.admin_security_posture_runtime_v3()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_security_posture()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_base JSONB;
  v_checks JSONB;
  v_new_checks JSONB;
  v_failures INTEGER;
  v_warnings INTEGER;
  v_unsafe_rpc_count INTEGER := 0;
  v_grant_table_exposed BOOLEAN := false;
  v_scoped_admin_overlap_count INTEGER := 0;
  v_latest_signup_hook_event TIMESTAMPTZ;
  v_signup_hook_events_30d BIGINT := 0;
  v_latest_grant_issued TIMESTAMPTZ;
  v_latest_grant_consumed TIMESTAMPTZ;
  v_latest_provisioning_allowed TIMESTAMPTZ;
  v_provisioning_events_30d BIGINT := 0;
  v_signup_hook_status TEXT;
  v_provisioning_status TEXT;
BEGIN
  -- The inherited function performs the AAL2 admin check first.
  v_base := public.admin_security_posture_runtime_v3();

  WITH expected(signature) AS (
    VALUES
      ('public.issue_signup_provisioning_grant(text,text,text,uuid,integer)'::REGPROCEDURE),
      ('public.consume_signup_provisioning_grant(text,text,text,text,text)'::REGPROCEDURE),
      ('public.is_signup_provisioning_grant_consumed(text)'::REGPROCEDURE),
      ('public.admin_finalize_fleet_manager_invitation(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text)'::REGPROCEDURE)
  )
  SELECT count(*)::INTEGER
  INTO v_unsafe_rpc_count
  FROM expected
  WHERE NOT pg_catalog.has_function_privilege(
      'service_role', signature, 'EXECUTE'
    )
    OR pg_catalog.has_function_privilege('anon', signature, 'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated', signature, 'EXECUTE');

  v_grant_table_exposed :=
    pg_catalog.has_table_privilege(
      'anon', 'security.signup_provisioning_grants', 'SELECT'
    )
    OR pg_catalog.has_table_privilege(
      'anon', 'security.signup_provisioning_grants', 'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'anon', 'security.signup_provisioning_grants', 'UPDATE'
    )
    OR pg_catalog.has_table_privilege(
      'anon', 'security.signup_provisioning_grants', 'DELETE'
    )
    OR pg_catalog.has_table_privilege(
      'authenticated', 'security.signup_provisioning_grants', 'SELECT'
    )
    OR pg_catalog.has_table_privilege(
      'authenticated', 'security.signup_provisioning_grants', 'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'authenticated', 'security.signup_provisioning_grants', 'UPDATE'
    )
    OR pg_catalog.has_table_privilege(
      'authenticated', 'security.signup_provisioning_grants', 'DELETE'
    );

  SELECT count(*)::INTEGER
  INTO v_scoped_admin_overlap_count
  FROM public.fleet_managers manager
  JOIN public.user_roles role_row
    ON role_row.user_id = manager.auth_user_id
   AND role_row.role::TEXT = 'admin'
  WHERE manager.role = 'fleet_manager'
    AND COALESCE(manager.is_active, false) = true;

  SELECT max(event.occurred_at), count(*)::BIGINT
  INTO v_latest_signup_hook_event, v_signup_hook_events_30d
  FROM security.event_ledger event
  WHERE event.occurred_at >= clock_timestamp() - interval '30 days'
    AND event.event_type IN (
      'authentication.supabase.signup_geo_allowed',
      'authentication.supabase.signup_geo_denied',
      'authentication.supabase.signup_blocked_ip',
      'authentication.supabase.signup_rate_limited',
      'authentication.supabase.signup_geo_verification_failed',
      'authentication.supabase.trusted_provisioning_allowed',
      'authentication.supabase.trusted_provisioning_denied'
    );

  SELECT
    max(event.occurred_at) FILTER (
      WHERE event.event_type = 'admin.signup_provisioning_grant_issued'
    ),
    max(event.occurred_at) FILTER (
      WHERE event.event_type = 'authentication.supabase.trusted_provisioning_grant_consumed'
    ),
    max(event.occurred_at) FILTER (
      WHERE event.event_type = 'authentication.supabase.trusted_provisioning_allowed'
    ),
    count(*)::BIGINT
  INTO
    v_latest_grant_issued,
    v_latest_grant_consumed,
    v_latest_provisioning_allowed,
    v_provisioning_events_30d
  FROM security.event_ledger event
  WHERE event.occurred_at >= clock_timestamp() - interval '30 days'
    AND event.event_type IN (
      'admin.signup_provisioning_grant_issued',
      'authentication.supabase.trusted_provisioning_grant_consumed',
      'authentication.supabase.trusted_provisioning_allowed'
    );

  v_signup_hook_status := CASE
    WHEN v_latest_signup_hook_event IS NULL THEN 'warning'
    ELSE 'pass'
  END;
  v_provisioning_status := CASE
    WHEN v_latest_grant_issued IS NULL
      OR v_latest_grant_consumed IS NULL
      OR v_latest_provisioning_allowed IS NULL THEN 'warning'
    ELSE 'pass'
  END;

  v_new_checks := jsonb_build_array(
    jsonb_build_object(
      'id', 'signup_provisioning_access_boundary',
      'label', 'Privileged signup provisioning boundary',
      'status', CASE
        WHEN v_unsafe_rpc_count = 0 AND NOT v_grant_table_exposed
          THEN 'pass'
        ELSE 'fail'
      END,
      'count', v_unsafe_rpc_count + CASE WHEN v_grant_table_exposed THEN 1 ELSE 0 END,
      'summary', CASE
        WHEN v_unsafe_rpc_count = 0 AND NOT v_grant_table_exposed
          THEN 'Invitation grants and finalization RPCs are isolated from client roles'
        ELSE 'A provisioning RPC or the grant store is exposed to a client role'
      END,
      'items', jsonb_build_array(
        jsonb_build_object('unsafe_rpc_count', v_unsafe_rpc_count),
        jsonb_build_object('grant_table_exposed', v_grant_table_exposed)
      )
    ),
    jsonb_build_object(
      'id', 'signup_auth_hook_verified',
      'label', 'Server-side signup location enforcement',
      'status', v_signup_hook_status,
      'count', v_signup_hook_events_30d,
      'summary', CASE
        WHEN v_latest_signup_hook_event IS NULL
          THEN 'No signed signup-hook evidence exists in the last 30 days; run Qatar and non-Qatar staging canaries'
        ELSE 'The signed Auth Hook is producing server-side signup decisions'
      END,
      'items', jsonb_build_array(jsonb_build_object(
        'latest_event', v_latest_signup_hook_event,
        'events_30d', v_signup_hook_events_30d
      ))
    ),
    jsonb_build_object(
      'id', 'privileged_provisioning_flow_verified',
      'label', 'Trusted invitation flow',
      'status', v_provisioning_status,
      'count', v_provisioning_events_30d,
      'summary', CASE
        WHEN v_provisioning_status = 'warning'
          THEN 'Issue one staging invitation and verify grant issuance, hook consumption, and account creation evidence'
        ELSE 'Privileged invitations are consuming one-time grants through the signed Auth Hook'
      END,
      'items', jsonb_build_array(
        jsonb_build_object('stage', 'issued', 'latest_event', v_latest_grant_issued),
        jsonb_build_object('stage', 'consumed', 'latest_event', v_latest_grant_consumed),
        jsonb_build_object('stage', 'allowed', 'latest_event', v_latest_provisioning_allowed)
      )
    ),
    jsonb_build_object(
      'id', 'scoped_fleet_manager_admin_overlap',
      'label', 'Fleet manager role separation',
      'status', CASE
        WHEN v_scoped_admin_overlap_count = 0 THEN 'pass'
        ELSE 'fail'
      END,
      'count', v_scoped_admin_overlap_count,
      'summary', CASE
        WHEN v_scoped_admin_overlap_count = 0
          THEN 'No scoped fleet manager also holds the global Admin role'
        ELSE 'Review active scoped fleet managers that still hold the global Admin role'
      END,
      'items', '[]'::JSONB
    )
  );

  v_checks := COALESCE(v_base -> 'checks', '[]'::JSONB) || v_new_checks;
  v_failures := COALESCE((v_base ->> 'failure_count')::INTEGER, 0)
    + CASE WHEN v_unsafe_rpc_count > 0 OR v_grant_table_exposed THEN 1 ELSE 0 END
    + CASE WHEN v_scoped_admin_overlap_count > 0 THEN 1 ELSE 0 END;
  v_warnings := COALESCE((v_base ->> 'warning_count')::INTEGER, 0)
    + CASE WHEN v_signup_hook_status = 'warning' THEN 1 ELSE 0 END
    + CASE WHEN v_provisioning_status = 'warning' THEN 1 ELSE 0 END;

  RETURN v_base || jsonb_build_object(
    'generated_at', clock_timestamp(),
    'release_version', '20260717120000',
    'status', CASE
      WHEN v_failures > 0 THEN 'action_required'
      WHEN v_warnings > 0 THEN 'review'
      ELSE 'healthy'
    END,
    'failure_count', v_failures,
    'warning_count', v_warnings,
    'checks', v_checks
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_security_posture()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_security_posture()
  TO authenticated;

COMMENT ON FUNCTION public.admin_security_posture() IS
  'AAL2-admin-only live security posture including signed signup-hook and trusted invitation attestation for release 20260717120000.';

NOTIFY pgrst, 'reload schema';

COMMIT;
