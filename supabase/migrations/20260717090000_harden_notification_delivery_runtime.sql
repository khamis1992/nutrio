-- Harden invoice numbering, notification workers, and post-expiry recovery delivery.

BEGIN;

-- ---------------------------------------------------------------------------
-- Collision-resistant invoice numbers
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

DO $do$
DECLARE
  v_existing_max BIGINT := 0;
  v_sequence_value BIGINT := 1;
  v_sequence_called BOOLEAN := false;
  v_floor BIGINT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN i.invoice_number ~ '[0-9]+$'
        AND char_length(substring(i.invoice_number FROM '([0-9]+)$')) <= 18
        THEN substring(i.invoice_number FROM '([0-9]+)$')::BIGINT
      ELSE NULL
    END
  ), 0)
  INTO v_existing_max
  FROM public.invoices i;

  SELECT last_value, is_called
  INTO v_sequence_value, v_sequence_called
  FROM public.invoice_number_seq;

  v_floor := GREATEST(
    v_existing_max,
    CASE WHEN v_sequence_called THEN v_sequence_value ELSE 0 END
  );

  PERFORM setval(
    'public.invoice_number_seq'::REGCLASS,
    GREATEST(v_floor, 1),
    v_floor > 0
  );
END;
$do$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public, pg_catalog, pg_temp
AS $function$
DECLARE
  v_prefix TEXT;
  v_sequence BIGINT;
BEGIN
  v_prefix := CASE lower(trim(COALESCE(p_type, '')))
    WHEN 'subscription' THEN 'SUB'
    WHEN 'wallet_topup' THEN 'WAL'
    WHEN 'partner_payout' THEN 'PTR'
    WHEN 'driver_payout' THEN 'DRV'
    WHEN 'order' THEN 'ORD'
    ELSE 'INV'
  END;

  v_sequence := nextval('public.invoice_number_seq'::REGCLASS);
  RETURN format(
    '%s-%s-%s',
    v_prefix,
    to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDD'),
    lpad(
      v_sequence::TEXT,
      GREATEST(12, char_length(v_sequence::TEXT)),
      '0'
    )
  );
END;
$function$;

REVOKE ALL ON SEQUENCE public.invoice_number_seq
  FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.invoice_number_seq TO service_role;
