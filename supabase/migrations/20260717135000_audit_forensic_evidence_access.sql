BEGIN;

-- Reading forensic evidence is itself a privileged action. The original
-- read-only RPCs remain private implementation details; these wrappers retain
-- the same API while appending a minimized access event after a successful
-- read. Failed authorization is captured independently by Supabase Auth and
-- the API gateway, so an attacker cannot manufacture a successful access log.
CREATE OR REPLACE FUNCTION security.record_admin_evidence_access(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_headers JSONB := '{}'::JSONB;
  v_ip INET;
  v_country_code TEXT;
  v_session_id TEXT;
  v_event_id UUID;
BEGIN
  IF p_action NOT IN (
    'search_events',
    'read_overview',
    'verify_integrity',
    'read_posture',
    'list_incidents',
    'view_incident'
  ) THEN
    RAISE EXCEPTION 'FORENSIC_ACCESS_ACTION_INVALID';
  END IF;
  IF char_length(COALESCE(p_resource_type, '')) NOT BETWEEN 3 AND 120
     OR char_length(COALESCE(p_resource_id, '')) > 240
     OR jsonb_typeof(COALESCE(p_metadata, '{}'::JSONB)) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'FORENSIC_ACCESS_METADATA_INVALID';
  END IF;

  BEGIN
    v_headers := COALESCE(
      NULLIF(current_setting('request.headers', true), '')::JSONB,
      '{}'::JSONB
    );
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::JSONB;
  END;

  BEGIN
    v_ip := NULLIF(trim(split_part(COALESCE(
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-forwarded-for',
      ''
    ), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  v_country_code := upper(trim(COALESCE(v_headers ->> 'cf-ipcountry', '')));
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    v_country_code := NULL;
  END IF;
  v_session_id := NULLIF(auth.jwt() ->> 'session_id', '');

  INSERT INTO security.event_ledger (
    event_type,
    category,
    severity,
    source,
    outcome,
    actor_user_id,
    actor_role,
    actor_type,
    action,
    resource_type,
    resource_id,
    request_id,
    correlation_id,
    session_fingerprint,
    ip_address,
    country_code,
    user_agent,
    metadata,
    event_hash
  ) VALUES (
    'admin.forensic_evidence.' || p_action,
    'admin',
    'low',
    'database',
    'success',
    v_actor,
    'admin',
    'admin',
    p_action,
    p_resource_type,
    NULLIF(left(trim(COALESCE(p_resource_id, '')), 240), ''),
    COALESCE(v_headers ->> 'sb-request-id', v_headers ->> 'x-request-id'),
    v_headers ->> 'x-correlation-id',
    CASE
      WHEN v_session_id IS NULL THEN NULL
      ELSE 'sha256:' || encode(
        extensions.digest(convert_to(v_session_id, 'UTF8'), 'sha256'),
        'hex'
      )
    END,
    v_ip,
    v_country_code,
    left(NULLIF(v_headers ->> 'user-agent', ''), 1000),
    security.redact_jsonb(COALESCE(p_metadata, '{}'::JSONB)),
    repeat('0', 64)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

ALTER FUNCTION public.admin_search_security_events(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER
) RENAME TO admin_search_security_events_evidence_access_legacy;

CREATE OR REPLACE FUNCTION public.admin_search_security_events(
  p_severity TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_outcome TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT (now() - interval '7 days'),
  p_to TIMESTAMPTZ DEFAULT now(),
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  sequence_number BIGINT,
  event_id UUID,
  occurred_at TIMESTAMPTZ,
  event_type TEXT,
  category TEXT,
  severity TEXT,
  source TEXT,
  outcome TEXT,
  actor_user_id UUID,
  actor_role TEXT,
  actor_type TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  request_id TEXT,
  correlation_id TEXT,
  session_fingerprint TEXT,
  ip_address TEXT,
  country_code TEXT,
  user_agent TEXT,
  metadata JSONB,
  previous_hash TEXT,
  event_hash TEXT,
  evidence_signature TEXT,
  signature_key_id TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM security.require_admin_actor();

  RETURN QUERY
  SELECT *
  FROM public.admin_search_security_events_evidence_access_legacy(
    p_severity,
    p_category,
    p_outcome,
    p_search,
    p_from,
    p_to,
    p_limit,
    p_offset
  );

  PERFORM security.record_admin_evidence_access(
    'search_events',
    'security.event_ledger',
    NULL,
    jsonb_build_object(
      'severity_filter', COALESCE(NULLIF(p_severity, ''), 'all'),
      'category_filter', COALESCE(NULLIF(p_category, ''), 'all'),
      'outcome_filter', COALESCE(NULLIF(p_outcome, ''), 'all'),
      'search_used', NULLIF(trim(COALESCE(p_search, '')), '') IS NOT NULL,
      'from', p_from,
      'to', p_to,
      'limit', LEAST(GREATEST(COALESCE(p_limit, 100), 1), 5000),
      'offset', GREATEST(COALESCE(p_offset, 0), 0)
    )
  );
END;
$function$;

ALTER FUNCTION public.admin_security_overview(TIMESTAMPTZ)
  RENAME TO admin_security_overview_evidence_access_legacy;

CREATE OR REPLACE FUNCTION public.admin_security_overview(
  p_since TIMESTAMPTZ DEFAULT (now() - interval '24 hours')
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM security.require_admin_actor();
  v_result := public.admin_security_overview_evidence_access_legacy(p_since);
  PERFORM security.record_admin_evidence_access(
    'read_overview',
    'security.event_ledger',
    NULL,
    jsonb_build_object('since', p_since)
  );
  RETURN v_result;
END;
$function$;

ALTER FUNCTION public.admin_verify_security_event_chain(INTEGER)
  RENAME TO admin_verify_security_event_chain_evidence_access_legacy;

CREATE OR REPLACE FUNCTION public.admin_verify_security_event_chain(
  p_limit INTEGER DEFAULT 50000
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM security.require_admin_actor();
  v_result := public.admin_verify_security_event_chain_evidence_access_legacy(p_limit);
  PERFORM security.record_admin_evidence_access(
    'verify_integrity',
    'security.event_ledger',
    NULL,
    jsonb_build_object(
      'valid', COALESCE((v_result ->> 'valid')::BOOLEAN, false),
      'verification_scope', v_result ->> 'verification_scope',
      'checked', v_result -> 'checked'
    )
  );
  RETURN v_result;
END;
$function$;

ALTER FUNCTION public.admin_security_posture()
  RENAME TO admin_security_posture_evidence_access_legacy;

CREATE OR REPLACE FUNCTION public.admin_security_posture()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM security.require_admin_actor();
  v_result := public.admin_security_posture_evidence_access_legacy();
  PERFORM security.record_admin_evidence_access(
    'read_posture',
    'security.runtime_posture',
    NULL,
    jsonb_build_object(
      'overall_status', v_result ->> 'overall_status',
      'release_version', v_result ->> 'release_version'
    )
  );
  RETURN v_result;
END;
$function$;

ALTER FUNCTION public.admin_list_security_incidents(TEXT, INTEGER)
  RENAME TO admin_list_security_incidents_evidence_access_legacy;

CREATE OR REPLACE FUNCTION public.admin_list_security_incidents(
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  case_number TEXT,
  title TEXT,
  summary TEXT,
  severity TEXT,
  status TEXT,
  opened_by UUID,
  assigned_to UUID,
  detected_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  external_reference TEXT,
  version INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  evidence_count BIGINT,
  timeline_count BIGINT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM security.require_admin_actor();

  RETURN QUERY
  SELECT *
  FROM public.admin_list_security_incidents_evidence_access_legacy(
    p_status,
    p_limit
  );

  PERFORM security.record_admin_evidence_access(
    'list_incidents',
    'security.incidents',
    NULL,
    jsonb_build_object(
      'status_filter', COALESCE(NULLIF(p_status, ''), 'all'),
      'limit', LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
    )
  );
END;
$function$;

ALTER FUNCTION public.admin_get_security_incident(UUID)
  RENAME TO admin_get_security_incident_evidence_access_legacy;

CREATE OR REPLACE FUNCTION public.admin_get_security_incident(
  p_incident_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM security.require_admin_actor();
  v_result := public.admin_get_security_incident_evidence_access_legacy(
    p_incident_id
  );
  PERFORM security.record_admin_evidence_access(
    'view_incident',
    'security.incidents',
    p_incident_id::TEXT,
    jsonb_build_object(
      'case_number', v_result -> 'incident' ->> 'case_number'
    )
  );
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION security.record_admin_evidence_access(TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_search_security_events_evidence_access_legacy(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_security_overview_evidence_access_legacy(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_verify_security_event_chain_evidence_access_legacy(INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_security_posture_evidence_access_legacy()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_list_security_incidents_evidence_access_legacy(TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_get_security_incident_evidence_access_legacy(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_search_security_events(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_security_overview(TIMESTAMPTZ)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_verify_security_event_chain(INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_security_posture()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_security_incidents(TEXT, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_security_incident(UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_search_security_events(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_security_overview(TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_security_event_chain(INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_security_posture()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_security_incidents(TEXT, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_security_incident(UUID)
  TO authenticated;

COMMENT ON FUNCTION security.record_admin_evidence_access(TEXT, TEXT, TEXT, JSONB) IS
  'Internal append-only audit for successful AAL2 administrator reads of forensic evidence; search text and sensitive payloads are never retained.';

NOTIFY pgrst, 'reload schema';

COMMIT;
