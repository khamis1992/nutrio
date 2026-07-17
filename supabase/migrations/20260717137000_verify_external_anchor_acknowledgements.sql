-- Verify off-site anchor acknowledgements independently inside PostgreSQL.
-- The Edge Function performs the first verification; this migration prevents
-- a stolen service-role credential from fabricating a validated receipt by
-- calling the receipt RPC directly.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS security;

CREATE OR REPLACE FUNCTION security.get_anchor_acknowledgement_hmac_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_key TEXT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Supabase Vault is required for security anchor acknowledgements';
  END IF;

  EXECUTE
    'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
  INTO v_key
  USING 'security_anchor_ack_hmac_key';

  IF v_key IS NULL OR octet_length(v_key) < 32 THEN
    RAISE EXCEPTION 'Security anchor acknowledgement key is not configured in Vault';
  END IF;

  RETURN v_key;
END;
$function$;

-- Keep the old signature only so stale workers fail closed with an explicit
-- error. It must never be granted to service_role again.
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
BEGIN
  RAISE EXCEPTION 'DATABASE_VERIFIED_RECEIVER_ACKNOWLEDGEMENT_REQUIRED';
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_security_anchor_receipt_v3(
  p_protocol TEXT,
  p_anchor_hash TEXT,
  p_previous_anchor_hash TEXT,
  p_provider TEXT,
  p_external_reference TEXT,
  p_payload_sha256 TEXT,
  p_acknowledged_at_text TEXT,
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
  v_anchor security.event_chain_anchors%ROWTYPE;
  v_acknowledged_at TIMESTAMPTZ;
  v_canonical_payload TEXT;
  v_expected_signature TEXT;
  v_existing_anchor_hash TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_protocol IS DISTINCT FROM 'nutrio-security-anchor-ack-v1' THEN
    RAISE EXCEPTION 'Receiver acknowledgement protocol is invalid';
  END IF;

  SELECT a.*
  INTO v_anchor
  FROM security.event_chain_anchors a
  WHERE a.anchor_hash = lower(trim(COALESCE(p_anchor_hash, '')));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown security anchor';
  END IF;

  IF v_anchor.previous_anchor_hash IS DISTINCT FROM p_previous_anchor_hash THEN
    RAISE EXCEPTION 'Receiver acknowledgement has the wrong previous anchor';
  END IF;

  IF COALESCE(p_payload_sha256, '') !~ '^[0-9a-f]{64}$'
     OR COALESCE(p_receipt_signature, '') !~ '^[0-9a-f]{64}$'
     OR trim(COALESCE(p_provider, '')) !~ '^[A-Za-z0-9.-]{2,80}$'
     OR char_length(trim(COALESCE(p_external_reference, ''))) NOT BETWEEN 3 AND 500
     OR p_external_reference ~ '[[:cntrl:]]'
     OR char_length(trim(COALESCE(p_acknowledgement_key_id, ''))) NOT BETWEEN 3 AND 80
     OR trim(COALESCE(p_acknowledgement_key_id, '')) !~ '^[A-Za-z0-9._:-]+$'
     OR trim(COALESCE(p_acknowledgement_nonce, '')) !~ '^[A-Za-z0-9._:-]{16,200}$'
     OR COALESCE(p_acknowledged_at_text, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$'
     OR jsonb_typeof(COALESCE(p_metadata, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'Receiver acknowledgement is malformed';
  END IF;

  BEGIN
    v_acknowledged_at := p_acknowledged_at_text::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Receiver acknowledgement timestamp is invalid';
  END;

  IF abs(extract(epoch FROM (clock_timestamp() - v_acknowledged_at))) > 900 THEN
    RAISE EXCEPTION 'Receiver acknowledgement is stale';
  END IF;

  v_canonical_payload := concat_ws(
    E'\n',
    p_protocol,
    v_anchor.anchor_hash,
    lower(p_payload_sha256),
    v_anchor.previous_anchor_hash,
    p_external_reference,
    p_acknowledged_at_text,
    trim(p_acknowledgement_nonce),
    trim(p_acknowledgement_key_id)
  );

  v_expected_signature := encode(
    extensions.hmac(
      convert_to(v_canonical_payload, 'UTF8'),
      convert_to(security.get_anchor_acknowledgement_hmac_key(), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  IF v_expected_signature IS DISTINCT FROM lower(p_receipt_signature) THEN
    RAISE EXCEPTION 'Receiver acknowledgement signature is invalid';
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
    v_anchor.anchor_hash,
    lower(trim(p_provider)),
    trim(p_external_reference),
    lower(p_receipt_signature),
    COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object(
      'acknowledgement_protocol', p_protocol,
      'acknowledged_previous_anchor_hash', v_anchor.previous_anchor_hash,
      'database_signature_verified', true
    ),
    repeat('0', 64),
    3,
    lower(p_payload_sha256),
    v_acknowledged_at,
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
      AND r.integrity_version = 3
      AND r.acknowledgement_validated = true
      AND r.payload_sha256 = lower(p_payload_sha256)
      AND r.acknowledgement_key_id = trim(p_acknowledgement_key_id)
      AND r.acknowledgement_nonce = trim(p_acknowledgement_nonce)
      AND r.receipt_signature = lower(p_receipt_signature);

    IF v_id IS NULL OR v_existing_anchor_hash IS DISTINCT FROM v_anchor.anchor_hash THEN
      RAISE EXCEPTION 'External receipt reference does not match this acknowledgement';
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION security.get_anchor_acknowledgement_hmac_key()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_security_anchor_receipt_v2(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_security_anchor_receipt_v3(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_security_anchor_receipt_v3(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;

COMMENT ON FUNCTION public.record_security_anchor_receipt_v3(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) IS 'Stores an off-site receipt only after PostgreSQL independently verifies its HMAC with a Vault-held receiver key.';

COMMIT;
