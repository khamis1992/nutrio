BEGIN;

-- Supabase Auth writes security-relevant activity to auth.audit_log_entries.
-- Mirror a deliberately small, non-secret subset into Nutrio's immutable
-- evidence ledger so MFA, password, session, and identity activity is visible
-- in the Admin Security Center. The trigger is fail-open for authentication:
-- an evidence outage must be alerted on, but must not break Auth transactions.
CREATE OR REPLACE FUNCTION security.capture_auth_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_row JSONB := to_jsonb(NEW);
  v_payload JSONB := COALESCE(to_jsonb(NEW) -> 'payload', '{}'::JSONB);
  v_traits JSONB := COALESCE(v_payload -> 'traits', '{}'::JSONB);
  v_metadata JSONB := COALESCE(v_payload -> 'metadata', '{}'::JSONB);
  v_action TEXT;
  v_actor_raw TEXT;
  v_actor UUID;
  v_target_raw TEXT;
  v_target UUID;
  v_ip_raw TEXT;
  v_ip INET;
  v_occurred_at TIMESTAMPTZ;
  v_result TEXT;
  v_outcome TEXT := 'success';
  v_severity TEXT := 'info';
  v_log_type TEXT;
  v_provider TEXT;
  v_request_id TEXT;
  v_user_agent TEXT;
  v_audit_id TEXT;
BEGIN
  v_action := lower(trim(COALESCE(v_payload ->> 'action', 'unknown')));
  v_action := regexp_replace(v_action, '[^a-z0-9_.-]+', '_', 'g');
  IF v_action = '' THEN
    v_action := 'unknown';
  END IF;

  v_actor_raw := NULLIF(COALESCE(
    v_payload ->> 'actor_id',
    v_payload ->> 'user_id',
    v_traits ->> 'actor_id'
  ), '');
  IF v_actor_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_actor := v_actor_raw::UUID;
  END IF;

  v_target_raw := NULLIF(COALESCE(
    v_traits ->> 'user_id',
    v_payload ->> 'user_id',
    v_actor_raw
  ), '');
  IF v_target_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_target := v_target_raw::UUID;
  END IF;

  v_ip_raw := NULLIF(COALESCE(
    v_row ->> 'ip_address',
    v_payload ->> 'ip_address',
    v_metadata ->> 'ip_address'
  ), '');
  BEGIN
    v_ip := NULLIF(trim(split_part(COALESCE(v_ip_raw, ''), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  BEGIN
    v_occurred_at := COALESCE(
      NULLIF(v_row ->> 'created_at', '')::TIMESTAMPTZ,
      NULLIF(v_payload ->> 'timestamp', '')::TIMESTAMPTZ,
      clock_timestamp()
    );
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    v_occurred_at := clock_timestamp();
  END;

  v_result := lower(COALESCE(
    v_payload ->> 'outcome',
    v_payload ->> 'result',
    v_traits ->> 'outcome',
    v_traits ->> 'result',
    ''
  ));
  IF v_result IN ('failure', 'failed', 'error', 'denied', 'invalid', 'blocked')
     OR COALESCE(v_payload ->> 'error', '') <> '' THEN
    v_outcome := 'failure';
  END IF;

  v_severity := CASE
    WHEN v_outcome = 'failure'
      AND v_action IN ('login', 'verification_attempted', 'mfa_code_login')
      THEN 'high'
    WHEN v_action IN (
      'user_deleted',
      'user_updated_password',
      'factor_unenrolled',
      'factor_deleted',
      'factor_updated',
      'recovery_codes_deleted',
      'generate_recovery_codes',
      'identity_unlinked',
      'token_revoked'
    ) THEN 'medium'
    WHEN v_action IN ('user_repeated_signup', 'user_recovery_requested')
      THEN 'low'
    ELSE 'info'
  END;

  v_log_type := left(NULLIF(trim(COALESCE(v_payload ->> 'log_type', '')), ''), 80);
  v_provider := left(NULLIF(trim(COALESCE(
    v_metadata ->> 'provider',
    v_traits ->> 'provider',
    v_payload ->> 'provider',
    v_traits ->> 'authentication_method'
  )), ''), 80);
  v_request_id := left(NULLIF(trim(COALESCE(
    v_metadata ->> 'request_id',
    v_payload ->> 'request_id'
  )), ''), 160);
  v_user_agent := left(NULLIF(COALESCE(
    v_metadata ->> 'user_agent',
    v_payload ->> 'user_agent'
  ), ''), 1000);
  v_audit_id := left(NULLIF(COALESCE(v_row ->> 'id', ''), ''), 160);

  INSERT INTO security.event_ledger (
    occurred_at,
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
    ip_address,
    user_agent,
    metadata,
    event_hash
  ) VALUES (
    v_occurred_at,
    'authentication.supabase.' || left(v_action, 96),
    'authentication',
    v_severity,
    'auth',
    v_outcome,
    v_actor,
    NULL,
    CASE
      WHEN v_actor IS NULL OR v_actor = '00000000-0000-0000-0000-000000000000'::UUID
        THEN 'system'
      ELSE 'user'
    END,
    left(v_action, 120),
    'auth.user',
    COALESCE(v_target::TEXT, left(v_target_raw, 240)),
    v_request_id,
    CASE WHEN v_audit_id IS NULL THEN NULL ELSE 'supabase-auth:' || v_audit_id END,
    v_ip,
    v_user_agent,
    jsonb_strip_nulls(jsonb_build_object(
      'auth_audit_id', v_audit_id,
      'log_type', v_log_type,
      'provider', v_provider,
      'actor_via_sso', CASE
        WHEN jsonb_typeof(v_payload -> 'actor_via_sso') = 'boolean'
          THEN v_payload -> 'actor_via_sso'
        ELSE NULL
      END,
      'authentication_method', left(NULLIF(COALESCE(
        v_traits ->> 'authentication_method',
        v_metadata ->> 'authentication_method'
      ), ''), 80)
    )),
    repeat('0', 64)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Auth must remain available if the evidence sink is temporarily unhealthy.
  -- The database warning is intentionally free of payload/PII.
  RAISE WARNING 'Nutrio auth audit mirror failed for action %', COALESCE(v_action, 'unknown');
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION security.capture_auth_audit_entry() FROM PUBLIC;

DO $do$
BEGIN
  IF to_regclass('auth.audit_log_entries') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS nutrio_security_auth_audit_trigger
      ON auth.audit_log_entries;
    CREATE TRIGGER nutrio_security_auth_audit_trigger
    AFTER INSERT ON auth.audit_log_entries
    FOR EACH ROW EXECUTE FUNCTION security.capture_auth_audit_entry();
  ELSE
    RAISE WARNING 'auth.audit_log_entries is unavailable; auth events require an external Supabase log drain';
  END IF;
END;
$do$;

COMMENT ON FUNCTION security.capture_auth_audit_entry() IS
  'Mirrors a minimized, redacted subset of Supabase Auth audit activity into the immutable Nutrio security ledger without blocking Auth on telemetry failure.';

COMMIT;
