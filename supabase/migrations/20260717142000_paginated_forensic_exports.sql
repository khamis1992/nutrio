-- Complete, cursor-based forensic exports with anchor membership and receipts.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_prepare_security_export_page(
  p_filters JSONB DEFAULT '{}'::JSONB,
  p_limit INTEGER DEFAULT 1500,
  p_before_sequence BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_filters JSONB := COALESCE(p_filters, '{}'::JSONB);
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 1500), 1), 2000);
  v_severity TEXT;
  v_category TEXT;
  v_outcome TEXT;
  v_search TEXT;
  v_from TIMESTAMPTZ;
  v_to TIMESTAMPTZ;
  v_total_count BIGINT := 0;
  v_remaining_count BIGINT := 0;
  v_event_count BIGINT := 0;
  v_min_sequence BIGINT;
  v_max_sequence BIGINT;
  v_next_before_sequence BIGINT;
  v_has_more BOOLEAN := false;
  v_events JSONB := '[]'::JSONB;
  v_anchors JSONB := '[]'::JSONB;
  v_memberships JSONB := '[]'::JSONB;
  v_receipts JSONB := '[]'::JSONB;
  v_integrity JSONB;
  v_payload JSONB;
  v_content TEXT;
  v_hash TEXT;
  v_byte_length BIGINT;
  v_generated_at TIMESTAMPTZ := clock_timestamp();
  v_filename TEXT;
  v_event_id UUID;
