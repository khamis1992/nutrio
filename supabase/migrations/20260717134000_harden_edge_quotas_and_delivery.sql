-- Close remaining Edge Function quota and delivery races.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TABLE IF NOT EXISTS security.monthly_affiliate_report_snapshots (
  report_month DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (report_month, user_id),
  CONSTRAINT monthly_affiliate_report_month_start CHECK (
    report_month = date_trunc('month', report_month)::DATE
  ),
  CONSTRAINT monthly_affiliate_report_payload_object CHECK (
    jsonb_typeof(payload) = 'object'
  )
);

ALTER TABLE security.monthly_affiliate_report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.monthly_affiliate_report_snapshots FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.monthly_affiliate_report_snapshots
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_monthly_affiliate_report_snapshot(
  p_user_id UUID,
  p_report_month DATE,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_payload JSONB;
  v_allowed_keys TEXT[] := ARRAY[
    'user_id', 'full_name', 'affiliate_tier', 'total_earnings',
    'current_balance', 'monthly_commissions', 'monthly_commission_count',
    'tier1_referrals', 'tier2_referrals', 'tier3_referrals',
    'new_referrals_this_month', 'milestones_achieved'
  ];
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_user_id IS NULL
     OR p_report_month IS NULL
     OR p_report_month <> date_trunc('month', p_report_month)::DATE
     OR p_report_month > date_trunc('month', CURRENT_DATE)::DATE
     OR jsonb_typeof(p_payload) <> 'object'
     OR octet_length(p_payload::TEXT) > 32768
     OR p_payload ->> 'user_id' IS DISTINCT FROM p_user_id::TEXT
     OR NOT (p_payload ?& v_allowed_keys)
     OR (p_payload - v_allowed_keys) <> '{}'::JSONB
  THEN
    RAISE EXCEPTION 'INVALID_MONTHLY_AFFILIATE_REPORT_SNAPSHOT';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || p_report_month::TEXT, 418327)
  );

  INSERT INTO security.monthly_affiliate_report_snapshots (
    report_month, user_id, payload
  ) VALUES (
    p_report_month, p_user_id, p_payload
  )
  ON CONFLICT (report_month, user_id) DO NOTHING;

  SELECT snapshot.payload INTO v_payload
  FROM security.monthly_affiliate_report_snapshots AS snapshot
  WHERE snapshot.report_month = p_report_month
    AND snapshot.user_id = p_user_id;

  RETURN v_payload;
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

  IF p_task IS NULL OR p_task NOT IN (
    'blood_work', 'weekly_report', 'coach_chat', 'meal_explanation',
    'meal_plan', 'translation', 'general', 'meal_image', 'daily_insight'
  ) THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_TASK';
  END IF;

  IF p_daily_limit IS NULL OR p_daily_limit NOT BETWEEN 1 AND 100
     OR p_input_chars IS NULL OR p_input_chars NOT BETWEEN 0 AND 100000 THEN
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

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_dedupe_key_length;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_dedupe_key_length CHECK (
    dedupe_key IS NULL OR char_length(dedupe_key) BETWEEN 1 AND 200
  );

UPDATE public.notifications
SET dedupe_key = NULLIF(left(data ->> 'dedupe_key', 200), '')
WHERE dedupe_key IS NULL
  AND jsonb_typeof(data) = 'object'
  AND data ? 'dedupe_key';

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, type, dedupe_key
           ORDER BY created_at, id
         ) AS duplicate_number
  FROM public.notifications
  WHERE dedupe_key IS NOT NULL
)
DELETE FROM public.notifications AS notification
USING ranked
WHERE notification.id = ranked.id
  AND ranked.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_delivery_dedupe_unique
  ON public.notifications (user_id, type, dedupe_key);

