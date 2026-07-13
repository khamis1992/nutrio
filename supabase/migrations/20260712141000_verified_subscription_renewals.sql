-- Make rollover credits compatible with the paid SADAD renewal lifecycle.

-- No reusable recurring-payment mandate is stored today. Do not advertise or
-- execute automatic renewal until the payment provider supplies one.
UPDATE public.subscriptions
SET auto_renew = FALSE,
    updated_at = NOW()
WHERE COALESCE(auto_renew, FALSE) = TRUE;

ALTER TABLE public.subscription_renewal_processed ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_renewal_processed'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.subscription_renewal_processed',
      v_policy.policyname
    );
  END LOOP;
END;
$$;

REVOKE ALL ON public.subscription_renewal_processed FROM anon, authenticated;
GRANT ALL ON public.subscription_renewal_processed TO service_role;

CREATE OR REPLACE FUNCTION public.expire_due_subscriptions(
  p_subscription_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE(subscription_id UUID, user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin');
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Qatar')::DATE;
BEGIN
  IF NOT v_is_service
    AND NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM public.sync_subscription_freezes(NULL);

  RETURN QUERY
  WITH candidates AS (
    SELECT s.id
    FROM public.subscriptions s
    WHERE s.status IN ('active', 'cancelled')
      AND s.end_date IS NOT NULL
      AND s.end_date::DATE < v_today
      AND s.freeze_active_id IS NULL
      AND (p_subscription_id IS NULL OR s.id = p_subscription_id)
    ORDER BY s.end_date ASC, s.id ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000)
    FOR UPDATE SKIP LOCKED
  ), expired AS (
    UPDATE public.subscriptions s
    SET status = 'expired',
        active = FALSE,
        auto_renew = FALSE,
        expired_at = COALESCE(s.expired_at, NOW()),
        updated_at = NOW()
    FROM candidates c
    WHERE s.id = c.id
    RETURNING s.id, s.user_id
  )
  SELECT expired.id, expired.user_id
  FROM expired;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_due_subscriptions(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions(UUID, INTEGER)
  TO service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'expire-due-subscriptions';

    PERFORM cron.schedule(
      'expire-due-subscriptions',
      '15 * * * *',
      'SELECT public.expire_due_subscriptions(NULL, 500);'
    );
  END IF;
EXCEPTION
  WHEN insufficient_privilege OR undefined_function OR undefined_table THEN
    RAISE NOTICE 'pg_cron is unavailable; use the authenticated renewal lifecycle worker';
END;
$$;

ALTER TABLE public.subscription_rollovers
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.subscription_rollovers
SET status = CASE
      WHEN status = 'consumed' OR COALESCE(is_consumed, FALSE) THEN 'consumed'
      WHEN status = 'expired' OR expiry_date < CURRENT_DATE THEN 'expired'
      ELSE 'active'
    END,
    is_consumed = status IN ('consumed', 'expired')
      OR COALESCE(is_consumed, FALSE)
      OR expiry_date < CURRENT_DATE,
    updated_at = COALESCE(updated_at, NOW());

ALTER TABLE public.subscription_rollovers
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN is_consumed SET DEFAULT FALSE,
  ALTER COLUMN is_consumed SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_rollovers_status_check'
      AND conrelid = 'public.subscription_rollovers'::REGCLASS
  ) THEN
    ALTER TABLE public.subscription_rollovers
      ADD CONSTRAINT subscription_rollovers_status_check
      CHECK (status IN ('active', 'consumed', 'expired'));
  END IF;
END;
$$;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY subscription_id, source_cycle_start, source_cycle_end
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'consumed' THEN 1 ELSE 2 END,
        rollover_credits DESC,
        created_at DESC,
        id DESC
    ) AS row_number
  FROM public.subscription_rollovers
)
DELETE FROM public.subscription_rollovers sr
USING ranked
WHERE sr.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_rollovers_source_cycle_unique
  ON public.subscription_rollovers (
    subscription_id,
    source_cycle_start,
    source_cycle_end
  );

