BEGIN;

CREATE SEQUENCE IF NOT EXISTS security.incident_case_number_seq;

CREATE TABLE IF NOT EXISTS security.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 5000),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'contained', 'recovered', 'closed')),
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  closed_at TIMESTAMPTZ,
  external_reference TEXT CHECK (external_reference IS NULL OR char_length(external_reference) <= 300),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS security_incidents_status_updated_idx
  ON security.incidents(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS security_incidents_severity_updated_idx
  ON security.incidents(severity, updated_at DESC);

CREATE TABLE IF NOT EXISTS security.incident_timeline (
  sequence_number BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES security.incidents(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 3 AND 80),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 10000),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  previous_hash TEXT NOT NULL DEFAULT 'GENESIS',
  event_hash TEXT NOT NULL DEFAULT repeat('0', 64)
    CHECK (event_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS security_incident_timeline_case_idx
  ON security.incident_timeline(incident_id, sequence_number);

CREATE TABLE IF NOT EXISTS security.incident_event_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES security.incidents(id) ON DELETE RESTRICT,
  event_id UUID NOT NULL REFERENCES security.event_ledger(id) ON DELETE RESTRICT,
  event_sequence BIGINT NOT NULL,
  event_hash_snapshot TEXT NOT NULL CHECK (event_hash_snapshot ~ '^[0-9a-f]{64}$'),
  linked_by UUID NOT NULL REFERENCES auth.users(id),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  link_hash TEXT NOT NULL DEFAULT repeat('0', 64)
    CHECK (link_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE (incident_id, event_id)
);

CREATE INDEX IF NOT EXISTS security_incident_event_links_case_idx
  ON security.incident_event_links(incident_id, event_sequence);

ALTER TABLE security.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.incidents FORCE ROW LEVEL SECURITY;
ALTER TABLE security.incident_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.incident_timeline FORCE ROW LEVEL SECURITY;
ALTER TABLE security.incident_event_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.incident_event_links FORCE ROW LEVEL SECURITY;

REVOKE ALL ON security.incidents FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON security.incident_timeline FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON security.incident_event_links FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE security.incident_case_number_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION security.require_admin_actor()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  RETURN v_actor;
END;
$function$;

CREATE OR REPLACE FUNCTION security.seal_incident_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_previous TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.incident_id::TEXT, 0));
  SELECT t.event_hash INTO v_previous
  FROM security.incident_timeline t
  WHERE t.incident_id = NEW.incident_id
  ORDER BY t.sequence_number DESC
  LIMIT 1;

  NEW.previous_hash := COALESCE(v_previous, 'GENESIS');
  NEW.metadata := security.redact_jsonb(COALESCE(NEW.metadata, '{}'::JSONB));
  NEW.event_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'id', NEW.id,
          'incident_id', NEW.incident_id,
          'action', NEW.action,
          'note', NEW.note,
          'actor_user_id', NEW.actor_user_id,
          'metadata', NEW.metadata,
          'created_at', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'previous_hash', NEW.previous_hash
        )::TEXT,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.seal_incident_event_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  SELECT e.sequence_number, e.event_hash
  INTO NEW.event_sequence, NEW.event_hash_snapshot
  FROM security.event_ledger e
  WHERE e.id = NEW.event_id;

  IF NEW.event_sequence IS NULL THEN
    RAISE EXCEPTION 'SECURITY_EVENT_NOT_FOUND';
  END IF;

  NEW.link_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'id', NEW.id,
          'incident_id', NEW.incident_id,
          'event_id', NEW.event_id,
          'event_sequence', NEW.event_sequence,
          'event_hash_snapshot', NEW.event_hash_snapshot,
          'linked_by', NEW.linked_by,
          'note', NEW.note,
          'linked_at', to_char(NEW.linked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        )::TEXT,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS security_incident_timeline_seal_trigger ON security.incident_timeline;
CREATE TRIGGER security_incident_timeline_seal_trigger
BEFORE INSERT ON security.incident_timeline
FOR EACH ROW EXECUTE FUNCTION security.seal_incident_timeline();

DROP TRIGGER IF EXISTS security_incident_link_seal_trigger ON security.incident_event_links;
CREATE TRIGGER security_incident_link_seal_trigger
BEFORE INSERT ON security.incident_event_links
FOR EACH ROW EXECUTE FUNCTION security.seal_incident_event_link();

DROP TRIGGER IF EXISTS security_incident_timeline_immutable_trigger ON security.incident_timeline;
CREATE TRIGGER security_incident_timeline_immutable_trigger
BEFORE UPDATE OR DELETE ON security.incident_timeline
FOR EACH ROW EXECUTE FUNCTION security.prevent_evidence_mutation();
DROP TRIGGER IF EXISTS security_incident_timeline_truncate_guard ON security.incident_timeline;
CREATE TRIGGER security_incident_timeline_truncate_guard
BEFORE TRUNCATE ON security.incident_timeline
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

