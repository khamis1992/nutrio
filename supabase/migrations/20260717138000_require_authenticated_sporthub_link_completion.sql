-- Prevent OAuth login-CSRF/session swapping. The public provider callback may
-- exchange the authorization code, but it cannot link an external identity.
-- Linking requires a second, authenticated one-time claim by the same Nutrio
-- user who initiated the OAuth state.

BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_oauth_pending_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle_hash TEXT NOT NULL UNIQUE CHECK (handle_hash ~ '^[A-Za-z0-9_-]{43}$'),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner TEXT NOT NULL CHECK (partner = 'sporthub'),
  external_user_id TEXT NOT NULL CHECK (
    external_user_id ~ '^[A-Za-z0-9][A-Za-z0-9._~:-]{0,199}$'
  ),
  access_token_encrypted TEXT NOT NULL CHECK (
    access_token_encrypted ~ '^v2\.[A-Za-z0-9_-]{1,32}\.'
    AND octet_length(access_token_encrypted) BETWEEN 24 AND 32768
  ),
  refresh_token_encrypted TEXT CHECK (
    refresh_token_encrypted IS NULL OR (
      refresh_token_encrypted ~ '^v2\.[A-Za-z0-9_-]{1,32}\.'
      AND octet_length(refresh_token_encrypted) BETWEEN 24 AND 32768
    )
  ),
  scope TEXT CHECK (scope IS NULL OR octet_length(scope) <= 1000),
  token_expires_at TIMESTAMPTZ,
  redirect_path TEXT NOT NULL CHECK (
    redirect_path IN ('/dashboard/activity', '/partners/sporthub')
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes')
);

ALTER TABLE public.partner_oauth_pending_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_oauth_pending_links FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_oauth_pending_links
  FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON public.partner_oauth_pending_links TO service_role;

CREATE INDEX IF NOT EXISTS partner_oauth_pending_links_user_idx
  ON public.partner_oauth_pending_links(user_id, expires_at DESC);

CREATE OR REPLACE FUNCTION public.consume_sporthub_pending_link(
  p_handle_hash TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  pending_id UUID,
  external_user_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  scope TEXT,
  token_expires_at TIMESTAMPTZ,
  redirect_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_user_id IS NULL OR COALESCE(p_handle_hash, '') !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION 'SPORTHUB_PENDING_LINK_INVALID';
  END IF;

  DELETE FROM public.partner_oauth_pending_links pending
  WHERE pending.expires_at <= clock_timestamp()
     OR pending.consumed_at < clock_timestamp() - interval '5 minutes';

  RETURN QUERY
  UPDATE public.partner_oauth_pending_links pending
  SET consumed_at = clock_timestamp()
  WHERE pending.handle_hash = p_handle_hash
    AND pending.user_id = p_user_id
    AND pending.partner = 'sporthub'
    AND pending.consumed_at IS NULL
    AND pending.expires_at > clock_timestamp()
  RETURNING
    pending.id,
    pending.external_user_id,
    pending.access_token_encrypted,
    pending.refresh_token_encrypted,
    pending.scope,
    pending.token_expires_at,
    pending.redirect_path;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sporthub_security_runtime_version()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT '20260717138000'::TEXT;
$function$;

REVOKE ALL ON FUNCTION public.consume_sporthub_pending_link(TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_sporthub_pending_link(TEXT, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.sporthub_security_runtime_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sporthub_security_runtime_version()
  TO service_role;

COMMENT ON TABLE public.partner_oauth_pending_links IS
  'Encrypted, short-lived OAuth results awaiting an authenticated same-user completion claim.';

NOTIFY pgrst, 'reload schema';

COMMIT;
