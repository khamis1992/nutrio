BEGIN;

CREATE OR REPLACE FUNCTION public.admin_security_posture()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_public_sensitive JSONB := '[]'::JSONB;
  v_rls_disabled JSONB := '[]'::JSONB;
  v_anon_definers JSONB := '[]'::JSONB;
  v_unsafe_search_path JSONB := '[]'::JSONB;
  v_direct_upload_policies JSONB := '[]'::JSONB;
  v_public_sensitive_count INTEGER := 0;
  v_rls_disabled_count INTEGER := 0;
  v_anon_definer_count INTEGER := 0;
  v_unsafe_search_path_count INTEGER := 0;
  v_direct_upload_policy_count INTEGER := 0;
  v_latest_anchor_date DATE;
  v_latest_anchor_hash TEXT;
  v_latest_receipt_count INTEGER := 0;
  v_anchored_sequence BIGINT := 0;
  v_unanchored_events BIGINT := 0;
  v_scan_clean_24h BIGINT := 0;
  v_scan_rejected_24h BIGINT := 0;
  v_scan_error_24h BIGINT := 0;
  v_scan_validated_only_24h BIGINT := 0;
  v_mfa_enforced BOOLEAN := false;
  v_failures INTEGER := 0;
  v_warnings INTEGER := 0;
  v_checks JSONB;