CREATE OR REPLACE FUNCTION public.protect_notification_delivery_identity()
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

  IF TG_OP = 'INSERT' AND NEW.dedupe_key IS NOT NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_DELIVERY_IDENTITY_IS_SERVER_MANAGED';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key
       OR (
         OLD.dedupe_key IS NOT NULL
         AND (
           NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.type IS DISTINCT FROM OLD.type
         )
       )
     ) THEN
    RAISE EXCEPTION 'NOTIFICATION_DELIVERY_IDENTITY_IS_SERVER_MANAGED';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_notification_delivery_identity
  ON public.notifications;
CREATE TRIGGER protect_notification_delivery_identity
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_notification_delivery_identity();

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, adjustment_date
           ORDER BY created_at, id
         ) AS duplicate_number
  FROM public.goal_adjustment_history
)
DELETE FROM public.goal_adjustment_history AS adjustment
USING ranked
WHERE adjustment.id = ranked.id
  AND ranked.duplicate_number > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, detected_at
           ORDER BY created_at, id
         ) AS duplicate_number
  FROM public.plateau_events
)
DELETE FROM public.plateau_events AS plateau
USING ranked
WHERE plateau.id = ranked.id
  AND ranked.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS goal_adjustment_history_user_day_unique
  ON public.goal_adjustment_history (user_id, adjustment_date);

CREATE UNIQUE INDEX IF NOT EXISTS plateau_events_user_day_unique
  ON public.plateau_events (user_id, detected_at);

