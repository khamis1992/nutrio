BEGIN;

-- Consume OAuth state in one statement so concurrent callbacks cannot both
-- exchange the same authorization code.
CREATE OR REPLACE FUNCTION public.consume_partner_oauth_state(
  p_state_hash TEXT,
  p_partner TEXT
)
RETURNS TABLE (
  user_id UUID,
  code_verifier TEXT,
  redirect_path TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  UPDATE public.partner_oauth_states s
  SET consumed_at = now()
  WHERE s.state_hash = p_state_hash
    AND s.partner = p_partner
    AND s.consumed_at IS NULL
    AND s.expires_at > now()
  RETURNING s.user_id, s.code_verifier, s.redirect_path, s.expires_at;
$function$;

-- Validate ownership again inside the transaction before any service-role
-- upsert. This prevents a colliding external session id from overwriting a
-- different Nutrio customer's activity or workout.
CREATE OR REPLACE FUNCTION public.ingest_sporthub_activity(
  p_user_id UUID,
  p_external_user_id TEXT,
  p_external_session_id TEXT,
  p_activity_type TEXT,
  p_venue_name TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_duration_minutes INTEGER,
  p_calories_burned INTEGER,
  p_status TEXT,
  p_raw_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_session_id UUID;
  v_workout_id UUID;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.partner_integrations i
    WHERE i.user_id = p_user_id
      AND i.partner = 'sporthub'
      AND i.consent_status = 'linked'
      AND i.external_user_id = p_external_user_id
  ) THEN
    RAISE EXCEPTION 'SPORTHUB_INTEGRATION_OWNERSHIP_INVALID';
  END IF;

  IF nullif(trim(p_external_session_id), '') IS NULL
     OR length(p_external_session_id) > 255
     OR nullif(trim(p_activity_type), '') IS NULL
     OR length(p_activity_type) > 100
     OR p_starts_at IS NULL
     OR (p_ends_at IS NOT NULL AND p_ends_at < p_starts_at)
     OR p_duration_minutes IS NOT NULL AND p_duration_minutes NOT BETWEEN 1 AND 1440
     OR p_calories_burned IS NOT NULL AND p_calories_burned NOT BETWEEN 0 AND 20000
     OR p_status NOT IN ('booked', 'confirmed', 'completed', 'cancelled', 'no_show')
     OR octet_length(COALESCE(p_raw_payload, '{}'::JSONB)::TEXT) > 65536 THEN
    RAISE EXCEPTION 'SPORTHUB_ACTIVITY_INVALID';
  END IF;

  INSERT INTO public.partner_activity_sessions (
    user_id, partner, external_session_id, external_user_id, activity_type,
    venue_name, starts_at, ends_at, duration_minutes, calories_burned,
    status, raw_payload, updated_at
  ) VALUES (
    p_user_id, 'sporthub', p_external_session_id, p_external_user_id,
    trim(p_activity_type), nullif(left(trim(COALESCE(p_venue_name, '')), 200), ''),
    p_starts_at, p_ends_at, p_duration_minutes, p_calories_burned,
    p_status, security.redact_jsonb(COALESCE(p_raw_payload, '{}'::JSONB)), now()
  )
  ON CONFLICT (partner, external_session_id) DO UPDATE
  SET activity_type = EXCLUDED.activity_type,
      venue_name = EXCLUDED.venue_name,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      duration_minutes = EXCLUDED.duration_minutes,
      calories_burned = EXCLUDED.calories_burned,
      status = EXCLUDED.status,
      raw_payload = EXCLUDED.raw_payload,
      updated_at = now()
  WHERE public.partner_activity_sessions.user_id = EXCLUDED.user_id
    AND public.partner_activity_sessions.external_user_id = EXCLUDED.external_user_id
  RETURNING id INTO v_session_id;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'SPORTHUB_SESSION_OWNERSHIP_CONFLICT';
  END IF;

  IF p_status = 'completed' THEN
    INSERT INTO public.workout_sessions (
      user_id, session_date, workout_type, duration_minutes, calories_burned,
      source, source_external_id, confirmed, created_at, external_metadata
    ) VALUES (
      p_user_id, (p_starts_at AT TIME ZONE 'Asia/Qatar')::DATE,
      trim(p_activity_type), COALESCE(p_duration_minutes, 1),
      COALESCE(p_calories_burned, 0), 'sporthub', p_external_session_id,
      TRUE, p_starts_at,
      jsonb_build_object('venue_name', nullif(left(trim(COALESCE(p_venue_name, '')), 200), ''), 'sync_source', 'pull')
    )
    ON CONFLICT (source, source_external_id) DO UPDATE
    SET session_date = EXCLUDED.session_date,
        workout_type = EXCLUDED.workout_type,
        duration_minutes = EXCLUDED.duration_minutes,
        calories_burned = EXCLUDED.calories_burned,
        confirmed = TRUE,
        external_metadata = EXCLUDED.external_metadata
    WHERE public.workout_sessions.user_id = EXCLUDED.user_id
    RETURNING id INTO v_workout_id;

    IF v_workout_id IS NULL THEN
      RAISE EXCEPTION 'SPORTHUB_WORKOUT_OWNERSHIP_CONFLICT';
    END IF;

    UPDATE public.partner_activity_sessions
    SET workout_session_id = v_workout_id
    WHERE id = v_session_id AND user_id = p_user_id;
  ELSIF p_status IN ('cancelled', 'no_show') THEN
    DELETE FROM public.workout_sessions
    WHERE user_id = p_user_id
      AND source = 'sporthub'
      AND source_external_id = p_external_session_id;

    UPDATE public.partner_activity_sessions
    SET workout_session_id = NULL
    WHERE id = v_session_id AND user_id = p_user_id;
  END IF;

  RETURN v_session_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unlink_sporthub_integration(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_integration public.partner_integrations%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_integration
  FROM public.partner_integrations
  WHERE user_id = p_user_id AND partner = 'sporthub'
  FOR UPDATE;

  IF NOT FOUND THEN
    DELETE FROM public.partner_oauth_states
    WHERE user_id = p_user_id AND partner = 'sporthub';
    RETURN FALSE;
  END IF;

  DELETE FROM public.partner_credentials
  WHERE integration_id = v_integration.id;

  DELETE FROM public.partner_oauth_states
  WHERE user_id = p_user_id AND partner = 'sporthub';

  UPDATE public.partner_integrations
  SET consent_status = 'revoked',
      unlinked_at = v_now,
      updated_at = v_now,
      metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
        'revoked_by', 'user',
        'revoked_at', v_now
      )
  WHERE id = v_integration.id;

  INSERT INTO public.partner_events (user_id, partner, event_type, payload)
  VALUES (
    p_user_id,
    'sporthub',
    'sporthub.account.unlinked',
    jsonb_build_object('external_user_id', v_integration.external_user_id)
  );

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_partner_oauth_state(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingest_sporthub_activity(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unlink_sporthub_integration(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_partner_oauth_state(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_sporthub_activity(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.unlink_sporthub_integration(UUID) TO service_role;

DO $do$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'partner_integrations', 'partner_credentials', 'partner_activity_sessions',
    'workout_sessions', 'payment_provider_events'
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

NOTIFY pgrst, 'reload schema';

COMMIT;
