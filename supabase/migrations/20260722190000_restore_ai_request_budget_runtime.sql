BEGIN;

CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.ai_usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  input_chars BIGINT NOT NULL DEFAULT 0 CHECK (input_chars >= 0),
  output_chars BIGINT NOT NULL DEFAULT 0 CHECK (output_chars >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, task, usage_date)
);

CREATE TABLE IF NOT EXISTS security.ai_request_ledger (
  request_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('reserved', 'completed', 'failed', 'rejected')
  ),
  input_chars INTEGER NOT NULL DEFAULT 0 CHECK (input_chars >= 0),
  output_chars INTEGER NOT NULL DEFAULT 0 CHECK (output_chars >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE security.ai_usage_daily
  DROP CONSTRAINT IF EXISTS ai_usage_daily_task_allowed;
ALTER TABLE security.ai_usage_daily
  ADD CONSTRAINT ai_usage_daily_task_allowed CHECK (
    task IN (
      'blood_work', 'weekly_report', 'coach_chat', 'meal_explanation',
      'meal_plan', 'translation', 'general', 'meal_image', 'daily_insight'
    )
  );

ALTER TABLE security.ai_request_ledger
  DROP CONSTRAINT IF EXISTS ai_request_ledger_task_allowed;
ALTER TABLE security.ai_request_ledger
  ADD CONSTRAINT ai_request_ledger_task_allowed CHECK (
    task IN (
      'blood_work', 'weekly_report', 'coach_chat', 'meal_explanation',
      'meal_plan', 'translation', 'general', 'meal_image', 'daily_insight'
    )
  );

CREATE INDEX IF NOT EXISTS ai_request_ledger_user_created_idx
  ON security.ai_request_ledger (user_id, created_at DESC);

ALTER TABLE security.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.ai_usage_daily FORCE ROW LEVEL SECURITY;
ALTER TABLE security.ai_request_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.ai_request_ledger FORCE ROW LEVEL SECURITY;

REVOKE ALL ON security.ai_usage_daily
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON security.ai_request_ledger
  FROM PUBLIC, anon, authenticated, service_role;

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
    'meal_plan', 'translation', 'general', 'meal_image', 'daily_insight'
  ) THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_TASK';
  END IF;

  IF p_daily_limit NOT BETWEEN 1 AND 100
     OR p_input_chars NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'INVALID_AI_BUDGET_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_user_id::TEXT || ':' || p_task || ':' || CURRENT_DATE::TEXT,
      0
    )
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
  SELECT '20260722190000'::TEXT;
$function$;

REVOKE ALL ON FUNCTION public.reserve_ai_request(
  UUID, TEXT, UUID, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_request(
  UUID, UUID, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_security_runtime_version()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_ai_request(
  UUID, TEXT, UUID, INTEGER, INTEGER
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ai_request(
  UUID, UUID, TEXT, INTEGER
) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_security_runtime_version()
  TO service_role;

COMMENT ON FUNCTION public.reserve_ai_request(
  UUID, TEXT, UUID, INTEGER, INTEGER
) IS 'Service-only idempotent and atomic daily AI budget reservation.';
COMMENT ON FUNCTION public.complete_ai_request(
  UUID, UUID, TEXT, INTEGER
) IS 'Service-only completion marker for reserved AI requests.';
COMMENT ON FUNCTION public.ai_security_runtime_version()
  IS 'Service-only deployment marker for the AI request budget runtime.';

COMMIT;
