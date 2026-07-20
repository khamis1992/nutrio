-- Agent 9: transactional domain-event outbox and localized notification delivery.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.domain_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.v[1-9][0-9]*$'),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version BETWEEN 1 AND 100),
  aggregate_type TEXT NOT NULL CHECK (aggregate_type ~ '^[a-z][a-z0-9_]{0,79}$'),
  aggregate_id UUID,
  actor_id UUID,
  audience_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 220),
  correlation_id UUID,
  causation_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  privacy_classification TEXT NOT NULL DEFAULT 'standard'
    CHECK (privacy_classification IN ('standard', 'sensitive', 'restricted')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'failed', 'completed', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (event_type, idempotency_key),
  CHECK (jsonb_typeof(payload) = 'object'),
  CHECK (octet_length(payload::TEXT) <= 4096)
);

CREATE INDEX IF NOT EXISTS domain_event_outbox_ready_idx
  ON security.domain_event_outbox (next_attempt_at, occurred_at, id)
  WHERE status IN ('pending', 'failed', 'processing');

CREATE INDEX IF NOT EXISTS domain_event_outbox_audience_idx
  ON security.domain_event_outbox (audience_user_id, occurred_at DESC);

ALTER TABLE security.domain_event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.domain_event_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.domain_event_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON security.domain_event_outbox TO service_role;

CREATE TABLE IF NOT EXISTS security.notification_event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL UNIQUE,
  template_key TEXT NOT NULL UNIQUE,
  notification_type TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app', 'push']::TEXT[],
  quiet_hours_policy TEXT NOT NULL DEFAULT 'respect'
    CHECK (quiet_hours_policy IN ('respect', 'bypass')),
  deep_link_type TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (channels <@ ARRAY['in_app', 'push']::TEXT[]),
  CHECK (cardinality(channels) BETWEEN 1 AND 2),
  CHECK (char_length(title_en) BETWEEN 1 AND 120),
  CHECK (char_length(title_ar) BETWEEN 1 AND 120),
  CHECK (char_length(body_en) BETWEEN 1 AND 1000),
  CHECK (char_length(body_ar) BETWEEN 1 AND 1000)
);

ALTER TABLE security.notification_event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.notification_event_templates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.notification_event_templates FROM PUBLIC, anon, authenticated;
GRANT ALL ON security.notification_event_templates TO service_role;

