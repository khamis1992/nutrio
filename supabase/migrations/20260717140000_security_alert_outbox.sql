-- Reliable, privacy-minimised delivery for high and critical security events.

BEGIN;

CREATE TABLE IF NOT EXISTS security.security_alert_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES security.event_ledger(id) ON DELETE RESTRICT,
  sequence_number BIGINT NOT NULL,
  event_hash TEXT NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  event_type TEXT NOT NULL CHECK (char_length(event_type) BETWEEN 3 AND 120),
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'critical')),
  outcome TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'delivered', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
  max_attempts INTEGER NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  claim_token UUID,
  claimed_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  provider_reference TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledgement_key_id TEXT,
  acknowledgement_signature TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT security_alert_claim_state CHECK (
    (status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'processing' AND claim_token IS NULL AND lease_expires_at IS NULL)
  ),
  CONSTRAINT security_alert_ack_signature_format CHECK (
    acknowledgement_signature IS NULL OR acknowledgement_signature ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS security_alert_outbox_due_idx
  ON security.security_alert_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS security_alert_outbox_status_idx
  ON security.security_alert_outbox (status, updated_at DESC);

ALTER TABLE security.security_alert_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE security.security_alert_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON security.security_alert_outbox FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION security.enqueue_security_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.severity IN ('high', 'critical')
     AND NEW.event_type NOT LIKE 'security.alert.%' THEN
    INSERT INTO security.security_alert_outbox (
      event_id,
      sequence_number,
      event_hash,
      event_type,
      category,
      severity,
      outcome,
      occurred_at
    ) VALUES (
      NEW.id,
      NEW.sequence_number,
      NEW.event_hash,
      NEW.event_type,
      NEW.category,
      NEW.severity,
      NEW.outcome,
      NEW.occurred_at
    )
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS security_event_alert_trigger ON security.event_ledger;
CREATE TRIGGER security_event_alert_trigger
AFTER INSERT ON security.event_ledger
FOR EACH ROW EXECUTE FUNCTION security.enqueue_security_alert();

CREATE OR REPLACE FUNCTION public.claim_security_alerts(
  p_limit INTEGER DEFAULT 10,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
  alert_id UUID,
  event_id UUID,
  sequence_number BIGINT,
  event_hash TEXT,
  event_type TEXT,
  category TEXT,
  severity TEXT,
  outcome TEXT,
  occurred_at TIMESTAMPTZ,
  claim_token UUID,
  attempt_number INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 25 OR p_lease_seconds NOT BETWEEN 30 AND 600 THEN
    RAISE EXCEPTION 'Invalid security alert claim configuration';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT queue.id
    FROM security.security_alert_outbox queue
    WHERE queue.attempts < queue.max_attempts
      AND (
        (queue.status = 'pending' AND queue.next_attempt_at <= clock_timestamp())
        OR
        (queue.status = 'processing' AND queue.lease_expires_at <= clock_timestamp())
      )
    ORDER BY
      CASE queue.severity WHEN 'critical' THEN 0 ELSE 1 END,
      queue.next_attempt_at,
      queue.created_at,
      queue.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE security.security_alert_outbox queue
  SET status = 'processing',
      attempts = queue.attempts + 1,
      claim_token = gen_random_uuid(),
      claimed_at = clock_timestamp(),
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      last_error_code = NULL,
      updated_at = clock_timestamp()
  FROM candidates
  WHERE queue.id = candidates.id
  RETURNING
    queue.id,
    queue.event_id,
    queue.sequence_number,
    queue.event_hash,
    queue.event_type,
    queue.category,
    queue.severity,
    queue.outcome,
    queue.occurred_at,
    queue.claim_token,
    queue.attempts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_security_alert(
  p_alert_id UUID,
  p_claim_token UUID,
  p_succeeded BOOLEAN,
  p_retryable BOOLEAN DEFAULT true,
  p_error_code TEXT DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL,
  p_acknowledged_at TIMESTAMPTZ DEFAULT NULL,
  p_acknowledgement_key_id TEXT DEFAULT NULL,
  p_acknowledgement_signature TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE security.security_alert_outbox queue
  SET status = CASE
        WHEN p_succeeded THEN 'delivered'
        WHEN p_retryable AND queue.attempts < queue.max_attempts THEN 'pending'
        ELSE 'dead_letter'
      END,
      next_attempt_at = CASE
        WHEN p_succeeded OR NOT p_retryable OR queue.attempts >= queue.max_attempts THEN v_now
        ELSE v_now + make_interval(
          secs => LEAST(3600, (30 * power(2, LEAST(GREATEST(queue.attempts - 1, 0), 7)))::INTEGER)
        )
      END,
      last_error_code = CASE
        WHEN p_succeeded THEN NULL
        ELSE NULLIF(left(regexp_replace(
          lower(COALESCE(p_error_code, 'delivery_failed')),
          '[^a-z0-9_.-]', '', 'g'
        ), 120), '')
      END,
      provider_reference = CASE
        WHEN p_succeeded THEN NULLIF(left(COALESCE(p_provider_reference, ''), 300), '')
        ELSE NULL
      END,
      acknowledged_at = CASE WHEN p_succeeded THEN p_acknowledged_at ELSE NULL END,
      acknowledgement_key_id = CASE
        WHEN p_succeeded THEN NULLIF(left(COALESCE(p_acknowledgement_key_id, ''), 100), '')
        ELSE NULL
      END,
      acknowledgement_signature = CASE
        WHEN p_succeeded THEN lower(NULLIF(COALESCE(p_acknowledgement_signature, ''), ''))
        ELSE NULL
      END,
      delivered_at = CASE WHEN p_succeeded THEN v_now ELSE queue.delivered_at END,
      claim_token = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL,
      updated_at = v_now
  WHERE queue.id = p_alert_id
    AND queue.claim_token = p_claim_token
    AND queue.status = 'processing'
  RETURNING queue.status INTO v_status;

  RETURN v_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_security_alert_delivery_health()
RETURNS TABLE (
  pending_count BIGINT,
  processing_count BIGINT,
  dead_letter_count BIGINT,
  oldest_pending_at TIMESTAMPTZ,
  last_delivered_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_is_admin BOOLEAN := false;
  v_aal TEXT := COALESCE(auth.jwt() ->> 'aal', '');
BEGIN
  IF NOT v_is_service THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles role_row
      WHERE role_row.user_id = auth.uid() AND role_row.role = 'admin'
    ) INTO v_is_admin;
    IF NOT v_is_admin OR v_aal <> 'aal2' THEN
      RAISE EXCEPTION 'AAL2 admin or service role required';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE queue.status = 'pending'),
    count(*) FILTER (WHERE queue.status = 'processing'),
    count(*) FILTER (WHERE queue.status = 'dead_letter'),
    min(queue.created_at) FILTER (WHERE queue.status IN ('pending', 'processing')),
    max(queue.delivered_at),
    max(queue.updated_at) FILTER (WHERE queue.last_error_code IS NOT NULL)
  FROM security.security_alert_outbox queue;
END;
$function$;

CREATE OR REPLACE FUNCTION public.security_alert_runtime_version()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN COALESCE(auth.role(), '') = 'service_role' THEN '20260717140000'::TEXT
    ELSE NULL::TEXT
  END;
$function$;

REVOKE ALL ON FUNCTION security.enqueue_security_alert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_security_alerts(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_security_alert(UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_security_alert_delivery_health() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_alert_runtime_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_security_alerts(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_security_alert(UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_security_alert_delivery_health() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.security_alert_runtime_version() TO service_role;

COMMIT;
