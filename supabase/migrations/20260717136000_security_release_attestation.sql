-- Extend the live Admin Security posture with the final delivery, AI quota,
-- notification idempotency, and forensic-read access controls introduced in
-- this release. The posture is evaluated from pg_catalog at read time so the
-- Admin Security Center reports drift, not merely installed migration files.

BEGIN;

ALTER FUNCTION public.admin_security_posture()
  RENAME TO admin_security_posture_evidence_access_v1;

REVOKE ALL ON FUNCTION public.admin_security_posture_evidence_access_v1()
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
  v_result JSONB;
  v_checks JSONB;
  v_new_checks JSONB;
  v_failures INTEGER;
  v_warnings INTEGER;
  v_delivery_capability_private BOOLEAN := false;
  v_delivery_insert_blocked BOOLEAN := false;
  v_delivery_update_blocked BOOLEAN := false;
  v_delivery_trigger_enabled BOOLEAN := false;
  v_driver_trigger_enabled BOOLEAN := false;
  v_delivery_rpc_grants_safe BOOLEAN := false;
  v_ai_constraint_present BOOLEAN := false;
  v_ai_reservation_grants_safe BOOLEAN := false;
  v_notification_dedupe_present BOOLEAN := false;
  v_notification_trigger_enabled BOOLEAN := false;
  v_forensic_wrappers_safe BOOLEAN := false;
  v_forensic_legacy_exposed_count INTEGER := 0;
  v_delivery_status TEXT;
  v_ai_status TEXT;
  v_forensic_status TEXT;
