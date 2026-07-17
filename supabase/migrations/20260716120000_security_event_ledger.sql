-- Tamper-evident security event ledger and admin-only investigation RPCs.
-- This ledger complements provider logs. It intentionally stores changed field
-- names rather than row snapshots to avoid copying passwords, tokens, or health data.

BEGIN;

CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $do$
DECLARE
  v_pgcrypto_schema TEXT;
BEGIN
  SELECT n.nspname
  INTO v_pgcrypto_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto';

  IF v_pgcrypto_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION
      'pgcrypto must be installed in the extensions schema (currently: %)',
      COALESCE(v_pgcrypto_schema, 'missing');
  END IF;
END;
$do$;

CREATE TABLE IF NOT EXISTS security.event_ledger (
  -- Sequence gaps are valid because PostgreSQL sequences are non-transactional.
  -- Anchors verify the exact rows and count in each sealed range, so gaps are
  -- never used as the sole signal for deletion.
  sequence_number BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL DEFAULT 'database',
  outcome TEXT NOT NULL DEFAULT 'success',
  actor_user_id UUID,
  actor_role TEXT,
  actor_type TEXT NOT NULL DEFAULT 'user',
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  request_id TEXT,
  correlation_id TEXT,
  session_fingerprint TEXT,
  ip_address INET,
  country_code TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Compatibility field for the Admin API. Version 2 uses independent row
  -- seals and range anchors instead of a global write-time predecessor lock.
  previous_hash TEXT NOT NULL DEFAULT 'INDEPENDENT',
  event_hash TEXT NOT NULL,
  evidence_signature TEXT,
  signature_key_id TEXT,
  integrity_version SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT security_event_type_length CHECK (char_length(event_type) BETWEEN 3 AND 120),
  CONSTRAINT security_category_allowed CHECK (category IN (
    'authentication', 'authorization', 'admin', 'data_change', 'payment',
    'api', 'edge_function', 'storage', 'configuration', 'detection', 'incident'
  )),
  CONSTRAINT security_severity_allowed CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  CONSTRAINT security_source_allowed CHECK (source IN ('client', 'edge', 'database', 'auth', 'storage', 'provider', 'system')),
  CONSTRAINT security_outcome_allowed CHECK (outcome IN ('success', 'failure', 'blocked', 'denied', 'unknown')),
  CONSTRAINT security_actor_type_allowed CHECK (actor_type IN ('user', 'admin', 'partner', 'driver', 'coach', 'service', 'anonymous', 'system')),
  CONSTRAINT security_country_code_format CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT security_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT security_event_hash_format CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT security_previous_hash_format CHECK (
    previous_hash IN ('GENESIS', 'INDEPENDENT') OR previous_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS security_event_ledger_occurred_idx
  ON security.event_ledger (occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_event_ledger_severity_idx
  ON security.event_ledger (severity, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_event_ledger_category_idx
  ON security.event_ledger (category, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_event_ledger_actor_idx
  ON security.event_ledger (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS security_event_ledger_ip_idx
  ON security.event_ledger (ip_address, occurred_at DESC)
  WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS security_event_ledger_request_idx
  ON security.event_ledger (request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS security_event_ledger_resource_idx
  ON security.event_ledger (resource_type, resource_id, occurred_at DESC)
  WHERE resource_type IS NOT NULL;

ALTER TABLE security.event_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.event_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.event_ledger FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.redact_jsonb(p_value JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_key TEXT;
  v_item JSONB;
  v_result JSONB;
BEGIN
  IF p_value IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;

  CASE jsonb_typeof(p_value)
    WHEN 'object' THEN
      v_result := '{}'::JSONB;
      FOR v_key, v_item IN SELECT key, value FROM jsonb_each(p_value)
      LOOP
        IF lower(v_key) ~ '(password|passwd|secret|token|authorization|cookie|api.?key|private.?key|card.?number|cvv|cvc|pin|refresh.?token|access.?token|blood.?value|medical.?document|document.?content|file.?content)' THEN
          v_result := v_result || jsonb_build_object(v_key, '[REDACTED]');
        ELSE
          v_result := v_result || jsonb_build_object(v_key, security.redact_jsonb(v_item));
        END IF;
      END LOOP;
      RETURN v_result;
    WHEN 'array' THEN
      SELECT COALESCE(jsonb_agg(security.redact_jsonb(value)), '[]'::JSONB)
      INTO v_result
      FROM jsonb_array_elements(p_value);
      RETURN v_result;
    ELSE
      RETURN p_value;
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION security.calculate_event_hash(p_event security.event_ledger)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'sequence_number', p_event.sequence_number,
          'id', p_event.id,
          'occurred_at_epoch', extract(epoch FROM p_event.occurred_at),
          'received_at_epoch', extract(epoch FROM p_event.received_at),
          'event_type', p_event.event_type,
          'category', p_event.category,
          'severity', p_event.severity,
          'source', p_event.source,
          'outcome', p_event.outcome,
          'actor_user_id', p_event.actor_user_id,
          'actor_role', p_event.actor_role,
          'actor_type', p_event.actor_type,
          'action', p_event.action,
          'resource_type', p_event.resource_type,
          'resource_id', p_event.resource_id,
          'request_id', p_event.request_id,
          'correlation_id', p_event.correlation_id,
          'session_fingerprint', p_event.session_fingerprint,
          'ip_address', p_event.ip_address,
          'country_code', p_event.country_code,
          'user_agent', p_event.user_agent,
          'metadata', p_event.metadata,
          'previous_hash', p_event.previous_hash,
          'evidence_signature', p_event.evidence_signature,
          'signature_key_id', p_event.signature_key_id,
          'integrity_version', p_event.integrity_version
        )::TEXT,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

CREATE OR REPLACE FUNCTION security.seal_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Security events are append-only';
  END IF;

  NEW.previous_hash := 'INDEPENDENT';
  NEW.received_at := clock_timestamp();
  NEW.event_type := left(trim(NEW.event_type), 120);
  NEW.actor_role := NULLIF(left(trim(COALESCE(NEW.actor_role, '')), 80), '');
  NEW.action := NULLIF(left(trim(COALESCE(NEW.action, '')), 120), '');
  NEW.resource_type := NULLIF(left(trim(COALESCE(NEW.resource_type, '')), 120), '');
  NEW.resource_id := NULLIF(left(trim(COALESCE(NEW.resource_id, '')), 240), '');
  NEW.request_id := NULLIF(left(trim(COALESCE(NEW.request_id, '')), 160), '');
  NEW.correlation_id := NULLIF(left(trim(COALESCE(NEW.correlation_id, '')), 160), '');
  NEW.session_fingerprint := NULLIF(left(trim(COALESCE(NEW.session_fingerprint, '')), 160), '');
  NEW.user_agent := NULLIF(left(COALESCE(NEW.user_agent, ''), 1000), '');
  NEW.metadata := security.redact_jsonb(COALESCE(NEW.metadata, '{}'::JSONB));

  IF pg_column_size(NEW.metadata) > 65536 THEN
    NEW.metadata := jsonb_build_object(
      'truncated', true,
      'reason', 'metadata exceeded 64 KiB'
    );
  END IF;

  NEW.event_hash := security.calculate_event_hash(NEW);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS security_event_seal_trigger ON security.event_ledger;
CREATE TRIGGER security_event_seal_trigger
BEFORE INSERT OR UPDATE OR DELETE ON security.event_ledger
FOR EACH ROW EXECUTE FUNCTION security.seal_event();

CREATE TABLE IF NOT EXISTS security.event_chain_anchors (
  anchor_date DATE PRIMARY KEY,
  cutoff_at TIMESTAMPTZ NOT NULL,
  first_sequence BIGINT NOT NULL,
  last_sequence BIGINT NOT NULL,
  last_hash TEXT NOT NULL CHECK (last_hash ~ '^[0-9a-f]{64}$'),
  event_count BIGINT NOT NULL CHECK (event_count >= 0),
  range_hash TEXT NOT NULL CHECK (range_hash ~ '^[0-9a-f]{64}$'),
  previous_anchor_hash TEXT NOT NULL CHECK (
    previous_anchor_hash = 'GENESIS' OR previous_anchor_hash ~ '^[0-9a-f]{64}$'
  ),
  anchor_hash TEXT NOT NULL UNIQUE CHECK (anchor_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT security_anchor_sequence_order CHECK (first_sequence <= last_sequence)
);

ALTER TABLE security.event_chain_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.event_chain_anchors FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.event_chain_anchors FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.prevent_evidence_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Security evidence is append-only';
END;
$function$;

DROP TRIGGER IF EXISTS security_anchor_immutable_trigger ON security.event_chain_anchors;
CREATE TRIGGER security_anchor_immutable_trigger
BEFORE UPDATE OR DELETE ON security.event_chain_anchors
FOR EACH ROW EXECUTE FUNCTION security.prevent_evidence_mutation();

DROP TRIGGER IF EXISTS security_event_truncate_guard ON security.event_ledger;
CREATE TRIGGER security_event_truncate_guard
BEFORE TRUNCATE ON security.event_ledger
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

DROP TRIGGER IF EXISTS security_anchor_truncate_guard ON security.event_chain_anchors;
CREATE TRIGGER security_anchor_truncate_guard
BEFORE TRUNCATE ON security.event_chain_anchors
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

CREATE TABLE IF NOT EXISTS security.event_anchor_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_hash TEXT NOT NULL REFERENCES security.event_chain_anchors(anchor_hash) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 2 AND 80),
  external_reference TEXT NOT NULL CHECK (char_length(external_reference) BETWEEN 3 AND 500),
  receipt_signature TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  receipt_hash TEXT NOT NULL CHECK (receipt_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE (provider, external_reference)
);

ALTER TABLE security.event_anchor_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.event_anchor_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.event_anchor_receipts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.seal_anchor_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Security evidence is append-only';
  END IF;

  NEW.provider := left(lower(trim(NEW.provider)), 80);
  NEW.external_reference := left(trim(NEW.external_reference), 500);
  NEW.receipt_signature := NULLIF(left(trim(COALESCE(NEW.receipt_signature, '')), 1000), '');
  NEW.metadata := security.redact_jsonb(COALESCE(NEW.metadata, '{}'::JSONB));
  NEW.received_at := clock_timestamp();
  NEW.receipt_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'id', NEW.id,
          'anchor_hash', NEW.anchor_hash,
          'provider', NEW.provider,
          'external_reference', NEW.external_reference,
          'receipt_signature', NEW.receipt_signature,
          'metadata', NEW.metadata,
          'received_at_epoch', extract(epoch FROM NEW.received_at)
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

DROP TRIGGER IF EXISTS security_anchor_receipt_seal_trigger ON security.event_anchor_receipts;
CREATE TRIGGER security_anchor_receipt_seal_trigger
BEFORE INSERT OR UPDATE OR DELETE ON security.event_anchor_receipts
FOR EACH ROW EXECUTE FUNCTION security.seal_anchor_receipt();

DROP TRIGGER IF EXISTS security_anchor_receipt_truncate_guard ON security.event_anchor_receipts;
CREATE TRIGGER security_anchor_receipt_truncate_guard
BEFORE TRUNCATE ON security.event_anchor_receipts
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

CREATE OR REPLACE FUNCTION security.record_event(
  p_event_type TEXT,
  p_category TEXT,
  p_severity TEXT DEFAULT 'info',
  p_source TEXT DEFAULT 'edge',
  p_outcome TEXT DEFAULT 'success',
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_role TEXT DEFAULT NULL,
  p_actor_type TEXT DEFAULT 'user',
  p_action TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_session_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_occurred_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  p_evidence_signature TEXT DEFAULT NULL,
  p_signature_key_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id UUID;
  v_ip INET;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  BEGIN
    v_ip := NULLIF(trim(split_part(COALESCE(p_ip_address, ''), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  INSERT INTO security.event_ledger (
    occurred_at, event_type, category, severity, source, outcome,
    actor_user_id, actor_role, actor_type, action, resource_type, resource_id,
    request_id, correlation_id, session_fingerprint, ip_address, country_code,
    user_agent, metadata, evidence_signature, signature_key_id, event_hash
  ) VALUES (
    COALESCE(p_occurred_at, clock_timestamp()), p_event_type, p_category,
    p_severity, p_source, p_outcome, p_actor_user_id, p_actor_role,
    p_actor_type, p_action, p_resource_type, p_resource_id, p_request_id,
    p_correlation_id, p_session_fingerprint, v_ip,
    NULLIF(upper(trim(COALESCE(p_country_code, ''))), ''), p_user_agent,
    COALESCE(p_metadata, '{}'::JSONB), p_evidence_signature,
    p_signature_key_id, repeat('0', 64)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- PostgREST normally exposes the public schema only. Edge Functions use this
-- narrowly granted wrapper instead of exposing the entire security schema.
CREATE OR REPLACE FUNCTION public.record_security_event(
  p_event_type TEXT,
  p_category TEXT,
  p_severity TEXT DEFAULT 'info',
  p_source TEXT DEFAULT 'edge',
  p_outcome TEXT DEFAULT 'success',
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_role TEXT DEFAULT NULL,
  p_actor_type TEXT DEFAULT 'user',
  p_action TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_session_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_occurred_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  p_evidence_signature TEXT DEFAULT NULL,
  p_signature_key_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT security.record_event(
    p_event_type,
    p_category,
    p_severity,
    p_source,
    p_outcome,
    p_actor_user_id,
    p_actor_role,
    p_actor_type,
    p_action,
    p_resource_type,
    p_resource_id,
    p_request_id,
    p_correlation_id,
    p_session_fingerprint,
    p_ip_address,
    p_country_code,
    p_user_agent,
    p_metadata,
    p_occurred_at,
    p_evidence_signature,
    p_signature_key_id
  );
$function$;

CREATE OR REPLACE FUNCTION security.calculate_anchor_hash(
  p_anchor_date DATE,
  p_cutoff_at TIMESTAMPTZ,
  p_first_sequence BIGINT,
  p_last_sequence BIGINT,
  p_event_count BIGINT,
  p_range_hash TEXT,
  p_last_hash TEXT,
  p_previous_anchor_hash TEXT
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
          'integrity_version', 2,
          'anchor_date', p_anchor_date,
          'cutoff_at_epoch', extract(epoch FROM p_cutoff_at),
          'first_sequence', p_first_sequence,
          'last_sequence', p_last_sequence,
          'event_count', p_event_count,
          'range_hash', p_range_hash,
          'last_hash', p_last_hash,
          'previous_anchor_hash', p_previous_anchor_hash
        )::TEXT,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

CREATE OR REPLACE FUNCTION security.anchor_event_chain(p_anchor_date DATE DEFAULT (CURRENT_DATE - 1))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_existing security.event_chain_anchors%ROWTYPE;
  v_previous security.event_chain_anchors%ROWTYPE;
  v_cutoff_at TIMESTAMPTZ;
  v_first_sequence BIGINT;
  v_last_sequence BIGINT;
  v_last_hash TEXT;
  v_event_count BIGINT := 0;
  v_range_hash TEXT := encode(extensions.digest('NUTRIO-EVENT-RANGE-V2', 'sha256'), 'hex');
  v_previous_anchor_hash TEXT := 'GENESIS';
  v_anchor_hash TEXT;
  v_event RECORD;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_anchor_date IS NULL OR p_anchor_date >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Only completed UTC dates can be anchored';
  END IF;

  -- Anchor creation is infrequent and isolated from event writers. This lock
  -- prevents two maintenance jobs from producing competing anchor heads.
  PERFORM pg_advisory_xact_lock(hashtext('security.event_chain_anchors.v2'));

  SELECT *
  INTO v_existing
  FROM security.event_chain_anchors
  WHERE anchor_date = p_anchor_date;

  IF v_existing.anchor_date IS NOT NULL THEN
    RETURN to_jsonb(v_existing) || jsonb_build_object('anchored', true, 'existing', true);
  END IF;

  SELECT *
  INTO v_previous
  FROM security.event_chain_anchors
  ORDER BY last_sequence DESC
  LIMIT 1;

  IF v_previous.anchor_date IS NOT NULL AND p_anchor_date <= v_previous.anchor_date THEN
    RAISE EXCEPTION 'Anchor dates must be created in chronological order';
  END IF;

  v_cutoff_at := (p_anchor_date + 1)::TIMESTAMPTZ;
  v_previous_anchor_hash := COALESCE(v_previous.anchor_hash, 'GENESIS');

  SELECT min(e.sequence_number), max(e.sequence_number)
  INTO v_first_sequence, v_last_sequence
  FROM security.event_ledger e
  WHERE e.sequence_number > COALESCE(v_previous.last_sequence, 0)
    AND e.received_at < v_cutoff_at;

  IF v_last_sequence IS NULL THEN
    RETURN jsonb_build_object('anchored', false, 'reason', 'no_events');
  END IF;

  FOR v_event IN
    SELECT e.sequence_number, e.event_hash
    FROM security.event_ledger e
    WHERE e.sequence_number BETWEEN v_first_sequence AND v_last_sequence
    ORDER BY e.sequence_number
  LOOP
    v_event_count := v_event_count + 1;
    v_range_hash := encode(
      extensions.digest(
        convert_to(
          v_range_hash || ':' || v_event.sequence_number::TEXT || ':' || v_event.event_hash,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    v_last_hash := v_event.event_hash;
  END LOOP;

  v_anchor_hash := security.calculate_anchor_hash(
    p_anchor_date,
    v_cutoff_at,
    v_first_sequence,
    v_last_sequence,
    v_event_count,
    v_range_hash,
    v_last_hash,
    v_previous_anchor_hash
  );

  INSERT INTO security.event_chain_anchors (
    anchor_date,
    cutoff_at,
    first_sequence,
    last_sequence,
    last_hash,
    event_count,
    range_hash,
    previous_anchor_hash,
    anchor_hash
  ) VALUES (
    p_anchor_date,
    v_cutoff_at,
    v_first_sequence,
    v_last_sequence,
    v_last_hash,
    v_event_count,
    v_range_hash,
    v_previous_anchor_hash,
    v_anchor_hash
  )
  RETURNING * INTO v_existing;

  RETURN to_jsonb(v_existing) || jsonb_build_object('anchored', true, 'existing', false);
END;
$function$;

-- Public-schema wrapper for the scheduled Edge Function. The inner function
-- still verifies that the original caller is service_role.
CREATE OR REPLACE FUNCTION public.create_security_event_anchor(
  p_anchor_date DATE DEFAULT (CURRENT_DATE - 1)
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT security.anchor_event_chain(p_anchor_date);
$function$;

CREATE OR REPLACE FUNCTION public.record_security_anchor_receipt(
  p_anchor_hash TEXT,
  p_provider TEXT,
  p_external_reference TEXT,
  p_receipt_signature TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id UUID;
  v_existing_anchor_hash TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM security.event_chain_anchors a
    WHERE a.anchor_hash = p_anchor_hash
  ) THEN
    RAISE EXCEPTION 'Unknown security anchor';
  END IF;

  INSERT INTO security.event_anchor_receipts (
    anchor_hash,
    provider,
    external_reference,
    receipt_signature,
    metadata,
    receipt_hash
  ) VALUES (
    p_anchor_hash,
    p_provider,
    p_external_reference,
    p_receipt_signature,
    COALESCE(p_metadata, '{}'::JSONB),
    repeat('0', 64)
  )
  ON CONFLICT (provider, external_reference) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT r.id, r.anchor_hash
    INTO v_id, v_existing_anchor_hash
    FROM security.event_anchor_receipts r
    WHERE r.provider = lower(trim(p_provider))
      AND r.external_reference = trim(p_external_reference);

    IF v_existing_anchor_hash IS DISTINCT FROM p_anchor_hash THEN
      RAISE EXCEPTION 'External receipt reference is already bound to another anchor';
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION security.capture_privileged_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::JSONB END;
  v_new JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::JSONB END;
  v_row JSONB;
  v_actor UUID := auth.uid();
  v_actor_role TEXT;
  v_resource_id TEXT;
  v_changed_fields TEXT[];
  v_severity TEXT;
  v_headers JSONB := '{}'::JSONB;
  v_ip INET;
  v_request_id TEXT;
  v_correlation_id TEXT;
  v_session_fingerprint TEXT := NULLIF(auth.jwt() ->> 'session_id', '');
  v_country_code TEXT;
  v_user_agent TEXT;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN v_old ELSE v_new END;
  v_resource_id := COALESCE(
    v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'order_id',
    v_row ->> 'subscription_id', v_row ->> 'restaurant_id', 'unknown'
  );

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key ORDER BY key)
    INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_object_keys(v_old) AS key
      UNION
      SELECT key FROM jsonb_object_keys(v_new) AS key
    ) keys
    WHERE v_old -> keys.key IS DISTINCT FROM v_new -> keys.key;
  ELSE
    v_changed_fields := ARRAY[]::TEXT[];
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT ur.role::TEXT INTO v_actor_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_actor
    ORDER BY CASE ur.role::TEXT WHEN 'admin' THEN 1 ELSE 2 END
    LIMIT 1;
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
      v_headers ->> 'x-forwarded-for',
      v_headers ->> 'cf-connecting-ip',
      ''
    ), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  v_request_id := COALESCE(v_headers ->> 'sb-request-id', v_headers ->> 'x-request-id');
  v_correlation_id := v_headers ->> 'x-correlation-id';
  v_user_agent := v_headers ->> 'user-agent';
  v_country_code := upper(trim(COALESCE(v_headers ->> 'cf-ipcountry', '')));
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    v_country_code := NULL;
  END IF;

  v_severity := CASE
    WHEN TG_TABLE_NAME IN ('user_roles', 'payments', 'wallet_transactions', 'customer_wallets', 'partner_payouts', 'affiliate_payouts') THEN 'high'
    WHEN TG_OP = 'DELETE' THEN 'high'
    WHEN TG_TABLE_NAME IN ('subscriptions', 'blocked_ips', 'fleet_managers') THEN 'medium'
    ELSE 'low'
  END;

  INSERT INTO security.event_ledger (
    event_type, category, severity, source, outcome, actor_user_id,
    actor_role, actor_type, action, resource_type, resource_id, request_id,
    correlation_id, session_fingerprint, ip_address, country_code, user_agent,
    metadata, event_hash
  ) VALUES (
    'database.' || TG_TABLE_NAME || '.' || lower(TG_OP),
    CASE WHEN TG_TABLE_NAME IN ('payments', 'wallet_transactions', 'customer_wallets', 'partner_payouts', 'affiliate_payouts') THEN 'payment' ELSE 'data_change' END,
    v_severity,
    'database',
    'success',
    v_actor,
    v_actor_role,
    CASE WHEN v_actor_role = 'admin' THEN 'admin' WHEN v_actor IS NULL THEN 'system' ELSE 'user' END,
    lower(TG_OP),
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    v_resource_id,
    v_request_id,
    v_correlation_id,
    CASE WHEN v_session_fingerprint IS NULL THEN NULL ELSE 'session:' || v_session_fingerprint END,
    v_ip,
    v_country_code,
    v_user_agent,
    jsonb_build_object(
      'changed_fields', COALESCE(to_jsonb(v_changed_fields), '[]'::JSONB),
      'transaction_id', txid_current()::TEXT
    ),
    repeat('0', 64)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

DO $do$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'user_roles', 'profiles', 'subscriptions', 'orders', 'payments',
    'wallet_transactions', 'customer_wallets', 'partner_payouts',
    'affiliate_payouts', 'drivers', 'fleet_managers', 'restaurants',
    'support_tickets', 'blocked_ips', 'blood_work_records', 'user_addresses'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS security_event_audit_trigger ON public.%I', v_table);
      EXECUTE format(
        'CREATE TRIGGER security_event_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION security.capture_privileged_change()',
        v_table
      );
    END IF;
  END LOOP;
END;
$do$;

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
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  RETURN QUERY
  SELECT
    e.sequence_number,
    e.id,
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
    host(e.ip_address),
    e.country_code,
    e.user_agent,
    e.metadata,
    e.previous_hash,
    e.event_hash,
    e.evidence_signature,
    e.signature_key_id,
    count(*) OVER ()
  FROM security.event_ledger e
  WHERE e.occurred_at >= COALESCE(p_from, '-infinity'::TIMESTAMPTZ)
    AND e.occurred_at <= COALESCE(p_to, 'infinity'::TIMESTAMPTZ)
    AND (p_severity IS NULL OR e.severity = p_severity)
    AND (p_category IS NULL OR e.category = p_category)
    AND (p_outcome IS NULL OR e.outcome = p_outcome)
    AND (
      NULLIF(trim(COALESCE(p_search, '')), '') IS NULL
      OR e.event_type ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(e.resource_type, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(e.resource_id, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(e.request_id, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(e.session_fingerprint, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(host(e.ip_address), '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(e.actor_user_id::TEXT, '') ILIKE '%' || trim(p_search) || '%'
    )
  ORDER BY e.occurred_at DESC, e.sequence_number DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 5000)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_security_overview(p_since TIMESTAMPTZ DEFAULT (now() - interval '24 hours'))
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'critical', count(*) FILTER (WHERE severity = 'critical'),
    'high', count(*) FILTER (WHERE severity = 'high'),
    'denied_or_blocked', count(*) FILTER (WHERE outcome IN ('denied', 'blocked')),
    'failures', count(*) FILTER (WHERE outcome = 'failure'),
    'unique_ips', count(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL),
    'last_event_at', max(occurred_at),
    'since', p_since,
    'latest_anchor', (
      SELECT to_jsonb(a) || jsonb_build_object(
        'external_receipt_count', (
          SELECT count(*)
          FROM security.event_anchor_receipts r
          WHERE r.anchor_hash = a.anchor_hash
        )
      )
      FROM security.event_chain_anchors a
      ORDER BY a.anchor_date DESC
      LIMIT 1
    )
  ) INTO v_result
  FROM security.event_ledger
  WHERE occurred_at >= COALESCE(p_since, now() - interval '24 hours');

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_verify_security_event_chain(p_limit INTEGER DEFAULT 50000)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_max_sequence BIGINT;
  v_start_sequence BIGINT;
  v_checked BIGINT;
  v_event_invalid BIGINT;
  v_first_event_invalid BIGINT;
  v_anchor_checked BIGINT := 0;
  v_anchor_range_checked BIGINT := 0;
  v_anchor_invalid BIGINT := 0;
  v_first_invalid_anchor DATE;
  v_previous_anchor_hash TEXT := 'GENESIS';
  v_previous_last_sequence BIGINT := 0;
  v_latest_anchor_sequence BIGINT := 0;
  v_unanchored_count BIGINT := 0;
  v_range_hash TEXT;
  v_range_count BIGINT;
  v_range_last_hash TEXT;
  v_range_row_invalid BIGINT;
  v_expected_anchor_hash TEXT;
  v_anchor_bad BOOLEAN;
  v_anchor security.event_chain_anchors%ROWTYPE;
  v_event RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  SELECT max(sequence_number) INTO v_max_sequence FROM security.event_ledger;
  IF v_max_sequence IS NULL THEN
    SELECT count(*) INTO v_anchor_invalid FROM security.event_chain_anchors;
    RETURN jsonb_build_object(
      'valid', v_anchor_invalid = 0,
      'checked', 0,
      'event_invalid_count', 0,
      'anchor_invalid_count', v_anchor_invalid,
      'anchors_checked', v_anchor_invalid,
      'unanchored_count', 0,
      'coverage', CASE WHEN v_anchor_invalid = 0 THEN 'empty' ELSE 'invalid' END,
      'first_invalid_sequence', NULL,
      'first_invalid_anchor', NULL
    );
  END IF;

  v_start_sequence := GREATEST(1, v_max_sequence - LEAST(GREATEST(COALESCE(p_limit, 50000), 1), 250000) + 1);

  WITH checked AS (
    SELECT
      e.sequence_number,
      e.event_hash,
      security.calculate_event_hash(e) AS calculated_hash
    FROM security.event_ledger e
    WHERE e.sequence_number >= v_start_sequence
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE event_hash <> calculated_hash),
    min(sequence_number) FILTER (WHERE event_hash <> calculated_hash)
  INTO v_checked, v_event_invalid, v_first_event_invalid
  FROM checked;

  FOR v_anchor IN
    SELECT a.*
    FROM security.event_chain_anchors a
    ORDER BY a.anchor_date, a.last_sequence
  LOOP
    v_anchor_checked := v_anchor_checked + 1;
    v_anchor_bad := false;

    v_expected_anchor_hash := security.calculate_anchor_hash(
      v_anchor.anchor_date,
      v_anchor.cutoff_at,
      v_anchor.first_sequence,
      v_anchor.last_sequence,
      v_anchor.event_count,
      v_anchor.range_hash,
      v_anchor.last_hash,
      v_anchor.previous_anchor_hash
    );

    IF v_anchor.previous_anchor_hash IS DISTINCT FROM v_previous_anchor_hash
       OR v_anchor.anchor_hash IS DISTINCT FROM v_expected_anchor_hash
       OR v_anchor.first_sequence <= v_previous_last_sequence
       OR v_anchor.last_sequence < v_anchor.first_sequence THEN
      v_anchor_bad := true;
    END IF;

    -- Recompute event content for anchors intersecting the requested window.
    -- This detects row deletion and changes to both payloads and stored hashes.
    IF v_anchor.last_sequence >= v_start_sequence THEN
      v_anchor_range_checked := v_anchor_range_checked + 1;
      v_range_hash := encode(extensions.digest('NUTRIO-EVENT-RANGE-V2', 'sha256'), 'hex');
      v_range_count := 0;
      v_range_last_hash := NULL;
      v_range_row_invalid := 0;

      FOR v_event IN
        SELECT e.*, security.calculate_event_hash(e) AS calculated_hash
        FROM security.event_ledger e
        WHERE e.sequence_number BETWEEN v_anchor.first_sequence AND v_anchor.last_sequence
        ORDER BY e.sequence_number
      LOOP
        v_range_count := v_range_count + 1;
        IF v_event.event_hash IS DISTINCT FROM v_event.calculated_hash THEN
          v_range_row_invalid := v_range_row_invalid + 1;
        END IF;
        v_range_hash := encode(
          extensions.digest(
            convert_to(
              v_range_hash || ':' || v_event.sequence_number::TEXT || ':' || v_event.event_hash,
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        );
        v_range_last_hash := v_event.event_hash;
      END LOOP;

      IF v_range_count IS DISTINCT FROM v_anchor.event_count
         OR v_range_hash IS DISTINCT FROM v_anchor.range_hash
         OR v_range_last_hash IS DISTINCT FROM v_anchor.last_hash
         OR v_range_row_invalid > 0 THEN
        v_anchor_bad := true;
      END IF;
    END IF;

    IF v_anchor_bad THEN
      v_anchor_invalid := v_anchor_invalid + 1;
      v_first_invalid_anchor := COALESCE(v_first_invalid_anchor, v_anchor.anchor_date);
    END IF;

    v_previous_anchor_hash := v_anchor.anchor_hash;
    v_previous_last_sequence := v_anchor.last_sequence;
    v_latest_anchor_sequence := GREATEST(v_latest_anchor_sequence, v_anchor.last_sequence);
  END LOOP;

  SELECT count(*)
  INTO v_unanchored_count
  FROM security.event_ledger e
  WHERE e.sequence_number > v_latest_anchor_sequence;

  RETURN jsonb_build_object(
    'valid', v_event_invalid = 0 AND v_anchor_invalid = 0,
    'checked', v_checked,
    'invalid_count', v_event_invalid + v_anchor_invalid,
    'event_invalid_count', v_event_invalid,
    'anchor_invalid_count', v_anchor_invalid,
    'anchors_checked', v_anchor_checked,
    'anchor_ranges_checked', v_anchor_range_checked,
    'first_invalid_sequence', v_first_event_invalid,
    'first_invalid_anchor', v_first_invalid_anchor,
    'start_sequence', v_start_sequence,
    'end_sequence', v_max_sequence,
    'anchored_through_sequence', NULLIF(v_latest_anchor_sequence, 0),
    'unanchored_count', v_unanchored_count,
    'coverage', CASE
      WHEN v_anchor_invalid > 0 OR v_event_invalid > 0 THEN 'invalid'
      WHEN v_anchor_checked = 0 THEN 'unanchored'
      WHEN v_unanchored_count > 0 THEN 'partially_anchored'
      ELSE 'fully_anchored'
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_record_security_export(
  p_format TEXT,
  p_event_count INTEGER,
  p_filters JSONB DEFAULT '{}'::JSONB
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
  v_request_id TEXT;
  v_correlation_id TEXT;
  v_session_fingerprint TEXT := NULLIF(auth.jwt() ->> 'session_id', '');
  v_country_code TEXT;
  v_user_agent TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF lower(COALESCE(p_format, '')) NOT IN ('csv', 'json') THEN
    RAISE EXCEPTION 'Unsupported export format';
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
    v_ip := NULLIF(
      trim(split_part(COALESCE(
        v_headers ->> 'x-forwarded-for',
        v_headers ->> 'cf-connecting-ip',
        ''
      ), ',', 1)),
      ''
    )::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  v_request_id := COALESCE(
    v_headers ->> 'sb-request-id',
    v_headers ->> 'x-request-id'
  );
  v_correlation_id := v_headers ->> 'x-correlation-id';
  v_country_code := upper(trim(COALESCE(v_headers ->> 'cf-ipcountry', '')));
  IF v_country_code !~ '^[A-Z]{2}$' THEN
    v_country_code := NULL;
  END IF;
  v_user_agent := v_headers ->> 'user-agent';

  INSERT INTO security.event_ledger (
    event_type, category, severity, source, outcome, actor_user_id,
    actor_role, actor_type, action, resource_type, resource_id, request_id,
    correlation_id, session_fingerprint, ip_address, country_code, user_agent,
    metadata, event_hash
  ) VALUES (
    'admin.security_events.export',
    'admin',
    'medium',
    'database',
    'success',
    auth.uid(),
    'admin',
    'admin',
    'export',
    'security.event_ledger',
    lower(p_format),
    v_request_id,
    v_correlation_id,
    CASE WHEN v_session_fingerprint IS NULL THEN NULL ELSE 'session:' || v_session_fingerprint END,
    v_ip,
    v_country_code,
    v_user_agent,
    jsonb_build_object(
      'format', lower(p_format),
      'event_count', LEAST(GREATEST(COALESCE(p_event_count, 0), 0), 5000),
      'filters', security.redact_jsonb(COALESCE(p_filters, '{}'::JSONB))
    ),
    repeat('0', 64)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION security.redact_jsonb(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.calculate_event_hash(security.event_ledger) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.calculate_anchor_hash(DATE, TIMESTAMPTZ, BIGINT, BIGINT, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.seal_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.seal_anchor_receipt() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.prevent_evidence_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.capture_privileged_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.record_event(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.anchor_event_chain(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_security_event(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_security_event_anchor(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_security_anchor_receipt(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION security.record_event(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION security.anchor_event_chain(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_security_event(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_security_event_anchor(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_security_anchor_receipt(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.admin_search_security_events(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_security_overview(TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_verify_security_event_chain(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_security_export(TEXT, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_security_events(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_security_overview(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_security_event_chain(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_security_export(TEXT, INTEGER, JSONB) TO authenticated;

COMMENT ON TABLE security.event_ledger IS
  'Append-only security evidence with independent SHA-256 row seals and externally attestable range anchors. Access is only through admin RPCs.';
COMMENT ON TABLE security.event_chain_anchors IS
  'Append-only range digests. Export anchor_hash off-database to detect privileged in-database rewrites or deletion.';
COMMENT ON TABLE security.event_anchor_receipts IS
  'Append-only receipts proving that an anchor hash was copied to an external evidence sink.';
COMMENT ON COLUMN security.event_ledger.ip_address IS
  'Restricted forensic identifier. Handle and export according to the incident response policy.';
COMMENT ON COLUMN security.event_ledger.evidence_signature IS
  'Optional signature produced by a trusted collector. Row seals detect mutation; external anchor receipts provide stronger assurance.';

COMMIT;