BEGIN
  IF jsonb_typeof(v_filters) IS DISTINCT FROM 'object'
     OR p_before_sequence IS NOT NULL AND p_before_sequence < 1 THEN
    RAISE EXCEPTION 'EXPORT_INPUT_INVALID';
  END IF;

  v_severity := NULLIF(trim(v_filters ->> 'severity'), '');
  v_category := NULLIF(trim(v_filters ->> 'category'), '');
  v_outcome := NULLIF(trim(v_filters ->> 'outcome'), '');
  v_search := NULLIF(left(trim(v_filters ->> 'search'), 200), '');
  IF v_severity = 'all' THEN v_severity := NULL; END IF;
  IF v_category = 'all' THEN v_category := NULL; END IF;
  IF v_outcome = 'all' THEN v_outcome := NULL; END IF;
  IF v_severity IS NOT NULL AND v_severity NOT IN ('info', 'low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'EXPORT_SEVERITY_INVALID';
  END IF;
  IF v_category IS NOT NULL AND v_category NOT IN (
    'authentication', 'authorization', 'admin', 'data_change', 'payment',
    'api', 'edge_function', 'storage', 'configuration', 'detection', 'incident'
  ) THEN
    RAISE EXCEPTION 'EXPORT_CATEGORY_INVALID';
  END IF;
  IF v_outcome IS NOT NULL AND v_outcome NOT IN ('success', 'failure', 'blocked', 'denied', 'unknown') THEN
    RAISE EXCEPTION 'EXPORT_OUTCOME_INVALID';
  END IF;

  BEGIN
    v_from := COALESCE(NULLIF(v_filters ->> 'from', '')::TIMESTAMPTZ, clock_timestamp() - interval '7 days');
    v_to := COALESCE(NULLIF(v_filters ->> 'to', '')::TIMESTAMPTZ, clock_timestamp());
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'EXPORT_DATE_RANGE_INVALID';
  END;
  IF v_from > v_to OR v_to - v_from > interval '366 days' THEN
    RAISE EXCEPTION 'EXPORT_DATE_RANGE_INVALID';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT event.*
    FROM security.event_ledger event
    WHERE event.occurred_at >= v_from
      AND event.occurred_at <= v_to
      AND (v_severity IS NULL OR event.severity = v_severity)
      AND (v_category IS NULL OR event.category = v_category)
      AND (v_outcome IS NULL OR event.outcome = v_outcome)
      AND (
        v_search IS NULL
        OR event.event_type ILIKE '%' || v_search || '%'
        OR COALESCE(event.resource_type, '') ILIKE '%' || v_search || '%'
        OR COALESCE(event.resource_id, '') ILIKE '%' || v_search || '%'
        OR COALESCE(event.request_id, '') ILIKE '%' || v_search || '%'
        OR COALESCE(event.session_fingerprint, '') ILIKE '%' || v_search || '%'
        OR COALESCE(host(event.ip_address), '') ILIKE '%' || v_search || '%'
        OR COALESCE(event.actor_user_id::TEXT, '') ILIKE '%' || v_search || '%'
      )
  ), page AS MATERIALIZED (
    SELECT event.*
    FROM filtered event
    WHERE p_before_sequence IS NULL OR event.sequence_number < p_before_sequence
    ORDER BY event.sequence_number DESC
    LIMIT v_limit
  )
  SELECT
    (SELECT count(*) FROM filtered),
    (SELECT count(*) FROM filtered event WHERE p_before_sequence IS NULL OR event.sequence_number < p_before_sequence),
    count(*),
    min(page.sequence_number),
    max(page.sequence_number),
    COALESCE(jsonb_agg(
      (to_jsonb(page) - 'id' - 'ip_address')
        || jsonb_build_object('event_id', page.id, 'ip_address', host(page.ip_address))
      ORDER BY page.sequence_number DESC
    ), '[]'::JSONB)
  INTO
    v_total_count,
    v_remaining_count,
    v_event_count,
    v_min_sequence,
    v_max_sequence,
    v_events
  FROM page;

  IF v_event_count > 0 THEN
    SELECT EXISTS (
      SELECT 1
      FROM security.event_ledger event
      WHERE event.sequence_number < v_min_sequence
        AND event.occurred_at >= v_from
        AND event.occurred_at <= v_to
        AND (v_severity IS NULL OR event.severity = v_severity)
        AND (v_category IS NULL OR event.category = v_category)
        AND (v_outcome IS NULL OR event.outcome = v_outcome)
        AND (
          v_search IS NULL
          OR event.event_type ILIKE '%' || v_search || '%'
          OR COALESCE(event.resource_type, '') ILIKE '%' || v_search || '%'
          OR COALESCE(event.resource_id, '') ILIKE '%' || v_search || '%'
          OR COALESCE(event.request_id, '') ILIKE '%' || v_search || '%'
          OR COALESCE(event.session_fingerprint, '') ILIKE '%' || v_search || '%'
          OR COALESCE(host(event.ip_address), '') ILIKE '%' || v_search || '%'
          OR COALESCE(event.actor_user_id::TEXT, '') ILIKE '%' || v_search || '%'
        )
    ) INTO v_has_more;
    IF v_has_more THEN v_next_before_sequence := v_min_sequence; END IF;

    WITH relevant_anchors AS MATERIALIZED (
      SELECT DISTINCT membership.anchor_hash
      FROM security.event_anchor_memberships membership
      WHERE membership.event_sequence BETWEEN v_min_sequence AND v_max_sequence
    )
    SELECT
      COALESCE((
        SELECT jsonb_agg(to_jsonb(anchor) ORDER BY anchor.anchor_date)
        FROM security.event_chain_anchors anchor
        JOIN relevant_anchors relevant ON relevant.anchor_hash = anchor.anchor_hash
      ), '[]'::JSONB),
      COALESCE((
        SELECT jsonb_agg(to_jsonb(membership) ORDER BY membership.anchor_hash, membership.ordinal)
        FROM security.event_anchor_memberships membership
        JOIN relevant_anchors relevant ON relevant.anchor_hash = membership.anchor_hash
      ), '[]'::JSONB),
      COALESCE((
        SELECT jsonb_agg(to_jsonb(receipt) ORDER BY receipt.received_at, receipt.id)
        FROM security.event_anchor_receipts receipt
        JOIN relevant_anchors relevant ON relevant.anchor_hash = receipt.anchor_hash
      ), '[]'::JSONB)
    INTO v_anchors, v_memberships, v_receipts;
  END IF;

  v_integrity := public.admin_verify_security_event_chain(0);
  v_filename := 'nutrio-security-evidence-' ||
    to_char(v_generated_at AT TIME ZONE 'UTC', 'YYYYMMDD-HH24MISS') ||
    '-seq-' || COALESCE(v_max_sequence::TEXT, 'empty') || '-to-' ||
    COALESCE(v_min_sequence::TEXT, 'empty') || '.json';
  v_payload := jsonb_build_object(
    'manifest', jsonb_build_object(
      'product', 'Nutrio',
      'evidence_format', 'nutrio-security-ledger-export-v4',
      'generated_at', to_char(v_generated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'filters', security.redact_jsonb(v_filters),
      'cursor_before_sequence', p_before_sequence,
      'next_before_sequence', v_next_before_sequence,
      'event_count', v_event_count,
      'remaining_count_at_snapshot', v_remaining_count,
      'total_matching_events', v_total_count,
      'has_more', v_has_more,
      'sequence_min', v_min_sequence,
      'sequence_max', v_max_sequence,
      'integrity', v_integrity,
      'notice', 'Technical identifiers support correlation but do not independently prove a person''s identity.'
    ),
    'events', v_events,
    'anchors', v_anchors,
    'anchor_memberships', v_memberships,
    'external_receipts', v_receipts
  );
  v_content := jsonb_pretty(v_payload) || E'\n';
  v_byte_length := octet_length(convert_to(v_content, 'UTF8'));
  IF v_byte_length > 20971520 THEN
    RAISE EXCEPTION 'SECURITY_EXPORT_PAGE_TOO_LARGE_REDUCE_LIMIT';
  END IF;
  v_hash := encode(extensions.digest(convert_to(v_content, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO security.event_ledger (
    event_type, category, severity, source, outcome,
    actor_user_id, actor_role, actor_type, action,
    resource_type, resource_id, metadata, event_hash
  ) VALUES (
    'admin.security_events.export_page_prepared',
    'admin', 'medium', 'database', 'success',
    v_actor, 'admin', 'admin', 'prepare_export_page',
    'security.event_ledger', v_hash,
    jsonb_build_object(
      'filename', v_filename,
      'package_sha256', v_hash,
      'byte_length', v_byte_length,
      'event_count', v_event_count,
      'total_matching_events', v_total_count,
      'has_more', v_has_more,
      'next_before_sequence', v_next_before_sequence,
      'anchor_count', jsonb_array_length(v_anchors),
      'receipt_count', jsonb_array_length(v_receipts)
    ),
    repeat('0', 64)
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'content', v_content,
    'sha256', v_hash,
    'byte_length', v_byte_length,
    'filename', v_filename,
    'media_type', 'application/json;charset=utf-8',
    'format', 'json',
    'event_count', v_event_count,
    'total_count', v_total_count,
    'truncated', v_has_more,
    'integrity', v_integrity,
    'next_before_sequence', v_next_before_sequence,
    'has_more', v_has_more,
    'export_event_id', v_event_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_prepare_security_export_page(JSONB, INTEGER, BIGINT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_prepare_security_export_page(JSONB, INTEGER, BIGINT)
  TO authenticated;

COMMIT;
