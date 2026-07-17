-- Atomic notification delivery claims and private queue workers.

BEGIN;

CREATE SCHEMA IF NOT EXISTS security;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS security.notification_delivery_claims (
  channel TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  claim_token UUID NOT NULL DEFAULT gen_random_uuid(),
  attempts INTEGER NOT NULL DEFAULT 1,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  lease_expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (channel, idempotency_key),
  CONSTRAINT notification_delivery_channel_allowed
    CHECK (channel IN ('email', 'invoice_email', 'push', 'whatsapp')),
  CONSTRAINT notification_delivery_key_length
    CHECK (char_length(idempotency_key) BETWEEN 1 AND 200),
  CONSTRAINT notification_delivery_hash_format
    CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT notification_delivery_status_allowed
    CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT notification_delivery_attempts_valid
    CHECK (attempts BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS notification_delivery_claims_completed_idx
  ON security.notification_delivery_claims (completed_at)
  WHERE completed_at IS NOT NULL;

ALTER TABLE security.notification_delivery_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.notification_delivery_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.notification_delivery_claims
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_notification_delivery(
  p_channel TEXT,
  p_idempotency_key TEXT,
  p_payload_hash TEXT,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO security, public, extensions, pg_temp
AS $function$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_claim security.notification_delivery_claims%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  p_channel := lower(trim(COALESCE(p_channel, '')));
  p_idempotency_key := trim(COALESCE(p_idempotency_key, ''));
  p_payload_hash := lower(trim(COALESCE(p_payload_hash, '')));

  IF p_channel NOT IN ('email', 'invoice_email', 'push', 'whatsapp')
     OR char_length(p_idempotency_key) NOT BETWEEN 1 AND 200
     OR p_payload_hash !~ '^[0-9a-f]{64}$'
     OR p_lease_seconds NOT BETWEEN 30 AND 600 THEN
    RAISE EXCEPTION 'Invalid notification delivery claim';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_channel || ':' || p_idempotency_key, 957421)
  );

  SELECT * INTO v_claim
  FROM security.notification_delivery_claims
  WHERE channel = p_channel
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO security.notification_delivery_claims (
      channel, idempotency_key, payload_hash, status, claim_token,
      attempts, claimed_at, lease_expires_at, updated_at
    ) VALUES (
      p_channel, p_idempotency_key, p_payload_hash, 'processing',
      gen_random_uuid(), 1, v_now,
      v_now + make_interval(secs => p_lease_seconds), v_now
    )
    RETURNING * INTO v_claim;

    RETURN jsonb_build_object(
      'claimed', true,
      'state', 'processing',
      'claim_token', v_claim.claim_token,
      'attempts', v_claim.attempts
    );
  END IF;

  IF v_claim.payload_hash <> p_payload_hash THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'state', 'conflict',
      'conflict', true
    );
  END IF;

  IF v_claim.status = 'completed' THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'state', 'completed',
      'provider_message_id', v_claim.provider_message_id
    );
  END IF;

  IF v_claim.status = 'processing' AND v_claim.lease_expires_at > v_now THEN
    RETURN jsonb_build_object('claimed', false, 'state', 'in_progress');
  END IF;

  IF v_claim.attempts >= 5 THEN
    RETURN jsonb_build_object('claimed', false, 'state', 'exhausted');
  END IF;

  UPDATE security.notification_delivery_claims
  SET status = 'processing',
      claim_token = gen_random_uuid(),
      attempts = attempts + 1,
      claimed_at = v_now,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      last_error_code = NULL,
      updated_at = v_now
  WHERE channel = p_channel
    AND idempotency_key = p_idempotency_key
  RETURNING * INTO v_claim;

  RETURN jsonb_build_object(
    'claimed', true,
    'state', 'processing',
    'claim_token', v_claim.claim_token,
    'attempts', v_claim.attempts
  );
END;
$function$;

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
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE security.notification_delivery_claims
  SET status = CASE WHEN p_succeeded THEN 'completed' ELSE 'failed' END,
      completed_at = CASE WHEN p_succeeded THEN clock_timestamp() ELSE NULL END,
      lease_expires_at = clock_timestamp(),
      provider_message_id = CASE
        WHEN p_succeeded THEN NULLIF(left(COALESCE(p_provider_message_id, ''), 250), '')
        ELSE NULL
      END,
      last_error_code = CASE
        WHEN p_succeeded THEN NULL
        ELSE NULLIF(left(regexp_replace(
          lower(COALESCE(p_error_code, 'delivery_failed')),
          '[^a-z0-9_.-]', '', 'g'
        ), 120), '')
      END,
      updated_at = clock_timestamp()
  WHERE channel = lower(trim(COALESCE(p_channel, '')))
    AND idempotency_key = trim(COALESCE(p_idempotency_key, ''))
    AND claim_token = p_claim_token
    AND status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

UPDATE public.notification_queue
SET next_attempt_at = COALESCE(next_attempt_at, created_at, clock_timestamp()),
    attempts = COALESCE(attempts, 0),
    max_attempts = GREATEST(COALESCE(max_attempts, 5), 1)
