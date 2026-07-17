BEGIN;

-- Uploaded health, support, coaching, and fleet documents are held until an
-- authenticated Edge Function validates their signature and completes the
-- configured malware scan. Clients no longer receive direct INSERT/UPDATE
-- rights on these buckets.
UPDATE storage.buckets
SET public = false
WHERE id IN (
  'blood-reports',
  'ticket-attachments',
  'coach-photos',
  'coach-attachments',
  'fleet-documents'
);

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::TEXT[]
WHERE id = 'ticket-attachments';

CREATE TABLE IF NOT EXISTS security.sensitive_file_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL,
  object_path TEXT NOT NULL,
  uploader_user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('clean', 'validated_only', 'rejected', 'error')),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  detected_mime TEXT NOT NULL,
  scanner_provider TEXT,
  scanner_reference TEXT,
  threat_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  record_hash TEXT NOT NULL CHECK (record_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sensitive_file_scan_bucket CHECK (bucket_id IN (
    'blood-reports',
    'ticket-attachments',
    'coach-photos',
    'coach-attachments',
    'fleet-documents'
  )),
  CONSTRAINT sensitive_file_scan_path CHECK (
    char_length(object_path) BETWEEN 3 AND 500
    AND object_path !~ '(^/|\.\.|//|[[:cntrl:]])'
  )
);

CREATE INDEX IF NOT EXISTS sensitive_file_scans_created_idx
  ON security.sensitive_file_scans (created_at DESC);
CREATE INDEX IF NOT EXISTS sensitive_file_scans_status_idx
  ON security.sensitive_file_scans (status, created_at DESC);
CREATE INDEX IF NOT EXISTS sensitive_file_scans_uploader_idx
  ON security.sensitive_file_scans (uploader_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sensitive_file_scans_clean_object_idx
  ON security.sensitive_file_scans (bucket_id, object_path)
  WHERE status IN ('clean', 'validated_only');

ALTER TABLE security.sensitive_file_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.sensitive_file_scans FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.sensitive_file_scans FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.seal_sensitive_file_scan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Sensitive file scan records are append-only';
  END IF;

  NEW.object_path := left(trim(NEW.object_path), 500);
  NEW.scanner_provider := NULLIF(left(trim(COALESCE(NEW.scanner_provider, '')), 80), '');
  NEW.scanner_reference := NULLIF(left(trim(COALESCE(NEW.scanner_reference, '')), 240), '');
  NEW.threat_name := NULLIF(left(trim(COALESCE(NEW.threat_name, '')), 240), '');
  NEW.metadata := security.redact_jsonb(COALESCE(NEW.metadata, '{}'::JSONB));
  NEW.created_at := clock_timestamp();
  NEW.record_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'id', NEW.id,
          'bucket_id', NEW.bucket_id,
          'object_path', NEW.object_path,
          'uploader_user_id', NEW.uploader_user_id,
          'status', NEW.status,
          'sha256', NEW.sha256,
          'size_bytes', NEW.size_bytes,
          'detected_mime', NEW.detected_mime,
          'scanner_provider', NEW.scanner_provider,
          'scanner_reference', NEW.scanner_reference,
          'threat_name', NEW.threat_name,
          'metadata', NEW.metadata,
          'created_at_epoch', extract(epoch FROM NEW.created_at)
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

DROP TRIGGER IF EXISTS sensitive_file_scan_seal_trigger
  ON security.sensitive_file_scans;
CREATE TRIGGER sensitive_file_scan_seal_trigger
BEFORE INSERT OR UPDATE OR DELETE ON security.sensitive_file_scans
FOR EACH ROW EXECUTE FUNCTION security.seal_sensitive_file_scan();

DROP TRIGGER IF EXISTS sensitive_file_scan_truncate_guard
  ON security.sensitive_file_scans;
CREATE TRIGGER sensitive_file_scan_truncate_guard
BEFORE TRUNCATE ON security.sensitive_file_scans
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

CREATE OR REPLACE FUNCTION public.record_sensitive_file_scan(
  p_bucket_id TEXT,
  p_object_path TEXT,
  p_uploader_user_id UUID,
  p_status TEXT,
  p_sha256 TEXT,
  p_size_bytes BIGINT,
  p_detected_mime TEXT,
  p_scanner_provider TEXT DEFAULT NULL,
  p_scanner_reference TEXT DEFAULT NULL,
  p_threat_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id UUID;
  v_updated INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  INSERT INTO security.sensitive_file_scans (
    bucket_id,
    object_path,
    uploader_user_id,
    status,
    sha256,
    size_bytes,
    detected_mime,
    scanner_provider,
    scanner_reference,
    threat_name,
    metadata,
    record_hash
  ) VALUES (
    p_bucket_id,
    p_object_path,
    p_uploader_user_id,
    p_status,
    lower(p_sha256),
    p_size_bytes,
    p_detected_mime,
    p_scanner_provider,
    p_scanner_reference,
    p_threat_name,
    COALESCE(p_metadata, '{}'::JSONB),
    repeat('0', 64)
  )
  RETURNING id INTO v_id;

  IF p_status IN ('clean', 'validated_only') THEN
    UPDATE storage.objects
    SET owner_id = p_uploader_user_id::TEXT
    WHERE bucket_id = p_bucket_id
      AND name = p_object_path;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'STORAGE_OBJECT_NOT_FOUND';
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_sensitive_file_scan(
  TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sensitive_file_scan(
  TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;

-- Drop every current direct client write policy for the sensitive buckets.
-- SELECT and DELETE remain governed by the existing participant/owner rules.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE')
      AND lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, ''))
        ~ '(blood-reports|ticket-attachments|coach-photos|coach-attachments|fleet-documents)'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
  END LOOP;
END;
$do$;

COMMENT ON TABLE security.sensitive_file_scans IS
  'Append-only evidence for server-validated uploads to sensitive private buckets.';
COMMENT ON FUNCTION public.record_sensitive_file_scan(
  TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB
) IS 'Service-only finalization and immutable evidence capture for sensitive uploads.';

NOTIFY pgrst, 'reload schema';

COMMIT;
