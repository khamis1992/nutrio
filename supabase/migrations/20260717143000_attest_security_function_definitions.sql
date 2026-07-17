-- Detect live drift in the definitions of critical security functions.

BEGIN;

CREATE TABLE IF NOT EXISTS security.function_definition_attestations (
  procedure_signature TEXT PRIMARY KEY,
  expected_sha256 TEXT NOT NULL CHECK (expected_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  release_version TEXT NOT NULL CHECK (release_version ~ '^[0-9]{14}$')
);

ALTER TABLE security.function_definition_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.function_definition_attestations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.function_definition_attestations FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO security.function_definition_attestations (
  procedure_signature,
  expected_sha256,
  release_version
)
SELECT
  expected.signature::TEXT,
  encode(
    extensions.digest(
      convert_to(pg_catalog.pg_get_functiondef(expected.signature), 'UTF8'),
      'sha256'
    ),
    'hex'
  ),
  '20260717143000'
FROM (
  VALUES
    ('public.has_role(uuid,public.app_role)'::REGPROCEDURE),
    ('security.require_admin_actor()'::REGPROCEDURE),
    ('public.record_security_event(text,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,timestamp with time zone,text,text)'::REGPROCEDURE),
    ('public.admin_verify_security_event_chain(integer)'::REGPROCEDURE),
    ('public.claim_security_alerts(integer,integer)'::REGPROCEDURE),
    ('public.complete_security_alert(uuid,uuid,boolean,boolean,text,text,timestamp with time zone,text,text)'::REGPROCEDURE),
    ('public.admin_seal_security_incident(uuid,integer)'::REGPROCEDURE),
    ('public.admin_prepare_security_export_page(jsonb,integer,bigint)'::REGPROCEDURE),
    ('public.admin_get_security_incident(uuid)'::REGPROCEDURE),
    ('security.guard_and_seal_incident()'::REGPROCEDURE)
) AS expected(signature)
ON CONFLICT (procedure_signature) DO NOTHING;

DROP TRIGGER IF EXISTS security_function_attestation_immutable_trigger
  ON security.function_definition_attestations;
CREATE TRIGGER security_function_attestation_immutable_trigger
BEFORE UPDATE OR DELETE ON security.function_definition_attestations
FOR EACH ROW EXECUTE FUNCTION security.prevent_evidence_mutation();
DROP TRIGGER IF EXISTS security_function_attestation_truncate_guard
  ON security.function_definition_attestations;
CREATE TRIGGER security_function_attestation_truncate_guard
BEFORE TRUNCATE ON security.function_definition_attestations
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

ALTER FUNCTION public.admin_security_posture()
  RENAME TO admin_security_posture_function_attestation_legacy;
REVOKE ALL ON FUNCTION public.admin_security_posture_function_attestation_legacy()
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
  v_drift JSONB := '[]'::JSONB;
  v_drift_count INTEGER := 0;
  v_pending BIGINT := 0;
  v_processing BIGINT := 0;
  v_dead_letter BIGINT := 0;
  v_oldest_pending TIMESTAMPTZ;
  v_last_dispatch TIMESTAMPTZ;
  v_alert_status TEXT;
  v_failures INTEGER;
  v_warnings INTEGER;
BEGIN
  PERFORM security.require_admin_actor();
  v_base := public.admin_security_posture_function_attestation_legacy();

  WITH current_state AS (
    SELECT
      attestation.procedure_signature,
      attestation.expected_sha256,
      procedure.oid,
      CASE
        WHEN procedure.oid IS NULL THEN NULL
        ELSE encode(
          extensions.digest(
            convert_to(pg_catalog.pg_get_functiondef(procedure.oid), 'UTF8'),
            'sha256'
          ),
          'hex'
        )
      END AS current_sha256
    FROM security.function_definition_attestations attestation
    LEFT JOIN pg_catalog.pg_proc procedure
      ON procedure.oid = pg_catalog.to_regprocedure(attestation.procedure_signature)
  )
  SELECT
    count(*) FILTER (
      WHERE current.oid IS NULL
         OR current.current_sha256 IS DISTINCT FROM current.expected_sha256
    )::INTEGER,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'procedure', current.procedure_signature,
        'expected_sha256', current.expected_sha256,
        'current_sha256', current.current_sha256,
        'missing', current.oid IS NULL
      ) ORDER BY current.procedure_signature
    ) FILTER (
      WHERE current.oid IS NULL
         OR current.current_sha256 IS DISTINCT FROM current.expected_sha256
    ), '[]'::JSONB)
  INTO v_drift_count, v_drift
  FROM current_state current;

  SELECT
    count(*) FILTER (WHERE queue.status = 'pending'),
    count(*) FILTER (WHERE queue.status = 'processing'),
    count(*) FILTER (WHERE queue.status = 'dead_letter'),
    min(queue.created_at) FILTER (WHERE queue.status IN ('pending', 'processing'))
  INTO v_pending, v_processing, v_dead_letter, v_oldest_pending
  FROM security.security_alert_outbox queue;

  SELECT max(event.occurred_at)
  INTO v_last_dispatch
  FROM security.event_ledger event
  WHERE event.event_type IN (
    'security.alert.dispatch_completed',
    'security.alert.dead_letter_detected'
  );

  v_alert_status := CASE
    WHEN v_dead_letter > 0 THEN 'fail'
    WHEN v_last_dispatch IS NULL
      OR v_last_dispatch < clock_timestamp() - interval '1 hour' THEN 'fail'
    WHEN v_last_dispatch < clock_timestamp() - interval '15 minutes'
      OR v_oldest_pending < clock_timestamp() - interval '10 minutes' THEN 'warning'
    ELSE 'pass'
  END;
  v_failures := COALESCE((v_base ->> 'failure_count')::INTEGER, 0)
    + CASE WHEN v_drift_count > 0 THEN 1 ELSE 0 END
    + CASE WHEN v_alert_status = 'fail' THEN 1 ELSE 0 END;
  v_warnings := COALESCE((v_base ->> 'warning_count')::INTEGER, 0)
    + CASE WHEN v_alert_status = 'warning' THEN 1 ELSE 0 END;

  v_checks := COALESCE(v_base -> 'checks', '[]'::JSONB) || jsonb_build_array(
    jsonb_build_object(
      'id', 'critical_function_definition_attestation',
      'label', 'Critical function definition attestation',
      'status', CASE WHEN v_drift_count = 0 THEN 'pass' ELSE 'fail' END,
      'count', v_drift_count,
      'summary', CASE
        WHEN v_drift_count = 0 THEN 'Critical live SQL definitions match the release baseline'
        ELSE 'A critical security function is missing or differs from its immutable release baseline'
      END,
      'items', v_drift
    ),
    jsonb_build_object(
      'id', 'critical_alert_delivery_health',
      'label', 'Critical alert delivery health',
      'status', v_alert_status,
      'count', v_dead_letter,
      'summary', CASE
        WHEN v_alert_status = 'pass' THEN 'Critical alerts have no dead letters or stale delivery backlog'
        WHEN v_alert_status = 'warning' THEN 'Security alerts have waited more than ten minutes for delivery'
        ELSE 'One or more security alerts exhausted all delivery attempts'
      END,
      'items', jsonb_build_array(
        jsonb_build_object('pending', v_pending),
        jsonb_build_object('processing', v_processing),
        jsonb_build_object('dead_letter', v_dead_letter),
        jsonb_build_object('oldest_pending_at', v_oldest_pending),
        jsonb_build_object('last_dispatch_at', v_last_dispatch)
      )
    )
  );

  RETURN v_base || jsonb_build_object(
    'generated_at', clock_timestamp(),
    'release_version', '20260717143000',
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
GRANT EXECUTE ON FUNCTION public.admin_security_posture() TO authenticated;

CREATE OR REPLACE FUNCTION public.security_release_runtime_version()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN COALESCE(auth.role(), '') = 'service_role' THEN '20260717143000'::TEXT
    ELSE NULL::TEXT
  END;
$function$;
REVOKE ALL ON FUNCTION public.security_release_runtime_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_release_runtime_version() TO service_role;

COMMIT;
