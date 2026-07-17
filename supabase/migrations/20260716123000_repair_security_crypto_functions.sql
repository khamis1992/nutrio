-- Repair security functions reported by plpgsql_check and remove plaintext
-- banking-key storage. Apply only after verifying Supabase Vault is enabled.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS security;

-- Move an existing non-placeholder banking key into Vault before removing the
-- legacy plaintext copy. The migration stops rather than losing the key.
DO $do$
DECLARE
  v_legacy_key TEXT;
  v_vault_key TEXT;
BEGIN
  IF to_regclass('security.encryption_config') IS NOT NULL THEN
    SELECT key_value
    INTO v_legacy_key
    FROM security.encryption_config
    WHERE key_name = 'banking_data_key'
    LIMIT 1;
  END IF;

  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
    INTO v_vault_key
    USING 'banking_data_key';
  END IF;

  IF v_legacy_key IS NOT NULL
     AND v_legacy_key <> 'YOUR_SECURE_32_BYTE_KEY_HERE' THEN
    IF v_vault_key IS NULL THEN
      IF to_regprocedure('vault.create_secret(text,text,text)') IS NULL THEN
        RAISE EXCEPTION 'Vault must be enabled before migrating the banking encryption key';
      END IF;

      EXECUTE 'SELECT vault.create_secret($1, $2, $3)'
      USING v_legacy_key, 'banking_data_key', 'Nutrio banking field encryption key';

      EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
      INTO v_vault_key
      USING 'banking_data_key';
    END IF;

    IF v_vault_key IS DISTINCT FROM v_legacy_key THEN
      RAISE EXCEPTION 'Vault banking key differs from the legacy key; manual rotation is required';
    END IF;
  END IF;

  IF to_regclass('security.encryption_config') IS NOT NULL THEN
    IF v_vault_key IS NOT NULL OR v_legacy_key = 'YOUR_SECURE_32_BYTE_KEY_HERE' THEN
      DELETE FROM security.encryption_config WHERE key_name = 'banking_data_key';
    END IF;
  END IF;
END;
$do$;

CREATE OR REPLACE FUNCTION security.get_banking_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO security, public, vault, pg_temp
AS $function$
DECLARE
  v_key TEXT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 ORDER BY created_at DESC LIMIT 1'
    INTO v_key
    USING 'banking_data_key';
  END IF;

  IF v_key IS NULL OR char_length(v_key) < 32 THEN
    RAISE EXCEPTION 'Banking encryption key is not configured in Vault';
  END IF;

  RETURN v_key;
END;
$function$;

CREATE OR REPLACE FUNCTION security.encrypt_sensitive_data(plain_text TEXT)
RETURNS BYTEA
LANGUAGE sql
STRICT
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
  SELECT extensions.pgp_sym_encrypt(
    plain_text,
    security.get_banking_encryption_key(),
    'cipher-algo=aes256'
  );
$function$;

CREATE OR REPLACE FUNCTION security.decrypt_sensitive_data(encrypted_data BYTEA)
RETURNS TEXT
LANGUAGE sql
STRICT
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
  SELECT extensions.pgp_sym_decrypt(
    encrypted_data,
    security.get_banking_encryption_key()
  );
$function$;

-- Encrypt any remaining legacy values, then remove plaintext copies.
UPDATE public.restaurant_details
SET
  bank_account_number_encrypted = COALESCE(
    bank_account_number_encrypted,
    security.encrypt_sensitive_data(bank_account_number)
  ),
  bank_iban_encrypted = COALESCE(
    bank_iban_encrypted,
    security.encrypt_sensitive_data(bank_iban)
  ),
  bank_swift_encrypted = COALESCE(
    bank_swift_encrypted,
    security.encrypt_sensitive_data(swift_code)
  ),
  bank_name_encrypted = COALESCE(
    bank_name_encrypted,
    security.encrypt_sensitive_data(bank_name)
  )
WHERE bank_account_number IS NOT NULL
   OR bank_iban IS NOT NULL
   OR swift_code IS NOT NULL
   OR bank_name IS NOT NULL;

UPDATE public.restaurant_details
SET bank_account_number = NULL,
    bank_iban = NULL,
    swift_code = NULL,
    bank_name = NULL
WHERE bank_account_number_encrypted IS NOT NULL
   OR bank_iban_encrypted IS NOT NULL
   OR bank_swift_encrypted IS NOT NULL
   OR bank_name_encrypted IS NOT NULL;