DROP TRIGGER IF EXISTS security_incident_link_immutable_trigger ON security.incident_event_links;
CREATE TRIGGER security_incident_link_immutable_trigger
BEFORE UPDATE OR DELETE ON security.incident_event_links
FOR EACH ROW EXECUTE FUNCTION security.prevent_evidence_mutation();
DROP TRIGGER IF EXISTS security_incident_link_truncate_guard ON security.incident_event_links;
CREATE TRIGGER security_incident_link_truncate_guard
BEFORE TRUNCATE ON security.incident_event_links
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

CREATE OR REPLACE FUNCTION security.record_incident_audit(
  p_incident_id UUID,
  p_actor UUID,
  p_action TEXT,
  p_severity TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_headers JSONB := '{}'::JSONB;
  v_ip INET;
  v_event_id UUID;
  v_country_code TEXT;
  v_session_fingerprint TEXT := NULLIF(auth.jwt() ->> 'session_id', '');
BEGIN
  BEGIN
    v_headers := COALESCE(NULLIF(current_setting('request.headers', true), '')::JSONB, '{}'::JSONB);
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::JSONB;
  END;

  BEGIN
    v_ip := NULLIF(trim(split_part(COALESCE(
      v_headers ->> 'x-forwarded-for',
      v_headers ->> 'cf-connecting-ip',
      ''
    ), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  v_country_code := upper(trim(COALESCE(v_headers ->> 'cf-ipcountry', '')));
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    v_country_code := NULL;
  END IF;

  INSERT INTO security.event_ledger (
    event_type, category, severity, source, outcome, actor_user_id,
    actor_role, actor_type, action, resource_type, resource_id, request_id,
    correlation_id, session_fingerprint, ip_address, country_code, user_agent,
    metadata, event_hash
  ) VALUES (
    'admin.security_incident.' || p_action,
    'incident',
    p_severity,
    'database',
    'success',
    p_actor,
    'admin',
    'admin',
    p_action,
    'security.incidents',
    p_incident_id::TEXT,
    COALESCE(v_headers ->> 'sb-request-id', v_headers ->> 'x-request-id'),
    v_headers ->> 'x-correlation-id',
    CASE WHEN v_session_fingerprint IS NULL THEN NULL ELSE 'session:' || v_session_fingerprint END,
    v_ip,
    v_country_code,
    v_headers ->> 'user-agent',
    security.redact_jsonb(COALESCE(p_metadata, '{}'::JSONB)),
    repeat('0', 64)
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION security.link_incident_event(
  p_incident_id UUID,
  p_event_id UUID,
  p_actor UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_link_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM security.incidents i WHERE i.id = p_incident_id) THEN
    RAISE EXCEPTION 'INCIDENT_NOT_FOUND';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 2000 THEN
    RAISE EXCEPTION 'INCIDENT_NOTE_TOO_LONG';
  END IF;

  INSERT INTO security.incident_event_links (incident_id, event_id, linked_by, note)
  VALUES (p_incident_id, p_event_id, p_actor, nullif(trim(p_note), ''))
  ON CONFLICT (incident_id, event_id) DO NOTHING
  RETURNING id INTO v_link_id;

  IF v_link_id IS NOT NULL THEN
    INSERT INTO security.incident_timeline (
      incident_id, action, note, actor_user_id, metadata
    ) VALUES (
      p_incident_id,
      'evidence_linked',
      nullif(trim(p_note), ''),
      p_actor,
      jsonb_build_object('event_id', p_event_id)
    );
  ELSE
    SELECT l.id INTO v_link_id
    FROM security.incident_event_links l
    WHERE l.incident_id = p_incident_id AND l.event_id = p_event_id;
  END IF;

  RETURN v_link_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_security_incident(
  p_title TEXT,
  p_summary TEXT,
  p_severity TEXT,
  p_event_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_incident security.incidents%ROWTYPE;
  v_event_id UUID;
BEGIN
  IF char_length(trim(COALESCE(p_title, ''))) NOT BETWEEN 3 AND 160
     OR char_length(trim(COALESCE(p_summary, ''))) NOT BETWEEN 10 AND 5000
     OR p_severity NOT IN ('low', 'medium', 'high', 'critical')
     OR cardinality(COALESCE(p_event_ids, ARRAY[]::UUID[])) > 100 THEN
    RAISE EXCEPTION 'INCIDENT_INPUT_INVALID';
  END IF;

  INSERT INTO security.incidents (
    case_number, title, summary, severity, opened_by, assigned_to
  ) VALUES (
    'NTR-' || to_char(clock_timestamp(), 'YYYY') || '-' ||
      lpad(nextval('security.incident_case_number_seq')::TEXT, 6, '0'),
    trim(p_title),
    trim(p_summary),
    p_severity,
    v_actor,
    v_actor
  ) RETURNING * INTO v_incident;

  INSERT INTO security.incident_timeline (
    incident_id, action, note, actor_user_id, metadata
  ) VALUES (
    v_incident.id,
    'incident_created',
    trim(p_summary),
    v_actor,
    jsonb_build_object('severity', p_severity, 'title', trim(p_title))
  );

  FOREACH v_event_id IN ARRAY COALESCE(p_event_ids, ARRAY[]::UUID[])
  LOOP
    PERFORM security.link_incident_event(v_incident.id, v_event_id, v_actor, 'Linked when case opened');
  END LOOP;

  PERFORM security.record_incident_audit(
    v_incident.id,
    v_actor,
    'created',
    p_severity,
    jsonb_build_object('case_number', v_incident.case_number, 'linked_events', cardinality(COALESCE(p_event_ids, ARRAY[]::UUID[])))
  );

  RETURN to_jsonb(v_incident);
END;
$function$;

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
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM security.require_admin_actor();
  IF p_status IS NOT NULL AND p_status NOT IN ('open', 'investigating', 'contained', 'recovered', 'closed') THEN
    RAISE EXCEPTION 'INCIDENT_STATUS_INVALID';
  END IF;

  RETURN QUERY
  SELECT
    i.id, i.case_number, i.title, i.summary, i.severity, i.status,
    i.opened_by, i.assigned_to, i.detected_at, i.closed_at,
    i.external_reference, i.version, i.created_at, i.updated_at,
    (SELECT count(*) FROM security.incident_event_links l WHERE l.incident_id = i.id),
    (SELECT count(*) FROM security.incident_timeline t WHERE t.incident_id = i.id)
  FROM security.incidents i
  WHERE p_status IS NULL OR i.status = p_status
  ORDER BY
    CASE i.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
    i.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_security_incident(p_incident_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM security.require_admin_actor();
  SELECT jsonb_build_object(
    'incident', to_jsonb(i),
    'timeline', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sequence_number)
      FROM security.incident_timeline t
      WHERE t.incident_id = i.id
    ), '[]'::JSONB),
    'evidence', COALESCE((
      SELECT jsonb_agg(to_jsonb(evidence_row) ORDER BY evidence_row.event_sequence)
      FROM (
        SELECT
          l.id AS link_id,
          l.event_id,
          l.event_sequence,
          l.event_hash_snapshot,
          l.linked_by,
          l.note,
          l.linked_at,
          l.link_hash,
          e.occurred_at,
          e.event_type,
          e.category,
          e.severity,
          e.source,
          e.outcome,
          e.actor_user_id,
          e.actor_role,
          e.actor_type,
          e.action,
          e.resource_type,
          e.resource_id,
          e.request_id,
          e.correlation_id,
          e.session_fingerprint,
          host(e.ip_address) AS ip_address,
          e.country_code,
          e.user_agent,
          e.metadata,
          e.event_hash AS current_event_hash,
          (e.event_hash = l.event_hash_snapshot) AS snapshot_matches
        FROM security.incident_event_links l
        JOIN security.event_ledger e ON e.id = l.event_id
        WHERE l.incident_id = i.id
        ORDER BY l.event_sequence
        LIMIT 2000
      ) evidence_row
    ), '[]'::JSONB)
  ) INTO v_result
  FROM security.incidents i
  WHERE i.id = p_incident_id;

  IF v_result IS NULL THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_security_incident(
  p_incident_id UUID,
  p_status TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL,
  p_assigned_to UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_external_reference TEXT DEFAULT NULL,
  p_expected_version INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_before security.incidents%ROWTYPE;
  v_after security.incidents%ROWTYPE;
BEGIN
  SELECT * INTO v_before FROM security.incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;
  IF p_expected_version IS NOT NULL AND v_before.version <> p_expected_version THEN
    RAISE EXCEPTION 'INCIDENT_VERSION_CONFLICT';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('open', 'investigating', 'contained', 'recovered', 'closed') THEN
    RAISE EXCEPTION 'INCIDENT_STATUS_INVALID';
  END IF;
  IF p_severity IS NOT NULL AND p_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'INCIDENT_SEVERITY_INVALID';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 10000 THEN
    RAISE EXCEPTION 'INCIDENT_NOTE_TOO_LONG';
  END IF;
  IF p_status = 'closed' AND char_length(trim(COALESCE(p_note, ''))) < 10 THEN
    RAISE EXCEPTION 'INCIDENT_CLOSURE_NOTE_REQUIRED';
  END IF;
  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_assigned_to AND ur.role::TEXT = 'admin'
  ) THEN
    RAISE EXCEPTION 'INCIDENT_ASSIGNEE_INVALID';
  END IF;
  IF p_external_reference IS NOT NULL AND char_length(p_external_reference) > 300 THEN
    RAISE EXCEPTION 'INCIDENT_EXTERNAL_REFERENCE_INVALID';
  END IF;

  UPDATE security.incidents
  SET status = COALESCE(p_status, status),
      severity = COALESCE(p_severity, severity),
      assigned_to = COALESCE(p_assigned_to, assigned_to),
      external_reference = COALESCE(nullif(trim(p_external_reference), ''), external_reference),
      closed_at = CASE
        WHEN COALESCE(p_status, status) = 'closed' THEN COALESCE(closed_at, clock_timestamp())
        ELSE NULL
      END,
      version = version + 1,
      updated_at = clock_timestamp()
  WHERE id = p_incident_id
  RETURNING * INTO v_after;

  INSERT INTO security.incident_timeline (
    incident_id, action, note, actor_user_id, metadata
  ) VALUES (
    p_incident_id,
    CASE
      WHEN p_status IS NOT NULL AND p_status <> v_before.status THEN 'status_changed'
      WHEN p_severity IS NOT NULL AND p_severity <> v_before.severity THEN 'severity_changed'
      WHEN p_assigned_to IS NOT NULL AND p_assigned_to IS DISTINCT FROM v_before.assigned_to THEN 'assignment_changed'
      ELSE 'investigation_note'
    END,
    nullif(trim(p_note), ''),
    v_actor,
    jsonb_build_object(
      'previous_status', v_before.status,
      'status', v_after.status,
      'previous_severity', v_before.severity,
      'severity', v_after.severity,
      'assigned_to', v_after.assigned_to,
      'external_reference', v_after.external_reference,
      'version', v_after.version
    )
  );

  PERFORM security.record_incident_audit(
    p_incident_id,
    v_actor,
    'updated',
    v_after.severity,
    jsonb_build_object('status', v_after.status, 'version', v_after.version)
  );
  RETURN to_jsonb(v_after);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_link_security_incident_event(
  p_incident_id UUID,
  p_event_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_link UUID;
  v_severity TEXT;
BEGIN
  SELECT severity INTO v_severity FROM security.incidents WHERE id = p_incident_id;
  IF v_severity IS NULL THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;
  v_link := security.link_incident_event(p_incident_id, p_event_id, v_actor, p_note);
  PERFORM security.record_incident_audit(
    p_incident_id,
    v_actor,
    'evidence_linked',
    v_severity,
    jsonb_build_object('event_id', p_event_id, 'link_id', v_link)
  );
  RETURN v_link;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_record_security_incident_export(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_record_security_incident_export(
  p_incident_id UUID,
  p_format TEXT,
  p_package_sha256 TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_timeline_id UUID;
  v_severity TEXT;
BEGIN
  IF lower(COALESCE(p_format, '')) NOT IN ('json', 'pdf') THEN
    RAISE EXCEPTION 'INCIDENT_EXPORT_FORMAT_INVALID';
  END IF;
  IF COALESCE(p_package_sha256, '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INCIDENT_EXPORT_HASH_INVALID';
  END IF;
  SELECT severity INTO v_severity FROM security.incidents WHERE id = p_incident_id;
  IF v_severity IS NULL THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;

  INSERT INTO security.incident_timeline (
    incident_id, action, note, actor_user_id, metadata
  ) VALUES (
    p_incident_id,
    'evidence_exported',
    'Incident evidence package exported',
    v_actor,
    jsonb_build_object(
      'format', lower(p_format),
      'package_sha256', lower(p_package_sha256)
    )
  ) RETURNING id INTO v_timeline_id;

  PERFORM security.record_incident_audit(
    p_incident_id,
    v_actor,
    'exported',
    v_severity,
    jsonb_build_object(
      'format', lower(p_format),
      'timeline_id', v_timeline_id,
      'package_sha256', lower(p_package_sha256)
    )
  );
  RETURN v_timeline_id;
END;
$function$;

REVOKE ALL ON FUNCTION security.require_admin_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.seal_incident_timeline() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.seal_incident_event_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.record_incident_audit(UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.link_incident_event(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_create_security_incident(TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_security_incidents(TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_security_incident(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_security_incident(UUID, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_link_security_incident_event(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_security_incident_export(UUID, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_create_security_incident(TEXT, TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_security_incidents(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_security_incident(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_security_incident(UUID, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_security_incident_event(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_security_incident_export(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE security.incidents IS
  'Administrator-managed incident cases. Direct access is blocked; use admin RPCs.';
COMMENT ON TABLE security.incident_timeline IS
  'Append-only, per-incident hash-chained investigation timeline.';
COMMENT ON TABLE security.incident_event_links IS
  'Immutable chain-of-custody links to sealed security events with hash snapshots.';

NOTIFY pgrst, 'reload schema';

COMMIT;