REVOKE ALL ON FUNCTION public.generate_invoice_number(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Provider delivery completion and WhatsApp Edge-safe leases
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION security.normalize_notification_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO pg_catalog
AS $function$
  WITH digits AS (
    SELECT regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g') AS value
  ), international AS (
    SELECT CASE
      WHEN value LIKE '00%' THEN substring(value FROM 3)
      ELSE value
    END AS value
    FROM digits
  )
  SELECT CASE
    WHEN char_length(value) = 8 THEN '974' || value
    ELSE value
  END
  FROM international;
$function$;

REVOKE ALL ON FUNCTION security.normalize_notification_phone(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION security.normalize_notification_phone(TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.complete_notification_delivery(
  p_channel TEXT,
  p_idempotency_key TEXT,
  p_claim_token UUID,
  p_succeeded BOOLEAN,
  p_provider_message_id TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_updated INTEGER;
  v_channel TEXT := lower(trim(COALESCE(p_channel, '')));
  v_error_code TEXT := NULLIF(left(regexp_replace(
    lower(COALESCE(p_error_code, 'delivery_failed')),
    '[^a-z0-9_.-]', '', 'g'
  ), 120), '');
  v_provider_message_id TEXT := NULLIF(
    left(trim(COALESCE(p_provider_message_id, '')), 250),
    ''
  );
  v_terminal_ambiguous BOOLEAN;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_succeeded AND (
    v_provider_message_id IS NULL
    OR v_provider_message_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,249}$'
  ) THEN
    RAISE EXCEPTION 'Verified provider message id required';
  END IF;

  -- A 2xx UltraMsg response without its explicit success contract may already
  -- have sent the message. Exhaust this idempotency claim instead of risking
  -- repeated customer messages. Transport/5xx failures remain retryable.
  v_terminal_ambiguous := NOT p_succeeded
    AND v_channel = 'whatsapp'
    AND v_error_code = 'provider_unverified_response';

  UPDATE security.notification_delivery_claims
  SET status = CASE WHEN p_succeeded THEN 'completed' ELSE 'failed' END,
      completed_at = CASE WHEN p_succeeded THEN clock_timestamp() ELSE NULL END,
      lease_expires_at = clock_timestamp(),
      provider_message_id = CASE
        WHEN p_succeeded THEN v_provider_message_id
        ELSE NULL
      END,
      last_error_code = CASE WHEN p_succeeded THEN NULL ELSE v_error_code END,
      attempts = CASE
        WHEN v_terminal_ambiguous THEN GREATEST(attempts, 5)
        ELSE attempts
      END,
      updated_at = clock_timestamp()
  WHERE channel = v_channel
    AND idempotency_key = trim(COALESCE(p_idempotency_key, ''))
    AND claim_token = p_claim_token
    AND status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_notification_delivery(
  TEXT, TEXT, UUID, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_notification_delivery(
  TEXT, TEXT, UUID, BOOLEAN, TEXT, TEXT
) TO service_role;

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS preference_key TEXT NOT NULL DEFAULT 'order_updates',
  ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMPTZ;

UPDATE public.notification_queue
SET phone = security.normalize_notification_phone(phone),
    updated_at = clock_timestamp()
WHERE char_length(security.normalize_notification_phone(phone)) BETWEEN 8 AND 15
  AND phone IS DISTINCT FROM security.normalize_notification_phone(phone);

UPDATE public.notification_queue
SET preference_key = CASE
  WHEN lower(COALESCE(template, '')) LIKE '%delivery%' THEN 'delivery_updates'
  WHEN lower(COALESCE(template, '')) LIKE '%support%' THEN 'support'
  ELSE 'order_updates'
END
WHERE preference_key IS NULL
   OR preference_key NOT IN ('order_updates', 'delivery_updates', 'support')
   OR (
     preference_key = 'order_updates'
     AND (
       lower(COALESCE(template, '')) LIKE '%delivery%'
       OR lower(COALESCE(template, '')) LIKE '%support%'
     )
   );

-- Existing queue rows predate user ownership. Attach them only when the
-- normalized phone maps to exactly one verified Auth identity. Ambiguous or
-- unverified rows are suppressed so they cannot inherit a customer's channel
-- preferences accidentally or reach the provider.
WITH verified_auth_phones AS (
  SELECT
    security.normalize_notification_phone(u.phone) AS normalized_phone,
    (array_agg(u.id ORDER BY u.id))[1] AS user_id
  FROM auth.users u
  WHERE u.phone_confirmed_at IS NOT NULL
    AND char_length(security.normalize_notification_phone(u.phone))
      BETWEEN 8 AND 15
  GROUP BY security.normalize_notification_phone(u.phone)
  HAVING count(*) = 1
)
UPDATE public.notification_queue q
SET user_id = verified.user_id,
    updated_at = clock_timestamp()
FROM verified_auth_phones verified
WHERE q.user_id IS NULL
  AND security.normalize_notification_phone(q.phone) = verified.normalized_phone;

UPDATE public.notification_queue
SET status = 'suppressed',
    error_message = 'verified_recipient_required',
    suppressed_at = clock_timestamp(),
    claim_token = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL,
    next_attempt_at = NULL,
    updated_at = clock_timestamp()
WHERE user_id IS NULL
  AND status IN ('pending', 'processing');

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_queue_user_id_fkey'
      AND conrelid = 'public.notification_queue'::REGCLASS
  ) THEN
    ALTER TABLE public.notification_queue
      ADD CONSTRAINT notification_queue_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_queue_preference_key_check'
      AND conrelid = 'public.notification_queue'::REGCLASS
  ) THEN
    ALTER TABLE public.notification_queue
      ADD CONSTRAINT notification_queue_preference_key_check
      CHECK (preference_key IN ('order_updates', 'delivery_updates', 'support'))
      NOT VALID;
  END IF;
END;
$do$;

ALTER TABLE public.notification_queue
  VALIDATE CONSTRAINT notification_queue_user_id_fkey;
ALTER TABLE public.notification_queue
  VALIDATE CONSTRAINT notification_queue_preference_key_check;

CREATE INDEX IF NOT EXISTS notification_queue_user_pending_idx
  ON public.notification_queue (user_id, next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.send_whatsapp_notification(
  p_phone TEXT,
  p_message TEXT,
  p_template TEXT DEFAULT 'custom'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_phone TEXT := security.normalize_notification_phone(p_phone);
  v_message TEXT := trim(COALESCE(p_message, ''));
  v_template TEXT := left(trim(COALESCE(p_template, 'custom')), 100);
  v_preference_key TEXT;
  v_user_id UUID;
  v_user_matches INTEGER := 0;
  v_enabled BOOLEAN := true;
  v_suppression_reason TEXT;
BEGIN
  IF char_length(v_phone) NOT BETWEEN 8 AND 15
     OR char_length(v_message) NOT BETWEEN 1 AND 2000 THEN
    -- This function is called by business-data triggers. A malformed optional
    -- notification must not roll back the delivery/order transaction.
    RAISE WARNING 'Skipped invalid WhatsApp notification payload';
    RETURN;
  END IF;

  v_preference_key := CASE
    WHEN lower(v_template) LIKE '%delivery%' THEN 'delivery_updates'
    WHEN lower(v_template) LIKE '%support%' THEN 'support'
    ELSE 'order_updates'
  END;

  SELECT
    CASE WHEN count(*) = 1 THEN (array_agg(u.id ORDER BY u.id))[1] END,
    count(*)::INTEGER
  INTO v_user_id, v_user_matches
  FROM auth.users u
  WHERE u.phone_confirmed_at IS NOT NULL
    AND security.normalize_notification_phone(u.phone) = v_phone;

  IF v_user_matches = 1 THEN
    SELECT lower(COALESCE(
      p.notification_preferences #>> ARRAY['whatsapp', v_preference_key],
      'true'
    )) NOT IN ('false', '0', 'off', 'no')
    INTO v_enabled
    FROM public.profiles p
    WHERE p.user_id = v_user_id;
    v_enabled := COALESCE(v_enabled, true);
    IF NOT v_enabled THEN
      v_suppression_reason := 'channel_disabled';
    END IF;
  ELSE
    v_user_id := NULL;
    v_enabled := false;
    v_suppression_reason := 'verified_recipient_required';
  END IF;

  INSERT INTO public.notification_queue (
    user_id,
    phone,
    message,
    template,
    preference_key,
    status,
    error_message,
    suppressed_at,
    next_attempt_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_phone,
    v_message,
    v_template,
    v_preference_key,
    CASE WHEN v_enabled THEN 'pending' ELSE 'suppressed' END,
    CASE WHEN v_enabled THEN NULL ELSE v_suppression_reason END,
    CASE WHEN v_enabled THEN NULL ELSE clock_timestamp() END,
    CASE WHEN v_enabled THEN clock_timestamp() ELSE NULL END,
    clock_timestamp(),
    clock_timestamp()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.send_whatsapp_notification(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_whatsapp_notification(TEXT, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_notifications(
  p_limit INTEGER DEFAULT 3,
  p_lease_seconds INTEGER DEFAULT 90
)
RETURNS TABLE (
  notification_id UUID,
  phone TEXT,
  message TEXT,
  template TEXT,
  claim_token UUID,
  attempt_number INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_limit NOT BETWEEN 1 AND 3 OR p_lease_seconds NOT BETWEEN 30 AND 120 THEN
    RAISE EXCEPTION 'Invalid WhatsApp claim configuration';
  END IF;

  UPDATE public.notification_queue q
  SET status = 'suppressed',
      error_message = 'verified_recipient_required',
      suppressed_at = clock_timestamp(),
      claim_token = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL,
      next_attempt_at = NULL,
      updated_at = clock_timestamp()
  WHERE q.user_id IS NULL
    AND (
      q.status = 'pending'
      OR (
        q.status = 'processing'
        AND COALESCE(q.lease_expires_at, '-infinity'::TIMESTAMPTZ)
          <= clock_timestamp()
      )
    );

  UPDATE public.notification_queue q
  SET status = 'suppressed',
      error_message = 'channel_disabled',
      suppressed_at = clock_timestamp(),
      claim_token = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL,
      next_attempt_at = NULL,
      updated_at = clock_timestamp()
  WHERE q.user_id IS NOT NULL
    AND (
      q.status = 'pending'
      OR (
        q.status = 'processing'
        AND COALESCE(q.lease_expires_at, '-infinity'::TIMESTAMPTZ)
          <= clock_timestamp()
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = q.user_id
        AND lower(COALESCE(
          p.notification_preferences #>> ARRAY['whatsapp', q.preference_key],
          'true'
        )) IN ('false', '0', 'off', 'no')
    );

  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.notification_queue q
    WHERE q.user_id IS NOT NULL
      AND COALESCE(q.attempts, 0) < GREATEST(COALESCE(q.max_attempts, 5), 1)
      AND (
        (
          q.status = 'pending'
          AND COALESCE(q.next_attempt_at, q.created_at, clock_timestamp())
            <= clock_timestamp()
        )
        OR (
          q.status = 'processing'
          AND COALESCE(q.lease_expires_at, '-infinity'::TIMESTAMPTZ)
            <= clock_timestamp()
        )
      )
    ORDER BY COALESCE(q.next_attempt_at, q.created_at), q.created_at, q.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_queue q
  SET status = 'processing',
      attempts = COALESCE(q.attempts, 0) + 1,
      claim_token = gen_random_uuid(),
      claimed_at = clock_timestamp(),
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      error_message = NULL,
      updated_at = clock_timestamp()
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.id, q.phone, q.message, q.template, q.claim_token, q.attempts;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_notifications(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_notifications(INTEGER, INTEGER)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Recovery notifications are post-expiry only: +1 day, +3 days, +7 days.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION security.next_subscription_recovery_stage(
  p_expired_at TIMESTAMPTZ,
  p_now TIMESTAMPTZ,
  p_minus_7_sent BOOLEAN,
  p_minus_3_sent BOOLEAN,
  p_minus_1_sent BOOLEAN,
  p_plus_1_sent BOOLEAN,
  p_plus_3_sent BOOLEAN,
  p_plus_7_sent BOOLEAN
)
RETURNS TEXT
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path TO pg_catalog
AS $function$
  SELECT CASE
    WHEN p_expired_at IS NULL OR p_now < p_expired_at + interval '1 day' THEN NULL
    WHEN COALESCE(p_plus_7_sent, false) THEN NULL
    WHEN COALESCE(p_plus_3_sent, false) THEN CASE
      WHEN p_now >= p_expired_at + interval '7 days' THEN 't_plus_7'
      ELSE NULL
    END
    WHEN COALESCE(p_plus_1_sent, false) THEN CASE
      WHEN p_now >= p_expired_at + interval '3 days' THEN 't_plus_3'
      ELSE NULL
    END
    WHEN p_now >= p_expired_at + interval '1 day' THEN 't_plus_1'
    ELSE NULL
  END;
$function$;

REVOKE ALL ON FUNCTION security.next_subscription_recovery_stage(
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION security.next_subscription_recovery_stage(
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) TO service_role;

-- Some early retention migrations installed a closed action enum that predates
-- subscription recovery. Replace only checks that reference action_type with a
-- bounded identifier format. NOT VALID preserves unusual historical rows while
-- still enforcing the contract for every new audit event.
DO $do$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.retention_audit_logs'::REGCLASS
      AND c.contype = 'c'
      AND position('action_type' IN pg_get_constraintdef(c.oid)) > 0
  LOOP
    EXECUTE format(
      'ALTER TABLE public.retention_audit_logs DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;
END;
$do$;

ALTER TABLE public.retention_audit_logs
  ADD CONSTRAINT retention_audit_logs_action_type_format_check
  CHECK (action_type ~ '^[a-z][a-z0-9_]{0,127}$') NOT VALID;

CREATE OR REPLACE FUNCTION public.check_and_expire_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_expired_count INTEGER := 0;
  v_recovery_count INTEGER := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT s.id
    FROM public.subscriptions s
    WHERE s.status = 'cancelled'
      AND s.end_date IS NOT NULL
      AND s.end_date < CURRENT_DATE
      AND s.expired_at IS NULL
    ORDER BY s.end_date, s.id
    LIMIT 25
    FOR UPDATE SKIP LOCKED
  ),
  expired_subscriptions AS (
    UPDATE public.subscriptions s
    SET status = 'expired',
        active = false,
        expired_at = COALESCE(s.expired_at, s.end_date::TIMESTAMPTZ),
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE s.id = c.id
    RETURNING s.id, s.user_id, s.expired_at, s.end_date, s.tier
  ),
  inserted_recoveries AS (
    INSERT INTO public.subscription_recovery (
      user_id,
      subscription_id,
      expired_at,
      recovery_status,
      next_notif_due_at,
      reactivation_tier,
      created_at,
      updated_at
    )
    SELECT
      e.user_id,
      e.id,
      e.expired_at,
      'pending',
      e.expired_at + interval '1 day',
      e.tier,
      clock_timestamp(),
      clock_timestamp()
    FROM expired_subscriptions e
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.subscription_recovery existing
      WHERE existing.subscription_id = e.id
        AND existing.recovery_status IN (
          'pending', 'offer_viewed', 'offer_accepted'
        )
    )
    RETURNING id
  ),
  inserted_audit AS (
    INSERT INTO public.retention_audit_logs (
      user_id,
      subscription_id,
      action_type,
      action_details,
      triggered_by
    )
    SELECT
      e.user_id,
      e.id,
      'subscription_expired',
      jsonb_build_object('end_date', e.end_date),
      'system'
    FROM expired_subscriptions e
    RETURNING id
  )
  SELECT
    (SELECT count(*)::INTEGER FROM expired_subscriptions),
    (SELECT count(*)::INTEGER FROM inserted_recoveries)
  INTO v_expired_count, v_recovery_count;

  RETURN jsonb_build_object(
    'success', true,
    'expired_subscriptions', v_expired_count,
    'recoveries_created', v_recovery_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.check_and_expire_subscriptions()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_expire_subscriptions()
  TO service_role;

UPDATE public.subscription_recovery sr
SET next_notif_due_at = CASE
      WHEN sr.notif_t_plus_7_sent THEN NULL
      WHEN sr.notif_t_plus_3_sent THEN sr.expired_at + interval '7 days'
      WHEN sr.notif_t_plus_1_sent THEN sr.expired_at + interval '3 days'
      ELSE sr.expired_at + interval '1 day'
    END,
    updated_at = clock_timestamp()
WHERE sr.recovery_status IN ('pending', 'offer_viewed')
  AND (
    sr.notification_claim_token IS NULL
    OR COALESCE(sr.notification_lease_expires_at, '-infinity'::TIMESTAMPTZ)
      <= clock_timestamp()
  );

CREATE OR REPLACE FUNCTION public.claim_subscription_recovery_notifications(
  p_limit INTEGER DEFAULT 2,
  p_lease_seconds INTEGER DEFAULT 120,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  recovery_id UUID,
  user_id UUID,
  expired_at TIMESTAMPTZ,
  timing TEXT,
  delay_days INTEGER,
  claim_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_limit NOT BETWEEN 1 AND 2 OR p_lease_seconds NOT BETWEEN 30 AND 120 THEN
    RAISE EXCEPTION 'Invalid recovery claim configuration';
  END IF;

  IF p_dry_run THEN
    RETURN QUERY
    WITH due AS (
      SELECT
        sr.id,
        sr.user_id,
        sr.expired_at,
        sr.next_notif_due_at,
        security.next_subscription_recovery_stage(
          sr.expired_at,
          clock_timestamp(),
          sr.notif_t_minus_7_sent,
          sr.notif_t_minus_3_sent,
          sr.notif_t_minus_1_sent,
          sr.notif_t_plus_1_sent,
          sr.notif_t_plus_3_sent,
          sr.notif_t_plus_7_sent
        ) AS stage
      FROM public.subscription_recovery sr
      WHERE sr.recovery_status IN ('pending', 'offer_viewed')
        AND COALESCE(sr.next_notif_due_at, sr.expired_at + interval '1 day')
          <= clock_timestamp()
    )
    SELECT
      d.id,
      d.user_id,
      d.expired_at,
      d.stage,
      CASE d.stage
        WHEN 't_plus_1' THEN 1
        WHEN 't_plus_3' THEN 3
        WHEN 't_plus_7' THEN 7
      END,
      NULL::UUID
    FROM due d
    WHERE d.stage IS NOT NULL
    ORDER BY COALESCE(d.next_notif_due_at, d.expired_at), d.id
    LIMIT p_limit;
    RETURN;
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT
      sr.id,
      next_stage.stage
    FROM public.subscription_recovery sr
    CROSS JOIN LATERAL (
      SELECT security.next_subscription_recovery_stage(
        sr.expired_at,
        clock_timestamp(),
        sr.notif_t_minus_7_sent,
        sr.notif_t_minus_3_sent,
        sr.notif_t_minus_1_sent,
        sr.notif_t_plus_1_sent,
        sr.notif_t_plus_3_sent,
        sr.notif_t_plus_7_sent
      ) AS stage
    ) next_stage
    WHERE sr.recovery_status IN ('pending', 'offer_viewed')
      AND sr.notification_attempts < 5
      AND next_stage.stage IS NOT NULL
      AND COALESCE(sr.next_notif_due_at, sr.expired_at + interval '1 day')
        <= clock_timestamp()
      AND COALESCE(
        sr.notification_lease_expires_at,
        '-infinity'::TIMESTAMPTZ
      ) <= clock_timestamp()
    ORDER BY COALESCE(sr.next_notif_due_at, sr.expired_at), sr.id
    LIMIT p_limit
    FOR UPDATE OF sr SKIP LOCKED
  )
  UPDATE public.subscription_recovery sr
  SET notification_claim_token = gen_random_uuid(),
      notification_claim_stage = due.stage,
      notification_claimed_at = clock_timestamp(),
      notification_lease_expires_at =
        clock_timestamp() + make_interval(secs => p_lease_seconds),
      notification_error_code = NULL,
      notification_attempts = sr.notification_attempts + 1,
      updated_at = clock_timestamp()
  FROM due
  WHERE sr.id = due.id
  RETURNING
    sr.id,
    sr.user_id,
    sr.expired_at,
    due.stage,
    CASE due.stage
      WHEN 't_plus_1' THEN 1
      WHEN 't_plus_3' THEN 3
      WHEN 't_plus_7' THEN 7
    END,
    sr.notification_claim_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_subscription_recovery_notification(
  p_recovery_id UUID,
  p_claim_token UUID,
  p_succeeded BOOLEAN,
  p_error_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, pg_temp
AS $function$
DECLARE
  v_recovery public.subscription_recovery%ROWTYPE;
  v_stage TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT * INTO v_recovery
  FROM public.subscription_recovery sr
  WHERE sr.id = p_recovery_id
    AND sr.notification_claim_token = p_claim_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_stage := v_recovery.notification_claim_stage;
  IF v_stage NOT IN ('t_plus_1', 't_plus_3', 't_plus_7') THEN
    UPDATE public.subscription_recovery
    SET notification_error_code = 'invalid_recovery_stage',
        notification_claim_token = NULL,
        notification_claim_stage = NULL,
        notification_claimed_at = NULL,
        notification_lease_expires_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = p_recovery_id;
    RETURN false;
  END IF;

  IF v_recovery.recovery_status NOT IN ('pending', 'offer_viewed') THEN
    UPDATE public.subscription_recovery
    SET notification_claim_token = NULL,
        notification_claim_stage = NULL,
        notification_claimed_at = NULL,
        notification_lease_expires_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = p_recovery_id;
    RETURN false;
  END IF;

  IF p_succeeded THEN
    UPDATE public.subscription_recovery
    SET notif_t_plus_1_sent = notif_t_plus_1_sent OR v_stage = 't_plus_1',
        notif_t_plus_3_sent = notif_t_plus_3_sent OR v_stage = 't_plus_3',
        notif_t_plus_7_sent = notif_t_plus_7_sent OR v_stage = 't_plus_7',
        notification_stage = COALESCE(notification_stage, 0) + 1,
        last_notif_sent_at = clock_timestamp(),
        next_notif_due_at = CASE v_stage
          WHEN 't_plus_1' THEN expired_at + interval '3 days'
          WHEN 't_plus_3' THEN expired_at + interval '7 days'
          WHEN 't_plus_7' THEN NULL
        END,
        notification_error_code = NULL,
        notification_attempts = 0,
        notification_claim_token = NULL,
        notification_claim_stage = NULL,
        notification_claimed_at = NULL,
        notification_lease_expires_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = p_recovery_id;
  ELSE
    UPDATE public.subscription_recovery
    SET next_notif_due_at = CASE
          WHEN notification_attempts >= 5 THEN NULL
          ELSE clock_timestamp() + make_interval(
            mins => LEAST(
              240,
              15 * power(2, GREATEST(notification_attempts - 1, 0))
            )::INTEGER
          )
        END,
        notification_error_code = NULLIF(left(regexp_replace(
          lower(COALESCE(
            CASE WHEN notification_attempts >= 5 THEN 'delivery_exhausted' END,
            p_error_code,
            'delivery_failed'
          )),
          '[^a-z0-9_.-]', '', 'g'
        ), 120), ''),
        notification_claim_token = NULL,
        notification_claim_stage = NULL,
        notification_claimed_at = NULL,
        notification_lease_expires_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = p_recovery_id;
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_subscription_recovery_notifications(
  INTEGER, INTEGER, BOOLEAN
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_subscription_recovery_notification(
  UUID, UUID, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_subscription_recovery_notifications(
  INTEGER, INTEGER, BOOLEAN
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_subscription_recovery_notification(
  UUID, UUID, BOOLEAN, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- Bounded atomic rollover cleanup
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS subscription_rollovers_expiry_worker_idx
  ON public.subscription_rollovers (expiry_date, id)
  WHERE status = 'active' AND is_consumed = false;

CREATE OR REPLACE FUNCTION public.cleanup_expired_rollover_batch(
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  rollover_id UUID,
  user_id UUID,
  subscription_id UUID,
  expired_credits INTEGER,
  expiry_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Invalid rollover cleanup batch size';
  END IF;

  RETURN QUERY
  WITH candidates AS MATERIALIZED (
    SELECT sr.id
    FROM public.subscription_rollovers sr
    JOIN public.subscriptions subscription_lock
      ON subscription_lock.id = sr.subscription_id
    WHERE sr.status = 'active'
      AND sr.is_consumed = false
      AND sr.expiry_date < CURRENT_DATE
    ORDER BY sr.expiry_date, sr.id
    LIMIT p_limit
    FOR UPDATE OF sr, subscription_lock SKIP LOCKED
  ),
  expired AS (
    UPDATE public.subscription_rollovers sr
    SET status = 'expired',
        is_consumed = true,
        consumed_at = COALESCE(sr.consumed_at, clock_timestamp()),
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE sr.id = c.id
    RETURNING
      sr.id AS rollover_id,
      sr.user_id,
      sr.subscription_id,
      sr.rollover_credits AS expired_credits,
      sr.expiry_date
  ),
  updated_subscriptions AS (
    UPDATE public.subscriptions s
    SET rollover_credits = COALESCE((
          SELECT sum(active_rollover.rollover_credits)::INTEGER
          FROM public.subscription_rollovers active_rollover
          WHERE active_rollover.subscription_id = s.id
            AND active_rollover.status = 'active'
            AND active_rollover.is_consumed = false
            AND active_rollover.expiry_date >= CURRENT_DATE
            AND NOT EXISTS (
              SELECT 1
              FROM expired e
              WHERE e.rollover_id = active_rollover.id
            )
        ), 0),
        rollover_expiry_date = (
          SELECT min(active_rollover.expiry_date)
          FROM public.subscription_rollovers active_rollover
          WHERE active_rollover.subscription_id = s.id
            AND active_rollover.status = 'active'
            AND active_rollover.is_consumed = false
            AND active_rollover.expiry_date >= CURRENT_DATE
            AND NOT EXISTS (
              SELECT 1
              FROM expired e
              WHERE e.rollover_id = active_rollover.id
            )
        ),
        updated_at = clock_timestamp()
    WHERE s.id IN (SELECT DISTINCT e.subscription_id FROM expired e)
    RETURNING s.id
  )
  SELECT
    e.rollover_id,
    e.user_id,
    e.subscription_id,
    e.expired_credits,
    e.expiry_date
  FROM expired e
  WHERE EXISTS (
    SELECT 1 FROM updated_subscriptions u WHERE u.id = e.subscription_id
  )
  ORDER BY e.expiry_date, e.rollover_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_expired_rollover_batch(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rollover_batch(INTEGER)
  TO service_role;

-- The deployment workflow calls this service-role-only probe before publishing
-- Edge functions that depend on the contracts above. No deployment secret is
-- stored in SQL; GitHub environment secrets authenticate the probe.
CREATE OR REPLACE FUNCTION public.notification_delivery_runtime_version()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path TO pg_catalog
AS $function$
  SELECT '20260717090000'::TEXT;
$function$;

REVOKE ALL ON FUNCTION public.notification_delivery_runtime_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_delivery_runtime_version()
  TO service_role;

COMMENT ON FUNCTION public.notification_delivery_runtime_version() IS
  'Deployment contract probe for notification delivery runtime 20260717090000.';
COMMENT ON FUNCTION security.normalize_notification_phone(TEXT) IS
  'Canonicalizes verified notification numbers, including Qatar local format.';
COMMENT ON FUNCTION public.complete_notification_delivery(
  TEXT, TEXT, UUID, BOOLEAN, TEXT, TEXT
) IS 'Service-role-only provider delivery completion with terminal handling for ambiguous WhatsApp 2xx responses.';
COMMENT ON FUNCTION public.cleanup_expired_rollover_batch(INTEGER) IS
  'Service-role-only bounded and concurrency-safe rollover expiry worker.';
COMMENT ON FUNCTION public.claim_whatsapp_notifications(INTEGER, INTEGER) IS
  'Service-role-only WhatsApp claim capped at three rows and a 120-second lease.';
COMMENT ON FUNCTION public.claim_subscription_recovery_notifications(
  INTEGER, INTEGER, BOOLEAN
) IS 'Service-role-only post-expiry recovery claim capped at two rows.';

COMMIT;