CREATE OR REPLACE FUNCTION security.get_restaurant_banking_value(
  p_details_id UUID,
  p_field TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_restaurant_id UUID;
  v_encrypted BYTEA;
BEGIN
  IF p_field NOT IN ('account_number', 'iban', 'swift', 'bank_name') THEN
    RAISE EXCEPTION 'Unsupported banking field';
  END IF;

  SELECT
    rd.restaurant_id,
    CASE p_field
      WHEN 'account_number' THEN rd.bank_account_number_encrypted
      WHEN 'iban' THEN rd.bank_iban_encrypted
      WHEN 'swift' THEN rd.bank_swift_encrypted
      WHEN 'bank_name' THEN rd.bank_name_encrypted
    END
  INTO v_restaurant_id, v_encrypted
  FROM public.restaurant_details rd
  WHERE rd.id = p_details_id;

  IF v_restaurant_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (
       auth.uid() IS NULL
       OR NOT (
         public.has_role(auth.uid(), 'admin'::public.app_role)
         OR EXISTS (
           SELECT 1
           FROM public.restaurants r
           WHERE r.id = v_restaurant_id
             AND r.owner_id = auth.uid()
         )
       )
     ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN security.decrypt_sensitive_data(v_encrypted);
END;
$function$;

CREATE OR REPLACE VIEW public.restaurant_details_secure
WITH (security_invoker = true)
AS
SELECT
  rd.id,
  rd.restaurant_id,
  rd.cuisine_type,
  rd.dietary_tags,
  rd.alternate_phone,
  rd.website_url,
  rd.operating_hours,
  rd.avg_prep_time_minutes,
  rd.max_meals_per_day,
  security.get_restaurant_banking_value(rd.id, 'account_number') AS bank_account_number,
  security.get_restaurant_banking_value(rd.id, 'iban') AS bank_iban,
  security.get_restaurant_banking_value(rd.id, 'swift') AS swift_code,
  security.get_restaurant_banking_value(rd.id, 'bank_name') AS bank_name,
  rd.onboarding_step,
  rd.onboarding_completed,
  rd.terms_accepted,
  rd.terms_accepted_at,
  rd.created_at,
  rd.updated_at
FROM public.restaurant_details rd;

CREATE OR REPLACE FUNCTION public.update_restaurant_banking_info(
  p_restaurant_id UUID,
  p_bank_name TEXT,
  p_bank_account_number TEXT,
  p_bank_iban TEXT,
  p_swift_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1
       FROM public.restaurants r
       WHERE r.id = p_restaurant_id
         AND (
           r.owner_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::public.app_role)
         )
     ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF char_length(trim(COALESCE(p_bank_name, ''))) NOT BETWEEN 2 AND 120
     OR char_length(trim(COALESCE(p_bank_account_number, ''))) NOT BETWEEN 4 AND 80
     OR char_length(trim(COALESCE(p_bank_iban, ''))) NOT BETWEEN 10 AND 64
     OR char_length(trim(COALESCE(p_swift_code, ''))) NOT BETWEEN 8 AND 16 THEN
    RAISE EXCEPTION 'Invalid banking details';
  END IF;

  UPDATE public.restaurant_details
  SET bank_name_encrypted = security.encrypt_sensitive_data(trim(p_bank_name)),
      bank_account_number_encrypted = security.encrypt_sensitive_data(trim(p_bank_account_number)),
      bank_iban_encrypted = security.encrypt_sensitive_data(upper(replace(p_bank_iban, ' ', ''))),
      bank_swift_encrypted = security.encrypt_sensitive_data(upper(replace(p_swift_code, ' ', ''))),
      bank_name = NULL,
      bank_account_number = NULL,
      bank_iban = NULL,
      swift_code = NULL,
      updated_at = clock_timestamp()
  WHERE restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant details not found';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION security.hash_api_secret(plain_secret TEXT)
RETURNS TABLE(hash TEXT, salt TEXT)
LANGUAGE plpgsql
STRICT
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_salt TEXT := extensions.gen_salt('bf', 12);
BEGIN
  IF char_length(plain_secret) < 32 THEN
    RAISE EXCEPTION 'API secret is too short';
  END IF;

  RETURN QUERY
  SELECT extensions.crypt(plain_secret, v_salt), v_salt;
END;
$function$;

CREATE OR REPLACE FUNCTION security.verify_api_secret(
  plain_secret TEXT,
  stored_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
  SELECT plain_secret IS NOT NULL
     AND stored_hash IS NOT NULL
     AND stored_hash = extensions.crypt(plain_secret, stored_hash);
$function$;

-- Preserve existing integrations while eliminating any remaining plaintext
-- partner secret. The bcrypt hash remains compatible with verify_api_secret().
ALTER TABLE public.partners
  ALTER COLUMN api_secret DROP NOT NULL;

UPDATE public.partners
SET api_secret_hash = extensions.crypt(api_secret, extensions.gen_salt('bf', 12)),
    api_secret_salt = NULL,
    updated_at = clock_timestamp()
WHERE api_secret IS NOT NULL
  AND api_secret_hash IS NULL;

UPDATE public.partners
SET api_secret = NULL,
    updated_at = clock_timestamp()
WHERE api_secret IS NOT NULL
  AND api_secret_hash IS NOT NULL;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.partners'::regclass
      AND conname = 'partners_active_api_secret_hash_check'
  ) THEN
    ALTER TABLE public.partners
      ADD CONSTRAINT partners_active_api_secret_hash_check
      CHECK (status <> 'active' OR api_secret_hash IS NOT NULL) NOT VALID;
  END IF;
END;
$do$;

CREATE OR REPLACE FUNCTION public.authenticate_partner_api_request(
  p_api_key UUID,
  p_api_secret TEXT
)
RETURNS TABLE (
  partner_id UUID,
  name TEXT,
  permissions JSONB,
  rate_limit INTEGER,
  authenticated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_partner RECORD;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT p.id, p.name, p.permissions, p.rate_limit, p.api_secret_hash
  INTO v_partner
  FROM public.partners p
  WHERE p.api_key = p_api_key
    AND p.status = 'active'
  LIMIT 1;

  IF NOT FOUND
     OR char_length(COALESCE(p_api_secret, '')) NOT BETWEEN 32 AND 512
     OR security.verify_api_secret(p_api_secret, v_partner.api_secret_hash) IS NOT TRUE THEN
    IF v_partner.id IS NOT NULL THEN
      INSERT INTO security.api_auth_failures (
        partner_id, attempted_at, ip_address
      ) VALUES (
        v_partner.id, clock_timestamp(), inet_client_addr()
      );
    END IF;

    PERFORM security.record_event(
      p_event_type := 'partner.api_authentication_failed',
      p_category := 'authentication',
      p_severity := 'high',
      p_source := 'database',
      p_outcome := 'failure',
      p_actor_type := 'partner',
      p_action := 'authenticate_partner_api',
      p_resource_type := 'partner',
      p_resource_id := v_partner.id::TEXT,
      p_ip_address := inet_client_addr()::TEXT,
      p_metadata := jsonb_build_object('api_key_known', v_partner.id IS NOT NULL)
    );

    RETURN QUERY
    SELECT NULL::UUID, NULL::TEXT, NULL::JSONB, NULL::INTEGER, false;
    RETURN;
  END IF;

  UPDATE public.partners
  SET last_used_at = clock_timestamp()
  WHERE id = v_partner.id;

  RETURN QUERY
  SELECT
    v_partner.id::UUID,
    v_partner.name::TEXT,
    v_partner.permissions::JSONB,
    v_partner.rate_limit::INTEGER,
    true;
END;
$function$;

CREATE TABLE IF NOT EXISTS security.api_key_rotation_requests (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  requested_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS api_key_rotation_requests_one_pending
ON security.api_key_rotation_requests (partner_id)
WHERE status = 'pending';

ALTER TABLE security.api_key_rotation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.api_key_rotation_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE security.api_key_rotation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE security.api_key_rotation_requests TO service_role;

CREATE OR REPLACE FUNCTION public.generate_partner_api_credentials(p_partner_id UUID)
RETURNS TABLE(api_key UUID, plain_secret TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_api_key UUID := extensions.gen_random_uuid();
  v_secret TEXT := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash TEXT;
  v_salt TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  -- Serialize rotations for a partner so concurrent admin requests cannot
  -- return credentials that are immediately replaced by another transaction.
  PERFORM 1
  FROM public.partners p
  WHERE p.id = p_partner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner not found';
  END IF;

  SELECT result.hash, result.salt
  INTO v_hash, v_salt
  FROM security.hash_api_secret(v_secret) result;

  UPDATE public.partners
  SET api_key = v_api_key,
      api_secret_hash = v_hash,
      api_secret_salt = v_salt,
      api_key_prefix = substring(v_api_key::TEXT, 1, 8),
      api_secret = NULL,
      last_rotated_at = clock_timestamp(),
      rotation_due_at = clock_timestamp() + interval '90 days',
      updated_at = clock_timestamp()
  WHERE id = p_partner_id;

  INSERT INTO security.api_key_rotation_log (
    partner_id, rotated_at, auto_rotated
  ) VALUES (
    p_partner_id, clock_timestamp(), false
  );

  UPDATE security.api_key_rotation_requests
  SET status = 'completed',
      completed_at = clock_timestamp()
  WHERE partner_id = p_partner_id
    AND status = 'pending';

  PERFORM security.record_event(
    p_event_type := 'partner.api_credentials_rotated',
    p_category := 'configuration',
    p_severity := 'high',
    p_source := 'database',
    p_outcome := 'success',
    p_actor_type := 'service',
    p_action := 'rotate_partner_api_credentials',
    p_resource_type := 'partner',
    p_resource_id := p_partner_id::TEXT,
    p_metadata := jsonb_build_object('delivery', 'one_time_plain_secret')
  );

  RETURN QUERY SELECT v_api_key, v_secret;
END;
$function$;

-- Historical versions silently replaced a partner secret with a value that
-- was never delivered to the partner. Keep the public name for scheduler
-- compatibility, but queue coordinated rotations instead of breaking clients.
CREATE OR REPLACE FUNCTION public.auto_rotate_api_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_partner RECORD;
  v_inserted INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  FOR v_partner IN
    SELECT p.id, p.rotation_due_at
    FROM public.partners p
    WHERE p.rotation_due_at < clock_timestamp()
      AND p.status = 'active'
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO security.api_key_rotation_requests (
      partner_id, due_at, requested_by
    ) VALUES (
      v_partner.id, v_partner.rotation_due_at, 'scheduled_rotation_check'
    )
    ON CONFLICT (partner_id) WHERE status = 'pending' DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 1 THEN
      v_count := v_count + 1;
      PERFORM security.record_event(
        p_event_type := 'partner.api_rotation_due',
        p_category := 'configuration',
        p_severity := 'medium',
        p_source := 'database',
        p_outcome := 'success',
        p_actor_type := 'system',
        p_action := 'queue_partner_api_rotation',
        p_resource_type := 'partner',
        p_resource_id := v_partner.id::TEXT,
        p_metadata := jsonb_build_object(
          'rotation_due_at', v_partner.rotation_due_at,
          'requires_coordinated_delivery', true
        )
      );
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION rate_limit.get_status(p_limit_name TEXT DEFAULT NULL)
RETURNS TABLE (
  limit_name TEXT,
  identifier TEXT,
  current_count INTEGER,
  limit_value INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  is_blocked BOOLEAN,
  blocked_until TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path TO rate_limit, public, pg_temp
AS $function$
DECLARE
  v_identifier TEXT;
BEGIN
  v_identifier := COALESCE(auth.uid()::TEXT, NULLIF(current_setting('app.current_ip', true), ''), 'unknown');

  RETURN QUERY
  SELECT
    rt.limit_name,
    rt.identifier,
    rt.request_count,
    rc.requests_per_window,
    GREATEST(rc.requests_per_window - rt.request_count, 0),
    rt.window_start + make_interval(mins => rc.window_minutes),
    rt.blocked_until IS NOT NULL AND rt.blocked_until > clock_timestamp(),
    rt.blocked_until
  FROM rate_limit.tracking rt
  JOIN rate_limit.config rc ON rc.limit_name = rt.limit_name
  WHERE rt.identifier = v_identifier
    AND rt.window_start = (
      SELECT max(inner_rt.window_start)
      FROM rate_limit.tracking inner_rt
      WHERE inner_rt.limit_name = rt.limit_name
        AND inner_rt.identifier = v_identifier
    )
    AND (p_limit_name IS NULL OR rt.limit_name = p_limit_name)
  ORDER BY rt.limit_name;
END;
$function$;

CREATE OR REPLACE FUNCTION soft_delete.enable_for_table(
  p_table_name TEXT,
  p_schema TEXT DEFAULT 'public',
  p_retention_days INTEGER DEFAULT 90
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO soft_delete, public, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_schema <> 'public'
     OR to_regclass(format('%I.%I', p_schema, p_table_name)) IS NULL
     OR p_retention_days NOT BETWEEN 1 AND 3650 THEN
    RAISE EXCEPTION 'Invalid soft-delete configuration';
  END IF;

  EXECUTE format(
    'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ',
    p_schema,
    p_table_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I.%I (deleted_at) WHERE deleted_at IS NULL',
    'idx_' || p_table_name || '_deleted_at',
    p_schema,
    p_table_name
  );

  INSERT INTO soft_delete.metadata (table_name, retention_days)
  VALUES (p_table_name, p_retention_days)
  ON CONFLICT (table_name) DO UPDATE
  SET retention_days = EXCLUDED.retention_days;
END;
$function$;

REVOKE ALL ON TABLE security.encryption_config FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.get_banking_encryption_key() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.encrypt_sensitive_data(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.decrypt_sensitive_data(BYTEA) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.get_restaurant_banking_value(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION security.get_restaurant_banking_value(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION security.hash_api_secret(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.verify_api_secret(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION security.hash_api_secret(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION security.verify_api_secret(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.generate_partner_api_credentials(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_rotate_api_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_partner_api_credentials(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_rotate_api_keys() TO service_role;

REVOKE ALL ON FUNCTION soft_delete.enable_for_table(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION soft_delete.enable_for_table(TEXT, TEXT, INTEGER) TO service_role;

COMMIT;
