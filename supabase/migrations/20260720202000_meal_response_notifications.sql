-- Meal-response domain events and privacy-safe notification templates.

BEGIN;

INSERT INTO security.notification_event_templates (
  event_type, template_key, notification_type, preference_key, channels,
  quiet_hours_policy, deep_link_type, title_en, title_ar, body_en, body_ar
) VALUES
  (
    'meal.response_checkin_due.v1',
    'meal_response_checkin_due_v1',
    'meal_reminder',
    'meal_reminders',
    ARRAY['in_app', 'push']::TEXT[],
    'respect',
    'meal_response',
    'How did that meal feel?',
    'كيف كان شعورك بعد الوجبة؟',
    'A quick check-in helps personalize future insights.',
    'تسجيل سريع يساعدنا على تخصيص ملاحظاتك القادمة.'
  ),
  (
    'meal.response_insight_ready.v1',
    'meal_response_insight_ready_v1',
    'health_insight',
    'health_insights',
    ARRAY['in_app', 'push']::TEXT[],
    'respect',
    'meal_response',
    'Your meal response insight is ready',
    'ملاحظتك عن استجابة الوجبة جاهزة',
    'Open Meal Response to review the latest insight.',
    'افتح استجابة الوجبة لمراجعة أحدث ملاحظة.'
  )
ON CONFLICT (event_type) DO UPDATE SET
  template_key = EXCLUDED.template_key,
  notification_type = EXCLUDED.notification_type,
  preference_key = EXCLUDED.preference_key,
  channels = EXCLUDED.channels,
  quiet_hours_policy = EXCLUDED.quiet_hours_policy,
  deep_link_type = EXCLUDED.deep_link_type,
  title_en = EXCLUDED.title_en,
  title_ar = EXCLUDED.title_ar,
  body_en = EXCLUDED.body_en,
  body_ar = EXCLUDED.body_ar,
  active = TRUE,
  updated_at = now();

CREATE OR REPLACE FUNCTION security.schedule_meal_response_checkin_due_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
DECLARE
  v_due_at TIMESTAMPTZ;
BEGIN
  IF NEW.started_consuming_at IS NULL
     OR NEW.status NOT IN ('full', 'partial', 'substituted') THEN
    UPDATE security.domain_event_outbox
    SET status = 'completed',
        processed_at = now(),
        lease_token = NULL,
        lease_expires_at = NULL
    WHERE event_type = 'meal.response_checkin_due.v1'
      AND aggregate_id = NEW.id
      AND audience_user_id = NEW.user_id
      AND status IN ('pending', 'failed');
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.health_context_preferences preferences
    WHERE preferences.user_id = NEW.user_id
      AND preferences.meal_response_enabled
      AND preferences.post_meal_prompts_enabled
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.meal_response_check_ins check_ins
    WHERE check_ins.user_id = NEW.user_id
      AND check_ins.consumption_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_due_at := GREATEST(NEW.started_consuming_at + interval '120 minutes', now());

  INSERT INTO security.domain_event_outbox (
    event_type, aggregate_type, aggregate_id, actor_id, audience_user_id,
    idempotency_key, payload, privacy_classification, status,
    next_attempt_at, occurred_at
  ) VALUES (
    'meal.response_checkin_due.v1',
    'meal_consumption',
    NEW.id,
    NEW.user_id,
    NEW.user_id,
    'meal-response-checkin-due:' || NEW.id::TEXT,
    '{}'::JSONB,
    'sensitive',
    'pending',
    v_due_at,
    v_due_at
  )
  ON CONFLICT (event_type, idempotency_key) DO UPDATE SET
    next_attempt_at = CASE
      WHEN security.domain_event_outbox.status IN ('pending', 'failed')
        THEN EXCLUDED.next_attempt_at
      ELSE security.domain_event_outbox.next_attempt_at
    END,
    occurred_at = CASE
      WHEN security.domain_event_outbox.status IN ('pending', 'failed')
        THEN EXCLUDED.occurred_at
      ELSE security.domain_event_outbox.occurred_at
    END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.cancel_meal_response_checkin_due_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  UPDATE security.domain_event_outbox
  SET status = 'completed',
      processed_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL
  WHERE event_type = 'meal.response_checkin_due.v1'
    AND aggregate_id = NEW.consumption_id
    AND audience_user_id = NEW.user_id
    AND status IN ('pending', 'failed');

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.emit_meal_response_insight_ready_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  IF NEW.episode_id IS NULL OR NEW.superseded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.health_context_preferences preferences
    WHERE preferences.user_id = NEW.user_id
      AND preferences.meal_response_enabled
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM security.enqueue_domain_event(
    'meal.response_insight_ready.v1',
    'meal_response_episode',
    NEW.episode_id,
    NEW.user_id,
    'meal-response-insight-ready:' || NEW.episode_id::TEXT,
    '{}'::JSONB,
    NEW.user_id,
    NULL,
    NULL,
    'sensitive',
    NEW.published_at
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS meal_consumptions_schedule_response_checkin
  ON public.meal_consumptions;
CREATE TRIGGER meal_consumptions_schedule_response_checkin
  AFTER INSERT OR UPDATE OF started_consuming_at, status
  ON public.meal_consumptions
  FOR EACH ROW
  EXECUTE FUNCTION security.schedule_meal_response_checkin_due_event();

DROP TRIGGER IF EXISTS meal_response_checkins_cancel_due_event
  ON public.meal_response_check_ins;
CREATE TRIGGER meal_response_checkins_cancel_due_event
  AFTER INSERT ON public.meal_response_check_ins
  FOR EACH ROW
  EXECUTE FUNCTION security.cancel_meal_response_checkin_due_event();

DROP TRIGGER IF EXISTS meal_response_estimates_emit_insight_ready
  ON public.meal_response_estimates;
CREATE TRIGGER meal_response_estimates_emit_insight_ready
  AFTER INSERT ON public.meal_response_estimates
  FOR EACH ROW
  EXECUTE FUNCTION security.emit_meal_response_insight_ready_event();

REVOKE ALL ON FUNCTION security.schedule_meal_response_checkin_due_event()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.cancel_meal_response_checkin_due_event()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION security.emit_meal_response_insight_ready_event()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION security.schedule_meal_response_checkin_due_event() IS
  'Schedules one consent-gated post-meal check-in event without health measurements.';
COMMENT ON FUNCTION security.emit_meal_response_insight_ready_event() IS
  'Emits one consent-gated insight-ready event per episode without estimate values.';

COMMIT;