BEGIN
  IF v_actor IS NULL
     OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;

  SELECT count(*), COALESCE(jsonb_agg(id ORDER BY id), '[]'::JSONB)
  INTO v_public_sensitive_count, v_public_sensitive
  FROM storage.buckets
  WHERE public = true
    AND id IN (
      'blood-reports',
      'ticket-attachments',
      'coach-photos',
      'coach-attachments',
      'fleet-documents'
    );

  SELECT count(*), COALESCE(jsonb_agg(table_name ORDER BY table_name), '[]'::JSONB)
  INTO v_rls_disabled_count, v_rls_disabled
  FROM (
    SELECT c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity = false
  ) exposed_tables;

  WITH candidates AS (
    SELECT p.oid::REGPROCEDURE::TEXT AS signature
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  ), numbered AS (
    SELECT signature, row_number() OVER (ORDER BY signature) AS item_number
    FROM candidates
  )
  SELECT
    count(*),
    COALESCE(
      jsonb_agg(signature ORDER BY signature) FILTER (WHERE item_number <= 50),
      '[]'::JSONB
    )
  INTO v_anon_definer_count, v_anon_definers
  FROM numbered;

  WITH candidates AS (
    SELECT p.oid::REGPROCEDURE::TEXT AS signature
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'security')
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) AS config(setting)
        WHERE config.setting LIKE 'search_path=%'
      )
  ), numbered AS (
    SELECT signature, row_number() OVER (ORDER BY signature) AS item_number
    FROM candidates
  )
  SELECT
    count(*),
    COALESCE(
      jsonb_agg(signature ORDER BY signature) FILTER (WHERE item_number <= 50),
      '[]'::JSONB
    )
  INTO v_unsafe_search_path_count, v_unsafe_search_path
  FROM numbered;

  WITH candidates AS (
    SELECT
      policyname AS policy_name,
      lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) AS expression
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE')
  ), unsafe_policies AS (
    SELECT policy_name
    FROM candidates
    WHERE expression ~ '(blood-reports|ticket-attachments|coach-photos|coach-attachments|fleet-documents)'
       OR expression !~ 'bucket_id'
  ), numbered AS (
    SELECT policy_name, row_number() OVER (ORDER BY policy_name) AS item_number
    FROM unsafe_policies
  )
  SELECT
    count(*),
    COALESCE(
      jsonb_agg(policy_name ORDER BY policy_name) FILTER (WHERE item_number <= 50),
      '[]'::JSONB
    )
  INTO v_direct_upload_policy_count, v_direct_upload_policies
  FROM numbered;

  SELECT a.anchor_date, a.anchor_hash, a.last_sequence
  INTO v_latest_anchor_date, v_latest_anchor_hash, v_anchored_sequence
  FROM security.event_chain_anchors a
  ORDER BY a.anchor_date DESC
  LIMIT 1;

  SELECT count(*)
  INTO v_latest_receipt_count
  FROM security.event_anchor_receipts r
  WHERE r.anchor_hash = v_latest_anchor_hash;

  SELECT count(*)
  INTO v_unanchored_events
  FROM security.event_ledger e
  WHERE e.sequence_number > COALESCE(v_anchored_sequence, 0);

  SELECT
    count(*) FILTER (WHERE status = 'clean'),
    count(*) FILTER (WHERE status = 'rejected'),
    count(*) FILTER (WHERE status = 'error'),
    count(*) FILTER (WHERE status = 'validated_only')
  INTO
    v_scan_clean_24h,
    v_scan_rejected_24h,
    v_scan_error_24h,
    v_scan_validated_only_24h
  FROM security.sensitive_file_scans
  WHERE created_at >= now() - interval '24 hours';

  SELECT COALESCE(
    pg_catalog.pg_get_functiondef('public.has_role(uuid,public.app_role)'::REGPROCEDURE)
      LIKE '%aal2%',
    false
  )
  INTO v_mfa_enforced;

  v_failures :=
    (CASE WHEN v_public_sensitive_count > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN v_rls_disabled_count > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN v_unsafe_search_path_count > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN v_direct_upload_policy_count > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN NOT v_mfa_enforced THEN 1 ELSE 0 END) +
    (CASE WHEN v_latest_anchor_date IS NOT NULL AND v_latest_receipt_count = 0 THEN 1 ELSE 0 END);

  v_warnings :=
    (CASE WHEN v_anon_definer_count > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN v_latest_anchor_date IS NULL THEN 1 ELSE 0 END) +
    (CASE WHEN v_unanchored_events > 5000 THEN 1 ELSE 0 END) +
    (CASE WHEN v_scan_error_24h > 0 OR v_scan_validated_only_24h > 0 THEN 1 ELSE 0 END);

  v_checks := jsonb_build_array(
    jsonb_build_object(
      'id', 'sensitive_storage_private',
      'label', 'Sensitive storage privacy',
      'status', CASE WHEN v_public_sensitive_count = 0 THEN 'pass' ELSE 'fail' END,
      'count', v_public_sensitive_count,
      'summary', CASE WHEN v_public_sensitive_count = 0
        THEN 'All sensitive buckets are private'
        ELSE 'Sensitive buckets are publicly readable' END,
      'items', v_public_sensitive
    ),
    jsonb_build_object(
      'id', 'public_tables_rls',
      'label', 'Public schema RLS',
      'status', CASE WHEN v_rls_disabled_count = 0 THEN 'pass' ELSE 'fail' END,
      'count', v_rls_disabled_count,
      'summary', CASE WHEN v_rls_disabled_count = 0
        THEN 'RLS is enabled on every public table'
        ELSE 'Tables without RLS require immediate review' END,
      'items', v_rls_disabled
    ),
    jsonb_build_object(
      'id', 'sensitive_upload_gateway',
      'label', 'Sensitive upload gateway',
      'status', CASE WHEN v_direct_upload_policy_count = 0 THEN 'pass' ELSE 'fail' END,
      'count', v_direct_upload_policy_count,
      'summary', CASE WHEN v_direct_upload_policy_count = 0
        THEN 'Direct client writes are blocked'
        ELSE 'Direct write policies bypass the scan gateway' END,
      'items', v_direct_upload_policies
    ),
    jsonb_build_object(
      'id', 'definer_search_path',
      'label', 'Privileged function search path',
      'status', CASE WHEN v_unsafe_search_path_count = 0 THEN 'pass' ELSE 'fail' END,
      'count', v_unsafe_search_path_count,
      'summary', CASE WHEN v_unsafe_search_path_count = 0
        THEN 'Privileged functions pin their search path'
        ELSE 'SECURITY DEFINER functions have an unsafe search path' END,
      'items', v_unsafe_search_path
    ),
    jsonb_build_object(
      'id', 'anonymous_definers',
      'label', 'Anonymous privileged RPC exposure',
      'status', CASE WHEN v_anon_definer_count = 0 THEN 'pass' ELSE 'warning' END,
      'count', v_anon_definer_count,
      'summary', CASE WHEN v_anon_definer_count = 0
        THEN 'No privileged RPC is executable anonymously'
        ELSE 'Privileged RPC grants require manual review' END,
      'items', v_anon_definers
    ),
    jsonb_build_object(
      'id', 'admin_mfa',
      'label', 'Admin step-up authentication',
      'status', CASE WHEN v_mfa_enforced THEN 'pass' ELSE 'fail' END,
      'count', CASE WHEN v_mfa_enforced THEN 0 ELSE 1 END,
      'summary', CASE WHEN v_mfa_enforced
        THEN 'Admin data access requires AAL2 MFA'
        ELSE 'Admin MFA enforcement is missing' END,
      'items', '[]'::JSONB
    ),
    jsonb_build_object(
      'id', 'external_evidence_anchor',
      'label', 'Off-site evidence anchor',
      'status', CASE
        WHEN v_latest_anchor_date IS NULL THEN 'warning'
        WHEN v_latest_receipt_count = 0 THEN 'fail'
        WHEN v_unanchored_events > 5000 THEN 'warning'
        ELSE 'pass'
      END,
      'count', v_unanchored_events,
      'summary', CASE
        WHEN v_latest_anchor_date IS NULL THEN 'No daily ledger anchor exists yet'
        WHEN v_latest_receipt_count = 0 THEN 'Latest anchor has no external receipt'
        WHEN v_unanchored_events > 5000 THEN 'A large recent event set awaits the next anchor'
        ELSE 'Latest anchor has an off-site receipt'
      END,
      'items', jsonb_build_array(
        jsonb_build_object(
          'latest_anchor', v_latest_anchor_date,
          'external_receipts', v_latest_receipt_count,
          'unanchored_events', v_unanchored_events
        )
      )
    ),
    jsonb_build_object(
      'id', 'malware_scanning',
      'label', 'Sensitive file scanning (24h)',
      'status', CASE
        WHEN v_scan_error_24h > 0 OR v_scan_validated_only_24h > 0 THEN 'warning'
        ELSE 'pass'
      END,
      'count', v_scan_error_24h + v_scan_validated_only_24h,
      'summary', CASE
        WHEN v_scan_error_24h > 0 THEN 'One or more malware scans failed closed'
        WHEN v_scan_validated_only_24h > 0 THEN 'Some files bypassed malware scanning by configuration'
        ELSE 'No scan bypass or scanner failure recorded' END,
      'items', jsonb_build_array(
        jsonb_build_object(
          'clean', v_scan_clean_24h,
          'blocked', v_scan_rejected_24h,
          'errors', v_scan_error_24h,
          'validated_only', v_scan_validated_only_24h
        )
      )
    )
  );

  RETURN jsonb_build_object(
    'generated_at', clock_timestamp(),
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

REVOKE ALL ON FUNCTION public.admin_security_posture() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_security_posture() TO authenticated;

COMMENT ON FUNCTION public.admin_security_posture() IS
  'AAL2-admin-only live posture checks for RLS, privileged RPCs, sensitive storage, scanning, and evidence anchoring.';

NOTIFY pgrst, 'reload schema';

COMMIT;