INSERT INTO security.notification_event_templates (
  event_type, template_key, notification_type, preference_key, channels,
  quiet_hours_policy, deep_link_type, title_en, title_ar, body_en, body_ar
) VALUES
  (
    'order.delivered.v1', 'order_delivered_prompt_consumption_v1', 'order_update',
    'order_updates', ARRAY['in_app', 'push'], 'bypass', 'order_detail',
    'Your order has arrived', 'تم توصيل طلبك',
    'Your meal is ready. Open the order when you are ready to confirm it.',
    'وجبتك جاهزة. افتح الطلب عندما تكون مستعدًا لتأكيدها.'
  ),
  (
    'meal.consumption_recorded.v1', 'meal_consumption_recorded_v1', 'meal_reminder',
    'meal_reminders', ARRAY['in_app'], 'respect', 'progress',
    'Meal logged', 'تم تسجيل الوجبة',
    'Your daily nutrition progress has been updated.',
    'تم تحديث تقدمك الغذائي اليومي.'
  ),
  (
    'meal.consumption_prompt_due.v1', 'meal_consumption_prompt_due_v1', 'meal_reminder',
    'meal_reminders', ARRAY['in_app', 'push'], 'respect', 'schedule',
    'How was your meal?', 'كيف كانت وجبتك؟',
    'Confirm what you ate to keep your nutrition progress accurate.',
    'أكد ما تناولته للحفاظ على دقة تقدمك الغذائي.'
  ),
  (
    'health.sync_failed.v1', 'health_sync_failed_v1', 'system_alert',
    'health_insights', ARRAY['in_app'], 'respect', 'settings',
    'Health sync needs attention', 'مزامنة الصحة تحتاج إلى انتباه',
    'Open health app settings to reconnect and try again.',
    'افتح إعدادات تطبيق الصحة لإعادة الاتصال والمحاولة مرة أخرى.'
  ),
  (
    'health.weekly_report_ready.v1', 'health_weekly_report_ready_v1', 'health_insight',
    'weekly_summary', ARRAY['in_app', 'push'], 'respect', 'progress',
    'Your weekly report is ready', 'تقريرك الأسبوعي جاهز',
    'Review your latest nutrition trends and progress.',
    'راجع أحدث اتجاهات التغذية والتقدم لديك.'
  ),
  (
    'goal.adjustment_recommended.v1', 'goal_adjustment_recommended_v1', 'plan_update',
    'plan_updates', ARRAY['in_app'], 'respect', 'progress',
    'Your nutrition goal was updated', 'تم تحديث هدفك الغذائي',
    'Review the latest adjustment and your updated targets.',
    'راجع آخر تعديل وأهدافك المحدثة.'
  ),
  (
    'challenge.reward_granted.v1', 'challenge_reward_granted_v1', 'achievement',
    'achievements', ARRAY['in_app', 'push'], 'respect', 'notifications',
    'Challenge reward earned', 'حصلت على مكافأة التحدي',
    'Your verified challenge reward is now available.',
    'مكافأة التحدي المؤكدة أصبحت متاحة الآن.'
  ),
  (
    'subscription.expired.v1', 'subscription_expired_v1', 'subscription',
    'subscription_updates', ARRAY['in_app', 'push'], 'bypass', 'subscription',
    'Your subscription has ended', 'انتهى اشتراكك',
    'Review your plan options to continue your Nutrio experience.',
    'راجع خيارات الخطط لمواصلة تجربتك مع Nutrio.'
  ),
  (
    'subscription.recovery_due.v1', 'subscription_recovery_due_v1', 'subscription',
    'subscription_updates', ARRAY['in_app', 'push'], 'respect', 'subscription',
    'Your plan is waiting', 'خطتك بانتظارك',
    'Open your subscription to review the available recovery option.',
    'افتح اشتراكك لمراجعة خيار الاستعادة المتاح.'
  ),
  (
    'coach.message_received.v1', 'coach_message_received_v1', 'coach_message',
    'support', ARRAY['in_app', 'push'], 'respect', 'notifications',
    'New message from your coach', 'رسالة جديدة من مدربك',
    'Open Nutrio to read and reply to your coach.',
    'افتح Nutrio لقراءة رسالة مدربك والرد عليها.'
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
  active = true,
  updated_at = now();

ALTER TABLE security.notification_event_deliveries
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS rendered_title TEXT,
  ADD COLUMN IF NOT EXISTS rendered_message TEXT,
  ADD COLUMN IF NOT EXISTS delivery_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notification_event_deliveries_ready_idx
  ON security.notification_event_deliveries (next_attempt_at, created_at, id)
  WHERE channel = 'push' AND status IN ('pending', 'deferred', 'failed', 'processing');

CREATE OR REPLACE FUNCTION security.enqueue_domain_event(
  p_event_type TEXT,
  p_aggregate_type TEXT,
  p_aggregate_id UUID,
  p_audience_user_id UUID,
  p_idempotency_key TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_actor_id UUID DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL,
  p_causation_id UUID DEFAULT NULL,
  p_privacy_classification TEXT DEFAULT 'standard',
  p_occurred_at TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
DECLARE
  v_event_id UUID;
  v_payload JSONB := COALESCE(p_payload, '{}'::JSONB);
BEGIN
  IF p_audience_user_id IS NULL
     OR p_event_type !~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.v[1-9][0-9]*$'
     OR p_aggregate_type !~ '^[a-z][a-z0-9_]{0,79}$'
     OR char_length(COALESCE(p_idempotency_key, '')) NOT BETWEEN 1 AND 220
     OR p_privacy_classification NOT IN ('standard', 'sensitive', 'restricted')
     OR jsonb_typeof(v_payload) <> 'object'
     OR octet_length(v_payload::TEXT) > 4096 THEN
    RAISE EXCEPTION 'invalid_domain_event';
  END IF;

  IF v_payload::TEXT ~* '"(medication|journal|measurement|blood_value|access_token|refresh_token|phone|email)"\s*:' THEN
    RAISE EXCEPTION 'sensitive_domain_event_payload_rejected';
  END IF;

  INSERT INTO security.domain_event_outbox (
    event_type, aggregate_type, aggregate_id, actor_id, audience_user_id,
    idempotency_key, correlation_id, causation_id, payload,
    privacy_classification, occurred_at
  ) VALUES (
    p_event_type, p_aggregate_type, p_aggregate_id, p_actor_id,
    p_audience_user_id, p_idempotency_key, p_correlation_id, p_causation_id,
    v_payload, p_privacy_classification, COALESCE(p_occurred_at, now())
  )
  ON CONFLICT (event_type, idempotency_key) DO UPDATE
    SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.emit_domain_event(
  p_event_type TEXT,
  p_aggregate_type TEXT,
  p_aggregate_id UUID,
  p_audience_user_id UUID,
  p_idempotency_key TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_actor_id UUID DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL,
  p_causation_id UUID DEFAULT NULL,
  p_privacy_classification TEXT DEFAULT 'standard',
  p_occurred_at TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  RETURN security.enqueue_domain_event(
    p_event_type, p_aggregate_type, p_aggregate_id, p_audience_user_id,
    p_idempotency_key, p_payload, p_actor_id, p_correlation_id,
    p_causation_id, p_privacy_classification, p_occurred_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION security.notification_preference_enabled(
  p_user_id UUID,
  p_preference_key TEXT,
  p_channel TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_preferences public.notification_preferences%ROWTYPE;
  v_category_enabled BOOLEAN := true;
BEGIN
  SELECT * INTO v_preferences
  FROM public.notification_preferences
  WHERE user_id = p_user_id;

  IF FOUND THEN
    v_category_enabled := CASE p_preference_key
      WHEN 'meal_reminders' THEN COALESCE(v_preferences.meal_reminders, true)
      WHEN 'order_updates' THEN COALESCE(v_preferences.order_updates, true)
      WHEN 'delivery_updates' THEN COALESCE(v_preferences.delivery_updates, true)
      WHEN 'health_insights' THEN COALESCE(v_preferences.health_insights, true)
      WHEN 'plan_updates' THEN COALESCE(v_preferences.plan_updates, true)
      WHEN 'subscription_updates' THEN COALESCE(v_preferences.subscription_updates, true)
      WHEN 'achievements' THEN COALESCE(v_preferences.achievements, true)
      WHEN 'weekly_summary' THEN COALESCE(v_preferences.weekly_summary, true)
      WHEN 'support' THEN COALESCE(v_preferences.support, true)
      ELSE COALESCE(v_preferences.system_alerts, true)
    END;

    IF p_channel = 'push' THEN
      v_category_enabled := v_category_enabled
        AND COALESCE(v_preferences.push_notifications, true);
    END IF;
  END IF;

  RETURN v_category_enabled;
END;
$function$;

CREATE OR REPLACE FUNCTION security.notification_next_allowed_at(
  p_user_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_catalog, pg_temp
AS $function$
DECLARE
  v_enabled BOOLEAN;
  v_start TIME;
  v_end TIME;
  v_timezone TEXT;
  v_local_now TIMESTAMP;
  v_local_time TIME;
  v_next_local TIMESTAMP;
  v_in_quiet BOOLEAN := false;
BEGIN
  SELECT
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end,
    timezone
  INTO v_enabled, v_start, v_end, v_timezone
  FROM public.notification_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND OR NOT COALESCE(v_enabled, false) OR v_start IS NULL
     OR v_end IS NULL OR v_start = v_end THEN
    RETURN p_now;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timezone) THEN
    v_timezone := 'Asia/Qatar';
  END IF;

  v_local_now := p_now AT TIME ZONE v_timezone;
  v_local_time := v_local_now::TIME;

  IF v_start < v_end THEN
    v_in_quiet := v_local_time >= v_start AND v_local_time < v_end;
    v_next_local := date_trunc('day', v_local_now) + v_end;
  ELSE
    v_in_quiet := v_local_time >= v_start OR v_local_time < v_end;
    v_next_local := CASE
      WHEN v_local_time >= v_start
        THEN date_trunc('day', v_local_now) + interval '1 day' + v_end
      ELSE date_trunc('day', v_local_now) + v_end
    END;
  END IF;

  IF NOT v_in_quiet THEN
    RETURN p_now;
  END IF;

  RETURN v_next_local AT TIME ZONE v_timezone;
END;
$function$;

CREATE OR REPLACE FUNCTION security.expand_domain_event(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
DECLARE
  v_event security.domain_event_outbox%ROWTYPE;
  v_template security.notification_event_templates%ROWTYPE;
  v_locale TEXT := 'en';
  v_title TEXT;
  v_message TEXT;
  v_notification_id UUID;
  v_channel TEXT;
  v_allowed BOOLEAN;
  v_deferred_until TIMESTAMPTZ;
  v_delivery_status TEXT;
  v_data JSONB;
BEGIN
  SELECT * INTO v_event
  FROM security.domain_event_outbox
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'domain_event_not_found';
  END IF;

  SELECT * INTO v_template
  FROM security.notification_event_templates
  WHERE event_type = v_event.event_type
    AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification_template_not_found';
  END IF;

  SELECT COALESCE(preferred_language::TEXT, 'en')
  INTO v_locale
  FROM public.profiles
  WHERE user_id = v_event.audience_user_id
  LIMIT 1;

  v_locale := CASE WHEN v_locale = 'ar' THEN 'ar' ELSE 'en' END;
  v_title := CASE WHEN v_locale = 'ar' THEN v_template.title_ar ELSE v_template.title_en END;
  v_message := CASE WHEN v_locale = 'ar' THEN v_template.body_ar ELSE v_template.body_en END;
  v_data := jsonb_strip_nulls(jsonb_build_object(
    'type', v_template.deep_link_type,
    'id', CASE
      WHEN v_template.deep_link_type IN ('order_detail', 'delivery_tracking', 'restaurant', 'meal_detail')
        THEN v_event.aggregate_id::TEXT
      ELSE NULL
    END,
    'event_id', v_event.id::TEXT,
    'event_type', v_event.event_type
  ));

  IF security.notification_preference_enabled(
    v_event.audience_user_id, v_template.preference_key, 'in_app'
  ) THEN
    SELECT notification_id INTO v_notification_id
    FROM security.notification_event_deliveries
    WHERE event_id = v_event.id AND notification_id IS NOT NULL
    ORDER BY created_at
    LIMIT 1;

    IF v_notification_id IS NULL THEN
      INSERT INTO public.notifications (
        user_id, type, title, message, status, data, related_entity_type,
        related_entity_id, scheduled_for, template_key, event_type,
        preference_key, deep_link_type
      ) VALUES (
        v_event.audience_user_id,
        v_template.notification_type::public.notification_type,
        v_title,
        v_message,
        'unread'::public.notification_status,
        v_data,
        v_event.aggregate_type,
        v_event.aggregate_id,
        now(),
        v_template.template_key,
        v_event.event_type,
        v_template.preference_key,
        v_template.deep_link_type
      ) RETURNING id INTO v_notification_id;
    END IF;
  END IF;

  FOREACH v_channel IN ARRAY v_template.channels LOOP
    v_allowed := security.notification_preference_enabled(
      v_event.audience_user_id, v_template.preference_key, v_channel
    );
    v_deferred_until := now();
    v_delivery_status := 'pending';

    IF NOT v_allowed THEN
      v_delivery_status := 'suppressed';
    ELSIF v_channel = 'in_app' THEN
      v_delivery_status := 'delivered';
    ELSIF v_template.quiet_hours_policy = 'respect' THEN
      v_deferred_until := security.notification_next_allowed_at(
        v_event.audience_user_id, now()
      );
      IF v_deferred_until > now() + interval '1 second' THEN
        v_delivery_status := 'deferred';
      END IF;
    END IF;

    INSERT INTO security.notification_event_deliveries (
      event_id, notification_id, user_id, event_type, template_key,
      notification_type, preference_key, channel, status, dedupe_key,
      quiet_hours_policy, deep_link_type, deferred_until, suppressed_at,
      suppression_reason, analytics_event, locale, rendered_title,
      rendered_message, delivery_data, next_attempt_at, delivered_at,
      provider_message_id, updated_at
    ) VALUES (
      v_event.id,
      v_notification_id,
      v_event.audience_user_id,
      v_event.event_type,
      v_template.template_key,
      v_template.notification_type,
      v_template.preference_key,
      v_channel,
      v_delivery_status,
      v_event.id::TEXT || ':' || v_channel,
      v_template.quiet_hours_policy,
      v_template.deep_link_type,
      CASE WHEN v_delivery_status = 'deferred' THEN v_deferred_until ELSE NULL END,
      CASE WHEN v_delivery_status = 'suppressed' THEN now() ELSE NULL END,
      CASE WHEN v_delivery_status = 'suppressed' THEN 'preference_disabled' ELSE NULL END,
      CASE
        WHEN v_delivery_status = 'suppressed' THEN 'notification_suppressed'
        WHEN v_delivery_status = 'deferred' THEN 'notification_deferred'
        ELSE 'notification_created'
      END,
      v_locale,
      v_title,
      v_message,
      v_data,
      CASE WHEN v_delivery_status = 'deferred' THEN v_deferred_until ELSE now() END,
      CASE WHEN v_delivery_status = 'delivered' THEN now() ELSE NULL END,
      CASE WHEN v_delivery_status = 'delivered' THEN 'database' ELSE NULL END,
      now()
    )
    ON CONFLICT (user_id, channel, dedupe_key) DO NOTHING;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_notification_domain_events(
  p_limit INTEGER DEFAULT 50,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
DECLARE
  v_event RECORD;
  v_processed INTEGER := 0;
  v_failed INTEGER := 0;
  v_dead_lettered INTEGER := 0;
  v_error_code TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  FOR v_event IN
    WITH candidates AS (
      SELECT id
      FROM security.domain_event_outbox
      WHERE (
        status IN ('pending', 'failed') AND next_attempt_at <= now()
      ) OR (
        status = 'processing' AND lease_expires_at <= now()
      )
      ORDER BY occurred_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 250))
    ), claimed AS (
      UPDATE security.domain_event_outbox outbox
      SET status = 'processing',
          attempt_count = LEAST(outbox.attempt_count + 1, 20),
          lease_token = gen_random_uuid(),
          lease_expires_at = now() + make_interval(secs => GREATEST(30, LEAST(COALESCE(p_lease_seconds, 120), 600))),
          last_error_code = NULL
      FROM candidates
      WHERE outbox.id = candidates.id
      RETURNING outbox.id, outbox.attempt_count, outbox.max_attempts
    )
    SELECT * FROM claimed
  LOOP
    BEGIN
      PERFORM security.expand_domain_event(v_event.id);
      UPDATE security.domain_event_outbox
      SET status = 'completed',
          processed_at = now(),
          lease_token = NULL,
          lease_expires_at = NULL,
          last_error_code = NULL
      WHERE id = v_event.id;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_error_code := COALESCE(
        security.safe_notification_error_code(SQLSTATE || '_' || SQLERRM),
        'domain_event_processing_failed'
      );
      UPDATE security.domain_event_outbox
      SET status = CASE
            WHEN attempt_count >= max_attempts THEN 'dead_letter'
            ELSE 'failed'
          END,
          next_attempt_at = now() + make_interval(
            secs => LEAST(21600, (60 * power(5, GREATEST(attempt_count - 1, 0)))::INTEGER)
          ),
          lease_token = NULL,
          lease_expires_at = NULL,
          last_error_code = v_error_code
      WHERE id = v_event.id;

      IF v_event.attempt_count >= v_event.max_attempts THEN
        v_dead_lettered := v_dead_lettered + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'failed', v_failed,
    'dead_lettered', v_dead_lettered
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_notification_event_deliveries(
  p_limit INTEGER DEFAULT 50,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
  delivery_id UUID,
  notification_id UUID,
  user_id UUID,
  dedupe_key TEXT,
  attempt_count INTEGER,
  max_attempts INTEGER,
  lease_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery.id
    FROM security.notification_event_deliveries delivery
    WHERE delivery.channel = 'push'
      AND delivery.notification_id IS NOT NULL
      AND (
        (delivery.status IN ('pending', 'deferred', 'failed') AND delivery.next_attempt_at <= now())
        OR (delivery.status = 'processing' AND delivery.lease_expires_at <= now())
      )
    ORDER BY delivery.next_attempt_at, delivery.created_at, delivery.id
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 250))
  ), claimed AS (
    UPDATE security.notification_event_deliveries delivery
    SET status = 'processing',
        attempt_count = LEAST(delivery.attempt_count + 1, 20),
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(secs => GREATEST(30, LEAST(COALESCE(p_lease_seconds, 120), 600))),
        last_error_code = NULL,
        updated_at = now()
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.id, delivery.notification_id, delivery.user_id,
      delivery.dedupe_key, delivery.attempt_count, delivery.max_attempts,
      delivery.lease_token
  )
  SELECT * FROM claimed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_notification_event_delivery(
  p_delivery_id UUID,
  p_lease_token UUID,
  p_success BOOLEAN,
  p_retryable BOOLEAN DEFAULT true,
  p_error_code TEXT DEFAULT NULL,
  p_provider_message_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
DECLARE
  v_delivery security.notification_event_deliveries%ROWTYPE;
  v_status TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  SELECT * INTO v_delivery
  FROM security.notification_event_deliveries
  WHERE id = p_delivery_id
    AND lease_token = p_lease_token
    AND status = 'processing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification_delivery_lease_invalid';
  END IF;

  IF COALESCE(p_success, false) THEN
    v_status := 'delivered';
    UPDATE security.notification_event_deliveries
    SET status = v_status,
        delivered_at = now(),
        provider_message_id = NULLIF(left(COALESCE(p_provider_message_id, ''), 250), ''),
        retryable = false,
        last_error_code = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        analytics_event = 'notification_delivery_succeeded',
        updated_at = now()
    WHERE id = p_delivery_id;
  ELSE
    v_status := CASE
      WHEN NOT COALESCE(p_retryable, true) OR v_delivery.attempt_count >= v_delivery.max_attempts
        THEN 'dead_letter'
      ELSE 'failed'
    END;

    UPDATE security.notification_event_deliveries
    SET status = v_status,
        retryable = COALESCE(p_retryable, true),
        last_error_code = COALESCE(
          security.safe_notification_error_code(p_error_code),
          'notification_delivery_failed'
        ),
        next_attempt_at = now() + make_interval(
          secs => LEAST(21600, (60 * power(5, GREATEST(attempt_count - 1, 0)))::INTEGER)
        ),
        failed_at = now(),
        lease_token = NULL,
        lease_expires_at = NULL,
        analytics_event = CASE
          WHEN v_status = 'dead_letter' THEN 'notification_dead_lettered'
          ELSE 'notification_delivery_failed'
        END,
        updated_at = now()
    WHERE id = p_delivery_id;
  END IF;

  RETURN jsonb_build_object(
    'delivery_id', p_delivery_id,
    'status', v_status,
    'attempt_count', v_delivery.attempt_count
  );
END;
$function$;

DO $do$
DECLARE
  v_secret TEXT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Supabase Vault is required for the notification worker';
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'notification_worker_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_secret IS NULL THEN
    IF to_regprocedure('vault.create_secret(text,text,text,uuid)') IS NOT NULL THEN
      PERFORM vault.create_secret(
        encode(extensions.gen_random_bytes(32), 'hex'),
        'notification_worker_secret',
        'Nutrio domain-event notification worker authentication secret',
        NULL
      );
    ELSE
      PERFORM vault.create_secret(
        encode(extensions.gen_random_bytes(32), 'hex'),
        'notification_worker_secret',
        'Nutrio domain-event notification worker authentication secret'
      );
    END IF;
  END IF;
END;
$do$;

CREATE OR REPLACE FUNCTION public.verify_notification_worker_secret(p_candidate TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO security, vault, extensions, pg_temp
AS $function$
DECLARE
  v_expected TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN false;
  END IF;

  SELECT decrypted_secret INTO v_expected
  FROM vault.decrypted_secrets
  WHERE name = 'notification_worker_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_expected IS NOT NULL
    AND p_candidate IS NOT NULL
    AND char_length(p_candidate) BETWEEN 32 AND 256
    AND extensions.digest(v_expected, 'sha256') = extensions.digest(p_candidate, 'sha256');
END;
$function$;

CREATE OR REPLACE FUNCTION public.invoke_notification_event_worker()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, vault, net, public, pg_temp
AS $function$
DECLARE
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'notification_worker_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'notification_worker_secret_unavailable';
  END IF;

  SELECT net.http_post(
    url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/process-notification-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-worker-secret', v_secret
    ),
    body := '{"limit":50}'::JSONB,
    timeout_milliseconds := 25000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION security.emit_order_delivered_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  IF lower(COALESCE(NEW.status, '')) = 'delivered'
     AND (TG_OP = 'INSERT' OR lower(COALESCE(OLD.status, '')) IS DISTINCT FROM 'delivered') THEN
    PERFORM security.enqueue_domain_event(
      'order.delivered.v1', 'order', NEW.id, NEW.user_id,
      'order:' || NEW.id::TEXT || ':delivered',
      jsonb_build_object('order_id', NEW.id), NULL, NULL, NULL, 'standard',
      COALESCE(NEW.delivered_at, NEW.updated_at, now())
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.emit_meal_consumption_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  IF NEW.event_type IN ('consumed', 'substituted') THEN
    PERFORM security.enqueue_domain_event(
      'meal.consumption_recorded.v1', 'meal_consumption', NEW.consumption_id,
      NEW.user_id, 'meal-consumption-event:' || NEW.id::TEXT,
      jsonb_build_object('consumption_id', NEW.consumption_id, 'source_type', NEW.source_type),
      NEW.user_id, NULL, NULL, 'sensitive', NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.emit_weekly_report_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  PERFORM security.enqueue_domain_event(
    'health.weekly_report_ready.v1', 'weekly_nutrition_report', NEW.id,
    NEW.user_id, 'weekly-report:' || NEW.id::TEXT,
    jsonb_build_object('report_id', NEW.id, 'week_start_date', NEW.week_start_date),
    NULL, NULL, NULL, 'sensitive', COALESCE(NEW.generated_at, now())
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.emit_goal_adjustment_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  IF NEW.event_type IN ('smart_adjusted', 'coach_updated', 'recalculated') THEN
    PERFORM security.enqueue_domain_event(
      'goal.adjustment_recommended.v1', 'nutrition_goal', NEW.goal_id,
      NEW.user_id, 'goal-event:' || NEW.id::TEXT,
      jsonb_build_object('goal_id', NEW.goal_id, 'adjustment_type', NEW.event_type),
      NEW.user_id, NULL, NULL, 'sensitive', NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.emit_challenge_reward_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  IF NEW.status = 'granted' THEN
    PERFORM security.enqueue_domain_event(
      'challenge.reward_granted.v1', 'community_challenge', NEW.challenge_id,
      NEW.user_id, 'challenge-settlement:' || NEW.id::TEXT,
      jsonb_build_object('challenge_id', NEW.challenge_id, 'settlement_id', NEW.id),
      NULL, NULL, NULL, 'standard', COALESCE(NEW.granted_at, now())
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.emit_subscription_expired_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.status::TEXT = 'expired'
     AND (TG_OP = 'INSERT' OR OLD.status::TEXT IS DISTINCT FROM 'expired') THEN
    v_user_id := COALESCE(NEW.user_id, NEW.subscriber_id);
    IF v_user_id IS NOT NULL THEN
      PERFORM security.enqueue_domain_event(
        'subscription.expired.v1', 'subscription', NEW.id, v_user_id,
        'subscription:' || NEW.id::TEXT || ':expired',
        jsonb_build_object('subscription_id', NEW.id), NULL, NULL, NULL,
        'standard', COALESCE(NEW.expired_at, NEW.updated_at, now())
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION security.emit_coach_message_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, pg_temp
AS $function$
BEGIN
  IF NEW.sender_role = 'coach' THEN
    PERFORM security.enqueue_domain_event(
      'coach.message_received.v1', 'coach_message', NEW.id, NEW.client_id,
      'coach-message:' || NEW.id::TEXT,
      jsonb_build_object('message_id', NEW.id, 'coach_id', NEW.coach_id),
      NEW.coach_id, NULL, NULL, 'restricted', NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_emit_delivered_domain_event ON public.orders;
CREATE TRIGGER orders_emit_delivered_domain_event
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION security.emit_order_delivered_domain_event();

DROP TRIGGER IF EXISTS meal_consumption_emit_domain_event ON public.meal_consumption_events;
CREATE TRIGGER meal_consumption_emit_domain_event
  AFTER INSERT ON public.meal_consumption_events
  FOR EACH ROW EXECUTE FUNCTION security.emit_meal_consumption_domain_event();

DROP TRIGGER IF EXISTS weekly_report_emit_domain_event ON public.weekly_nutrition_reports;
CREATE TRIGGER weekly_report_emit_domain_event
  AFTER INSERT ON public.weekly_nutrition_reports
  FOR EACH ROW EXECUTE FUNCTION security.emit_weekly_report_domain_event();

DROP TRIGGER IF EXISTS nutrition_goal_emit_adjustment_domain_event ON public.nutrition_goal_events;
CREATE TRIGGER nutrition_goal_emit_adjustment_domain_event
  AFTER INSERT ON public.nutrition_goal_events
  FOR EACH ROW EXECUTE FUNCTION security.emit_goal_adjustment_domain_event();

DROP TRIGGER IF EXISTS challenge_reward_emit_domain_event ON public.community_challenge_reward_settlements;
CREATE TRIGGER challenge_reward_emit_domain_event
  AFTER INSERT ON public.community_challenge_reward_settlements
  FOR EACH ROW EXECUTE FUNCTION security.emit_challenge_reward_domain_event();

DROP TRIGGER IF EXISTS subscription_emit_expired_domain_event ON public.subscriptions;
CREATE TRIGGER subscription_emit_expired_domain_event
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION security.emit_subscription_expired_domain_event();

DROP TRIGGER IF EXISTS coach_message_emit_domain_event ON public.coach_messages;
CREATE TRIGGER coach_message_emit_domain_event
  AFTER INSERT ON public.coach_messages
  FOR EACH ROW EXECUTE FUNCTION security.emit_coach_message_domain_event();

CREATE OR REPLACE VIEW security.notification_pipeline_status AS
SELECT
  'domain_event'::TEXT AS queue,
  event_type AS category,
  status,
  count(*)::INTEGER AS item_count,
  min(created_at) AS oldest_created_at,
  max(attempt_count)::INTEGER AS max_attempt_count,
  array_remove(array_agg(DISTINCT last_error_code), NULL) AS error_codes
FROM security.domain_event_outbox
GROUP BY event_type, status
UNION ALL
SELECT
  'delivery'::TEXT,
  template_key,
  status,
  count(*)::INTEGER,
  min(created_at),
  max(attempt_count)::INTEGER,
  array_remove(array_agg(DISTINCT last_error_code), NULL)
FROM security.notification_event_deliveries
GROUP BY template_key, status;

REVOKE ALL ON security.notification_pipeline_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON security.notification_pipeline_status TO service_role;

REVOKE ALL ON FUNCTION security.enqueue_domain_event(TEXT, TEXT, UUID, UUID, TEXT, JSONB, UUID, UUID, UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.notification_preference_enabled(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.notification_next_allowed_at(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION security.expand_domain_event(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.emit_domain_event(TEXT, TEXT, UUID, UUID, TEXT, JSONB, UUID, UUID, UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_notification_domain_events(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_notification_event_deliveries(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_notification_event_delivery(UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_notification_worker_secret(TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_notification_event_worker()
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.emit_domain_event(TEXT, TEXT, UUID, UUID, TEXT, JSONB, UUID, UUID, UUID, TEXT, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.process_notification_domain_events(INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_notification_event_deliveries(INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_event_delivery(UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_notification_worker_secret(TEXT)
  TO service_role;

DO $do$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    SELECT jobid INTO v_job_id
    FROM cron.job
    WHERE jobname = 'process-domain-event-notifications'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'process-domain-event-notifications',
      '* * * * *',
      'SELECT public.invoke_notification_event_worker();'
    );
  END IF;
END;
$do$;

COMMENT ON TABLE security.domain_event_outbox IS
  'Transactional, replay-safe phase-one domain event outbox.';
COMMENT ON TABLE security.notification_event_templates IS
  'Server-owned bilingual notification templates and routing policy.';
COMMENT ON FUNCTION public.process_notification_domain_events(INTEGER, INTEGER) IS
  'Claims domain events with SKIP LOCKED and materializes preference-aware localized deliveries.';
COMMENT ON FUNCTION public.complete_notification_event_delivery(UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT) IS
  'Completes a leased delivery with bounded exponential retry and dead-letter routing.';

COMMIT;
