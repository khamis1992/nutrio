BEGIN;

-- OAuth state and token ciphertext must remain unreachable even if a future
-- default privilege or table-owner policy drifts.
ALTER TABLE public.partner_oauth_states FORCE ROW LEVEL SECURITY;
ALTER TABLE public.partner_credentials FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_oauth_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.partner_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.partner_oauth_states TO service_role;
GRANT ALL ON public.partner_credentials TO service_role;

DELETE FROM public.partner_oauth_states
WHERE state_hash !~ '^[A-Za-z0-9_-]{43}$'
   OR code_verifier IS NULL
   OR code_verifier !~ '^[A-Za-z0-9_-]{43,128}$';

UPDATE public.partner_credentials SET token_type = 'Bearer'
WHERE token_type IS DISTINCT FROM 'Bearer';

ALTER TABLE public.partner_oauth_states
  DROP CONSTRAINT IF EXISTS partner_oauth_states_state_hash_format,
  DROP CONSTRAINT IF EXISTS partner_oauth_states_code_verifier_format,
  ADD CONSTRAINT partner_oauth_states_state_hash_format
    CHECK (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  ADD CONSTRAINT partner_oauth_states_code_verifier_format
    CHECK (code_verifier ~ '^[A-Za-z0-9_-]{43,128}$');

ALTER TABLE public.partner_credentials
  DROP CONSTRAINT IF EXISTS partner_credentials_bearer_only,
  DROP CONSTRAINT IF EXISTS partner_credentials_ciphertext_size,
  ADD CONSTRAINT partner_credentials_bearer_only
    CHECK (token_type = 'Bearer'),
  ADD CONSTRAINT partner_credentials_ciphertext_size CHECK (
    octet_length(access_token_encrypted) BETWEEN 24 AND 32768
    AND (
      refresh_token_encrypted IS NULL
      OR octet_length(refresh_token_encrypted) BETWEEN 24 AND 32768
    )
  );

-- Remove arbitrary historical provider JSON. The relational columns and event
-- IDs preserve the business/forensic facts without retaining unknown secrets.
UPDATE public.partner_events
SET payload = jsonb_strip_nulls(jsonb_build_object(
  'source', COALESCE(payload ->> 'source', 'legacy_minimized'),
  'legacy_minimized', TRUE,
  'session_id', COALESCE(payload #>> '{data,session_id}', payload ->> 'session_id'),
  'activity_type', COALESCE(payload #>> '{data,activity_type}', payload ->> 'activity_type'),
  'status', COALESCE(payload #>> '{data,status}', payload ->> 'status'),
  'starts_at', COALESCE(payload #>> '{data,starts_at}', payload ->> 'starts_at')
))
WHERE partner = 'sporthub';

UPDATE public.partner_activity_sessions
SET raw_payload = jsonb_strip_nulls(jsonb_build_object(
  'source', 'legacy_minimized',
  'session_id', external_session_id,
  'activity_type', activity_type,
  'venue_name', venue_name,
  'starts_at', starts_at,
  'ends_at', ends_at,
  'duration_minutes', duration_minutes,
  'calories_burned', calories_burned,
  'status', status
))
WHERE partner = 'sporthub';

-- Reserve the replay ID and project the activity in one database transaction.
-- A projection error rolls the event insert back, allowing a legitimate retry.
CREATE OR REPLACE FUNCTION public.ingest_sporthub_webhook_event(
  p_user_id UUID,
  p_external_user_id TEXT,
  p_event_type TEXT,
  p_external_event_id TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_event_payload JSONB,
  p_activity JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_inserted INTEGER := 0;
  v_projected BOOLEAN := p_activity IS NOT NULL;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_user_id IS NULL
     OR p_occurred_at IS NULL
     OR p_event_type !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
     OR p_external_event_id !~ '^[A-Za-z0-9][A-Za-z0-9._~:-]{0,199}$'
     OR p_external_user_id !~ '^[A-Za-z0-9][A-Za-z0-9._~:-]{0,199}$'
     OR octet_length(COALESCE(p_event_payload, '{}'::JSONB)::TEXT) > 8192
     OR octet_length(COALESCE(p_activity, '{}'::JSONB)::TEXT) > 8192
     OR NOT EXISTS (
       SELECT 1
       FROM public.partner_integrations integration
       WHERE integration.user_id = p_user_id
         AND integration.partner = 'sporthub'
         AND integration.external_user_id = p_external_user_id
         AND integration.consent_status = 'linked'
     ) THEN
    RAISE EXCEPTION 'SPORTHUB_WEBHOOK_OWNERSHIP_OR_PAYLOAD_INVALID';
  END IF;

  INSERT INTO public.partner_events (
    user_id, partner, event_type, external_event_id, occurred_at, payload
  ) VALUES (
    p_user_id,
    'sporthub',
    p_event_type,
    p_external_event_id,
    p_occurred_at,
    security.redact_jsonb(COALESCE(p_event_payload, '{}'::JSONB))
  )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('duplicate', TRUE, 'projected', FALSE);
  END IF;

  IF p_activity IS NOT NULL THEN
    PERFORM public.ingest_sporthub_activity(
      p_user_id,
      p_external_user_id,
      p_activity ->> 'external_session_id',
      p_activity ->> 'activity_type',
      p_activity ->> 'venue_name',
      (p_activity ->> 'starts_at')::TIMESTAMPTZ,
      NULLIF(p_activity ->> 'ends_at', '')::TIMESTAMPTZ,
      NULLIF(p_activity ->> 'duration_minutes', '')::INTEGER,
      NULLIF(p_activity ->> 'calories_burned', '')::INTEGER,
      p_activity ->> 'status',
      p_activity
    );

    UPDATE public.partner_integrations
    SET last_synced_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE user_id = p_user_id
      AND partner = 'sporthub'
      AND external_user_id = p_external_user_id;
  END IF;

  RETURN jsonb_build_object(
    'duplicate', FALSE,
    'projected', v_projected
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_sporthub_link(
  p_user_id UUID,
  p_external_user_id TEXT,
  p_access_token_encrypted TEXT,
  p_refresh_token_encrypted TEXT,
  p_scope TEXT,
  p_expires_at TIMESTAMPTZ,
  p_linked_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_integration_id UUID;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_user_id IS NULL
     OR p_external_user_id !~ '^[A-Za-z0-9][A-Za-z0-9._~:-]{0,199}$'
     OR p_access_token_encrypted !~ '^v2\.[A-Za-z0-9_-]{1,32}\.'
     OR octet_length(p_access_token_encrypted) NOT BETWEEN 24 AND 32768
     OR (
       p_refresh_token_encrypted IS NOT NULL
       AND (
         p_refresh_token_encrypted !~ '^v2\.[A-Za-z0-9_-]{1,32}\.'
         OR octet_length(p_refresh_token_encrypted) NOT BETWEEN 24 AND 32768
       )
     )
     OR p_scope IS NOT NULL AND octet_length(p_scope) > 1000
     OR p_linked_at IS NULL THEN
    RAISE EXCEPTION 'SPORTHUB_LINK_PAYLOAD_INVALID';
  END IF;

  INSERT INTO public.partner_integrations (
    user_id, partner, external_user_id, consent_status, linked_at,
    unlinked_at, last_synced_at, metadata, updated_at
  ) VALUES (
    p_user_id, 'sporthub', p_external_user_id, 'linked', p_linked_at,
    NULL, NULL,
    jsonb_build_object('scope', p_scope, 'oauth_version', '2.0-pkce'),
    p_linked_at
  )
  ON CONFLICT (user_id, partner) DO UPDATE
  SET external_user_id = EXCLUDED.external_user_id,
      consent_status = 'linked',
      linked_at = EXCLUDED.linked_at,
      unlinked_at = NULL,
      last_synced_at = NULL,
      metadata = EXCLUDED.metadata,
      updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_integration_id;

  INSERT INTO public.partner_credentials (
    integration_id, access_token_encrypted, refresh_token_encrypted,
    token_type, scope, expires_at, updated_at
  ) VALUES (
    v_integration_id, p_access_token_encrypted, p_refresh_token_encrypted,
    'Bearer', p_scope, p_expires_at, p_linked_at
  )
  ON CONFLICT (integration_id) DO UPDATE
  SET access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      token_type = 'Bearer',
      scope = EXCLUDED.scope,
      expires_at = EXCLUDED.expires_at,
      updated_at = EXCLUDED.updated_at;

  INSERT INTO public.partner_events (user_id, partner, event_type, payload)
  VALUES (
    p_user_id,
    'sporthub',
    'sporthub.account.linked',
    jsonb_build_object('linked_at', p_linked_at, 'oauth_version', '2.0-pkce')
  );

  RETURN v_integration_id;
END;
$function$;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.partner_integrations
    WHERE external_user_id IS NOT NULL
      AND consent_status = 'linked'
    GROUP BY partner, external_user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'SPORTHUB_DUPLICATE_LINKED_EXTERNAL_IDENTITIES_REQUIRE_REVIEW';
  END IF;
END;
$do$;

CREATE UNIQUE INDEX IF NOT EXISTS partner_integrations_linked_external_identity_idx
  ON public.partner_integrations (partner, external_user_id)
  WHERE external_user_id IS NOT NULL AND consent_status = 'linked';

REVOKE ALL ON FUNCTION public.ingest_sporthub_webhook_event(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_sporthub_webhook_event(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, JSONB
) TO service_role;
REVOKE ALL ON FUNCTION public.complete_sporthub_link(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sporthub_link(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION public.sporthub_security_runtime_version()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT '20260717132000'::TEXT;
$function$;

REVOKE ALL ON FUNCTION public.sporthub_security_runtime_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sporthub_security_runtime_version()
  TO service_role;

COMMENT ON FUNCTION public.ingest_sporthub_webhook_event(
  UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, JSONB
) IS 'Service-only atomic SportHub replay reservation and customer-scoped activity projection.';

NOTIFY pgrst, 'reload schema';

COMMIT;
