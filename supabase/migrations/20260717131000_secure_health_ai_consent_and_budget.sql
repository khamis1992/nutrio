BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_data_consents (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
  policy_version TEXT NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, purpose),
  CONSTRAINT ai_data_consent_purpose_allowed
    CHECK (purpose IN ('blood_work_analysis')),
  CONSTRAINT ai_data_consent_policy_version_length
    CHECK (char_length(policy_version) BETWEEN 3 AND 80)
);

ALTER TABLE public.ai_data_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_data_consents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_data_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_data_consents TO authenticated;
GRANT ALL ON public.ai_data_consents TO service_role;

DROP POLICY IF EXISTS ai_data_consents_owner_read ON public.ai_data_consents;
CREATE POLICY ai_data_consents_owner_read
  ON public.ai_data_consents FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS security.ai_usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  input_chars BIGINT NOT NULL DEFAULT 0 CHECK (input_chars >= 0),
  output_chars BIGINT NOT NULL DEFAULT 0 CHECK (output_chars >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, task, usage_date),
  CONSTRAINT ai_usage_daily_task_allowed CHECK (
    task IN (
      'blood_work', 'weekly_report', 'coach_chat', 'meal_explanation',
      'meal_plan', 'translation', 'general'
    )
  )
);

CREATE TABLE IF NOT EXISTS security.ai_request_ledger (
  request_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'completed', 'failed', 'rejected')),
  input_chars INTEGER NOT NULL DEFAULT 0 CHECK (input_chars >= 0),
  output_chars INTEGER NOT NULL DEFAULT 0 CHECK (output_chars >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT ai_request_ledger_task_allowed CHECK (
    task IN (
      'blood_work', 'weekly_report', 'coach_chat', 'meal_explanation',
      'meal_plan', 'translation', 'general'
    )
  )
);

CREATE INDEX IF NOT EXISTS ai_request_ledger_user_created_idx
  ON security.ai_request_ledger (user_id, created_at DESC);