BEGIN
  PERFORM security.require_admin_actor();

  -- Call the private attestation implementation directly. The previous public
  -- wrapper is intentionally bypassed so this outer wrapper writes exactly one
  -- access event containing the final release status below.
  v_base := public.admin_security_posture_evidence_access_legacy();

  SELECT
    class.relrowsecurity
    AND NOT pg_catalog.has_table_privilege(
      'anon', 'security.delivery_pickup_capabilities', 'SELECT'
    )
    AND NOT pg_catalog.has_table_privilege(
      'anon', 'security.delivery_pickup_capabilities', 'INSERT'
    )
    AND NOT pg_catalog.has_table_privilege(
      'anon', 'security.delivery_pickup_capabilities', 'UPDATE'
    )
    AND NOT pg_catalog.has_table_privilege(
      'anon', 'security.delivery_pickup_capabilities', 'DELETE'
    )
    AND NOT pg_catalog.has_table_privilege(
      'authenticated', 'security.delivery_pickup_capabilities', 'SELECT'
    )
    AND NOT pg_catalog.has_table_privilege(
      'authenticated', 'security.delivery_pickup_capabilities', 'INSERT'
    )
    AND NOT pg_catalog.has_table_privilege(
      'authenticated', 'security.delivery_pickup_capabilities', 'UPDATE'
    )
    AND NOT pg_catalog.has_table_privilege(
      'authenticated', 'security.delivery_pickup_capabilities', 'DELETE'
    )
  INTO v_delivery_capability_private
  FROM pg_catalog.pg_class class
  JOIN pg_catalog.pg_namespace namespace
    ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'security'
    AND class.relname = 'delivery_pickup_capabilities'
    AND class.relkind = 'r';

  SELECT count(*) = 1 AND COALESCE(bool_and(
    policy.policyname = 'delivery_jobs_rpc_only_insert'
    AND pg_catalog.regexp_replace(
      lower(COALESCE(policy.with_check, '')),
      '[[:space:]()]',
      '',
      'g'
    ) = 'false'
  ), false)
  INTO v_delivery_insert_blocked
  FROM pg_catalog.pg_policies policy
  WHERE policy.schemaname = 'public'
    AND policy.tablename = 'delivery_jobs'
    AND policy.cmd = 'INSERT';

  SELECT count(*) = 1 AND COALESCE(bool_and(
    policy.policyname = 'delivery_jobs_rpc_only_update'
    AND pg_catalog.regexp_replace(
      lower(COALESCE(policy.qual, '')),
      '[[:space:]()]',
      '',
      'g'
    ) = 'false'
    AND pg_catalog.regexp_replace(
      lower(COALESCE(policy.with_check, '')),
      '[[:space:]()]',
      '',
      'g'
    ) = 'false'
  ), false)
  INTO v_delivery_update_blocked
  FROM pg_catalog.pg_policies policy
  WHERE policy.schemaname = 'public'
    AND policy.tablename = 'delivery_jobs'
    AND policy.cmd = 'UPDATE';

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger_row
    WHERE trigger_row.tgrelid = 'public.delivery_jobs'::REGCLASS
      AND trigger_row.tgname = 'enforce_delivery_job_rpc_boundary'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
  )
  INTO v_delivery_trigger_enabled;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger_row
    WHERE trigger_row.tgrelid = 'public.drivers'::REGCLASS
      AND trigger_row.tgname = 'enforce_driver_authorization_boundary'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
  )
  INTO v_driver_trigger_enabled;

  WITH expected(signature) AS (
    VALUES
      ('public.refresh_verification_code(uuid,uuid)'::REGPROCEDURE),
      ('public.initialize_delivery_verification(uuid,uuid)'::REGPROCEDURE),
      ('public.partner_confirm_handover(uuid,uuid,text)'::REGPROCEDURE),
      ('public.complete_delivery_pickup(uuid,text)'::REGPROCEDURE),
      ('public.transition_delivery_job(uuid,text,text,text)'::REGPROCEDURE),
      ('public.assign_fleet_delivery_job(text,uuid,uuid,text,text)'::REGPROCEDURE),
      ('public.get_customer_delivery_tracking(uuid)'::REGPROCEDURE)
  )
  SELECT count(*) = 7
    AND bool_and(pg_catalog.has_function_privilege(
      'authenticated', signature, 'EXECUTE'
    ))
    AND bool_and(NOT pg_catalog.has_function_privilege(
      'anon', signature, 'EXECUTE'
    ))
  INTO v_delivery_rpc_grants_safe
  FROM expected;

  SELECT count(*) = 2
  INTO v_ai_constraint_present
  FROM pg_catalog.pg_constraint constraint_row
  WHERE constraint_row.conrelid IN (
      'security.ai_usage_daily'::REGCLASS,
      'security.ai_request_ledger'::REGCLASS
    )
    AND constraint_row.conname IN (
      'ai_usage_daily_task_allowed',
      'ai_request_ledger_task_allowed'
    )
    AND constraint_row.contype = 'c'
    AND constraint_row.convalidated;

  SELECT
    pg_catalog.has_function_privilege(
      'service_role',
      'public.reserve_ai_request(uuid,text,uuid,integer,integer)'::REGPROCEDURE,
      'EXECUTE'
    )
    AND NOT pg_catalog.has_function_privilege(
      'anon',
      'public.reserve_ai_request(uuid,text,uuid,integer,integer)'::REGPROCEDURE,
      'EXECUTE'
    )
    AND NOT pg_catalog.has_function_privilege(
      'authenticated',
      'public.reserve_ai_request(uuid,text,uuid,integer,integer)'::REGPROCEDURE,
      'EXECUTE'
    )
  INTO v_ai_reservation_grants_safe;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class index_row
    JOIN pg_catalog.pg_namespace namespace
      ON namespace.oid = index_row.relnamespace
    JOIN pg_catalog.pg_index index_meta
      ON index_meta.indexrelid = index_row.oid
    WHERE namespace.nspname = 'public'
      AND index_row.relname = 'notifications_delivery_dedupe_unique'
      AND index_meta.indisunique
      AND index_meta.indisvalid
  )
  INTO v_notification_dedupe_present;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger_row
    WHERE trigger_row.tgrelid = 'public.notifications'::REGCLASS
      AND trigger_row.tgname = 'protect_notification_delivery_identity'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
  )
  INTO v_notification_trigger_enabled;

  WITH expected(signature) AS (
    VALUES
      ('public.admin_search_security_events(text,text,text,text,timestamp with time zone,timestamp with time zone,integer,integer)'::REGPROCEDURE),
      ('public.admin_security_overview(timestamp with time zone)'::REGPROCEDURE),
      ('public.admin_verify_security_event_chain(integer)'::REGPROCEDURE),
      ('public.admin_list_security_incidents(text,integer)'::REGPROCEDURE),
      ('public.admin_get_security_incident(uuid)'::REGPROCEDURE)
  )
  SELECT count(*) = 5
    AND bool_and(procedure.provolatile = 'v')
    AND bool_and(procedure.prosecdef)
    AND bool_and(pg_catalog.has_function_privilege(
      'authenticated', expected.signature, 'EXECUTE'
    ))
    AND bool_and(NOT pg_catalog.has_function_privilege(
      'anon', expected.signature, 'EXECUTE'
    ))
  INTO v_forensic_wrappers_safe
  FROM expected
  JOIN pg_catalog.pg_proc procedure
    ON procedure.oid = expected.signature;

  v_forensic_wrappers_safe := v_forensic_wrappers_safe
    AND NOT pg_catalog.has_function_privilege(
      'anon',
      'security.record_admin_evidence_access(text,text,text,jsonb)'::REGPROCEDURE,
      'EXECUTE'
    )
    AND NOT pg_catalog.has_function_privilege(
      'authenticated',
      'security.record_admin_evidence_access(text,text,text,jsonb)'::REGPROCEDURE,
      'EXECUTE'
    );

  SELECT count(*)::INTEGER
  INTO v_forensic_legacy_exposed_count
  FROM pg_catalog.pg_proc procedure
  JOIN pg_catalog.pg_namespace namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND (
      procedure.proname LIKE '%evidence_access_legacy'
      OR procedure.proname = 'admin_security_posture_evidence_access_v1'
    )
    AND (
      pg_catalog.has_function_privilege(
        'anon', procedure.oid::REGPROCEDURE, 'EXECUTE'
      )
      OR pg_catalog.has_function_privilege(
        'authenticated', procedure.oid::REGPROCEDURE, 'EXECUTE'
      )
    );

  v_delivery_status := CASE
    WHEN COALESCE(v_delivery_capability_private, false)
      AND v_delivery_insert_blocked
      AND v_delivery_update_blocked
      AND v_delivery_trigger_enabled
      AND v_driver_trigger_enabled
      AND v_delivery_rpc_grants_safe THEN 'pass'
    ELSE 'fail'
  END;
  v_ai_status := CASE
    WHEN v_ai_constraint_present
      AND v_ai_reservation_grants_safe
      AND v_notification_dedupe_present
      AND v_notification_trigger_enabled THEN 'pass'
    ELSE 'fail'
  END;
  v_forensic_status := CASE
    WHEN v_forensic_wrappers_safe
      AND v_forensic_legacy_exposed_count = 0 THEN 'pass'
    ELSE 'fail'
  END;

  v_new_checks := jsonb_build_array(
    jsonb_build_object(
      'id', 'delivery_capability_and_assignment_boundary',
      'label', 'Delivery capability and assignment boundary',
      'status', v_delivery_status,
      'count', CASE WHEN v_delivery_status = 'pass' THEN 0 ELSE 1 END,
      'summary', CASE
        WHEN v_delivery_status = 'pass'
          THEN 'Pickup secrets are private and delivery or driver state changes require reviewed RPC boundaries'
        ELSE 'A delivery secret, direct-write policy, trigger, or reviewed RPC grant has drifted'
      END,
      'items', jsonb_build_array(
        jsonb_build_object('pickup_capability_private', v_delivery_capability_private),
        jsonb_build_object('direct_insert_blocked', v_delivery_insert_blocked),
        jsonb_build_object('direct_update_blocked', v_delivery_update_blocked),
        jsonb_build_object('delivery_trigger_enabled', v_delivery_trigger_enabled),
        jsonb_build_object('driver_trigger_enabled', v_driver_trigger_enabled),
        jsonb_build_object('reviewed_rpc_grants_safe', v_delivery_rpc_grants_safe)
      )
    ),
    jsonb_build_object(
      'id', 'ai_quota_and_notification_idempotency',
      'label', 'AI budget and notification idempotency',
      'status', v_ai_status,
      'count', CASE WHEN v_ai_status = 'pass' THEN 0 ELSE 1 END,
      'summary', CASE
        WHEN v_ai_status = 'pass'
          THEN 'AI reservations are service-only and notification deliveries are deduplicated'
        ELSE 'An AI quota constraint, reservation grant, or notification dedupe control has drifted'
      END,
      'items', jsonb_build_array(
        jsonb_build_object('task_constraint_present', v_ai_constraint_present),
        jsonb_build_object('reservation_service_only', v_ai_reservation_grants_safe),
        jsonb_build_object('dedupe_index_present', v_notification_dedupe_present),
        jsonb_build_object('identity_trigger_enabled', v_notification_trigger_enabled)
      )
    ),
    jsonb_build_object(
      'id', 'forensic_evidence_read_audit',
      'label', 'Forensic evidence read audit',
      'status', v_forensic_status,
      'count', v_forensic_legacy_exposed_count,
      'summary', CASE
        WHEN v_forensic_status = 'pass'
          THEN 'AAL2 evidence reads use volatile audited wrappers and legacy implementations are private'
        ELSE 'A forensic wrapper is not auditable or a legacy evidence function is exposed'
      END,
      'items', jsonb_build_array(
        jsonb_build_object('audited_wrappers_safe', v_forensic_wrappers_safe),
        jsonb_build_object('legacy_exposed_count', v_forensic_legacy_exposed_count)
      )
    )
  );

  v_checks := COALESCE(v_base -> 'checks', '[]'::JSONB) || v_new_checks;
  v_failures := COALESCE((v_base ->> 'failure_count')::INTEGER, 0)
    + CASE WHEN v_delivery_status = 'fail' THEN 1 ELSE 0 END
    + CASE WHEN v_ai_status = 'fail' THEN 1 ELSE 0 END
    + CASE WHEN v_forensic_status = 'fail' THEN 1 ELSE 0 END;
  v_warnings := COALESCE((v_base ->> 'warning_count')::INTEGER, 0);

  v_result := v_base || jsonb_build_object(
    'generated_at', clock_timestamp(),
    'release_version', '20260717136000',
    'status', CASE
      WHEN v_failures > 0 THEN 'action_required'
      WHEN v_warnings > 0 THEN 'review'
      ELSE 'healthy'
    END,
    'failure_count', v_failures,
    'warning_count', v_warnings,
    'checks', v_checks
  );

  PERFORM security.record_admin_evidence_access(
    'read_posture',
    'security.runtime_posture',
    NULL,
    jsonb_build_object(
      'status', v_result ->> 'status',
      'release_version', v_result ->> 'release_version'
    )
  );

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_security_posture()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_security_posture()
  TO authenticated;

COMMENT ON FUNCTION public.admin_security_posture() IS
  'AAL2-admin-only live security posture with audited reads and delivery, AI quota, notification idempotency, and forensic-access attestation for release 20260717136000.';

NOTIFY pgrst, 'reload schema';

COMMIT;