CREATE OR REPLACE FUNCTION public.persist_adaptive_goal_recommendation(
  p_user_id UUID,
  p_adjustment_date DATE,
  p_previous_calories INTEGER,
  p_new_calories INTEGER,
  p_previous_macros JSONB,
  p_new_macros JSONB,
  p_reason TEXT,
  p_weight_change_kg NUMERIC,
  p_adherence_rate NUMERIC,
  p_plateau_detected BOOLEAN,
  p_ai_confidence NUMERIC,
  p_predictions JSONB,
  p_suggested_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_adjustment_id UUID;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_user_id IS NULL
     OR p_adjustment_date IS NULL
     OR p_previous_calories IS NULL
     OR p_previous_calories NOT BETWEEN 500 AND 10000
     OR p_new_calories IS NULL
     OR p_new_calories NOT BETWEEN 500 AND 10000
     OR jsonb_typeof(p_previous_macros) <> 'object'
     OR jsonb_typeof(p_new_macros) <> 'object'
     OR char_length(COALESCE(p_reason, '')) NOT BETWEEN 1 AND 2000
     OR p_adherence_rate IS NULL
     OR p_adherence_rate NOT BETWEEN 0 AND 1
     OR p_plateau_detected IS NULL
     OR p_ai_confidence IS NULL
     OR p_ai_confidence NOT BETWEEN 0 AND 1
     OR (p_weight_change_kg IS NOT NULL AND p_weight_change_kg NOT BETWEEN -100 AND 100)
     OR jsonb_typeof(COALESCE(p_predictions, '[]'::JSONB)) <> 'array'
     OR jsonb_array_length(COALESCE(p_predictions, '[]'::JSONB)) > 26
     OR (p_plateau_detected AND char_length(COALESCE(p_suggested_action, '')) NOT BETWEEN 1 AND 1000)
  THEN
    RAISE EXCEPTION 'INVALID_ADAPTIVE_GOAL_RECOMMENDATION';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || p_adjustment_date::TEXT, 734291)
  );

  SELECT id INTO v_adjustment_id
  FROM public.goal_adjustment_history
  WHERE user_id = p_user_id
    AND adjustment_date = p_adjustment_date;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'created', false,
      'duplicate', true,
      'adjustment_id', v_adjustment_id
    );
  END IF;

  INSERT INTO public.goal_adjustment_history (
    user_id,
    adjustment_date,
    previous_calories,
    new_calories,
    previous_macros,
    new_macros,
    reason,
    weight_change_kg,
    adherence_rate,
    plateau_detected,
    ai_confidence,
    applied
  ) VALUES (
    p_user_id,
    p_adjustment_date,
    p_previous_calories,
    p_new_calories,
    p_previous_macros,
    p_new_macros,
    p_reason,
    p_weight_change_kg,
    p_adherence_rate,
    p_plateau_detected,
    p_ai_confidence,
    false
  )
  RETURNING id INTO v_adjustment_id;

  INSERT INTO public.weight_predictions (
    user_id,
    prediction_date,
    predicted_weight,
    confidence_lower,
    confidence_upper
  )
  SELECT
    p_user_id,
    prediction.prediction_date,
    prediction.predicted_weight,
    prediction.confidence_lower,
    prediction.confidence_upper
  FROM jsonb_to_recordset(COALESCE(p_predictions, '[]'::JSONB)) AS prediction(
    prediction_date DATE,
    predicted_weight NUMERIC,
    confidence_lower NUMERIC,
    confidence_upper NUMERIC
  )
  ON CONFLICT (user_id, prediction_date) DO UPDATE
  SET predicted_weight = EXCLUDED.predicted_weight,
      confidence_lower = EXCLUDED.confidence_lower,
      confidence_upper = EXCLUDED.confidence_upper,
      model_version = 'v1.0';

  UPDATE public.profiles
  SET ai_suggested_calories = p_new_calories,
      ai_suggestion_confidence = p_ai_confidence,
      has_unviewed_adjustment = true,
      plateau_weeks = CASE WHEN p_plateau_detected THEN 3 ELSE 0 END,
      last_goal_adjustment_date = p_adjustment_date
  WHERE user_id = p_user_id;

  IF p_plateau_detected THEN
    INSERT INTO public.plateau_events (
      user_id,
      detected_at,
      weeks_without_change,
      suggested_action
    ) VALUES (
      p_user_id,
      p_adjustment_date,
      3,
      p_suggested_action
    )
    ON CONFLICT (user_id, detected_at) DO UPDATE
    SET weeks_without_change = EXCLUDED.weeks_without_change,
        suggested_action = EXCLUDED.suggested_action;
  END IF;

  RETURN jsonb_build_object(
    'created', true,
    'duplicate', false,
    'adjustment_id', v_adjustment_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_affiliate_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, net, pg_temp
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_secret := security.read_vault_secret('affiliate_notification_secret');
    IF v_secret IS NULL THEN
      RAISE WARNING 'Affiliate notification skipped: Vault secret is not configured';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-commission-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', v_secret
      ),
      body := jsonb_build_object(
        'commission_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_milestone_achievement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, security, net, pg_temp
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  v_secret := security.read_vault_secret('affiliate_notification_secret');
  IF v_secret IS NULL THEN
    RAISE WARNING 'Affiliate milestone notification skipped: Vault secret is not configured';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-milestone-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
      ),
      body := jsonb_build_object(
        'achievement_id', NEW.id
      )
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.persist_adaptive_goal_recommendation(
  UUID, DATE, INTEGER, INTEGER, JSONB, JSONB, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, NUMERIC, JSONB, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.persist_adaptive_goal_recommendation(
  UUID, DATE, INTEGER, INTEGER, JSONB, JSONB, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, NUMERIC, JSONB, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_ai_request(UUID, TEXT, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_request(UUID, TEXT, UUID, INTEGER, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_or_create_monthly_affiliate_report_snapshot(
  UUID, DATE, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_monthly_affiliate_report_snapshot(
  UUID, DATE, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.protect_notification_delivery_identity()
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.notifications.dedupe_key IS
  'Server-controlled delivery identity used for atomic notification deduplication.';
COMMENT ON TABLE security.monthly_affiliate_report_snapshots IS
  'Restricted immutable payload snapshots that make monthly report retries deterministic.';
COMMENT ON FUNCTION public.persist_adaptive_goal_recommendation(
  UUID, DATE, INTEGER, INTEGER, JSONB, JSONB, TEXT, NUMERIC, NUMERIC,
  BOOLEAN, NUMERIC, JSONB, TEXT
) IS 'Service-only atomic persistence boundary for one adaptive recommendation per user and day.';

COMMIT;