ALTER TABLE security.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.ai_usage_daily FORCE ROW LEVEL SECURITY;
ALTER TABLE security.ai_request_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.ai_request_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.ai_usage_daily FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON security.ai_request_ledger FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_ai_data_consent(
  p_purpose TEXT,
  p_granted BOOLEAN,
  p_policy_version TEXT
)
RETURNS public.ai_data_consents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_headers JSONB := '{}'::JSONB;
  v_ip INET;
  v_consent public.ai_data_consents%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_purpose <> 'blood_work_analysis' THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_CONSENT_PURPOSE';
  END IF;

  IF p_policy_version IS NULL
     OR char_length(trim(p_policy_version)) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'INVALID_AI_CONSENT_VERSION';
  END IF;

  INSERT INTO public.ai_data_consents (
    user_id, purpose, status, policy_version, granted_at, revoked_at, updated_at
  ) VALUES (
    v_actor,
    p_purpose,
    CASE WHEN p_granted THEN 'granted' ELSE 'revoked' END,
    trim(p_policy_version),
    CASE WHEN p_granted THEN clock_timestamp() ELSE NULL END,
    CASE WHEN p_granted THEN NULL ELSE clock_timestamp() END,
    clock_timestamp()
  )
  ON CONFLICT (user_id, purpose) DO UPDATE
  SET status = EXCLUDED.status,
      policy_version = EXCLUDED.policy_version,
      granted_at = CASE
        WHEN EXCLUDED.status = 'granted' THEN clock_timestamp()
        ELSE public.ai_data_consents.granted_at
      END,
      revoked_at = CASE
        WHEN EXCLUDED.status = 'revoked' THEN clock_timestamp()
        ELSE NULL
      END,
      updated_at = clock_timestamp()
  RETURNING * INTO v_consent;

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
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-forwarded-for',
      ''
    ), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  INSERT INTO security.event_ledger (
    event_type, category, severity, source, outcome, actor_user_id,
    actor_role, actor_type, action, resource_type, resource_id, request_id,
    ip_address, country_code, user_agent, metadata, event_hash
  ) VALUES (
    CASE
      WHEN p_granted THEN 'consent.health_ai.granted'
      ELSE 'consent.health_ai.revoked'
    END,
    'authorization',
    'medium',
    'database',
    'success',
    v_actor,
    'customer',
    'user',
    CASE WHEN p_granted THEN 'grant_consent' ELSE 'revoke_consent' END,
    'ai_data_consent',
    p_purpose,
    COALESCE(v_headers ->> 'x-request-id', v_headers ->> 'sb-request-id'),
    v_ip,
    v_headers ->> 'cf-ipcountry',
    v_headers ->> 'user-agent',
    jsonb_build_object(
      'purpose', p_purpose,
      'policy_version', trim(p_policy_version),
      'status', v_consent.status
    ),
    repeat('0', 64)
  );

  RETURN v_consent;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_ai_request(
  p_user_id UUID,
  p_task TEXT,
  p_request_id UUID,
  p_daily_limit INTEGER,
  p_input_chars INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_existing security.ai_request_ledger%ROWTYPE;
  v_current_count INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'AI_REQUEST_IDENTITY_REQUIRED';
  END IF;

  IF p_task NOT IN (
    'blood_work', 'weekly_report', 'coach_chat', 'meal_explanation',
    'meal_plan', 'translation', 'general'
  ) THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_TASK';
  END IF;

  IF p_daily_limit NOT BETWEEN 1 AND 100
     OR p_input_chars NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'INVALID_AI_BUDGET_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || p_task || ':' || CURRENT_DATE::TEXT, 0)
  );

  SELECT * INTO v_existing
  FROM security.ai_request_ledger
  WHERE request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.user_id <> p_user_id OR v_existing.task <> p_task THEN
      RAISE EXCEPTION 'AI_REQUEST_ID_REUSE';
    END IF;

    RETURN jsonb_build_object(
      'allowed', v_existing.status IN ('reserved', 'completed'),
      'duplicate', true,
      'status', v_existing.status
    );
  END IF;

  SELECT COALESCE(request_count, 0)
  INTO v_current_count
  FROM security.ai_usage_daily
  WHERE user_id = p_user_id
    AND task = p_task
    AND usage_date = CURRENT_DATE
  FOR UPDATE;

  v_current_count := COALESCE(v_current_count, 0);

  IF v_current_count >= p_daily_limit THEN
    INSERT INTO security.ai_request_ledger (
      request_id, user_id, task, status, input_chars
    ) VALUES (
      p_request_id, p_user_id, p_task, 'rejected', p_input_chars
    );

    RETURN jsonb_build_object(
      'allowed', false,
      'duplicate', false,
      'status', 'rejected',
      'remaining', 0
    );
  END IF;

  INSERT INTO security.ai_usage_daily (
    user_id, task, usage_date, request_count, input_chars, updated_at
  ) VALUES (
    p_user_id, p_task, CURRENT_DATE, 1, p_input_chars, clock_timestamp()
  )
  ON CONFLICT (user_id, task, usage_date) DO UPDATE
  SET request_count = security.ai_usage_daily.request_count + 1,
      input_chars = security.ai_usage_daily.input_chars + EXCLUDED.input_chars,
      updated_at = clock_timestamp();

  INSERT INTO security.ai_request_ledger (
    request_id, user_id, task, status, input_chars
  ) VALUES (
    p_request_id, p_user_id, p_task, 'reserved', p_input_chars
  );

  RETURN jsonb_build_object(
    'allowed', true,
    'duplicate', false,
    'status', 'reserved',
    'remaining', p_daily_limit - v_current_count - 1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ai_data_consent(
  p_purpose TEXT,
  p_policy_version TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND p_purpose = 'blood_work_analysis'
    AND EXISTS (
      SELECT 1
      FROM public.ai_data_consents c
      WHERE c.user_id = auth.uid()
        AND c.purpose = p_purpose
        AND c.status = 'granted'
        AND c.policy_version = p_policy_version
    );
$function$;

CREATE OR REPLACE FUNCTION public.complete_ai_request(
  p_user_id UUID,
  p_request_id UUID,
  p_status TEXT,
  p_output_chars INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_task TEXT;
  v_usage_date DATE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_status NOT IN ('completed', 'failed')
     OR p_output_chars NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'INVALID_AI_COMPLETION';
  END IF;

  UPDATE security.ai_request_ledger
  SET status = p_status,
      output_chars = p_output_chars,
      completed_at = clock_timestamp()
  WHERE request_id = p_request_id
    AND user_id = p_user_id
    AND status = 'reserved'
  RETURNING task, created_at::DATE INTO v_task, v_usage_date;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE security.ai_usage_daily
  SET output_chars = output_chars + p_output_chars,
      updated_at = clock_timestamp()
  WHERE user_id = p_user_id
    AND task = v_task
    AND usage_date = v_usage_date;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_security_runtime_version()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT '20260717131000'::TEXT;
$function$;

CREATE OR REPLACE FUNCTION public.protect_blood_work_ai_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_is_trusted BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin');
BEGIN
  IF v_is_trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.ai_analysis IS NOT NULL
       OR COALESCE(NEW.status, 'pending') IN ('analyzed', 'error') THEN
      RAISE EXCEPTION 'BLOOD_WORK_AI_FIELDS_ARE_SERVER_MANAGED';
    END IF;
  ELSIF NEW.ai_analysis IS DISTINCT FROM OLD.ai_analysis
     OR (
       NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('analyzed', 'error')
     ) THEN
    RAISE EXCEPTION 'BLOOD_WORK_AI_FIELDS_ARE_SERVER_MANAGED';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_blood_work_ai_fields_trigger
  ON public.blood_work_records;
CREATE TRIGGER protect_blood_work_ai_fields_trigger
  BEFORE INSERT OR UPDATE OF ai_analysis, status
  ON public.blood_work_records
  FOR EACH ROW EXECUTE FUNCTION public.protect_blood_work_ai_fields();

REVOKE ALL ON FUNCTION public.set_ai_data_consent(TEXT, BOOLEAN, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ai_data_consent(TEXT, BOOLEAN, TEXT)
  TO authenticated;
REVOKE ALL ON FUNCTION public.get_ai_data_consent(TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_data_consent(TEXT, TEXT)
  TO authenticated;
REVOKE ALL ON FUNCTION public.reserve_ai_request(UUID, TEXT, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_request(UUID, UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_request(UUID, TEXT, UUID, INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ai_request(UUID, UUID, TEXT, INTEGER)
  TO service_role;
REVOKE ALL ON FUNCTION public.ai_security_runtime_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_security_runtime_version()
  TO service_role;

COMMENT ON TABLE public.ai_data_consents IS
  'Versioned, revocable consent for sending narrowly scoped customer data to an external AI processor.';
COMMENT ON FUNCTION public.reserve_ai_request(UUID, TEXT, UUID, INTEGER, INTEGER) IS
  'Service-only idempotent and atomic daily AI budget reservation.';
COMMENT ON FUNCTION public.ai_security_runtime_version() IS
  'Service-only deployment marker for the structured AI consent and budget boundary.';

COMMIT;
