-- Secure cancellation/retention and make subscription freezes executable.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_until DATE,
  ADD COLUMN IF NOT EXISTS freeze_active_id UUID REFERENCES public.subscription_freezes(id) ON DELETE SET NULL;

-- Financial offers are disabled until billing applies them from verified payments.
UPDATE public.win_back_offers
SET is_active = false,
    updated_at = now()
WHERE offer_type IN ('discount', 'downgrade', 'bonus');

CREATE OR REPLACE FUNCTION public.get_win_back_offers(
  p_user_id UUID,
  p_subscription_id UUID,
  p_step INTEGER
)
RETURNS TABLE (
  offer_id UUID,
  offer_code VARCHAR(50),
  offer_type VARCHAR(20),
  name VARCHAR(100),
  description TEXT,
  pause_duration_days INTEGER,
  discount_percent INTEGER,
  discount_duration_months INTEGER,
  target_tier VARCHAR(20),
  bonus_credits INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_months_subscribed INTEGER;
  v_previous_cancellations INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_step NOT BETWEEN 2 AND 4 THEN
    RETURN;
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id
    AND s.user_id = p_user_id
    AND s.status::TEXT IN ('active', 'pending');

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_months_subscribed := GREATEST(
    0,
    COALESCE(EXTRACT(YEAR FROM age(now(), v_subscription.created_at))::INTEGER, 0) * 12
      + COALESCE(EXTRACT(MONTH FROM age(now(), v_subscription.created_at))::INTEGER, 0)
  );

  SELECT COUNT(*)::INTEGER INTO v_previous_cancellations
  FROM public.cancellation_attempts ca
  WHERE ca.user_id = p_user_id
    AND ca.final_action = 'cancelled';

  RETURN QUERY
  SELECT
    wbo.id,
    wbo.offer_code,
    wbo.offer_type,
    wbo.name,
    wbo.description,
    wbo.pause_duration_days,
    wbo.discount_percent,
    wbo.discount_duration_months,
    wbo.target_tier,
    wbo.bonus_credits
  FROM public.win_back_offers wbo
  WHERE wbo.is_active = true
    AND wbo.offer_type = 'pause'
    AND p_step = 2
    AND COALESCE(v_subscription.tier, v_subscription.plan, 'basic') = ANY(wbo.applicable_tiers)
    AND v_months_subscribed >= COALESCE(wbo.min_subscription_months, 0)
    AND v_previous_cancellations <= COALESCE(wbo.max_previous_cancellations, 999)
    AND NOT EXISTS (
      SELECT 1
      FROM public.cancellation_attempts used
      WHERE used.subscription_id = p_subscription_id
        AND used.offer_accepted = true
        AND used.final_action = 'paused'
        AND used.resolved_at >= now() - interval '90 days'
    )
  ORDER BY wbo.priority ASC, wbo.created_at DESC
  LIMIT 3;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_cancellation(
  p_subscription_id UUID,
  p_step INTEGER,
  p_reason public.cancellation_reason DEFAULT NULL,
  p_reason_details TEXT DEFAULT NULL,
  p_offer_code VARCHAR(50) DEFAULT NULL,
  p_accept_offer BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_subscription public.subscriptions%ROWTYPE;
  v_offer public.win_back_offers%ROWTYPE;
  v_attempt_id UUID;
  v_pause_until DATE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_step NOT BETWEEN 1 AND 4
    OR COALESCE(length(p_reason_details), 0) > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid cancellation request', 'code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id
    AND s.user_id = v_actor
    AND s.status::TEXT IN ('active', 'pending')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found', 'code', 'NOT_FOUND');
  END IF;

  IF p_accept_offer THEN
    IF p_offer_code IS NULL OR p_step <> 2 OR v_subscription.status::TEXT <> 'active' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Offer is not valid at this step', 'code', 'OFFER_INVALID');
    END IF;

    SELECT * INTO v_offer
    FROM public.win_back_offers wbo
    WHERE wbo.offer_code = p_offer_code
      AND wbo.is_active = true
      AND wbo.offer_type = 'pause'
      AND COALESCE(wbo.pause_duration_days, 0) BETWEEN 1 AND 30
      AND COALESCE(v_subscription.tier, v_subscription.plan, 'basic') = ANY(wbo.applicable_tiers)
    FOR UPDATE;

    IF NOT FOUND OR EXISTS (
      SELECT 1
      FROM public.cancellation_attempts ca
      WHERE ca.subscription_id = p_subscription_id
        AND ca.offer_accepted = true
        AND ca.final_action = 'paused'
        AND ca.resolved_at >= now() - interval '90 days'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Offer is unavailable', 'code', 'OFFER_INVALID');
    END IF;

    INSERT INTO public.cancellation_attempts (
      user_id,
      subscription_id,
      step_reached,
      cancellation_reason,
      reason_details,
      offer_shown,
      offer_accepted,
      final_action,
      resolved_at
    )
    VALUES (
      v_actor,
      p_subscription_id,
      p_step,
      p_reason,
      NULLIF(trim(p_reason_details), ''),
      v_offer.offer_code,
      true,
      'paused',
      now()
    )
    RETURNING id INTO v_attempt_id;

    v_pause_until := CURRENT_DATE + v_offer.pause_duration_days;

    UPDATE public.subscriptions
    SET status = 'pending',
        active = false,
        paused_at = now(),
        pause_until = v_pause_until,
        next_renewal_date = COALESCE(next_renewal_date, CURRENT_DATE) + v_offer.pause_duration_days,
        end_date = COALESCE(end_date, CURRENT_DATE) + v_offer.pause_duration_days,
        cancellation_reason = p_reason,
        cancellation_details = NULLIF(trim(p_reason_details), ''),
        updated_at = now()
    WHERE id = p_subscription_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'paused',
      'message', format('Your subscription has been paused for %s days', v_offer.pause_duration_days),
      'resumes_on', v_pause_until,
      'attempt_id', v_attempt_id
    );
  END IF;

  INSERT INTO public.cancellation_attempts (
    user_id,
    subscription_id,
    step_reached,
    cancellation_reason,
    reason_details,
    offer_shown,
    offer_accepted
  )
  VALUES (
    v_actor,
    p_subscription_id,
    p_step,
    p_reason,
    NULLIF(trim(p_reason_details), ''),
    NULL,
    false
  )
  RETURNING id INTO v_attempt_id;

  IF p_step = 4 THEN
    IF p_reason IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cancellation reason is required', 'code', 'REASON_REQUIRED');
    END IF;

    UPDATE public.subscriptions
    SET status = 'cancelled',
        active = false,
        auto_renew = false,
        cancelled_at = now(),
        cancellation_reason = p_reason,
        cancellation_details = NULLIF(trim(p_reason_details), ''),
        updated_at = now()
    WHERE id = p_subscription_id;

    UPDATE public.cancellation_attempts
    SET final_action = 'cancelled',
        resolved_at = now()
    WHERE id = v_attempt_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'cancelled',
      'message', format(
        'Your subscription has been cancelled. Access remains available until %s',
        COALESCE(v_subscription.end_date, v_subscription.next_renewal_date, CURRENT_DATE)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'continue',
    'current_step', p_step,
    'next_step', p_step + 1,
    'offers', COALESCE((
      SELECT jsonb_agg(to_jsonb(offer_row))
      FROM public.get_win_back_offers(v_actor, p_subscription_id, p_step + 1) offer_row
    ), '[]'::JSONB)
  );
END;
$$;

-- Freeze dates are inclusive, matching the customer UI.
ALTER TABLE public.subscription_freezes DROP CONSTRAINT IF EXISTS valid_freeze_period;
ALTER TABLE public.subscription_freezes DROP CONSTRAINT IF EXISTS max_freeze_days;
ALTER TABLE public.subscription_freezes
  ADD CONSTRAINT valid_freeze_period CHECK (
    freeze_start_date >= billing_cycle_start
    AND freeze_end_date <= billing_cycle_end
    AND freeze_end_date >= freeze_start_date
  );

CREATE OR REPLACE FUNCTION public.request_subscription_freeze(
  p_user_id UUID,
  p_subscription_id UUID,
  p_freeze_start_date DATE,
  p_freeze_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_subscription public.subscriptions%ROWTYPE;
  v_freeze_days INTEGER;
  v_days_remaining INTEGER;
  v_cycle_start DATE;
  v_cycle_end DATE;
  v_freeze_id UUID;
BEGIN
  IF v_actor IS NULL OR p_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_freeze_start_date < CURRENT_DATE + 1
    OR p_freeze_end_date < p_freeze_start_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freeze must be scheduled at least 24 hours in advance');
  END IF;

  v_freeze_days := p_freeze_end_date - p_freeze_start_date + 1;
  IF v_freeze_days NOT BETWEEN 1 AND 7 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A freeze can be 1 to 7 days');
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id
    AND s.user_id = v_actor
    AND s.status::TEXT = 'active'
    AND COALESCE(s.active, true) = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active subscription not found');
  END IF;

  v_cycle_start := COALESCE(v_subscription.month_start_date, v_subscription.start_date, CURRENT_DATE);
  v_cycle_end := COALESCE(v_subscription.next_renewal_date, v_subscription.end_date, v_cycle_start + 30);

  IF p_freeze_start_date < v_cycle_start OR p_freeze_end_date > v_cycle_end THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freeze period must be within the current billing cycle');
  END IF;

  v_days_remaining := 7 - COALESCE(v_subscription.freeze_days_used, 0);
  IF v_freeze_days > v_days_remaining THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Only %s freeze days remain this cycle', GREATEST(v_days_remaining, 0))
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscription_freezes sf
    WHERE sf.subscription_id = p_subscription_id
      AND sf.status IN ('scheduled', 'active')
      AND daterange(sf.freeze_start_date, sf.freeze_end_date, '[]')
        && daterange(p_freeze_start_date, p_freeze_end_date, '[]')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freeze period overlaps an existing freeze');
  END IF;

  INSERT INTO public.subscription_freezes (
    user_id,
    subscription_id,
    freeze_start_date,
    freeze_end_date,
    freeze_days,
    billing_cycle_start,
    billing_cycle_end,
    status
  )
  VALUES (
    v_actor,
    p_subscription_id,
    p_freeze_start_date,
    p_freeze_end_date,
    v_freeze_days,
    v_cycle_start,
    v_cycle_end,
    'scheduled'
  )
  RETURNING id INTO v_freeze_id;

  UPDATE public.subscriptions
  SET freeze_days_used = COALESCE(freeze_days_used, 0) + v_freeze_days,
      next_renewal_date = COALESCE(next_renewal_date, v_cycle_end) + v_freeze_days,
      end_date = COALESCE(end_date, v_cycle_end) + v_freeze_days,
      updated_at = now()
  WHERE id = p_subscription_id;

  RETURN jsonb_build_object(
    'success', true,
    'freeze_id', v_freeze_id,
    'freeze_days', v_freeze_days,
    'freeze_start', p_freeze_start_date,
    'freeze_end', p_freeze_end_date,
    'days_remaining_this_cycle', v_days_remaining - v_freeze_days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_subscription_freeze(
  p_freeze_id UUID,
  p_reason TEXT DEFAULT 'User cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_freeze public.subscription_freezes%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT * INTO v_freeze
  FROM public.subscription_freezes sf
  WHERE sf.id = p_freeze_id
    AND sf.status = 'scheduled'
    AND (
      sf.user_id = v_actor
      OR public.has_role(v_actor, 'admin')
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SCHEDULED_FREEZE_NOT_FOUND';
  END IF;

  UPDATE public.subscription_freezes
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_reason = LEFT(COALESCE(NULLIF(trim(p_reason), ''), 'Cancelled'), 500)
  WHERE id = v_freeze.id;

  UPDATE public.subscriptions
  SET freeze_days_used = GREATEST(0, COALESCE(freeze_days_used, 0) - v_freeze.freeze_days),
      next_renewal_date = next_renewal_date - v_freeze.freeze_days,
      end_date = end_date - v_freeze.freeze_days,
      updated_at = now()
  WHERE id = v_freeze.subscription_id;

  RETURN jsonb_build_object('success', true, 'freeze_id', v_freeze.id, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_subscription_freezes(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN :=
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR (v_actor IS NULL AND session_user IN ('postgres', 'supabase_admin'));
  v_target_user UUID;
  v_activated INTEGER := 0;
  v_completed INTEGER := 0;
  v_resumed_pauses INTEGER := 0;
BEGIN
  IF v_is_service OR (v_actor IS NOT NULL AND public.has_role(v_actor, 'admin')) THEN
    v_target_user := p_user_id;
  ELSE
    IF v_actor IS NULL OR (p_user_id IS NOT NULL AND p_user_id <> v_actor) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    v_target_user := v_actor;
  END IF;

  WITH activated AS (
    UPDATE public.subscription_freezes sf
    SET status = 'active',
        activated_at = COALESCE(activated_at, now())
    WHERE sf.status = 'scheduled'
      AND sf.freeze_start_date <= CURRENT_DATE
      AND sf.freeze_end_date >= CURRENT_DATE
      AND (v_target_user IS NULL OR sf.user_id = v_target_user)
    RETURNING sf.id, sf.subscription_id
  ), updated_subscriptions AS (
    UPDATE public.subscriptions s
    SET status = 'pending',
        active = false,
        freeze_active_id = activated.id,
        updated_at = now()
    FROM activated
    WHERE s.id = activated.subscription_id
      AND s.status::TEXT = 'active'
    RETURNING s.id
  )
  SELECT COUNT(*)::INTEGER INTO v_activated FROM updated_subscriptions;

  WITH completed AS (
    UPDATE public.subscription_freezes sf
    SET status = 'completed',
        completed_at = COALESCE(completed_at, now())
    WHERE sf.status IN ('scheduled', 'active')
      AND sf.freeze_end_date < CURRENT_DATE
      AND (v_target_user IS NULL OR sf.user_id = v_target_user)
    RETURNING sf.id, sf.subscription_id
  ), updated_subscriptions AS (
    UPDATE public.subscriptions s
    SET status = CASE
          WHEN COALESCE(s.end_date, CURRENT_DATE) >= CURRENT_DATE THEN 'active'::public.subscription_status
          ELSE 'expired'::public.subscription_status
        END,
        active = COALESCE(s.end_date, CURRENT_DATE) >= CURRENT_DATE,
        freeze_active_id = NULL,
        resumed_at = now(),
        updated_at = now()
    FROM completed
    WHERE s.id = completed.subscription_id
      AND s.freeze_active_id = completed.id
    RETURNING s.id
  )
  SELECT COUNT(*)::INTEGER INTO v_completed FROM completed;

  WITH resumed_pauses AS (
    UPDATE public.subscriptions s
    SET status = CASE
          WHEN COALESCE(s.end_date, CURRENT_DATE) >= CURRENT_DATE
            THEN 'active'::public.subscription_status
          ELSE 'expired'::public.subscription_status
        END,
        active = COALESCE(s.end_date, CURRENT_DATE) >= CURRENT_DATE,
        pause_until = NULL,
        resumed_at = now(),
        updated_at = now()
    WHERE s.status::TEXT = 'pending'
      AND s.freeze_active_id IS NULL
      AND s.pause_until IS NOT NULL
      AND s.pause_until <= CURRENT_DATE
      AND (v_target_user IS NULL OR s.user_id = v_target_user)
    RETURNING s.id
  )
  SELECT COUNT(*)::INTEGER INTO v_resumed_pauses FROM resumed_pauses;

  RETURN jsonb_build_object(
    'success', true,
    'activated', v_activated,
    'completed', v_completed,
    'resumed_pauses', v_resumed_pauses
  );
END;
$$;

DROP FUNCTION IF EXISTS public.resume_subscription(UUID);

CREATE FUNCTION public.resume_subscription(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.subscriptions s
  SET status = 'active',
      active = true,
      resumed_at = now(),
      pause_until = NULL,
      updated_at = now()
  WHERE s.id = p_subscription_id
    AND s.user_id = v_actor
    AND s.status::TEXT = 'pending'
    AND s.freeze_active_id IS NULL
    AND (s.pause_until IS NULL OR s.pause_until <= CURRENT_DATE)
    AND COALESCE(s.end_date, CURRENT_DATE) >= CURRENT_DATE;

  RETURN FOUND;
END;
$$;

DO $$
DECLARE
  v_policy RECORD;
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'cancellation_attempts',
    'win_back_offers',
    'subscription_freezes',
    'recovery_offers',
    'subscription_recovery'
  ] LOOP
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
  END LOOP;
END;
$$;

CREATE POLICY "Users and admins can view cancellation attempts"
  ON public.cancellation_attempts
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Authenticated users can view active retention offers"
  ON public.win_back_offers
  FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users and admins can view subscription freezes"
  ON public.subscription_freezes
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Authenticated users can view active recovery offers"
  ON public.recovery_offers
  FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users and admins can view subscription recovery"
  ON public.subscription_recovery
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

-- Recovery offers currently grant discounts, free time, or wallet credits
-- without payment evidence. Keep the catalog for audit/history, but do not
-- expose an active financial offer until a paid recovery contract is added.
UPDATE public.recovery_offers
SET is_active = false
WHERE is_active = true;

REVOKE INSERT, UPDATE, DELETE ON public.cancellation_attempts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.win_back_offers FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_freezes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.recovery_offers FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_recovery FROM authenticated;
REVOKE ALL ON public.recovery_offers, public.subscription_recovery FROM anon;
GRANT SELECT ON public.cancellation_attempts,
  public.win_back_offers,
  public.subscription_freezes,
  public.recovery_offers,
  public.subscription_recovery
TO authenticated;
GRANT ALL ON public.recovery_offers, public.subscription_recovery TO service_role;

REVOKE ALL ON FUNCTION public.get_win_back_offers(UUID, UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_cancellation(UUID, INTEGER, public.cancellation_reason, TEXT, VARCHAR, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_subscription_freeze(UUID, UUID, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_subscription_freeze(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_subscription_freezes(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resume_subscription(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_win_back_offers(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_cancellation(UUID, INTEGER, public.cancellation_reason, TEXT, VARCHAR, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_subscription_freeze(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_freeze(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_freezes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_subscription(UUID) TO authenticated;

-- All remaining entitlement/payment helpers are service-only until they can
-- prove a verified payment or an idempotent server event.
DO $$
DECLARE
  v_signature REGPROCEDURE;
BEGIN
  FOR v_signature IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'award_bonus_credits',
        'calculate_rollover_credits',
        'process_annual_renewal',
        'process_subscription_renewal',
        'decrement_monthly_meal_usage',
        'consume_meal_credit_v2',
        'increment_meal_usage',
        'retry_failed_payment',
        'reactivate_subscription',
        'apply_recovery_offer',
        'check_and_expire_subscriptions',
        'get_recovery_offers',
        'get_recovery_status',
        'dismiss_recovery'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_signature);
  END LOOP;
END;
$$;

-- Use pg_cron when available; the authenticated sync call remains a fallback.
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'sync-subscription-freezes';

    PERFORM cron.schedule(
      'sync-subscription-freezes',
      '*/15 * * * *',
      'SELECT public.sync_subscription_freezes(NULL);'
    );
  END IF;
EXCEPTION
  WHEN insufficient_privilege OR undefined_function OR undefined_table THEN
    RAISE NOTICE 'pg_cron is unavailable; freeze state will sync from authenticated app and renewal worker calls';
END;
$$;