ALTER TABLE public.subscription_rollovers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_rollovers'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.subscription_rollovers',
      v_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY "Users and admins can view subscription rollovers"
  ON public.subscription_rollovers
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
  );

REVOKE ALL ON public.subscription_rollovers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_rollovers FROM authenticated;
GRANT SELECT ON public.subscription_rollovers TO authenticated;
GRANT ALL ON public.subscription_rollovers TO service_role;

CREATE OR REPLACE FUNCTION public.use_rollover_credit_if_available(
  p_subscription_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_subscription public.subscriptions%ROWTYPE;
  v_rollover public.subscription_rollovers%ROWTYPE;
  v_remaining INTEGER;
  v_total_remaining INTEGER;
BEGIN
  IF NOT v_is_service AND (
    v_actor IS NULL
    OR p_user_id IS DISTINCT FROM v_actor
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_subscription_id::TEXT, 0)
  );

  SELECT *
    INTO v_subscription
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id
    AND s.user_id = p_user_id
    AND s.status IN ('active', 'cancelled')
    AND COALESCE(s.end_date, CURRENT_DATE) >= CURRENT_DATE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_SUBSCRIPTION_NOT_FOUND';
  END IF;

  SELECT *
    INTO v_rollover
  FROM public.subscription_rollovers sr
  WHERE sr.user_id = p_user_id
    AND sr.subscription_id = p_subscription_id
    AND sr.status = 'active'
    AND sr.is_consumed = FALSE
    AND sr.expiry_date >= CURRENT_DATE
    AND sr.rollover_credits > 0
  ORDER BY sr.expiry_date ASC, sr.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.subscriptions
    SET rollover_credits = 0,
        updated_at = NOW()
    WHERE id = p_subscription_id
      AND user_id = p_user_id;

    RETURN jsonb_build_object(
      'used_rollover', FALSE,
      'rollover_remaining', 0
    );
  END IF;

  v_remaining := v_rollover.rollover_credits - 1;

  UPDATE public.subscription_rollovers
  SET rollover_credits = GREATEST(0, v_remaining),
      status = CASE WHEN v_remaining <= 0 THEN 'consumed' ELSE 'active' END,
      is_consumed = v_remaining <= 0,
      consumed_at = CASE
        WHEN v_remaining <= 0 THEN COALESCE(consumed_at, NOW())
        ELSE NULL
      END,
      updated_at = NOW()
  WHERE id = v_rollover.id;

  SELECT COALESCE(SUM(sr.rollover_credits), 0)::INTEGER
    INTO v_total_remaining
  FROM public.subscription_rollovers sr
  WHERE sr.user_id = p_user_id
    AND sr.subscription_id = p_subscription_id
    AND sr.status = 'active'
    AND sr.is_consumed = FALSE
    AND sr.expiry_date >= CURRENT_DATE;

  UPDATE public.subscriptions
  SET rollover_credits = v_total_remaining,
      updated_at = NOW()
  WHERE id = p_subscription_id
    AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'used_rollover', TRUE,
    'rollover_remaining', v_total_remaining,
    'rollover_id', v_rollover.id
  );
END;
$$;

-- The legacy two-argument function cannot prove a payment. Leave a compatible
-- service-only response instead of allowing it to mint a new paid period.
CREATE OR REPLACE FUNCTION public.calculate_rollover_credits(
  p_subscription_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'VERIFIED_PAYMENT_REQUIRED',
    'subscription_id', p_subscription_id,
    'user_id', p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_old_rollover_credits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.subscription_rollovers
  SET status = 'expired',
      is_consumed = TRUE,
      updated_at = NOW()
  WHERE status = 'active'
    AND expiry_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.use_rollover_credit_if_available(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.use_rollover_credit_if_available(UUID, UUID)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.calculate_rollover_credits(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_rollover_credits(UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.expire_old_rollover_credits()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_rollover_credits()
  TO service_role;

COMMENT ON FUNCTION public.calculate_rollover_credits(UUID, UUID) IS
  'Deprecated compatibility function. Paid SADAD renewal fulfillment calculates rollover atomically.';
