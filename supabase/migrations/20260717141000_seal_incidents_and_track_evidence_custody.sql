-- Final incident seals and append-only evidence handoff custody.

BEGIN;

ALTER TABLE security.incidents
  ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sealed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS seal_hash TEXT,
  ADD COLUMN IF NOT EXISTS seal_version SMALLINT;

ALTER TABLE security.incidents
  DROP CONSTRAINT IF EXISTS security_incident_seal_state;
ALTER TABLE security.incidents
  ADD CONSTRAINT security_incident_seal_state CHECK (
    (sealed_at IS NULL AND sealed_by IS NULL AND seal_hash IS NULL AND seal_version IS NULL)
    OR
    (sealed_at IS NOT NULL AND sealed_by IS NOT NULL AND seal_hash ~ '^[0-9a-f]{64}$' AND seal_version = 1)
  );

CREATE TABLE IF NOT EXISTS security.incident_evidence_custody (
  custody_sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES security.incidents(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('export_prepared', 'transferred')),
  package_sha256 TEXT NOT NULL CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  byte_length BIGINT CHECK (byte_length IS NULL OR byte_length BETWEEN 0 AND 20971520),
  filename TEXT CHECK (
    filename IS NULL OR (
      char_length(filename) BETWEEN 3 AND 180
      AND filename !~ '[\\/]'
      AND filename !~ '[[:cntrl:]]'
    )
  ),
  recipient_type TEXT CHECK (
    recipient_type IS NULL OR recipient_type IN (
      'internal_security', 'external_archive', 'authority', 'provider', 'legal_counsel'
    )
  ),
  external_reference TEXT CHECK (
    external_reference IS NULL OR char_length(external_reference) BETWEEN 3 AND 300
  ),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  previous_hash TEXT NOT NULL DEFAULT 'GENESIS' CHECK (
    previous_hash = 'GENESIS' OR previous_hash ~ '^[0-9a-f]{64}$'
  ),
  custody_hash TEXT NOT NULL DEFAULT repeat('0', 64) CHECK (custody_hash ~ '^[0-9a-f]{64}$'),
  integrity_version SMALLINT NOT NULL DEFAULT 1 CHECK (integrity_version = 1),
  CONSTRAINT security_incident_custody_action_fields CHECK (
    (action = 'export_prepared' AND byte_length IS NOT NULL AND filename IS NOT NULL
      AND recipient_type IS NULL AND external_reference IS NULL)
    OR
    (action = 'transferred' AND recipient_type IS NOT NULL AND external_reference IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS security_incident_custody_case_idx
  ON security.incident_evidence_custody (incident_id, custody_sequence);
CREATE INDEX IF NOT EXISTS security_incident_custody_package_idx
  ON security.incident_evidence_custody (package_sha256, custody_sequence);

ALTER TABLE security.incident_evidence_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.incident_evidence_custody FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.incident_evidence_custody FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.calculate_incident_custody_hash(
  p_entry security.incident_evidence_custody
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'integrity_version', p_entry.integrity_version,
          'custody_sequence', p_entry.custody_sequence,
          'id', p_entry.id,
          'incident_id', p_entry.incident_id,
          'action', p_entry.action,
          'package_sha256', p_entry.package_sha256,
          'byte_length', p_entry.byte_length,
          'filename', p_entry.filename,
          'recipient_type', p_entry.recipient_type,
          'external_reference', p_entry.external_reference,
          'actor_user_id', p_entry.actor_user_id,
          'created_at', to_char(
            p_entry.created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ),
          'previous_hash', p_entry.previous_hash
        )::TEXT,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

CREATE OR REPLACE FUNCTION security.seal_incident_custody_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_previous TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Incident custody is append-only';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.incident_id::TEXT, 2));
  SELECT custody.custody_hash
  INTO v_previous
  FROM security.incident_evidence_custody custody
  WHERE custody.incident_id = NEW.incident_id
  ORDER BY custody.custody_sequence DESC
  LIMIT 1;
  NEW.previous_hash := COALESCE(v_previous, 'GENESIS');
  NEW.custody_hash := security.calculate_incident_custody_hash(NEW);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS security_incident_custody_seal_trigger
  ON security.incident_evidence_custody;
CREATE TRIGGER security_incident_custody_seal_trigger
BEFORE INSERT ON security.incident_evidence_custody
FOR EACH ROW EXECUTE FUNCTION security.seal_incident_custody_entry();

DROP TRIGGER IF EXISTS security_incident_custody_immutable_trigger
  ON security.incident_evidence_custody;
CREATE TRIGGER security_incident_custody_immutable_trigger
BEFORE UPDATE OR DELETE ON security.incident_evidence_custody
FOR EACH ROW EXECUTE FUNCTION security.prevent_evidence_mutation();

DROP TRIGGER IF EXISTS security_incident_custody_truncate_guard
  ON security.incident_evidence_custody;
CREATE TRIGGER security_incident_custody_truncate_guard
BEFORE TRUNCATE ON security.incident_evidence_custody
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

CREATE OR REPLACE FUNCTION security.calculate_incident_seal(
  p_incident security.incidents
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'seal_version', p_incident.seal_version,
          'id', p_incident.id,
          'case_number', p_incident.case_number,
          'title', p_incident.title,
          'summary', p_incident.summary,
          'severity', p_incident.severity,
          'status', p_incident.status,
          'opened_by', p_incident.opened_by,
          'assigned_to', p_incident.assigned_to,
          'detected_at', p_incident.detected_at,
          'closed_at', p_incident.closed_at,
          'external_reference', p_incident.external_reference,
          'version', p_incident.version,
          'timeline_entry_count', p_incident.timeline_entry_count,
          'timeline_head_hash', p_incident.timeline_head_hash,
          'evidence_link_count', p_incident.evidence_link_count,
          'evidence_manifest_hash', p_incident.evidence_manifest_hash,
          'sealed_at', p_incident.sealed_at,
          'sealed_by', p_incident.sealed_by
        )::TEXT,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

CREATE OR REPLACE FUNCTION security.guard_and_seal_incident()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION 'SEALED_INCIDENT_IMMUTABLE';
  END IF;
  IF NEW.sealed_at IS NOT NULL THEN
    IF NEW.status <> 'closed' OR NEW.closed_at IS NULL OR NEW.sealed_by IS NULL THEN
      RAISE EXCEPTION 'INCIDENT_MUST_BE_CLOSED_BEFORE_SEALING';
    END IF;
    NEW.seal_version := 1;
    NEW.seal_hash := security.calculate_incident_seal(NEW);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS security_incident_seal_guard ON security.incidents;
CREATE TRIGGER security_incident_seal_guard
BEFORE UPDATE OR DELETE ON security.incidents
FOR EACH ROW EXECUTE FUNCTION security.guard_and_seal_incident();

DROP TRIGGER IF EXISTS security_incident_truncate_guard ON security.incidents;
CREATE TRIGGER security_incident_truncate_guard
BEFORE TRUNCATE ON security.incidents
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

CREATE OR REPLACE FUNCTION security.reject_sealed_incident_child_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM security.incidents incident
    WHERE incident.id = NEW.incident_id AND incident.sealed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'SEALED_INCIDENT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS security_incident_timeline_sealed_guard ON security.incident_timeline;
CREATE TRIGGER security_incident_timeline_sealed_guard
BEFORE INSERT ON security.incident_timeline
FOR EACH ROW EXECUTE FUNCTION security.reject_sealed_incident_child_insert();
DROP TRIGGER IF EXISTS security_incident_link_sealed_guard ON security.incident_event_links;
CREATE TRIGGER security_incident_link_sealed_guard
BEFORE INSERT ON security.incident_event_links
FOR EACH ROW EXECUTE FUNCTION security.reject_sealed_incident_child_insert();

CREATE OR REPLACE FUNCTION public.admin_seal_security_incident(
  p_incident_id UUID,
  p_expected_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_incident security.incidents%ROWTYPE;
  v_detail JSONB;
BEGIN
  SELECT * INTO v_incident
  FROM security.incidents incident
  WHERE incident.id = p_incident_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;
  IF v_incident.version <> p_expected_version THEN RAISE EXCEPTION 'INCIDENT_VERSION_CONFLICT'; END IF;
  IF v_incident.sealed_at IS NOT NULL THEN RAISE EXCEPTION 'INCIDENT_ALREADY_SEALED'; END IF;
  IF v_incident.status <> 'closed' OR v_incident.closed_at IS NULL THEN
    RAISE EXCEPTION 'INCIDENT_MUST_BE_CLOSED_BEFORE_SEALING';
  END IF;
  IF v_incident.evidence_link_count < 1 THEN RAISE EXCEPTION 'INCIDENT_EVIDENCE_REQUIRED'; END IF;

  v_detail := public.admin_get_security_incident(p_incident_id);
  IF COALESCE((v_detail -> 'integrity' ->> 'valid')::BOOLEAN, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'INCIDENT_INTEGRITY_INVALID';
  END IF;

  INSERT INTO security.incident_timeline (
    incident_id, action, note, actor_user_id, metadata
  ) VALUES (
    p_incident_id,
    'incident_sealed',
    'Case evidence and final state sealed',
    v_actor,
    jsonb_build_object('previous_version', v_incident.version)
  );

  UPDATE security.incidents
  SET sealed_at = clock_timestamp(),
      sealed_by = v_actor,
      version = version + 1,
      updated_at = clock_timestamp()
  WHERE id = p_incident_id
  RETURNING * INTO v_incident;

  PERFORM security.record_incident_audit(
    p_incident_id,
    v_actor,
    'sealed',
    v_incident.severity,
    jsonb_build_object('seal_hash', v_incident.seal_hash, 'version', v_incident.version)
  );
  RETURN to_jsonb(v_incident);
END;
$function$;

ALTER FUNCTION public.admin_prepare_security_incident_export(UUID, INTEGER)
  RENAME TO admin_prepare_security_incident_export_timeline_legacy;
REVOKE ALL ON FUNCTION public.admin_prepare_security_incident_export_timeline_legacy(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_prepare_security_incident_export(
  p_incident_id UUID,
  p_expected_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_incident security.incidents%ROWTYPE;
  v_detail JSONB;
  v_package JSONB;
  v_content TEXT;
  v_hash TEXT;
  v_byte_length BIGINT;
  v_generated_at TIMESTAMPTZ := clock_timestamp();
  v_filename TEXT;
  v_custody_id UUID;
BEGIN
  SELECT * INTO v_incident
  FROM security.incidents incident
  WHERE incident.id = p_incident_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;
  IF v_incident.version <> p_expected_version THEN RAISE EXCEPTION 'INCIDENT_VERSION_CONFLICT'; END IF;

  v_detail := public.admin_get_security_incident(p_incident_id);
  v_package := v_detail || jsonb_build_object(
    'manifest', jsonb_build_object(
      'product', 'Nutrio',
      'evidence_format', 'nutrio-security-incident-v3',
      'case_number', v_incident.case_number,
      'incident_version', v_incident.version,
      'generated_at', to_char(v_generated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'sealed', v_incident.sealed_at IS NOT NULL,
      'seal_hash', v_incident.seal_hash,
      'truncated', false,
      'notice', 'Technical identifiers support correlation but do not independently prove a person''s identity.',
      'custody', 'Preserve this original file and detached SHA-256 checksum without modification. Record every handoff in Nutrio.'
    )
  );
  v_content := jsonb_pretty(v_package) || E'\n';
  v_byte_length := octet_length(convert_to(v_content, 'UTF8'));
  IF v_byte_length > 20971520 THEN RAISE EXCEPTION 'INCIDENT_EXPORT_TOO_LARGE'; END IF;
  v_hash := encode(extensions.digest(convert_to(v_content, 'UTF8'), 'sha256'), 'hex');
  v_filename := left(v_incident.case_number, 120) || '-evidence.json';

  INSERT INTO security.incident_evidence_custody (
    incident_id, action, package_sha256, byte_length, filename, actor_user_id
  ) VALUES (
    p_incident_id, 'export_prepared', v_hash, v_byte_length, v_filename, v_actor
  ) RETURNING id INTO v_custody_id;

  PERFORM security.record_incident_audit(
    p_incident_id,
    v_actor,
    'export_prepared',
    v_incident.severity,
    jsonb_build_object(
      'custody_id', v_custody_id,
      'package_sha256', v_hash,
      'byte_length', v_byte_length,
      'filename', v_filename,
      'incident_version', v_incident.version,
      'sealed', v_incident.sealed_at IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'content', v_content,
    'sha256', v_hash,
    'byte_length', v_byte_length,
    'filename', v_filename,
    'media_type', 'application/json;charset=utf-8',
    'format', 'json',
    'event_count', jsonb_array_length(COALESCE(v_detail -> 'evidence', '[]'::JSONB)),
    'total_count', jsonb_array_length(COALESCE(v_detail -> 'evidence', '[]'::JSONB)),
    'truncated', false,
    'integrity', v_detail -> 'integrity',
    'snapshot_version', v_incident.version,
    'current_version', v_incident.version,
    'custody_id', v_custody_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_record_incident_evidence_transfer(
  p_incident_id UUID,
  p_package_sha256 TEXT,
  p_recipient_type TEXT,
  p_external_reference TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_id UUID;
  v_severity TEXT;
BEGIN
  IF COALESCE(p_package_sha256, '') !~ '^[0-9a-f]{64}$'
     OR p_recipient_type NOT IN ('internal_security', 'external_archive', 'authority', 'provider', 'legal_counsel')
     OR char_length(trim(COALESCE(p_external_reference, ''))) NOT BETWEEN 3 AND 300 THEN
    RAISE EXCEPTION 'INCIDENT_TRANSFER_INPUT_INVALID';
  END IF;
  SELECT severity INTO v_severity FROM security.incidents WHERE id = p_incident_id;
  IF v_severity IS NULL THEN RAISE EXCEPTION 'INCIDENT_NOT_FOUND'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM security.incident_evidence_custody custody
    WHERE custody.incident_id = p_incident_id
      AND custody.action = 'export_prepared'
      AND custody.package_sha256 = lower(p_package_sha256)
  ) THEN
    RAISE EXCEPTION 'INCIDENT_EXPORTED_PACKAGE_NOT_FOUND';
  END IF;

  INSERT INTO security.incident_evidence_custody (
    incident_id, action, package_sha256, recipient_type, external_reference, actor_user_id
  ) VALUES (
    p_incident_id,
    'transferred',
    lower(p_package_sha256),
    p_recipient_type,
    trim(p_external_reference),
    v_actor
  ) RETURNING id INTO v_id;

  PERFORM security.record_incident_audit(
    p_incident_id,
    v_actor,
    'evidence_transferred',
    v_severity,
    jsonb_build_object(
      'custody_id', v_id,
      'package_sha256', lower(p_package_sha256),
      'recipient_type', p_recipient_type,
      'external_reference', trim(p_external_reference)
    )
  );
  RETURN v_id;
END;
$function$;

ALTER FUNCTION public.admin_get_security_incident(UUID)
  RENAME TO admin_get_security_incident_pre_seal_legacy;
REVOKE ALL ON FUNCTION public.admin_get_security_incident_pre_seal_legacy(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_security_incident(p_incident_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB;
  v_incident security.incidents%ROWTYPE;
  v_custody JSONB := '[]'::JSONB;
  v_custody_invalid BIGINT := 0;
  v_seal_valid BOOLEAN := true;
BEGIN
  PERFORM security.require_admin_actor();
  v_result := public.admin_get_security_incident_pre_seal_legacy(p_incident_id);
  SELECT * INTO v_incident FROM security.incidents WHERE id = p_incident_id;

  WITH ordered AS (
    SELECT
      custody.*,
      security.calculate_incident_custody_hash(custody) AS calculated_custody_hash,
      COALESCE(
        lag(custody.custody_hash) OVER (
          PARTITION BY custody.incident_id ORDER BY custody.custody_sequence
        ),
        'GENESIS'
      ) AS expected_previous_hash
    FROM security.incident_evidence_custody custody
    WHERE custody.incident_id = p_incident_id
  )
  SELECT
    COALESCE(jsonb_agg(
      to_jsonb(entry) || jsonb_build_object(
        'hash_matches', entry.custody_hash = entry.calculated_custody_hash,
        'previous_hash_matches', entry.previous_hash = entry.expected_previous_hash
      ) ORDER BY entry.custody_sequence
    ), '[]'::JSONB),
    count(*) FILTER (
      WHERE entry.custody_hash IS DISTINCT FROM entry.calculated_custody_hash
         OR entry.previous_hash IS DISTINCT FROM entry.expected_previous_hash
    )
  INTO v_custody, v_custody_invalid
  FROM ordered entry;

  IF v_incident.sealed_at IS NOT NULL THEN
    v_seal_valid := v_incident.seal_hash = security.calculate_incident_seal(v_incident);
  END IF;

  RETURN v_result
    || jsonb_build_object('incident', to_jsonb(v_incident), 'custody', v_custody)
    || jsonb_build_object(
      'integrity', COALESCE(v_result -> 'integrity', '{}'::JSONB) || jsonb_build_object(
        'custody_valid', v_custody_invalid = 0,
        'custody_invalid_count', v_custody_invalid,
        'seal_valid', v_seal_valid,
        'valid', COALESCE((v_result -> 'integrity' ->> 'valid')::BOOLEAN, false)
          AND v_custody_invalid = 0 AND v_seal_valid
      )
    );
END;
$function$;

REVOKE ALL ON FUNCTION security.calculate_incident_custody_hash(security.incident_evidence_custody)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.seal_incident_custody_entry()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.calculate_incident_seal(security.incidents)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.guard_and_seal_incident()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.reject_sealed_incident_child_insert()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_seal_security_incident(UUID, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_prepare_security_incident_export(UUID, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_incident_evidence_transfer(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_security_incident(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_seal_security_incident(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_security_incident_export(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_incident_evidence_transfer(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_security_incident(UUID) TO authenticated;

COMMIT;