WHERE next_attempt_at IS NULL
   OR attempts IS NULL
   OR max_attempts IS NULL
   OR max_attempts < 1;

ALTER TABLE public.notification_queue
  ALTER COLUMN next_attempt_at SET DEFAULT clock_timestamp();

CREATE INDEX IF NOT EXISTS notification_queue_claimable_idx
  ON public.notification_queue (next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_queue TO service_role;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_notifications(
  p_limit INTEGER DEFAULT 25,
  p_lease_seconds INTEGER DEFAULT 120
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

  IF p_limit NOT BETWEEN 1 AND 50 OR p_lease_seconds NOT BETWEEN 30 AND 600 THEN
    RAISE EXCEPTION 'Invalid WhatsApp claim configuration';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.notification_queue q
    WHERE COALESCE(q.attempts, 0) < GREATEST(COALESCE(q.max_attempts, 5), 1)
      AND (
        (
          q.status = 'pending'
          AND COALESCE(q.next_attempt_at, q.created_at, clock_timestamp()) <= clock_timestamp()
        )
        OR (
          q.status = 'processing'
          AND COALESCE(q.lease_expires_at, '-infinity'::TIMESTAMPTZ) <= clock_timestamp()
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

CREATE OR REPLACE FUNCTION public.complete_whatsapp_notification(
  p_notification_id UUID,
  p_claim_token UUID,
  p_succeeded BOOLEAN,
  p_provider_message_id TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_retryable BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, pg_temp
AS $function$
DECLARE
  v_updated INTEGER;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE public.notification_queue q
  SET status = CASE
        WHEN p_succeeded THEN 'sent'
        WHEN p_retryable AND q.attempts < q.max_attempts THEN 'pending'
        ELSE 'failed'
      END,
      sent_at = CASE WHEN p_succeeded THEN v_now ELSE q.sent_at END,
      provider_message_id = CASE
        WHEN p_succeeded THEN NULLIF(left(COALESCE(p_provider_message_id, ''), 250), '')
        ELSE NULL
      END,
      error_message = CASE
        WHEN p_succeeded THEN NULL
        ELSE NULLIF(left(regexp_replace(
          lower(COALESCE(p_error_code, 'delivery_failed')),
          '[^a-z0-9_.-]', '', 'g'
        ), 120), '')
      END,
      next_attempt_at = CASE
        WHEN p_succeeded OR NOT p_retryable OR q.attempts >= q.max_attempts THEN NULL
        ELSE v_now + make_interval(
          secs => LEAST(300, (5 * power(2, LEAST(GREATEST(q.attempts - 1, 0), 6)))::INTEGER)
        )
      END,
      claim_token = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL,
      updated_at = v_now
  WHERE q.id = p_notification_id
    AND q.claim_token = p_claim_token
    AND q.status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

ALTER TABLE public.subscription_recovery
  ADD COLUMN IF NOT EXISTS recovery_status TEXT,
  ADD COLUMN IF NOT EXISTS notification_stage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_notif_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notif_t_minus_7_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_t_minus_3_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_t_minus_1_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_t_plus_1_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_t_plus_3_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_t_plus_7_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_claim_token UUID,
  ADD COLUMN IF NOT EXISTS notification_claim_stage TEXT,
  ADD COLUMN IF NOT EXISTS notification_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_error_code TEXT,
  ADD COLUMN IF NOT EXISTS notification_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.subscription_recovery
  DROP CONSTRAINT IF EXISTS subscription_recovery_notification_attempts_valid;

ALTER TABLE public.subscription_recovery
  ADD CONSTRAINT subscription_recovery_notification_attempts_valid
  CHECK (notification_attempts BETWEEN 0 AND 5) NOT VALID;

ALTER TABLE public.subscription_recovery
  VALIDATE CONSTRAINT subscription_recovery_notification_attempts_valid;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_recovery'
      AND column_name = 'status'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_recovery'
      AND column_name = 'recovery_status'
      AND data_type = 'text'
  ) THEN
    EXECUTE $sql$
      UPDATE public.subscription_recovery
      SET recovery_status = status::TEXT
      WHERE recovery_status IS NULL
    $sql$;
  END IF;
END;
$do$;

UPDATE public.subscription_recovery
SET recovery_status = 'pending'
WHERE recovery_status IS NULL;

ALTER TABLE public.subscription_recovery
  ALTER COLUMN recovery_status SET DEFAULT 'pending',
  ALTER COLUMN recovery_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS subscription_recovery_notification_claim_idx
  ON public.subscription_recovery (next_notif_due_at, notification_lease_expires_at)
  WHERE recovery_status IN ('pending', 'offer_viewed');

REVOKE INSERT, UPDATE, DELETE ON public.subscription_recovery FROM authenticated;
REVOKE ALL ON public.subscription_recovery FROM anon;
GRANT ALL ON public.subscription_recovery TO service_role;

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
    WHEN p_now < p_expired_at THEN CASE
      WHEN p_now >= p_expired_at - interval '1 day' AND NOT COALESCE(p_minus_1_sent, false) THEN 't_minus_1'
      WHEN p_now >= p_expired_at - interval '3 days' AND NOT COALESCE(p_minus_3_sent, false) THEN 't_minus_3'
      WHEN p_now >= p_expired_at - interval '7 days' AND NOT COALESCE(p_minus_7_sent, false) THEN 't_minus_7'
      ELSE NULL
    END
    ELSE CASE
      WHEN p_now >= p_expired_at + interval '7 days' AND NOT COALESCE(p_plus_7_sent, false) THEN 't_plus_7'
      WHEN p_now >= p_expired_at + interval '3 days' AND NOT COALESCE(p_plus_3_sent, false) THEN 't_plus_3'
      WHEN p_now >= p_expired_at + interval '1 day' AND NOT COALESCE(p_plus_1_sent, false) THEN 't_plus_1'
      ELSE NULL
    END
  END;
$function$;

REVOKE ALL ON FUNCTION security.next_subscription_recovery_stage(
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION security.next_subscription_recovery_stage(
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_subscription_recovery_notifications(
  p_limit INTEGER DEFAULT 3,
  p_lease_seconds INTEGER DEFAULT 180,
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

  IF p_limit NOT BETWEEN 1 AND 4 OR p_lease_seconds NOT BETWEEN 30 AND 600 THEN
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
        AND COALESCE(
          sr.next_notif_due_at,
          sr.expired_at - interval '7 days'
        ) <= clock_timestamp()
    )
    SELECT
      d.id,
      d.user_id,
      d.expired_at,
      d.stage,
      CASE d.stage
        WHEN 't_minus_7' THEN -7
        WHEN 't_minus_3' THEN -3
        WHEN 't_minus_1' THEN -1
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
      AND COALESCE(
        sr.next_notif_due_at,
        sr.expired_at - interval '7 days'
      ) <= clock_timestamp()
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
      notification_lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      notification_error_code = NULL,
      notification_attempts = notification_attempts + 1,
      updated_at = clock_timestamp()
  FROM due
  WHERE sr.id = due.id
  RETURNING
    sr.id,
    sr.user_id,
    sr.expired_at,
    due.stage,
    CASE due.stage
      WHEN 't_minus_7' THEN -7
      WHEN 't_minus_3' THEN -3
      WHEN 't_minus_1' THEN -1
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
    SET notif_t_minus_7_sent = notif_t_minus_7_sent OR v_stage = 't_minus_7',
        notif_t_minus_3_sent = notif_t_minus_3_sent OR v_stage = 't_minus_3',
        notif_t_minus_1_sent = notif_t_minus_1_sent OR v_stage = 't_minus_1',
        notif_t_plus_1_sent = notif_t_plus_1_sent OR v_stage = 't_plus_1',
        notif_t_plus_3_sent = notif_t_plus_3_sent OR v_stage = 't_plus_3',
        notif_t_plus_7_sent = notif_t_plus_7_sent OR v_stage = 't_plus_7',
        notification_stage = COALESCE(notification_stage, 0) + 1,
        last_notif_sent_at = clock_timestamp(),
        next_notif_due_at = CASE v_stage
          WHEN 't_minus_7' THEN expired_at - interval '3 days'
          WHEN 't_minus_3' THEN expired_at - interval '1 day'
          WHEN 't_minus_1' THEN expired_at + interval '1 day'
          WHEN 't_plus_1' THEN expired_at + interval '3 days'
          WHEN 't_plus_3' THEN expired_at + interval '7 days'
          WHEN 't_plus_7' THEN NULL
          ELSE next_notif_due_at
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
            mins => LEAST(240, 15 * power(2, GREATEST(notification_attempts - 1, 0)))::INTEGER
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

REVOKE ALL ON FUNCTION public.claim_notification_delivery(TEXT, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_notification_delivery(TEXT, TEXT, UUID, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_whatsapp_notifications(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_whatsapp_notification(UUID, UUID, BOOLEAN, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_subscription_recovery_notifications(INTEGER, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_subscription_recovery_notification(UUID, UUID, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_notification_delivery(TEXT, TEXT, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_delivery(TEXT, TEXT, UUID, BOOLEAN, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_notifications(INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_whatsapp_notification(UUID, UUID, BOOLEAN, TEXT, TEXT, BOOLEAN)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_subscription_recovery_notifications(INTEGER, INTEGER, BOOLEAN)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_subscription_recovery_notification(UUID, UUID, BOOLEAN, TEXT)
  TO service_role;

COMMENT ON TABLE security.notification_delivery_claims IS
  'Private idempotency ledger for provider-backed notification sends.';
COMMENT ON FUNCTION public.claim_whatsapp_notifications(INTEGER, INTEGER) IS
  'Service-role-only leased claim for pending WhatsApp outbox rows.';
COMMENT ON FUNCTION public.claim_subscription_recovery_notifications(INTEGER, INTEGER, BOOLEAN) IS
  'Service-role-only leased claim for subscription recovery notification stages.';

COMMIT;
