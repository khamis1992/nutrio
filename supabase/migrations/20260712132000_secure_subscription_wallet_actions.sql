-- Protect subscription quotas and wallet balances from caller-controlled RPCs.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS price_per_meal NUMERIC(10, 2);

UPDATE public.subscriptions s
SET price_per_meal = COALESCE(
  (
    SELECT sp.price_per_meal
    FROM public.subscription_plans sp
    WHERE sp.id = s.plan_id
       OR (
         sp.tier = s.tier
         AND sp.billing_interval = COALESCE(s.billing_interval, 'monthly')
       )
    ORDER BY (sp.id = s.plan_id) DESC
    LIMIT 1
  ),
  50
)
WHERE s.price_per_meal IS NULL;

-- Customers may read their subscription, but only trusted functions may create
-- or mutate financial/quota fields. Admins retain management access through RLS.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.subscriptions',
      v_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY subscriptions_owner_read
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY subscriptions_admin_manage
  ON public.subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'staff')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_monthly_meal_usage(
  p_subscription_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_subscription public.subscriptions%ROWTYPE;
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_current_week DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  v_monthly_used INTEGER;
  v_weekly_used INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT *
    INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
    AND user_id = v_user_id
    AND status IN ('active', 'cancelled')
    AND (
      status = 'active'
      OR COALESCE(end_date, CURRENT_DATE - 1) >= CURRENT_DATE
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_monthly_used := CASE
    WHEN v_subscription.month_start_date IS NULL
      OR v_subscription.month_start_date < v_current_month THEN 0
    ELSE COALESCE(v_subscription.meals_used_this_month, 0)
  END;

  v_weekly_used := CASE
    WHEN v_subscription.week_start_date IS NULL
      OR v_subscription.week_start_date < v_current_week THEN 0
    ELSE COALESCE(v_subscription.meals_used_this_week, 0)
  END;

  IF COALESCE(v_subscription.tier, '') <> 'vip'
    AND COALESCE(v_subscription.meals_per_month, 0) > 0
    AND v_monthly_used >= v_subscription.meals_per_month THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(v_subscription.tier, '') <> 'vip'
    AND COALESCE(v_subscription.meals_per_week, 0) > 0
    AND v_weekly_used >= v_subscription.meals_per_week THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET meals_used_this_month = v_monthly_used + 1,
      month_start_date = v_current_month,
      meals_used_this_week = v_weekly_used + 1,
      week_start_date = v_current_week,
      updated_at = NOW()
  WHERE id = v_subscription.id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_snack_usage(
  p_subscription_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_subscription public.subscriptions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT *
    INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
    AND user_id = v_user_id
    AND status IN ('active', 'cancelled')
    AND (
      status = 'active'
      OR COALESCE(end_date, CURRENT_DATE - 1) >= CURRENT_DATE
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(v_subscription.tier, '') <> 'vip'
    AND (
      COALESCE(v_subscription.snacks_per_month, 0) <= 0
      OR COALESCE(v_subscription.snacks_used_this_month, 0)
        >= v_subscription.snacks_per_month
    ) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET snacks_used_this_month = COALESCE(snacks_used_this_month, 0) + 1,
      updated_at = NOW()
  WHERE id = v_subscription.id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_subscription(
  p_subscription_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET status = 'pending',
      active = FALSE,
      updated_at = NOW()
  WHERE id = p_subscription_id
    AND user_id = v_user_id
    AND status = 'active';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_subscription(
  p_subscription_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET status = 'active',
      active = TRUE,
      updated_at = NOW()
  WHERE id = p_subscription_id
    AND user_id = v_user_id
    AND status = 'pending'
    AND COALESCE(end_date, CURRENT_DATE) >= CURRENT_DATE;

  RETURN FOUND;
END;
$$;

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
  v_user_id UUID := auth.uid();
  v_rollover public.subscription_rollovers%ROWTYPE;
  v_new_credits INTEGER;
BEGIN
  IF v_user_id IS NULL OR p_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.id = p_subscription_id
      AND s.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
  END IF;

  SELECT *
    INTO v_rollover
  FROM public.subscription_rollovers
  WHERE user_id = v_user_id
    AND subscription_id = p_subscription_id
    AND status = 'active'
    AND expiry_date >= CURRENT_DATE
    AND rollover_credits > 0
  ORDER BY expiry_date ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'used_rollover', FALSE,
      'rollover_remaining', 0
    );
  END IF;

  v_new_credits := v_rollover.rollover_credits - 1;

  UPDATE public.subscription_rollovers
  SET status = CASE WHEN v_new_credits = 0 THEN 'consumed' ELSE status END,
      rollover_credits = v_new_credits,
      updated_at = NOW()
  WHERE id = v_rollover.id;

  UPDATE public.subscriptions
  SET rollover_credits = GREATEST(0, COALESCE(rollover_credits, 0) - 1),
      updated_at = NOW()
  WHERE id = p_subscription_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'used_rollover', TRUE,
    'rollover_remaining', v_new_credits,
    'rollover_id', v_rollover.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id UUID,
  p_amount NUMERIC(10, 2),
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_wallet public.customer_wallets%ROWTYPE;
  v_balance_after NUMERIC(10, 2);
  v_transaction_id UUID;
BEGIN
  IF NOT v_is_service AND (v_actor_id IS NULL OR p_user_id <> v_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_WALLET_AMOUNT';
  END IF;

  SELECT *
    INTO v_wallet
  FROM public.customer_wallets
  WHERE user_id = p_user_id
    AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCE';
  END IF;

  v_balance_after := v_wallet.balance - p_amount;

  UPDATE public.customer_wallets
  SET balance = v_balance_after,
      total_debits = COALESCE(total_debits, 0) + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    v_wallet.id,
    p_user_id,
    'debit',
    p_amount,
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_description,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_extra_meal_credit(
  p_subscription_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_subscription public.subscriptions%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_price NUMERIC(10, 2);
  v_balance_after NUMERIC(10, 2);
  v_transaction_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT *
    INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
    AND user_id = v_user_id
    AND status IN ('active', 'cancelled')
    AND (
      status = 'active'
      OR COALESCE(end_date, CURRENT_DATE - 1) >= CURRENT_DATE
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
  END IF;

  SELECT COALESCE(
    v_subscription.price_per_meal,
    (
      SELECT sp.price_per_meal
      FROM public.subscription_plans sp
      WHERE sp.id = v_subscription.plan_id
         OR (
           sp.tier = v_subscription.tier
           AND sp.billing_interval = COALESCE(
             v_subscription.billing_interval,
             'monthly'
           )
         )
      ORDER BY (sp.id = v_subscription.plan_id) DESC
      LIMIT 1
    ),
    50
  ) INTO v_price;

  IF v_price <= 0 THEN
    RAISE EXCEPTION 'INVALID_MEAL_CREDIT_PRICE';
  END IF;

  SELECT *
    INTO v_wallet
  FROM public.customer_wallets
  WHERE user_id = v_user_id
    AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_wallet.balance, 0) < v_price THEN
    RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCE';
  END IF;

  v_balance_after := v_wallet.balance - v_price;

  UPDATE public.customer_wallets
  SET balance = v_balance_after,
      total_debits = COALESCE(total_debits, 0) + v_price,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  UPDATE public.subscriptions
  SET meals_per_month = COALESCE(meals_per_month, 0) + 1,
      updated_at = NOW()
  WHERE id = v_subscription.id;

  INSERT INTO public.wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  ) VALUES (
    v_wallet.id,
    v_user_id,
    'debit',
    v_price,
    v_balance_after,
    'extra_meal_credit',
    v_subscription.id,
    'Extra meal credit purchase',
    jsonb_build_object('subscription_id', v_subscription.id)
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'transaction_id', v_transaction_id,
    'amount', v_price,
    'new_balance', v_balance_after,
    'meals_per_month', COALESCE(v_subscription.meals_per_month, 0) + 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_streak_reward(
  p_reward_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reward public.streak_rewards%ROWTYPE;
  v_streak_days INTEGER;
  v_wallet public.customer_wallets%ROWTYPE;
  v_balance_after NUMERIC(10, 2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT *
    INTO v_reward
  FROM public.streak_rewards
  WHERE id = p_reward_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REWARD_NOT_FOUND';
  END IF;

  SELECT COALESCE(streak_days, 0)
    INTO v_streak_days
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF COALESCE(v_streak_days, 0) < v_reward.streak_days THEN
    RAISE EXCEPTION 'REWARD_NOT_EARNED';
  END IF;

  INSERT INTO public.streak_rewards_claimed (
    user_id,
    reward_id,
    streak_days,
    reward_type,
    reward_value
  ) VALUES (
    v_user_id,
    v_reward.id,
    v_reward.streak_days,
    v_reward.reward_type,
    v_reward.reward_value
  )
  ON CONFLICT (user_id, reward_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'already_claimed', TRUE,
      'reward_id', v_reward.id
    );
  END IF;

  IF v_reward.reward_type = 'bonus_credit' AND v_reward.reward_value > 0 THEN
    SELECT *
      INTO v_wallet
    FROM public.customer_wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.customer_wallets (
        user_id, balance, total_credits, total_debits, is_active
      ) VALUES (
        v_user_id, 0, 0, 0, TRUE
      )
      RETURNING * INTO v_wallet;
    END IF;

    v_balance_after := COALESCE(v_wallet.balance, 0) + v_reward.reward_value;

    UPDATE public.customer_wallets
    SET balance = v_balance_after,
        total_credits = COALESCE(total_credits, 0) + v_reward.reward_value,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO public.wallet_transactions (
      wallet_id,
      user_id,
      type,
      amount,
      balance_after,
      reference_type,
      reference_id,
      description,
      metadata
    ) VALUES (
      v_wallet.id,
      v_user_id,
      'bonus',
      v_reward.reward_value,
      v_balance_after,
      'streak_reward',
      v_reward.id,
      'Streak reward',
      jsonb_build_object('streak_days', v_reward.streak_days)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'already_claimed', FALSE,
    'reward_id', v_reward.id,
    'reward_type', v_reward.reward_type,
    'reward_value', v_reward.reward_value,
    'wallet_balance', v_balance_after
  );
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.streak_rewards_claimed
  FROM anon, authenticated;
GRANT SELECT ON public.streak_rewards_claimed TO authenticated;

DO $$
DECLARE
  v_function RECORD;
BEGIN
  FOR v_function IN
    SELECT p.oid::REGPROCEDURE AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'credit_wallet',
        'create_subscription',
        'upgrade_subscription',
        'allocate_subscription_credits',
        'process_payment_atomic'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      v_function.signature
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_monthly_meal_usage(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_snack_usage(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pause_subscription(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resume_subscription(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.use_rollover_credit_if_available(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.debit_wallet(UUID, NUMERIC, TEXT, UUID, TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_extra_meal_credit(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_streak_reward(UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.increment_monthly_meal_usage(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_snack_usage(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pause_subscription(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resume_subscription(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.use_rollover_credit_if_available(UUID, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, NUMERIC, TEXT, UUID, TEXT, JSONB)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_extra_meal_credit(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_streak_reward(UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.purchase_extra_meal_credit(UUID) IS
  'Atomically debits the authenticated customer wallet and increases their subscription meal allowance.';
COMMENT ON FUNCTION public.claim_streak_reward(UUID) IS
  'Validates streak eligibility and atomically fulfills the configured reward.';
