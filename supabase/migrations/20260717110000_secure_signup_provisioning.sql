-- Enforce server-issued, single-use grants for privileged Auth invitations and
-- finalize fleet-manager provisioning atomically with forensic evidence.

BEGIN;

CREATE TABLE IF NOT EXISTS security.signup_provisioning_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  normalized_email TEXT NOT NULL CHECK (
    normalized_email = lower(trim(normalized_email))
    AND normalized_email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
  ),
  kind TEXT NOT NULL CHECK (kind IN (
    'partner_invitation',
    'fleet_driver_invitation',
    'fleet_manager_invitation'
  )),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consume_request_id TEXT,
  consumed_ip INET,
  CHECK (expires_at > created_at),
  CHECK (consume_request_id IS NULL OR char_length(consume_request_id) <= 160)
);

CREATE INDEX IF NOT EXISTS signup_provisioning_grants_expiry_idx
  ON security.signup_provisioning_grants (expires_at)
  WHERE consumed_at IS NULL;

REVOKE ALL ON TABLE security.signup_provisioning_grants
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.issue_signup_provisioning_grant(
  p_token_hash TEXT,
  p_email TEXT,
  p_kind TEXT,
  p_created_by UUID,
  p_ttl_seconds INTEGER DEFAULT 300
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_grant_id UUID;
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_is_admin BOOLEAN := false;
  v_is_fleet_operator BOOLEAN := false;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  v_is_admin := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_created_by AND ur.role::TEXT = 'admin'
  );
  v_is_fleet_operator := EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = p_created_by AND COALESCE(fm.is_active, false) = true
  );

  IF p_kind IN ('partner_invitation', 'fleet_manager_invitation')
     AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Verified admin actor required';
  END IF;
  IF p_kind = 'fleet_driver_invitation'
     AND NOT (v_is_admin OR v_is_fleet_operator) THEN
    RAISE EXCEPTION 'Verified fleet actor required';
  END IF;

  IF COALESCE(p_token_hash, '') !~ '^[0-9a-f]{64}$'
     OR v_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
     OR p_kind NOT IN (
       'partner_invitation',
       'fleet_driver_invitation',
       'fleet_manager_invitation'
     )
     OR p_ttl_seconds NOT BETWEEN 30 AND 600 THEN
    RAISE EXCEPTION 'Invalid provisioning grant';
  END IF;

  INSERT INTO security.signup_provisioning_grants (
    token_hash, normalized_email, kind, created_by, expires_at
  ) VALUES (
    p_token_hash,
    v_email,
    p_kind,
    p_created_by,
    clock_timestamp() + make_interval(secs => p_ttl_seconds)
  )
  RETURNING id INTO v_grant_id;

  PERFORM security.record_event(
    p_event_type := 'admin.signup_provisioning_grant_issued',
    p_category := 'admin',
    p_severity := 'high',
    p_source := 'edge',
    p_outcome := 'success',
    p_actor_user_id := p_created_by,
    p_actor_role := CASE WHEN v_is_admin THEN 'admin' ELSE 'fleet_manager' END,
    p_actor_type := CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END,
    p_action := 'issue_signup_provisioning_grant',
    p_resource_type := 'signup_provisioning_grant',
    p_resource_id := v_grant_id::TEXT,
    p_metadata := jsonb_build_object('kind', p_kind)
  );

  RETURN v_grant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_signup_provisioning_grant(
  p_token_hash TEXT,
  p_email TEXT,
  p_kind TEXT,
  p_request_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_grant security.signup_provisioning_grants%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE security.signup_provisioning_grants
  SET consumed_at = clock_timestamp(),
      consume_request_id = left(NULLIF(trim(COALESCE(p_request_id, '')), ''), 160),
      consumed_ip = CASE
        WHEN NULLIF(trim(COALESCE(p_ip_address, '')), '') IS NULL THEN NULL
        ELSE trim(p_ip_address)::INET
      END
  WHERE token_hash = lower(trim(COALESCE(p_token_hash, '')))
    AND normalized_email = lower(trim(COALESCE(p_email, '')))
    AND kind = p_kind
    AND consumed_at IS NULL
    AND expires_at > clock_timestamp()
  RETURNING * INTO v_grant;

  IF v_grant.id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM security.record_event(
    p_event_type := 'authentication.supabase.trusted_provisioning_grant_consumed',
    p_category := 'authentication',
    p_severity := 'high',
    p_source := 'auth',
    p_outcome := 'success',
    p_actor_user_id := v_grant.created_by,
    p_actor_role := 'service',
    p_actor_type := 'service',
    p_action := 'consume_signup_provisioning_grant',
    p_resource_type := 'signup_provisioning_grant',
    p_resource_id := v_grant.id::TEXT,
    p_request_id := v_grant.consume_request_id,
    p_ip_address := p_ip_address,
    p_metadata := jsonb_build_object('kind', v_grant.kind)
  );

  RETURN true;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_signup_provisioning_grant_consumed(
  p_token_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN COALESCE(auth.role(), '') <> 'service_role' THEN false
    ELSE EXISTS (
      SELECT 1
      FROM security.signup_provisioning_grants grant_row
      WHERE grant_row.token_hash = lower(trim(COALESCE(p_token_hash, '')))
        AND grant_row.consumed_at IS NOT NULL
    )
  END;
$function$;

ALTER TABLE public.fleet_managers
  ADD COLUMN IF NOT EXISTS country TEXT;

CREATE OR REPLACE FUNCTION public.admin_finalize_fleet_manager_invitation(
  p_actor_user_id UUID,
  p_invited_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_fleet_role TEXT,
  p_country TEXT,
  p_request_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_session_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_event_id UUID;
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_name TEXT := trim(COALESCE(p_full_name, ''));
  v_phone TEXT := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_country TEXT := upper(trim(COALESCE(p_country, '')));
  v_country_code TEXT := upper(trim(COALESCE(p_country_code, '')));
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_actor_user_id AND ur.role::TEXT = 'admin'
  ) THEN
    RAISE EXCEPTION 'Verified admin actor required';
  END IF;
  IF p_invited_user_id IS NULL
     OR v_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
     OR char_length(v_name) NOT BETWEEN 2 AND 100
     OR v_name ~ '[[:cntrl:]]'
     OR (v_phone IS NOT NULL AND (char_length(v_phone) > 24 OR v_phone ~ '[[:cntrl:]]'))
     OR p_fleet_role NOT IN ('fleet_manager', 'super_admin')
     OR (
       p_fleet_role = 'fleet_manager'
       AND v_country NOT IN ('QA', 'SA', 'AE', 'KW', 'BH', 'OM')
     ) THEN
    RAISE EXCEPTION 'Invalid fleet manager invitation';
  END IF;

  INSERT INTO public.fleet_managers (
    auth_user_id, email, full_name, phone, role, country, is_active
  ) VALUES (
    p_invited_user_id,
    v_email,
    v_name,
    v_phone,
    p_fleet_role,
    CASE WHEN p_fleet_role = 'super_admin' THEN NULL ELSE v_country END,
    true
  );

  -- Fleet managers are authorized by their scoped fleet_managers row. Only a
  -- super admin receives the global admin role.
  IF p_fleet_role = 'super_admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_invited_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF v_country_code !~ '^[A-Z]{2}$' THEN v_country_code := NULL; END IF;
  v_event_id := security.record_event(
    p_event_type := 'admin.fleet_manager_invitation_created',
    p_category := 'admin',
    p_severity := 'critical',
    p_source := 'edge',
    p_outcome := 'success',
    p_actor_user_id := p_actor_user_id,
    p_actor_role := 'admin',
    p_actor_type := 'admin',
    p_action := 'invite_fleet_manager',
    p_resource_type := 'fleet_manager',
    p_resource_id := p_invited_user_id::TEXT,
    p_request_id := left(NULLIF(trim(COALESCE(p_request_id, '')), ''), 160),
    p_correlation_id := left(NULLIF(trim(COALESCE(p_correlation_id, '')), ''), 160),
    p_session_fingerprint := left(NULLIF(trim(COALESCE(p_session_fingerprint, '')), ''), 200),
    p_ip_address := p_ip_address,
    p_country_code := v_country_code,
    p_user_agent := left(NULLIF(COALESCE(p_user_agent, ''), ''), 1000),
    p_metadata := jsonb_build_object(
      'fleet_role', p_fleet_role,
      'assigned_country', CASE WHEN p_fleet_role = 'super_admin' THEN NULL ELSE v_country END
    )
  );

  RETURN v_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_signup_provisioning_grant(TEXT, TEXT, TEXT, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_signup_provisioning_grant(TEXT, TEXT, TEXT, UUID, INTEGER)
  TO service_role;
REVOKE ALL ON FUNCTION public.consume_signup_provisioning_grant(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_signup_provisioning_grant(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.is_signup_provisioning_grant_consumed(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_signup_provisioning_grant_consumed(TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_finalize_fleet_manager_invitation(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_finalize_fleet_manager_invitation(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMIT;
