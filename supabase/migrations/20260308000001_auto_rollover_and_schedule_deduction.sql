-- Migration: Auto-trigger rollover on renewal + rollover deduction for meal schedules
-- Date: 2026-03-08

-- ============================================================
-- 1. SIMPLE ROLLOVER DEDUCTION FOR MEAL SCHEDULING
--    (consume_meal_credit_v2 requires orders table; this works
--     with meal_schedules which is the actual scheduling flow)
-- ============================================================
CREATE OR REPLACE FUNCTION use_rollover_credit_if_available(
  p_subscription_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rollover subscription_rollovers%ROWTYPE;
  v_new_credits integer;
BEGIN
  -- Find oldest expiring active rollover for this user
  SELECT * INTO v_rollover
  FROM subscription_rollovers
  WHERE user_id = p_user_id
    AND subscription_id = p_subscription_id
    AND status = 'active'
    AND expiry_date >= CURRENT_DATE
    AND rollover_credits > 0
  ORDER BY expiry_date ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No rollover credits available
    RETURN jsonb_build_object('used_rollover', false, 'rollover_remaining', 0);
  END IF;

  v_new_credits := v_rollover.rollover_credits - 1;

  IF v_new_credits <= 0 THEN
    -- Fully consumed — mark as consumed
    UPDATE subscription_rollovers
    SET status = 'consumed',
        rollover_credits = 0,
        updated_at = now()
    WHERE id = v_rollover.id;
  ELSE
    -- Partially consumed — decrement
    UPDATE subscription_rollovers
    SET rollover_credits = v_new_credits,
        updated_at = now()
    WHERE id = v_rollover.id;
  END IF;

  -- Keep subscriptions.rollover_credits column in sync
  UPDATE subscriptions
  SET rollover_credits = GREATEST(0, COALESCE(rollover_credits, 0) - 1),
      updated_at = now()
  WHERE id = p_subscription_id;

  RETURN jsonb_build_object(
    'used_rollover', true,
    'rollover_remaining', v_new_credits,
    'rollover_id', v_rollover.id
  );
END;
$$;

COMMENT ON FUNCTION use_rollover_credit_if_available IS
  'Deducts 1 rollover credit from the soonest-expiring active rollover record.
   Returns whether a rollover credit was used. Called when a meal is scheduled.';


-- NOTE: Auto-trigger for rollover on renewal was removed.
-- The subscriptions table does not have plan_id / current_period_start columns
-- that the trigger required. Rollover credits are granted manually via
-- calculate_rollover_credits RPC or the RolloverCreditsWidget.


-- ============================================================
-- 3. EXPIRE OLD ROLLOVER RECORDS (cleanup)
-- ============================================================
CREATE OR REPLACE FUNCTION expire_old_rollover_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE subscription_rollovers
  SET status = 'expired', updated_at = now()
  WHERE status = 'active'
    AND expiry_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_old_rollover_credits IS
  'Marks expired rollover records as expired. Call via pg_cron or scheduled job.';
