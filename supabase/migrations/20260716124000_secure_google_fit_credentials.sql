-- Keep third-party OAuth credentials server-side and encrypted at rest.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS security;

DO $do$
DECLARE
  v_key TEXT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL
     OR to_regprocedure('vault.create_secret(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Supabase Vault must be enabled before securing OAuth credentials';
  END IF;

  SELECT decrypted_secret
  INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_token_encryption_key'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_key IS NULL THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'oauth_token_encryption_key',
      'Nutrio third-party OAuth credential encryption key'
    );
  END IF;
END;
$do$;

CREATE OR REPLACE FUNCTION security.get_oauth_token_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO security, vault, public, pg_temp
AS $function$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret
  INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_token_encryption_key'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_key IS NULL OR char_length(v_key) < 32 THEN
    RAISE EXCEPTION 'OAuth token encryption key is unavailable';
  END IF;

  RETURN v_key;
END;
$function$;

CREATE OR REPLACE FUNCTION security.encrypt_oauth_token(p_value TEXT)
RETURNS BYTEA
LANGUAGE sql
STRICT
SECURITY DEFINER
SET search_path TO security, extensions, public, pg_temp
AS $function$
  SELECT extensions.pgp_sym_encrypt(
    p_value,
    security.get_oauth_token_encryption_key(),
    'cipher-algo=aes256'
  );
$function$;

CREATE OR REPLACE FUNCTION security.decrypt_oauth_token(p_value BYTEA)
RETURNS TEXT
LANGUAGE sql
STRICT
SECURITY DEFINER
SET search_path TO security, extensions, public, pg_temp
AS $function$
  SELECT extensions.pgp_sym_decrypt(
    p_value,
    security.get_oauth_token_encryption_key()
  );
$function$;

ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted BYTEA;

UPDATE public.user_integrations
SET access_token_encrypted = COALESCE(
      access_token_encrypted,
      security.encrypt_oauth_token(access_token)
    ),
    refresh_token_encrypted = COALESCE(
      refresh_token_encrypted,
      CASE
        WHEN refresh_token IS NOT NULL THEN security.encrypt_oauth_token(refresh_token)
        ELSE NULL
      END
    )
WHERE access_token IS NOT NULL;

ALTER TABLE public.user_integrations
  ALTER COLUMN access_token DROP NOT NULL;

UPDATE public.user_integrations
SET access_token = NULL,
    refresh_token = NULL,
    updated_at = clock_timestamp()
WHERE access_token_encrypted IS NOT NULL;

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own integrations" ON public.user_integrations;
DROP POLICY IF EXISTS "Users can insert own integrations" ON public.user_integrations;
DROP POLICY IF EXISTS "Users can update own integrations" ON public.user_integrations;
DROP POLICY IF EXISTS "Users can delete own integrations" ON public.user_integrations;

REVOKE ALL ON TABLE public.user_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_integrations TO service_role;

CREATE OR REPLACE FUNCTION public.get_google_fit_server_credentials(p_user_id UUID)
RETURNS TABLE (
  access_token TEXT,
  refresh_token TEXT,
  expires_at BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  RETURN QUERY
  SELECT
    security.decrypt_oauth_token(ui.access_token_encrypted),
    CASE
      WHEN ui.refresh_token_encrypted IS NOT NULL
        THEN security.decrypt_oauth_token(ui.refresh_token_encrypted)
      ELSE NULL
    END,
    ui.expires_at::BIGINT
  FROM public.user_integrations ui
  WHERE ui.user_id = p_user_id
    AND ui.provider = 'google_fit'
    AND ui.access_token_encrypted IS NOT NULL
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_google_fit_server_credentials(
  p_user_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_at BIGINT,
  p_scope TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_access_token IS NULL
     OR char_length(p_access_token) < 16
     OR p_expires_at <= extract(epoch FROM clock_timestamp())::BIGINT THEN
    RAISE EXCEPTION 'Invalid OAuth credential payload';
  END IF;

  INSERT INTO public.user_integrations (
    user_id,
    provider,
    access_token,
    refresh_token,
    access_token_encrypted,
    refresh_token_encrypted,
    expires_at,
    scope,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    'google_fit',
    NULL,
    NULL,
    security.encrypt_oauth_token(p_access_token),
    CASE
      WHEN p_refresh_token IS NOT NULL
        THEN security.encrypt_oauth_token(p_refresh_token)
      ELSE NULL
    END,
    p_expires_at,
    p_scope,
    clock_timestamp(),
    clock_timestamp()
  )
  ON CONFLICT (user_id, provider) DO UPDATE
  SET access_token = NULL,
      refresh_token = NULL,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = COALESCE(
        EXCLUDED.refresh_token_encrypted,
        public.user_integrations.refresh_token_encrypted
      ),
      expires_at = EXCLUDED.expires_at,
      scope = COALESCE(EXCLUDED.scope, public.user_integrations.scope),
      updated_at = clock_timestamp();
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_google_fit_server_credentials(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  DELETE FROM public.user_integrations
  WHERE user_id = p_user_id
    AND provider = 'google_fit';

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION security.get_oauth_token_encryption_key() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.encrypt_oauth_token(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.decrypt_oauth_token(BYTEA) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_google_fit_server_credentials(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_google_fit_server_credentials(UUID, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_google_fit_server_credentials(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_fit_server_credentials(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_google_fit_server_credentials(UUID, TEXT, TEXT, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_google_fit_server_credentials(UUID) TO service_role;

COMMIT;
