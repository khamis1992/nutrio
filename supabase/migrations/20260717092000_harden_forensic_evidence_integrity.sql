-- Forensic evidence integrity hardening.
--
-- This migration keeps the public RPC names used by the Admin Security Center,
-- but replaces ambiguous/bounded integrity claims with full verification and
-- introduces explicit anchor membership. Explicit membership is necessary
-- because PostgreSQL identity values are allocated before commit and can become
-- visible out of sequence.

BEGIN;

-- ---------------------------------------------------------------------------
-- Commit-order-safe event anchors
-- ---------------------------------------------------------------------------

ALTER TABLE security.event_chain_anchors
  ADD COLUMN IF NOT EXISTS integrity_version SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS membership_hash TEXT;

ALTER TABLE security.event_chain_anchors
  DROP CONSTRAINT IF EXISTS security_anchor_membership_hash_format;
ALTER TABLE security.event_chain_anchors
  ADD CONSTRAINT security_anchor_membership_hash_format CHECK (
    membership_hash IS NULL OR membership_hash ~ '^[0-9a-f]{64}$'
  );

CREATE TABLE IF NOT EXISTS security.event_anchor_memberships (
  anchor_hash TEXT NOT NULL
    REFERENCES security.event_chain_anchors(anchor_hash) ON DELETE RESTRICT,
  event_id UUID NOT NULL
    REFERENCES security.event_ledger(id) ON DELETE RESTRICT,
  event_sequence BIGINT NOT NULL,
  event_hash_snapshot TEXT NOT NULL
    CHECK (event_hash_snapshot ~ '^[0-9a-f]{64}$'),
  ordinal BIGINT NOT NULL CHECK (ordinal > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (anchor_hash, event_id),
  UNIQUE (event_id),
  UNIQUE (anchor_hash, ordinal)
);

CREATE INDEX IF NOT EXISTS security_event_anchor_membership_sequence_idx
  ON security.event_anchor_memberships(event_sequence);

ALTER TABLE security.event_anchor_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.event_anchor_memberships FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.event_anchor_memberships
  FROM PUBLIC, anon, authenticated, service_role;

-- Existing v2 anchors are represented by their original sequence ranges. If a
-- late row appeared inside one of those ranges, full verification below will
-- detect the changed count/range digest instead of blessing it silently.
WITH legacy_members AS (
  SELECT
    a.anchor_hash,
    e.id AS event_id,
    e.sequence_number AS event_sequence,
    e.event_hash AS event_hash_snapshot,
    row_number() OVER (
      PARTITION BY a.anchor_hash
      ORDER BY e.sequence_number
    )::BIGINT AS ordinal
  FROM security.event_chain_anchors a
  JOIN security.event_ledger e
    ON e.sequence_number BETWEEN a.first_sequence AND a.last_sequence
  WHERE a.integrity_version = 2
)
INSERT INTO security.event_anchor_memberships (
  anchor_hash,
  event_id,
  event_sequence,
  event_hash_snapshot,
  ordinal
)
SELECT
  anchor_hash,
  event_id,
  event_sequence,
  event_hash_snapshot,
  ordinal
FROM legacy_members
ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS security_anchor_membership_immutable_trigger
  ON security.event_anchor_memberships;
CREATE TRIGGER security_anchor_membership_immutable_trigger
BEFORE UPDATE OR DELETE ON security.event_anchor_memberships
FOR EACH ROW EXECUTE FUNCTION security.prevent_evidence_mutation();

DROP TRIGGER IF EXISTS security_anchor_membership_truncate_guard
  ON security.event_anchor_memberships;
CREATE TRIGGER security_anchor_membership_truncate_guard
BEFORE TRUNCATE ON security.event_anchor_memberships
FOR EACH STATEMENT EXECUTE FUNCTION security.prevent_evidence_mutation();

-- A transaction-local build set prevents a second statement snapshot from
-- accidentally including a late commit that was not part of the digest.
CREATE TABLE IF NOT EXISTS security.event_anchor_build_members (
  batch_id UUID NOT NULL,
  event_id UUID NOT NULL,
  event_sequence BIGINT NOT NULL,
  event_hash_snapshot TEXT NOT NULL,
  ordinal BIGINT NOT NULL,
  PRIMARY KEY (batch_id, event_id),
  UNIQUE (batch_id, ordinal)
);

ALTER TABLE security.event_anchor_build_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.event_anchor_build_members FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.event_anchor_build_members
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.calculate_anchor_hash_v3(
  p_anchor_date DATE,
  p_cutoff_at TIMESTAMPTZ,
  p_first_sequence BIGINT,
  p_last_sequence BIGINT,
  p_event_count BIGINT,
  p_membership_hash TEXT,
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
          'integrity_version', 3,
          'anchor_date', p_anchor_date,
          'cutoff_at_epoch', extract(epoch FROM p_cutoff_at),
          'first_sequence', p_first_sequence,
          'last_sequence', p_last_sequence,
          'event_count', p_event_count,
          'membership_hash', p_membership_hash,
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

CREATE OR REPLACE FUNCTION security.anchor_event_chain(
  p_anchor_date DATE DEFAULT (CURRENT_DATE - 1)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_existing security.event_chain_anchors%ROWTYPE;
  v_previous security.event_chain_anchors%ROWTYPE;
  v_cutoff_at TIMESTAMPTZ;
  v_batch_id UUID := gen_random_uuid();
  v_first_sequence BIGINT;
  v_last_sequence BIGINT;
  v_last_hash TEXT;
  v_event_count BIGINT := 0;
  v_membership_hash TEXT := encode(
    extensions.digest('NUTRIO-EVENT-MEMBERSHIP-V3', 'sha256'),
    'hex'
  );
  v_previous_anchor_hash TEXT := 'GENESIS';
  v_anchor_hash TEXT;
  v_event RECORD;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_anchor_date IS NULL OR p_anchor_date >= (clock_timestamp() AT TIME ZONE 'UTC')::DATE THEN
    RAISE EXCEPTION 'Only completed UTC dates can be anchored';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('security.event_chain_anchors.v3'));

  SELECT *
  INTO v_existing
  FROM security.event_chain_anchors
  WHERE anchor_date = p_anchor_date;

  IF v_existing.anchor_date IS NOT NULL THEN
    RETURN to_jsonb(v_existing) || jsonb_build_object(
      'anchored', true,
      'existing', true
    );
  END IF;

  SELECT *
  INTO v_previous
  FROM security.event_chain_anchors
  ORDER BY anchor_date DESC
  LIMIT 1;

  IF v_previous.anchor_date IS NOT NULL AND p_anchor_date <= v_previous.anchor_date THEN
    RAISE EXCEPTION 'Anchor dates must be created in chronological order';
  END IF;

  v_cutoff_at := make_timestamptz(
    extract(year FROM p_anchor_date + 1)::INTEGER,
    extract(month FROM p_anchor_date + 1)::INTEGER,
    extract(day FROM p_anchor_date + 1)::INTEGER,
    0,
    0,
    0,
    'UTC'
  );
  v_previous_anchor_hash := COALESCE(v_previous.anchor_hash, 'GENESIS');

  INSERT INTO security.event_anchor_build_members (
    batch_id,
    event_id,
    event_sequence,
    event_hash_snapshot,
    ordinal
  )
  SELECT
    v_batch_id,
    e.id,
    e.sequence_number,
    e.event_hash,
    row_number() OVER (ORDER BY e.sequence_number, e.id)::BIGINT
  FROM security.event_ledger e
  WHERE e.received_at < v_cutoff_at
    AND NOT EXISTS (
      SELECT 1
      FROM security.event_anchor_memberships m
      WHERE m.event_id = e.id
    );

  SELECT
    min(event_sequence),
    max(event_sequence),
    count(*)
  INTO v_first_sequence, v_last_sequence, v_event_count
  FROM security.event_anchor_build_members
  WHERE batch_id = v_batch_id;

  IF v_event_count = 0 THEN
    DELETE FROM security.event_anchor_build_members WHERE batch_id = v_batch_id;
    RETURN jsonb_build_object('anchored', false, 'reason', 'no_events');
  END IF;

  FOR v_event IN
    SELECT
      b.ordinal,
      b.event_id,
      b.event_sequence,
      b.event_hash_snapshot,
      security.calculate_event_hash(e) AS calculated_hash
    FROM security.event_anchor_build_members b
    JOIN security.event_ledger e ON e.id = b.event_id
    WHERE b.batch_id = v_batch_id
    ORDER BY b.ordinal
  LOOP
    IF v_event.event_hash_snapshot IS DISTINCT FROM v_event.calculated_hash THEN
      RAISE EXCEPTION 'Security event seal mismatch at sequence %', v_event.event_sequence;
    END IF;

    v_membership_hash := encode(
      extensions.digest(
        convert_to(
          v_membership_hash || ':' ||
          v_event.ordinal::TEXT || ':' ||
          v_event.event_sequence::TEXT || ':' ||
          v_event.event_id::TEXT || ':' ||
          v_event.event_hash_snapshot,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    v_last_hash := v_event.event_hash_snapshot;
  END LOOP;

  v_anchor_hash := security.calculate_anchor_hash_v3(
    p_anchor_date,
    v_cutoff_at,
    v_first_sequence,
    v_last_sequence,
    v_event_count,
    v_membership_hash,
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
    anchor_hash,
    integrity_version,
    membership_hash
  ) VALUES (
    p_anchor_date,
    v_cutoff_at,
    v_first_sequence,
    v_last_sequence,
    v_last_hash,
    v_event_count,
    v_membership_hash,
    v_previous_anchor_hash,
    v_anchor_hash,
    3,
    v_membership_hash
  )
  RETURNING * INTO v_existing;

  INSERT INTO security.event_anchor_memberships (
    anchor_hash,
    event_id,
    event_sequence,
    event_hash_snapshot,
    ordinal
  )
  SELECT
    v_anchor_hash,
    event_id,
    event_sequence,
    event_hash_snapshot,
    ordinal
  FROM security.event_anchor_build_members
  WHERE batch_id = v_batch_id
  ORDER BY ordinal;

  DELETE FROM security.event_anchor_build_members WHERE batch_id = v_batch_id;

  RETURN to_jsonb(v_existing) || jsonb_build_object(
    'anchored', true,
    'existing', false
  );
END;
$function$;

ALTER TABLE security.event_chain_anchors
  ALTER COLUMN integrity_version SET DEFAULT 3;

CREATE TABLE IF NOT EXISTS security.event_anchor_chain_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  anchor_count BIGINT NOT NULL DEFAULT 0 CHECK (anchor_count >= 0),
  head_anchor_hash TEXT NOT NULL DEFAULT 'GENESIS' CHECK (
    head_anchor_hash = 'GENESIS' OR head_anchor_hash ~ '^[0-9a-f]{64}$'
  ),
  latest_anchor_date DATE,
  latest_cutoff_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE security.event_anchor_chain_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.event_anchor_chain_state FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.event_anchor_chain_state
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.refresh_event_anchor_chain_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_count BIGINT;
  v_head TEXT;
  v_date DATE;
  v_cutoff TIMESTAMPTZ;
BEGIN
  SELECT count(*) INTO v_count FROM security.event_chain_anchors;
  SELECT a.anchor_hash, a.anchor_date, a.cutoff_at
  INTO v_head, v_date, v_cutoff
  FROM security.event_chain_anchors a
  ORDER BY a.anchor_date DESC
  LIMIT 1;

  INSERT INTO security.event_anchor_chain_state (
    singleton,
    anchor_count,
    head_anchor_hash,
    latest_anchor_date,
    latest_cutoff_at,
    updated_at
  ) VALUES (
    true,
    v_count,
    COALESCE(v_head, 'GENESIS'),
    v_date,
    v_cutoff,
    clock_timestamp()
  )
  ON CONFLICT (singleton) DO UPDATE
  SET anchor_count = EXCLUDED.anchor_count,
      head_anchor_hash = EXCLUDED.head_anchor_hash,
      latest_anchor_date = EXCLUDED.latest_anchor_date,
      latest_cutoff_at = EXCLUDED.latest_cutoff_at,
      updated_at = EXCLUDED.updated_at;
  RETURN NULL;
END;
$function$;

INSERT INTO security.event_anchor_chain_state (
  singleton,
  anchor_count,
  head_anchor_hash,
  latest_anchor_date,
  latest_cutoff_at
)
SELECT
  true,
  count(*),
  COALESCE((
    SELECT a.anchor_hash
    FROM security.event_chain_anchors a
    ORDER BY a.anchor_date DESC
    LIMIT 1
  ), 'GENESIS'),
  (
    SELECT a.anchor_date
    FROM security.event_chain_anchors a
    ORDER BY a.anchor_date DESC
    LIMIT 1
  ),
  (
    SELECT a.cutoff_at
    FROM security.event_chain_anchors a
    ORDER BY a.anchor_date DESC
    LIMIT 1
  )
FROM security.event_chain_anchors
ON CONFLICT (singleton) DO UPDATE
SET anchor_count = EXCLUDED.anchor_count,
    head_anchor_hash = EXCLUDED.head_anchor_hash,
    latest_anchor_date = EXCLUDED.latest_anchor_date,
    latest_cutoff_at = EXCLUDED.latest_cutoff_at,
    updated_at = clock_timestamp();

DROP TRIGGER IF EXISTS security_anchor_chain_state_trigger
  ON security.event_chain_anchors;
CREATE TRIGGER security_anchor_chain_state_trigger
AFTER INSERT ON security.event_chain_anchors
FOR EACH ROW EXECUTE FUNCTION security.refresh_event_anchor_chain_state();

-- ---------------------------------------------------------------------------
-- Receiver-generated off-site acknowledgements
-- ---------------------------------------------------------------------------

ALTER TABLE security.event_anchor_receipts
  ADD COLUMN IF NOT EXISTS integrity_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payload_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledgement_key_id TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgement_nonce TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgement_validated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE security.event_anchor_receipts
  DROP CONSTRAINT IF EXISTS security_anchor_receipt_payload_hash_format;
ALTER TABLE security.event_anchor_receipts
  ADD CONSTRAINT security_anchor_receipt_payload_hash_format CHECK (
    payload_sha256 IS NULL OR payload_sha256 ~ '^[0-9a-f]{64}$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS security_anchor_receipt_ack_nonce_idx
  ON security.event_anchor_receipts(
    acknowledgement_key_id,
    acknowledgement_nonce
  )
  WHERE acknowledgement_validated = true;

CREATE OR REPLACE FUNCTION security.calculate_anchor_receipt_hash(
  p_receipt security.event_anchor_receipts
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT encode(
    extensions.digest(
      convert_to(
        CASE
          WHEN p_receipt.integrity_version >= 2 THEN
            jsonb_build_object(
              'integrity_version', p_receipt.integrity_version,
              'id', p_receipt.id,
              'anchor_hash', p_receipt.anchor_hash,
              'provider', p_receipt.provider,
              'external_reference', p_receipt.external_reference,
              'receipt_signature', p_receipt.receipt_signature,
              'payload_sha256', p_receipt.payload_sha256,
              'acknowledged_at_epoch', extract(epoch FROM p_receipt.acknowledged_at),
              'acknowledgement_key_id', p_receipt.acknowledgement_key_id,
              'acknowledgement_nonce', p_receipt.acknowledgement_nonce,
              'acknowledgement_validated', p_receipt.acknowledgement_validated,
              'metadata', p_receipt.metadata,
              'received_at_epoch', extract(epoch FROM p_receipt.received_at)
            )::TEXT
          ELSE
            jsonb_build_object(
              'id', p_receipt.id,
              'anchor_hash', p_receipt.anchor_hash,
              'provider', p_receipt.provider,
              'external_reference', p_receipt.external_reference,
              'receipt_signature', p_receipt.receipt_signature,
              'metadata', p_receipt.metadata,
              'received_at_epoch', extract(epoch FROM p_receipt.received_at)
            )::TEXT
        END,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

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
  NEW.payload_sha256 := NULLIF(lower(trim(COALESCE(NEW.payload_sha256, ''))), '');
  NEW.acknowledgement_key_id := NULLIF(
    left(trim(COALESCE(NEW.acknowledgement_key_id, '')), 80),
    ''
  );
  NEW.acknowledgement_nonce := NULLIF(
    left(trim(COALESCE(NEW.acknowledgement_nonce, '')), 200),
    ''
  );
  NEW.metadata := security.redact_jsonb(COALESCE(NEW.metadata, '{}'::JSONB));
  NEW.received_at := clock_timestamp();

  IF NEW.integrity_version >= 2 AND (
    NEW.acknowledgement_validated IS DISTINCT FROM true
    OR NEW.payload_sha256 !~ '^[0-9a-f]{64}$'
    OR NEW.receipt_signature !~ '^[0-9a-f]{64}$'
    OR NEW.acknowledged_at IS NULL
    OR char_length(COALESCE(NEW.acknowledgement_key_id, '')) NOT BETWEEN 3 AND 80
    OR char_length(COALESCE(NEW.acknowledgement_nonce, '')) NOT BETWEEN 16 AND 200
  ) THEN
    RAISE EXCEPTION 'Validated receiver acknowledgement required';
  END IF;

  NEW.receipt_hash := security.calculate_anchor_receipt_hash(NEW);
  RETURN NEW;
END;
$function$;

-- The legacy RPC accepted an outbound request HMAC as if it were a receipt.
-- Keep the signature for an explicit compatibility error, but remove every
-- application grant so old workers fail closed.
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
BEGIN
  RAISE EXCEPTION 'RECEIVER_ACKNOWLEDGEMENT_REQUIRED';
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_security_anchor_receipt_v2(
  p_anchor_hash TEXT,
  p_provider TEXT,
  p_external_reference TEXT,
  p_payload_sha256 TEXT,
  p_acknowledged_at TIMESTAMPTZ,
  p_acknowledgement_key_id TEXT,
  p_acknowledgement_nonce TEXT,
  p_receipt_signature TEXT,
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

  IF COALESCE(p_payload_sha256, '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(p_receipt_signature, '') !~ '^[0-9a-f]{64}$'
     OR char_length(trim(COALESCE(p_acknowledgement_key_id, ''))) NOT BETWEEN 3 AND 80
     OR trim(COALESCE(p_acknowledgement_nonce, '')) !~ '^[A-Za-z0-9._:-]{16,200}$'
     OR p_acknowledged_at IS NULL
     OR abs(extract(epoch FROM (clock_timestamp() - p_acknowledged_at))) > 900 THEN
    RAISE EXCEPTION 'Receiver acknowledgement is invalid or stale';
  END IF;

  INSERT INTO security.event_anchor_receipts (
    anchor_hash,
    provider,
    external_reference,
    receipt_signature,
    metadata,
    receipt_hash,
    integrity_version,
    payload_sha256,
    acknowledged_at,
    acknowledgement_key_id,
    acknowledgement_nonce,
    acknowledgement_validated
  ) VALUES (
    p_anchor_hash,
    p_provider,
    p_external_reference,
    lower(p_receipt_signature),
    COALESCE(p_metadata, '{}'::JSONB),
    repeat('0', 64),
    2,
    lower(p_payload_sha256),
    p_acknowledged_at,
    trim(p_acknowledgement_key_id),
    trim(p_acknowledgement_nonce),
    true
  )
  ON CONFLICT (provider, external_reference) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT r.id, r.anchor_hash
    INTO v_id, v_existing_anchor_hash
    FROM security.event_anchor_receipts r
    WHERE r.provider = lower(trim(p_provider))
      AND r.external_reference = trim(p_external_reference)
      AND r.acknowledgement_validated = true
      AND r.payload_sha256 = lower(p_payload_sha256)
      AND r.receipt_signature = lower(p_receipt_signature);

    IF v_id IS NULL OR v_existing_anchor_hash IS DISTINCT FROM p_anchor_hash THEN
      RAISE EXCEPTION 'External receipt reference does not match this acknowledgement';
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Full ledger/anchor/receipt verification
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_verify_security_event_chain(
  p_limit INTEGER DEFAULT 50000
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_min_sequence BIGINT;
  v_max_sequence BIGINT;
  v_total_events BIGINT := 0;
  v_event_invalid BIGINT := 0;
  v_first_event_invalid BIGINT;
  v_anchor_checked BIGINT := 0;
  v_anchor_invalid BIGINT := 0;
  v_first_invalid_anchor DATE;
  v_previous_anchor_hash TEXT := 'GENESIS';
  v_previous_anchor_date DATE;
  v_latest_cutoff TIMESTAMPTZ;
  v_unanchored_count BIGINT := 0;
  v_historical_unanchored_count BIGINT := 0;
  v_first_historical_unanchored BIGINT;
  v_membership_hash TEXT;
  v_range_count BIGINT;
  v_range_first_sequence BIGINT;
  v_range_last_sequence BIGINT;
  v_range_last_hash TEXT;
  v_range_row_invalid BIGINT;
  v_membership_row_invalid BIGINT;
  v_membership_count BIGINT;
  v_min_ordinal BIGINT;
  v_max_ordinal BIGINT;
  v_expected_anchor_hash TEXT;
  v_anchor_bad BOOLEAN;
  v_anchor security.event_chain_anchors%ROWTYPE;
  v_event RECORD;
  v_receipt_invalid BIGINT := 0;
  v_first_invalid_receipt TEXT;
  v_anchor_state security.event_anchor_chain_state%ROWTYPE;
  v_actual_anchor_count BIGINT := 0;
  v_actual_anchor_head TEXT := 'GENESIS';
  v_actual_anchor_date DATE;
  v_actual_anchor_cutoff TIMESTAMPTZ;
  v_anchor_state_invalid BIGINT := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  WITH checked AS (
    SELECT
      e.sequence_number,
      e.event_hash,
      security.calculate_event_hash(e) AS calculated_hash
    FROM security.event_ledger e
  )
  SELECT
    count(*),
    min(sequence_number),
    max(sequence_number),
    count(*) FILTER (WHERE event_hash IS DISTINCT FROM calculated_hash),
    min(sequence_number) FILTER (WHERE event_hash IS DISTINCT FROM calculated_hash)
  INTO
    v_total_events,
    v_min_sequence,
    v_max_sequence,
    v_event_invalid,
    v_first_event_invalid
  FROM checked;

  FOR v_anchor IN
    SELECT a.*
    FROM security.event_chain_anchors a
    ORDER BY a.anchor_date
  LOOP
    v_anchor_checked := v_anchor_checked + 1;
    v_anchor_bad := false;

    IF v_anchor.previous_anchor_hash IS DISTINCT FROM v_previous_anchor_hash
       OR (v_previous_anchor_date IS NOT NULL AND v_anchor.anchor_date <= v_previous_anchor_date)
       OR v_anchor.last_sequence < v_anchor.first_sequence THEN
      v_anchor_bad := true;
    END IF;

    IF v_anchor.integrity_version >= 3 THEN
      v_membership_hash := encode(
        extensions.digest('NUTRIO-EVENT-MEMBERSHIP-V3', 'sha256'),
        'hex'
      );
      v_range_count := 0;
      v_range_first_sequence := NULL;
      v_range_last_sequence := NULL;
      v_range_last_hash := NULL;
      v_range_row_invalid := 0;

      SELECT count(*), min(ordinal), max(ordinal)
      INTO v_membership_count, v_min_ordinal, v_max_ordinal
      FROM security.event_anchor_memberships m
      WHERE m.anchor_hash = v_anchor.anchor_hash;

      FOR v_event IN
        SELECT
          m.ordinal,
          m.event_id,
          m.event_sequence,
          m.event_hash_snapshot,
          e.sequence_number AS current_sequence,
          e.event_hash AS current_hash,
          security.calculate_event_hash(e) AS calculated_hash
        FROM security.event_anchor_memberships m
        JOIN security.event_ledger e ON e.id = m.event_id
        WHERE m.anchor_hash = v_anchor.anchor_hash
        ORDER BY m.ordinal
      LOOP
        v_range_count := v_range_count + 1;
        v_range_first_sequence := LEAST(
          COALESCE(v_range_first_sequence, v_event.current_sequence),
          v_event.current_sequence
        );
        v_range_last_sequence := GREATEST(
          COALESCE(v_range_last_sequence, v_event.current_sequence),
          v_event.current_sequence
        );

        IF v_event.event_sequence IS DISTINCT FROM v_event.current_sequence
           OR v_event.event_hash_snapshot IS DISTINCT FROM v_event.current_hash
           OR v_event.current_hash IS DISTINCT FROM v_event.calculated_hash THEN
          v_range_row_invalid := v_range_row_invalid + 1;
        END IF;

        v_membership_hash := encode(
          extensions.digest(
            convert_to(
              v_membership_hash || ':' ||
              v_event.ordinal::TEXT || ':' ||
              v_event.current_sequence::TEXT || ':' ||
              v_event.event_id::TEXT || ':' ||
              v_event.current_hash,
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        );
        v_range_last_hash := v_event.current_hash;
      END LOOP;

      v_expected_anchor_hash := security.calculate_anchor_hash_v3(
        v_anchor.anchor_date,
        v_anchor.cutoff_at,
        v_anchor.first_sequence,
        v_anchor.last_sequence,
        v_anchor.event_count,
        v_anchor.membership_hash,
        v_anchor.last_hash,
        v_anchor.previous_anchor_hash
      );

      IF v_membership_count IS DISTINCT FROM v_anchor.event_count
         OR v_range_count IS DISTINCT FROM v_anchor.event_count
         OR v_min_ordinal IS DISTINCT FROM 1
         OR v_max_ordinal IS DISTINCT FROM v_anchor.event_count
         OR v_range_first_sequence IS DISTINCT FROM v_anchor.first_sequence
         OR v_range_last_sequence IS DISTINCT FROM v_anchor.last_sequence
         OR v_membership_hash IS DISTINCT FROM v_anchor.membership_hash
         OR v_anchor.range_hash IS DISTINCT FROM v_anchor.membership_hash
         OR v_range_last_hash IS DISTINCT FROM v_anchor.last_hash
         OR v_range_row_invalid > 0
         OR v_anchor.anchor_hash IS DISTINCT FROM v_expected_anchor_hash THEN
        v_anchor_bad := true;
      END IF;
    ELSE
      v_membership_hash := encode(
        extensions.digest('NUTRIO-EVENT-RANGE-V2', 'sha256'),
        'hex'
      );
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
        v_membership_hash := encode(
          extensions.digest(
            convert_to(
              v_membership_hash || ':' ||
              v_event.sequence_number::TEXT || ':' ||
              v_event.event_hash,
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        );
        v_range_last_hash := v_event.event_hash;
      END LOOP;

      SELECT
        count(*),
        count(*) FILTER (
          WHERE m.event_sequence IS DISTINCT FROM e.sequence_number
             OR m.event_hash_snapshot IS DISTINCT FROM e.event_hash
        )
      INTO v_membership_count, v_membership_row_invalid
      FROM security.event_anchor_memberships m
      LEFT JOIN security.event_ledger e ON e.id = m.event_id
      WHERE m.anchor_hash = v_anchor.anchor_hash;

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

      IF v_range_count IS DISTINCT FROM v_anchor.event_count
         OR v_membership_count IS DISTINCT FROM v_anchor.event_count
         OR v_membership_hash IS DISTINCT FROM v_anchor.range_hash
         OR v_range_last_hash IS DISTINCT FROM v_anchor.last_hash
         OR v_range_row_invalid > 0
         OR v_membership_row_invalid > 0
         OR v_anchor.anchor_hash IS DISTINCT FROM v_expected_anchor_hash THEN
        v_anchor_bad := true;
      END IF;
    END IF;

    IF v_anchor_bad THEN
      v_anchor_invalid := v_anchor_invalid + 1;
      v_first_invalid_anchor := COALESCE(v_first_invalid_anchor, v_anchor.anchor_date);
    END IF;

    v_previous_anchor_hash := v_anchor.anchor_hash;
    v_previous_anchor_date := v_anchor.anchor_date;
    v_latest_cutoff := GREATEST(
      COALESCE(v_latest_cutoff, v_anchor.cutoff_at),
      v_anchor.cutoff_at
    );
  END LOOP;

  SELECT
    count(*),
    min(e.sequence_number)
  INTO v_unanchored_count, v_first_historical_unanchored
  FROM security.event_ledger e
  WHERE NOT EXISTS (
    SELECT 1
    FROM security.event_anchor_memberships m
    WHERE m.event_id = e.id
  );

  IF v_latest_cutoff IS NOT NULL THEN
    SELECT
      count(*),
      min(e.sequence_number)
    INTO v_historical_unanchored_count, v_first_historical_unanchored
    FROM security.event_ledger e
    WHERE e.received_at < v_latest_cutoff
      AND NOT EXISTS (
        SELECT 1
        FROM security.event_anchor_memberships m
        WHERE m.event_id = e.id
      );
  END IF;

  SELECT
    count(*),
    min(r.id::TEXT) FILTER (
      WHERE r.receipt_hash IS DISTINCT FROM security.calculate_anchor_receipt_hash(r)
         OR (
           r.integrity_version >= 2
           AND (
             r.acknowledgement_validated IS DISTINCT FROM true
             OR r.payload_sha256 !~ '^[0-9a-f]{64}$'
             OR r.receipt_signature !~ '^[0-9a-f]{64}$'
             OR r.acknowledged_at IS NULL
           )
         )
    ),
    count(*) FILTER (
      WHERE r.receipt_hash IS DISTINCT FROM security.calculate_anchor_receipt_hash(r)
         OR (
           r.integrity_version >= 2
           AND (
             r.acknowledgement_validated IS DISTINCT FROM true
             OR r.payload_sha256 !~ '^[0-9a-f]{64}$'
             OR r.receipt_signature !~ '^[0-9a-f]{64}$'
             OR r.acknowledged_at IS NULL
           )
         )
    )
  INTO v_membership_count, v_first_invalid_receipt, v_receipt_invalid
  FROM security.event_anchor_receipts r;

  SELECT *
  INTO v_anchor_state
  FROM security.event_anchor_chain_state
  WHERE singleton = true;

  SELECT count(*)
  INTO v_actual_anchor_count
  FROM security.event_chain_anchors;
  SELECT a.anchor_hash, a.anchor_date, a.cutoff_at
  INTO v_actual_anchor_head, v_actual_anchor_date, v_actual_anchor_cutoff
  FROM security.event_chain_anchors a
  ORDER BY a.anchor_date DESC
  LIMIT 1;
  v_actual_anchor_head := COALESCE(v_actual_anchor_head, 'GENESIS');

  IF v_anchor_state.singleton IS NULL
     OR v_anchor_state.anchor_count IS DISTINCT FROM v_actual_anchor_count
     OR v_anchor_state.head_anchor_hash IS DISTINCT FROM v_actual_anchor_head
     OR v_anchor_state.latest_anchor_date IS DISTINCT FROM v_actual_anchor_date
     OR v_anchor_state.latest_cutoff_at IS DISTINCT FROM v_actual_anchor_cutoff THEN
    v_anchor_state_invalid := 1;
  END IF;

  RETURN jsonb_build_object(
    'valid',
      v_event_invalid = 0
      AND v_anchor_invalid = 0
      AND v_anchor_state_invalid = 0
      AND v_historical_unanchored_count = 0
      AND v_receipt_invalid = 0,
    'complete', true,
    'verification_scope', 'full',
    'requested_limit', p_limit,
    'checked', v_total_events,
    'total_events', v_total_events,
    'invalid_count',
      v_event_invalid + v_anchor_invalid + v_anchor_state_invalid +
      v_historical_unanchored_count + v_receipt_invalid,
    'event_invalid_count', v_event_invalid,
    'anchor_invalid_count', v_anchor_invalid,
    'anchor_state_invalid_count', v_anchor_state_invalid,
    'receipt_invalid_count', v_receipt_invalid,
    'anchors_checked', v_anchor_checked,
    'anchor_ranges_checked', v_anchor_checked,
    'first_invalid_sequence', COALESCE(
      v_first_event_invalid,
      v_first_historical_unanchored
    ),
    'first_invalid_anchor', v_first_invalid_anchor,
    'first_invalid_receipt', v_first_invalid_receipt,
    'start_sequence', v_min_sequence,
    'end_sequence', v_max_sequence,
    'anchored_through_sequence', (
      SELECT max(m.event_sequence) FROM security.event_anchor_memberships m
    ),
    'unanchored_count', v_unanchored_count,
    'historical_unanchored_count', v_historical_unanchored_count,
    'coverage', CASE
      WHEN v_event_invalid > 0
        OR v_anchor_invalid > 0
        OR v_anchor_state_invalid > 0
        OR v_historical_unanchored_count > 0
        OR v_receipt_invalid > 0 THEN 'invalid'
      WHEN v_anchor_checked = 0 AND v_total_events = 0 THEN 'empty'
      WHEN v_anchor_checked = 0 THEN 'unanchored'
      WHEN v_unanchored_count > 0 THEN 'partially_anchored'
      ELSE 'fully_anchored'
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_security_overview(
  p_since TIMESTAMPTZ DEFAULT (now() - interval '24 hours')
)
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
            AND r.acknowledgement_validated = true
            AND r.integrity_version >= 2
        ),
        'legacy_receipt_count', (
          SELECT count(*)
          FROM security.event_anchor_receipts r
          WHERE r.anchor_hash = a.anchor_hash
            AND r.acknowledgement_validated = false
        ),
        'latest_receipt_at', (
          SELECT max(r.received_at)
          FROM security.event_anchor_receipts r
          WHERE r.anchor_hash = a.anchor_hash
            AND r.acknowledgement_validated = true
        ),
        'receipt_fresh', COALESCE((
          SELECT max(r.received_at) >= clock_timestamp() - interval '36 hours'
          FROM security.event_anchor_receipts r
          WHERE r.anchor_hash = a.anchor_hash
            AND r.acknowledgement_validated = true
        ), false),
        'anchor_fresh', a.created_at >= clock_timestamp() - interval '36 hours'
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

-- Preserve the broad posture implementation, then replace only its forensic
-- anchor check with a strict receiver-acknowledgement/freshness check.
ALTER FUNCTION public.admin_security_posture()
  RENAME TO admin_security_posture_legacy;

REVOKE ALL ON FUNCTION public.admin_security_posture_legacy()
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
  v_old_status TEXT;
  v_new_status TEXT;
  v_new_check JSONB;
  v_failures INTEGER;
  v_warnings INTEGER;
  v_latest_anchor security.event_chain_anchors%ROWTYPE;
  v_validated_receipts BIGINT := 0;
  v_legacy_receipts BIGINT := 0;
  v_latest_receipt_at TIMESTAMPTZ;
  v_unanchored_events BIGINT := 0;
  v_historical_unanchored BIGINT := 0;
  v_anchor_fresh BOOLEAN := false;
  v_receipt_fresh BOOLEAN := false;
BEGIN
  v_base := public.admin_security_posture_legacy();

  SELECT a.*
  INTO v_latest_anchor
  FROM security.event_chain_anchors a
  ORDER BY a.anchor_date DESC
  LIMIT 1;

  IF v_latest_anchor.anchor_date IS NOT NULL THEN
    SELECT
      count(*) FILTER (
        WHERE r.acknowledgement_validated = true
          AND r.integrity_version >= 2
      ),
      count(*) FILTER (WHERE r.acknowledgement_validated = false),
      max(r.received_at) FILTER (
        WHERE r.acknowledgement_validated = true
          AND r.integrity_version >= 2
      )
    INTO v_validated_receipts, v_legacy_receipts, v_latest_receipt_at
    FROM security.event_anchor_receipts r
    WHERE r.anchor_hash = v_latest_anchor.anchor_hash;

    v_anchor_fresh :=
      v_latest_anchor.created_at >= clock_timestamp() - interval '36 hours';
    v_receipt_fresh :=
      v_latest_receipt_at >= clock_timestamp() - interval '36 hours';

    SELECT count(*)
    INTO v_historical_unanchored
    FROM security.event_ledger e
    WHERE e.received_at < v_latest_anchor.cutoff_at
      AND NOT EXISTS (
        SELECT 1
        FROM security.event_anchor_memberships m
        WHERE m.event_id = e.id
      );
  END IF;

  SELECT count(*)
  INTO v_unanchored_events
  FROM security.event_ledger e
  WHERE NOT EXISTS (
    SELECT 1
    FROM security.event_anchor_memberships m
    WHERE m.event_id = e.id
  );

  SELECT check_item ->> 'status'
  INTO v_old_status
  FROM jsonb_array_elements(COALESCE(v_base -> 'checks', '[]'::JSONB))
    AS check_rows(check_item)
  WHERE check_item ->> 'id' = 'external_evidence_anchor'
  LIMIT 1;

  v_new_status := CASE
    WHEN v_latest_anchor.anchor_date IS NULL THEN 'warning'
    WHEN v_historical_unanchored > 0 THEN 'fail'
    WHEN v_validated_receipts = 0 THEN 'fail'
    WHEN NOT v_anchor_fresh OR NOT v_receipt_fresh THEN 'fail'
    WHEN v_unanchored_events > 5000 THEN 'warning'
    ELSE 'pass'
  END;

  v_new_check := jsonb_build_object(
    'id', 'external_evidence_anchor',
    'label', 'Off-site evidence anchor',
    'status', v_new_status,
    'count', v_unanchored_events,
    'summary', CASE
      WHEN v_latest_anchor.anchor_date IS NULL
        THEN 'No completed ledger anchor exists yet'
      WHEN v_historical_unanchored > 0
        THEN 'Committed historical events are outside every anchor'
      WHEN v_validated_receipts = 0
        THEN 'Latest anchor has no receiver-generated acknowledgement'
      WHEN NOT v_anchor_fresh
        THEN 'Latest evidence anchor is stale'
      WHEN NOT v_receipt_fresh
        THEN 'Latest receiver acknowledgement is stale'
      WHEN v_unanchored_events > 5000
        THEN 'A large recent event set awaits the next anchor'
      ELSE 'Latest anchor has a fresh, receiver-generated acknowledgement'
    END,
    'items', jsonb_build_array(jsonb_build_object(
      'latest_anchor', v_latest_anchor.anchor_date,
      'anchor_integrity_version', v_latest_anchor.integrity_version,
      'validated_receipts', v_validated_receipts,
      'legacy_unvalidated_receipts', v_legacy_receipts,
      'latest_receipt_at', v_latest_receipt_at,
      'anchor_fresh', v_anchor_fresh,
      'receipt_fresh', v_receipt_fresh,
      'historical_unanchored_events', v_historical_unanchored,
      'unanchored_events', v_unanchored_events
    ))
  );

  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN check_item ->> 'id' = 'external_evidence_anchor' THEN v_new_check
        ELSE check_item
      END
      ORDER BY ordinal
    ),
    jsonb_build_array(v_new_check)
  )
  INTO v_checks
  FROM jsonb_array_elements(COALESCE(v_base -> 'checks', '[]'::JSONB))
    WITH ORDINALITY AS check_rows(check_item, ordinal);

  IF v_old_status IS NULL THEN
    v_checks := COALESCE(v_checks, '[]'::JSONB) || jsonb_build_array(v_new_check);
  END IF;

  v_failures := COALESCE((v_base ->> 'failure_count')::INTEGER, 0)
    - CASE WHEN v_old_status = 'fail' THEN 1 ELSE 0 END
    + CASE WHEN v_new_status = 'fail' THEN 1 ELSE 0 END;
  v_warnings := COALESCE((v_base ->> 'warning_count')::INTEGER, 0)
    - CASE WHEN v_old_status = 'warning' THEN 1 ELSE 0 END
    + CASE WHEN v_new_status = 'warning' THEN 1 ELSE 0 END;

  RETURN v_base || jsonb_build_object(
    'generated_at', clock_timestamp(),
    'status', CASE
      WHEN v_failures > 0 THEN 'action_required'
      WHEN v_warnings > 0 THEN 'review'
      ELSE 'healthy'
    END,
    'failure_count', GREATEST(v_failures, 0),
    'warning_count', GREATEST(v_warnings, 0),
    'checks', v_checks
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Incident case chain-of-custody verification
-- ---------------------------------------------------------------------------

ALTER TABLE security.incidents
  ADD COLUMN IF NOT EXISTS timeline_entry_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timeline_head_hash TEXT NOT NULL DEFAULT 'GENESIS',
  ADD COLUMN IF NOT EXISTS evidence_link_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_manifest_hash TEXT NOT NULL DEFAULT
    encode(
      extensions.digest('NUTRIO-INCIDENT-EVIDENCE-MANIFEST-V1', 'sha256'),
      'hex'
    );

ALTER TABLE security.incidents
  DROP CONSTRAINT IF EXISTS security_incident_timeline_head_hash_format;
ALTER TABLE security.incidents
  ADD CONSTRAINT security_incident_timeline_head_hash_format CHECK (
    timeline_head_hash = 'GENESIS' OR timeline_head_hash ~ '^[0-9a-f]{64}$'
  );
ALTER TABLE security.incidents
  DROP CONSTRAINT IF EXISTS security_incident_evidence_manifest_hash_format;
ALTER TABLE security.incidents
  ADD CONSTRAINT security_incident_evidence_manifest_hash_format CHECK (
    evidence_manifest_hash ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE security.incident_event_links
  ADD COLUMN IF NOT EXISTS custody_sequence BIGINT GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN IF NOT EXISTS integrity_version SMALLINT NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS security_incident_event_links_custody_idx
  ON security.incident_event_links(custody_sequence);

CREATE OR REPLACE FUNCTION security.calculate_incident_timeline_hash(
  p_entry security.incident_timeline
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
          'id', p_entry.id,
          'incident_id', p_entry.incident_id,
          'action', p_entry.action,
          'note', p_entry.note,
          'actor_user_id', p_entry.actor_user_id,
          'metadata', p_entry.metadata,
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

CREATE OR REPLACE FUNCTION security.calculate_incident_link_hash(
  p_link security.incident_event_links
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT encode(
    extensions.digest(
      convert_to(
        CASE
          WHEN p_link.integrity_version >= 2 THEN
            jsonb_build_object(
              'integrity_version', p_link.integrity_version,
              'custody_sequence', p_link.custody_sequence,
              'id', p_link.id,
              'incident_id', p_link.incident_id,
              'event_id', p_link.event_id,
              'event_sequence', p_link.event_sequence,
              'event_hash_snapshot', p_link.event_hash_snapshot,
              'linked_by', p_link.linked_by,
              'note', p_link.note,
              'linked_at', to_char(
                p_link.linked_at AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
              )
            )::TEXT
          ELSE
            jsonb_build_object(
              'id', p_link.id,
              'incident_id', p_link.incident_id,
              'event_id', p_link.event_id,
              'event_sequence', p_link.event_sequence,
              'event_hash_snapshot', p_link.event_hash_snapshot,
              'linked_by', p_link.linked_by,
              'note', p_link.note,
              'linked_at', to_char(
                p_link.linked_at AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
              )
            )::TEXT
        END,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

CREATE OR REPLACE FUNCTION security.calculate_incident_evidence_manifest(
  p_incident_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT encode(
    extensions.digest(
      convert_to(
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'custody_sequence', l.custody_sequence,
                'link_hash', l.link_hash
              )
              ORDER BY l.custody_sequence
            )::TEXT
            FROM security.incident_event_links l
            WHERE l.incident_id = p_incident_id
          ),
          'NUTRIO-INCIDENT-EVIDENCE-MANIFEST-V1'
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
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
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Security evidence is append-only';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.incident_id::TEXT, 0));
  SELECT t.event_hash
  INTO v_previous
  FROM security.incident_timeline t
  WHERE t.incident_id = NEW.incident_id
  ORDER BY t.sequence_number DESC
  LIMIT 1;

  NEW.previous_hash := COALESCE(v_previous, 'GENESIS');
  NEW.metadata := security.redact_jsonb(COALESCE(NEW.metadata, '{}'::JSONB));
  NEW.event_hash := security.calculate_incident_timeline_hash(NEW);
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
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Security evidence is append-only';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.incident_id::TEXT, 1));
  SELECT e.sequence_number, e.event_hash
  INTO NEW.event_sequence, NEW.event_hash_snapshot
  FROM security.event_ledger e
  WHERE e.id = NEW.event_id;

  IF NEW.event_sequence IS NULL THEN
    RAISE EXCEPTION 'SECURITY_EVENT_NOT_FOUND';
  END IF;

  NEW.integrity_version := 2;
  NEW.link_hash := security.calculate_incident_link_hash(NEW);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.refresh_incident_timeline_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE security.incidents i
  SET timeline_entry_count = state.entry_count,
      timeline_head_hash = state.head_hash
  FROM (
    SELECT
      count(*) AS entry_count,
      COALESCE((
        SELECT t.event_hash
        FROM security.incident_timeline t
        WHERE t.incident_id = NEW.incident_id
        ORDER BY t.sequence_number DESC
        LIMIT 1
      ), 'GENESIS') AS head_hash
    FROM security.incident_timeline t
    WHERE t.incident_id = NEW.incident_id
  ) state
  WHERE i.id = NEW.incident_id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION security.refresh_incident_evidence_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE security.incidents i
  SET evidence_link_count = (
        SELECT count(*)
        FROM security.incident_event_links l
        WHERE l.incident_id = NEW.incident_id
      ),
      evidence_manifest_hash = security.calculate_incident_evidence_manifest(
        NEW.incident_id
      )
  WHERE i.id = NEW.incident_id;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS security_incident_timeline_state_trigger
  ON security.incident_timeline;
CREATE TRIGGER security_incident_timeline_state_trigger
AFTER INSERT ON security.incident_timeline
FOR EACH ROW EXECUTE FUNCTION security.refresh_incident_timeline_state();

DROP TRIGGER IF EXISTS security_incident_evidence_state_trigger
  ON security.incident_event_links;
CREATE TRIGGER security_incident_evidence_state_trigger
AFTER INSERT ON security.incident_event_links
FOR EACH ROW EXECUTE FUNCTION security.refresh_incident_evidence_state();

UPDATE security.incidents i
SET timeline_entry_count = state.entry_count,
    timeline_head_hash = state.head_hash
FROM (
  SELECT
    i2.id AS incident_id,
    count(t.id) AS entry_count,
    COALESCE((
      SELECT t2.event_hash
      FROM security.incident_timeline t2
      WHERE t2.incident_id = i2.id
      ORDER BY t2.sequence_number DESC
      LIMIT 1
    ), 'GENESIS') AS head_hash
  FROM security.incidents i2
  LEFT JOIN security.incident_timeline t ON t.incident_id = i2.id
  GROUP BY i2.id
) state
WHERE i.id = state.incident_id;

UPDATE security.incidents i
SET evidence_link_count = state.link_count,
    evidence_manifest_hash = security.calculate_incident_evidence_manifest(i.id)
FROM (
  SELECT
    i2.id AS incident_id,
    count(l.id) AS link_count
  FROM security.incidents i2
  LEFT JOIN security.incident_event_links l ON l.incident_id = i2.id
  GROUP BY i2.id
) state
WHERE i.id = state.incident_id;

CREATE OR REPLACE FUNCTION public.admin_get_security_incident(
  p_incident_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_incident security.incidents%ROWTYPE;
  v_timeline JSONB := '[]'::JSONB;
  v_evidence JSONB := '[]'::JSONB;
  v_timeline_count BIGINT := 0;
  v_timeline_hash_invalid BIGINT := 0;
  v_timeline_chain_invalid BIGINT := 0;
  v_timeline_head TEXT := 'GENESIS';
  v_evidence_count BIGINT := 0;
  v_evidence_invalid BIGINT := 0;
  v_evidence_manifest TEXT;
  v_timeline_state_valid BOOLEAN;
  v_evidence_state_valid BOOLEAN;
BEGIN
  PERFORM security.require_admin_actor();

  SELECT *
  INTO v_incident
  FROM security.incidents i
  WHERE i.id = p_incident_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INCIDENT_NOT_FOUND';
  END IF;

  WITH ordered AS (
    SELECT
      t.*,
      security.calculate_incident_timeline_hash(t) AS calculated_event_hash,
      COALESCE(
        lag(t.event_hash) OVER (
          PARTITION BY t.incident_id ORDER BY t.sequence_number
        ),
        'GENESIS'
      ) AS expected_previous_hash
    FROM security.incident_timeline t
    WHERE t.incident_id = p_incident_id
  )
  SELECT
    COALESCE(
      jsonb_agg(
        to_jsonb(o) || jsonb_build_object(
          'hash_matches', o.event_hash = o.calculated_event_hash,
          'previous_hash_matches', o.previous_hash = o.expected_previous_hash
        )
        ORDER BY o.sequence_number
      ),
      '[]'::JSONB
    ),
    count(*),
    count(*) FILTER (
      WHERE o.event_hash IS DISTINCT FROM o.calculated_event_hash
    ),
    count(*) FILTER (
      WHERE o.previous_hash IS DISTINCT FROM o.expected_previous_hash
    )
  INTO
    v_timeline,
    v_timeline_count,
    v_timeline_hash_invalid,
    v_timeline_chain_invalid
  FROM ordered o;

  SELECT COALESCE(t.event_hash, 'GENESIS')
  INTO v_timeline_head
  FROM (
    SELECT 'GENESIS'::TEXT AS event_hash, 0::BIGINT AS sequence_number
    UNION ALL
    SELECT t.event_hash, t.sequence_number
    FROM security.incident_timeline t
    WHERE t.incident_id = p_incident_id
  ) t
  ORDER BY t.sequence_number DESC
  LIMIT 1;

  WITH evidence_rows AS (
    SELECT
      l.id AS link_id,
      l.custody_sequence,
      l.integrity_version AS link_integrity_version,
      l.event_id,
      l.event_sequence,
      l.event_hash_snapshot,
      l.linked_by,
      l.note,
      l.linked_at,
      l.link_hash,
      security.calculate_incident_link_hash(l) AS calculated_link_hash,
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
      security.calculate_event_hash(e) AS calculated_event_hash,
      l.link_hash = security.calculate_incident_link_hash(l)
        AS link_hash_matches,
      e.event_hash = l.event_hash_snapshot AS event_snapshot_matches,
      e.event_hash = security.calculate_event_hash(e) AS event_hash_matches
    FROM security.incident_event_links l
    JOIN security.event_ledger e ON e.id = l.event_id
    WHERE l.incident_id = p_incident_id
  )
  SELECT
    COALESCE(
      jsonb_agg(
        to_jsonb(er) || jsonb_build_object(
          'snapshot_matches',
            er.link_hash_matches
            AND er.event_snapshot_matches
            AND er.event_hash_matches
        )
        ORDER BY er.custody_sequence
      ),
      '[]'::JSONB
    ),
    count(*),
    count(*) FILTER (
      WHERE NOT er.link_hash_matches
         OR NOT er.event_snapshot_matches
         OR NOT er.event_hash_matches
    )
  INTO v_evidence, v_evidence_count, v_evidence_invalid
  FROM evidence_rows er;

  v_evidence_manifest := security.calculate_incident_evidence_manifest(
    p_incident_id
  );
  v_timeline_state_valid :=
    v_timeline_hash_invalid = 0
    AND v_timeline_chain_invalid = 0
    AND v_timeline_count = v_incident.timeline_entry_count
    AND v_timeline_head = v_incident.timeline_head_hash;
  v_evidence_state_valid :=
    v_evidence_invalid = 0
    AND v_evidence_count = v_incident.evidence_link_count
    AND v_evidence_manifest = v_incident.evidence_manifest_hash;

  RETURN jsonb_build_object(
    'incident', to_jsonb(v_incident),
    'timeline', v_timeline,
    'evidence', v_evidence,
    'integrity', jsonb_build_object(
      'valid', v_timeline_state_valid AND v_evidence_state_valid,
      'timeline_valid', v_timeline_state_valid,
      'evidence_valid', v_evidence_state_valid,
      'timeline_count', v_timeline_count,
      'expected_timeline_count', v_incident.timeline_entry_count,
      'timeline_hash_invalid_count', v_timeline_hash_invalid,
      'timeline_chain_invalid_count', v_timeline_chain_invalid,
      'evidence_count', v_evidence_count,
      'expected_evidence_count', v_incident.evidence_link_count,
      'evidence_invalid_count', v_evidence_invalid,
      'calculated_evidence_manifest', v_evidence_manifest,
      'stored_evidence_manifest', v_incident.evidence_manifest_hash
    )
  );
END;
$function$;

ALTER FUNCTION public.admin_update_security_incident(
  UUID,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  INTEGER
) RENAME TO admin_update_security_incident_legacy;

REVOKE ALL ON FUNCTION public.admin_update_security_incident_legacy(
  UUID,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  INTEGER
) FROM PUBLIC, anon, authenticated, service_role;

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
BEGIN
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'INCIDENT_EXPECTED_VERSION_REQUIRED';
  END IF;

  RETURN public.admin_update_security_incident_legacy(
    p_incident_id,
    p_status,
    p_severity,
    p_assigned_to,
    p_note,
    p_external_reference,
    p_expected_version
  );
END;
$function$;

ALTER FUNCTION public.admin_link_security_incident_event(UUID, UUID, TEXT)
  RENAME TO admin_link_security_incident_event_legacy;

REVOKE ALL ON FUNCTION public.admin_link_security_incident_event_legacy(
  UUID,
  UUID,
  TEXT
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_link_security_incident_event(
  p_incident_id UUID,
  p_event_id UUID,
  p_note TEXT DEFAULT NULL,
  p_expected_version INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := security.require_admin_actor();
  v_incident security.incidents%ROWTYPE;
  v_link UUID;
BEGIN
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'INCIDENT_EXPECTED_VERSION_REQUIRED';
  END IF;

  SELECT *
  INTO v_incident
  FROM security.incidents
  WHERE id = p_incident_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INCIDENT_NOT_FOUND';
  END IF;
  IF v_incident.version <> p_expected_version THEN
    RAISE EXCEPTION 'INCIDENT_VERSION_CONFLICT';
  END IF;

  v_link := security.link_incident_event(
    p_incident_id,
    p_event_id,
    v_actor,
    p_note
  );

  UPDATE security.incidents
  SET version = version + 1,
      updated_at = clock_timestamp()
  WHERE id = p_incident_id;

  PERFORM security.record_incident_audit(
    p_incident_id,
    v_actor,
    'evidence_linked',
    v_incident.severity,
    jsonb_build_object(
      'event_id', p_event_id,
      'link_id', v_link,
      'previous_version', p_expected_version,
      'version', p_expected_version + 1
    )
  );
  RETURN v_link;
END;
$function$;

ALTER FUNCTION public.admin_record_security_incident_export(UUID, TEXT, TEXT)
  RENAME TO admin_record_security_incident_export_client_hash_legacy;

REVOKE ALL ON FUNCTION public.admin_record_security_incident_export_client_hash_legacy(
  UUID,
  TEXT,
  TEXT
) FROM PUBLIC, anon, authenticated, service_role;

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
  v_timeline_id UUID;
BEGIN
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'INCIDENT_EXPECTED_VERSION_REQUIRED';
  END IF;

  SELECT *
  INTO v_incident
  FROM security.incidents
  WHERE id = p_incident_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INCIDENT_NOT_FOUND';
  END IF;
  IF v_incident.version <> p_expected_version THEN
    RAISE EXCEPTION 'INCIDENT_VERSION_CONFLICT';
  END IF;

  v_detail := public.admin_get_security_incident(p_incident_id);
  v_package := v_detail || jsonb_build_object(
    'manifest', jsonb_build_object(
      'product', 'Nutrio',
      'evidence_format', 'nutrio-security-incident-v2',
      'case_number', v_incident.case_number,
      'incident_version', v_incident.version,
      'generated_at', to_char(
        v_generated_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ),
      'truncated', false,
      'notice',
        'Technical identifiers support correlation but do not independently prove a person''s identity.',
      'custody',
        'Preserve this original file and its detached SHA-256 checksum without modification.'
    )
  );
  v_content := jsonb_pretty(v_package) || E'\n';
  v_byte_length := octet_length(convert_to(v_content, 'UTF8'));
  IF v_byte_length > 20971520 THEN
    RAISE EXCEPTION 'INCIDENT_EXPORT_TOO_LARGE';
  END IF;
  v_hash := encode(
    extensions.digest(convert_to(v_content, 'UTF8'), 'sha256'),
    'hex'
  );
  v_filename := left(v_incident.case_number, 120) || '-evidence.json';

  INSERT INTO security.incident_timeline (
    incident_id,
    action,
    note,
    actor_user_id,
    metadata
  ) VALUES (
    p_incident_id,
    'evidence_export_prepared',
    'Server-prepared incident evidence package',
    v_actor,
    jsonb_build_object(
      'format', 'json',
      'package_sha256', v_hash,
      'byte_length', v_byte_length,
      'filename', v_filename,
      'incident_version', v_incident.version,
      'integrity_valid', COALESCE(
        (v_detail -> 'integrity' ->> 'valid')::BOOLEAN,
        false
      )
    )
  )
  RETURNING id INTO v_timeline_id;

  UPDATE security.incidents
  SET version = version + 1,
      updated_at = clock_timestamp()
  WHERE id = p_incident_id;

  PERFORM security.record_incident_audit(
    p_incident_id,
    v_actor,
    'export_prepared',
    v_incident.severity,
    jsonb_build_object(
      'format', 'json',
      'timeline_id', v_timeline_id,
      'package_sha256', v_hash,
      'byte_length', v_byte_length,
      'filename', v_filename,
      'incident_version', v_incident.version,
      'integrity_valid', COALESCE(
        (v_detail -> 'integrity' ->> 'valid')::BOOLEAN,
        false
      )
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
    'current_version', v_incident.version + 1
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Server-prepared, byte-bound ledger exports
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION security.csv_evidence_cell(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_value TEXT := COALESCE(p_value, '');
BEGIN
  IF v_value ~ '^[=+\-@\t\r]' THEN
    v_value := '''' || v_value;
  END IF;
  RETURN '"' || replace(v_value, '"', '""') || '"';
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
BEGIN
  RAISE EXCEPTION 'SERVER_PREPARED_EXPORT_REQUIRED';
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_record_security_export(TEXT, INTEGER, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_prepare_security_export(
  p_format TEXT,
  p_filters JSONB DEFAULT '{}'::JSONB,
  p_limit INTEGER DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_format TEXT := lower(trim(COALESCE(p_format, '')));
  v_filters JSONB := COALESCE(p_filters, '{}'::JSONB);
  v_severity TEXT;
  v_category TEXT;
  v_outcome TEXT;
  v_search TEXT;
  v_from TIMESTAMPTZ;
  v_to TIMESTAMPTZ;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 5000);
  v_total_count BIGINT := 0;
  v_event_count BIGINT := 0;
  v_truncated BOOLEAN := false;
  v_events JSONB := '[]'::JSONB;
  v_integrity JSONB;
  v_content TEXT;
  v_rows TEXT;
  v_hash TEXT;
  v_byte_length BIGINT;
  v_generated_at TIMESTAMPTZ := clock_timestamp();
  v_filename TEXT;
  v_media_type TEXT;
  v_headers JSONB := '{}'::JSONB;
  v_ip INET;
  v_country_code TEXT;
  v_event_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF v_format NOT IN ('json', 'csv') THEN
    RAISE EXCEPTION 'Unsupported export format';
  END IF;
  IF jsonb_typeof(v_filters) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Export filters must be an object';
  END IF;

  v_severity := NULLIF(trim(v_filters ->> 'severity'), '');
  v_category := NULLIF(trim(v_filters ->> 'category'), '');
  v_outcome := NULLIF(trim(v_filters ->> 'outcome'), '');
  v_search := NULLIF(left(trim(v_filters ->> 'search'), 200), '');

  IF v_severity = 'all' THEN v_severity := NULL; END IF;
  IF v_category = 'all' THEN v_category := NULL; END IF;
  IF v_outcome = 'all' THEN v_outcome := NULL; END IF;

  IF v_severity IS NOT NULL AND v_severity NOT IN ('info', 'low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid export severity';
  END IF;
  IF v_outcome IS NOT NULL AND v_outcome NOT IN ('success', 'failure', 'blocked', 'denied', 'unknown') THEN
    RAISE EXCEPTION 'Invalid export outcome';
  END IF;

  BEGIN
    v_from := COALESCE(
      NULLIF(v_filters ->> 'from', '')::TIMESTAMPTZ,
      clock_timestamp() - interval '7 days'
    );
    v_to := COALESCE(
      NULLIF(v_filters ->> 'to', '')::TIMESTAMPTZ,
      clock_timestamp()
    );
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Invalid export date range';
  END;
  IF v_from > v_to THEN
    RAISE EXCEPTION 'Invalid export date range';
  END IF;

  -- Count and select the export rows in one statement snapshot. Both JSON and
  -- CSV are then rendered from v_events, so a concurrent commit cannot make
  -- the recorded count, truncation flag, and exported bytes disagree.
  WITH filtered AS MATERIALIZED (
    SELECT e.*
    FROM security.event_ledger e
    WHERE e.occurred_at >= v_from
      AND e.occurred_at <= v_to
      AND (v_severity IS NULL OR e.severity = v_severity)
      AND (v_category IS NULL OR e.category = v_category)
      AND (v_outcome IS NULL OR e.outcome = v_outcome)
      AND (
        v_search IS NULL
        OR e.event_type ILIKE '%' || v_search || '%'
        OR COALESCE(e.resource_type, '') ILIKE '%' || v_search || '%'
        OR COALESCE(e.resource_id, '') ILIKE '%' || v_search || '%'
        OR COALESCE(e.request_id, '') ILIKE '%' || v_search || '%'
        OR COALESCE(e.session_fingerprint, '') ILIKE '%' || v_search || '%'
        OR COALESCE(host(e.ip_address), '') ILIKE '%' || v_search || '%'
        OR COALESCE(e.actor_user_id::TEXT, '') ILIKE '%' || v_search || '%'
      )
  ), selected AS MATERIALIZED (
    SELECT f.*
    FROM filtered f
    ORDER BY f.occurred_at DESC, f.sequence_number DESC
    LIMIT v_limit
  )
  SELECT
    (SELECT count(*) FROM filtered),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'sequence_number', e.sequence_number,
          'event_id', e.id,
          'occurred_at', e.occurred_at,
          'received_at', e.received_at,
          'event_type', e.event_type,
          'category', e.category,
          'severity', e.severity,
          'source', e.source,
          'outcome', e.outcome,
          'actor_user_id', e.actor_user_id,
          'actor_role', e.actor_role,
          'actor_type', e.actor_type,
          'action', e.action,
          'resource_type', e.resource_type,
          'resource_id', e.resource_id,
          'request_id', e.request_id,
          'correlation_id', e.correlation_id,
          'session_fingerprint', e.session_fingerprint,
          'ip_address', host(e.ip_address),
          'country_code', e.country_code,
          'user_agent', e.user_agent,
          'metadata', e.metadata,
          'previous_hash', e.previous_hash,
          'event_hash', e.event_hash,
          'evidence_signature', e.evidence_signature,
          'signature_key_id', e.signature_key_id,
          'integrity_version', e.integrity_version
        )
        ORDER BY e.occurred_at DESC, e.sequence_number DESC
      ),
      '[]'::JSONB
    )
  INTO v_total_count, v_events
  FROM selected e;

  v_event_count := jsonb_array_length(v_events);
  v_truncated := v_event_count < v_total_count;
  v_integrity := public.admin_verify_security_event_chain(0);
  v_filename := 'nutrio-security-evidence-' ||
    to_char(v_generated_at AT TIME ZONE 'UTC', 'YYYYMMDD-HH24MISS') ||
    '.' || v_format;

  IF v_format = 'json' THEN
    v_content := jsonb_pretty(jsonb_build_object(
      'manifest', jsonb_build_object(
        'product', 'Nutrio',
        'evidence_format', 'nutrio-security-ledger-export-v3',
        'generated_at', to_char(
          v_generated_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        ),
        'filters', security.redact_jsonb(v_filters),
        'event_count', v_event_count,
        'total_matching_events', v_total_count,
        'truncated', v_truncated,
        'integrity', v_integrity,
        'notice',
          'Technical identifiers support correlation but do not independently prove a person''s identity.'
      ),
      'events', v_events
    )) || E'\n';
    v_media_type := 'application/json;charset=utf-8';
  ELSE
    SELECT string_agg(
      concat_ws(',',
        security.csv_evidence_cell(e.item ->> 'sequence_number'),
        security.csv_evidence_cell(e.item ->> 'event_id'),
        security.csv_evidence_cell(e.item ->> 'occurred_at'),
        security.csv_evidence_cell(e.item ->> 'received_at'),
        security.csv_evidence_cell(e.item ->> 'event_type'),
        security.csv_evidence_cell(e.item ->> 'category'),
        security.csv_evidence_cell(e.item ->> 'severity'),
        security.csv_evidence_cell(e.item ->> 'source'),
        security.csv_evidence_cell(e.item ->> 'outcome'),
        security.csv_evidence_cell(e.item ->> 'actor_user_id'),
        security.csv_evidence_cell(e.item ->> 'actor_role'),
        security.csv_evidence_cell(e.item ->> 'actor_type'),
        security.csv_evidence_cell(e.item ->> 'action'),
        security.csv_evidence_cell(e.item ->> 'resource_type'),
        security.csv_evidence_cell(e.item ->> 'resource_id'),
        security.csv_evidence_cell(e.item ->> 'request_id'),
        security.csv_evidence_cell(e.item ->> 'correlation_id'),
        security.csv_evidence_cell(e.item ->> 'session_fingerprint'),
        security.csv_evidence_cell(e.item ->> 'ip_address'),
        security.csv_evidence_cell(e.item ->> 'country_code'),
        security.csv_evidence_cell(e.item ->> 'user_agent'),
        security.csv_evidence_cell((e.item -> 'metadata')::TEXT),
        security.csv_evidence_cell(e.item ->> 'previous_hash'),
        security.csv_evidence_cell(e.item ->> 'event_hash'),
        security.csv_evidence_cell(e.item ->> 'evidence_signature'),
        security.csv_evidence_cell(e.item ->> 'signature_key_id'),
        security.csv_evidence_cell(e.item ->> 'integrity_version')
      ),
      E'\r\n'
      ORDER BY e.ordinality
    )
    INTO v_rows
    FROM jsonb_array_elements(v_events) WITH ORDINALITY AS e(item, ordinality);

    v_content := chr(65279) ||
      'sequence_number,event_id,occurred_at,received_at,event_type,category,severity,source,outcome,actor_user_id,actor_role,actor_type,action,resource_type,resource_id,request_id,correlation_id,session_fingerprint,ip_address,country_code,user_agent,metadata,previous_hash,event_hash,evidence_signature,signature_key_id,integrity_version' ||
      CASE WHEN COALESCE(v_rows, '') = '' THEN E'\r\n' ELSE E'\r\n' || v_rows || E'\r\n' END;
    v_media_type := 'text/csv;charset=utf-8';
  END IF;

  v_byte_length := octet_length(convert_to(v_content, 'UTF8'));
  IF v_byte_length > 20971520 THEN
    RAISE EXCEPTION 'SECURITY_EXPORT_TOO_LARGE_NARROW_FILTERS';
  END IF;
  v_hash := encode(
    extensions.digest(convert_to(v_content, 'UTF8'), 'sha256'),
    'hex'
  );

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
  v_country_code := upper(trim(COALESCE(v_headers ->> 'cf-ipcountry', '')));
  IF v_country_code !~ '^[A-Z]{2}$' THEN v_country_code := NULL; END IF;

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
    'admin.security_events.export_prepared',
    'admin',
    'medium',
    'database',
    'success',
    v_actor,
    'admin',
    'admin',
    'prepare_export',
    'security.event_ledger',
    v_hash,
    COALESCE(v_headers ->> 'sb-request-id', v_headers ->> 'x-request-id'),
    v_headers ->> 'x-correlation-id',
    CASE
      WHEN NULLIF(auth.jwt() ->> 'session_id', '') IS NULL THEN NULL
      ELSE 'session:' || (auth.jwt() ->> 'session_id')
    END,
    v_ip,
    v_country_code,
    v_headers ->> 'user-agent',
    jsonb_build_object(
      'format', v_format,
      'filename', v_filename,
      'package_sha256', v_hash,
      'byte_length', v_byte_length,
      'event_count', v_event_count,
      'total_matching_events', v_total_count,
      'truncated', v_truncated,
      'filters', security.redact_jsonb(v_filters),
      'integrity_valid', COALESCE((v_integrity ->> 'valid')::BOOLEAN, false),
      'verification_scope', v_integrity ->> 'verification_scope'
    ),
    repeat('0', 64)
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'content', v_content,
    'sha256', v_hash,
    'byte_length', v_byte_length,
    'filename', v_filename,
    'media_type', v_media_type,
    'format', v_format,
    'event_count', v_event_count,
    'total_count', v_total_count,
    'truncated', v_truncated,
    'integrity', v_integrity,
    'export_event_id', v_event_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION security.calculate_anchor_hash_v3(
  DATE,
  TIMESTAMPTZ,
  BIGINT,
  BIGINT,
  BIGINT,
  TEXT,
  TEXT,
  TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.calculate_anchor_receipt_hash(
  security.event_anchor_receipts
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.refresh_event_anchor_chain_state()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.calculate_incident_timeline_hash(
  security.incident_timeline
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.calculate_incident_link_hash(
  security.incident_event_links
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.calculate_incident_evidence_manifest(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.refresh_incident_timeline_state()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.refresh_incident_evidence_state()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.csv_evidence_cell(TEXT)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.record_security_anchor_receipt(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_security_anchor_receipt_v2(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_security_anchor_receipt_v2(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.admin_verify_security_event_chain(INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_security_overview(TIMESTAMPTZ)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_security_posture()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_security_incident(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_security_incident(
  UUID,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  INTEGER
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_link_security_incident_event(
  UUID,
  UUID,
  TEXT,
  INTEGER
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_prepare_security_incident_export(UUID, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_prepare_security_export(TEXT, JSONB, INTEGER)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_verify_security_event_chain(INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_security_overview(TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_security_posture()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_security_incident(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_security_incident(
  UUID,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  INTEGER
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_security_incident_event(
  UUID,
  UUID,
  TEXT,
  INTEGER
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_security_incident_export(UUID, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_security_export(TEXT, JSONB, INTEGER)
  TO authenticated;

COMMENT ON TABLE security.event_anchor_memberships IS
  'Immutable explicit membership for every event covered by a forensic anchor; supports out-of-order transaction commits.';
COMMENT ON TABLE security.event_anchor_chain_state IS
  'Locally retained anchor count/head checkpoint used to detect removal of the final anchor; compare with the independent receiver for external assurance.';
COMMENT ON FUNCTION public.admin_verify_security_event_chain(INTEGER) IS
  'Admin-only full verification of every event seal, anchor range, membership, receiver receipt, and historical coverage. The integer is retained for API compatibility and never limits verification.';
COMMENT ON FUNCTION public.record_security_anchor_receipt_v2(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) IS
  'Records only an acknowledgement already authenticated as receiver-generated by the security-log-maintenance Edge Function.';
COMMENT ON FUNCTION public.admin_prepare_security_export(TEXT, JSONB, INTEGER) IS
  'Prepares canonical evidence bytes server-side, records their SHA-256 and truncation state, and returns exactly those bytes.';
COMMENT ON FUNCTION public.admin_prepare_security_incident_export(UUID, INTEGER) IS
  'Prepares a version-pinned incident evidence package server-side and records its exact SHA-256 and byte length.';

NOTIFY pgrst, 'reload schema';

COMMIT;
