BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_user_subscription_wallet(
  p_user_id UUID,
  p_subscription_id UUID DEFAULT NULL,
  p_plan TEXT DEFAULT 'monthly',
  p_status public.subscription_status DEFAULT 'active',
  p_tier TEXT DEFAULT 'basic',
  p_meals_per_week INTEGER DEFAULT 0,
  p_meals_per_month INTEGER DEFAULT 0,
  p_meals_used_this_week INTEGER DEFAULT 0,
  p_meals_used_this_month INTEGER DEFAULT 0,
  p_price NUMERIC DEFAULT 0,
  p_end_date DATE DEFAULT NULL,
  p_includes_gym BOOLEAN DEFAULT FALSE,
  p_wallet_balance NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_subscription_id UUID;
  v_wallet public.customer_wallets%ROWTYPE;
  v_current_balance NUMERIC(10, 2) := 0;
  v_next_balance NUMERIC(10, 2);
  v_delta NUMERIC(10, 2);
  v_transaction_id UUID;
  v_today DATE := CURRENT_DATE;
  v_effective_end_date DATE;
BEGIN
  IF auth.role() <> 'service_role' AND (
    v_actor_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_actor_id
        AND ur.role IN ('admin', 'staff')
    )
  ) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED';
  END IF;

  v_effective_end_date := CASE
    WHEN p_status = 'active' AND (p_end_date IS NULL OR p_end_date < v_today) THEN
      v_today + CASE WHEN LOWER(COALESCE(p_plan, 'monthly')) = 'weekly' THEN 7 ELSE 30 END
    ELSE p_end_date
  END;

  IF p_subscription_id IS NULL THEN
    INSERT INTO public.subscriptions (
      user_id,
      plan,
      plan_type,
      status,
      tier,
      meals_per_week,
      meals_per_month,
      meals_used_this_week,
      meals_used_this_month,
      price,
      start_date,
      end_date,
      active,
      week_start_date,
      month_start_date,
      updated_at
    ) VALUES (
      p_user_id,
      p_plan,
      p_plan,
      p_status,
      p_tier,
      GREATEST(COALESCE(p_meals_per_week, 0), 0),
      GREATEST(COALESCE(p_meals_per_month, 0), 0),
      GREATEST(COALESCE(p_meals_used_this_week, 0), 0),
      GREATEST(COALESCE(p_meals_used_this_month, 0), 0),
      GREATEST(COALESCE(p_price, 0), 0),
      v_today,
      v_effective_end_date,
      p_status = 'active',
      v_today,
      v_today,
      NOW()
    )
    RETURNING id INTO v_subscription_id;
  ELSE
    UPDATE public.subscriptions
    SET plan = p_plan,
        plan_type = p_plan,
        status = p_status,
        tier = p_tier,
        meals_per_week = GREATEST(COALESCE(p_meals_per_week, 0), 0),
        meals_per_month = GREATEST(COALESCE(p_meals_per_month, 0), 0),
        meals_used_this_week = GREATEST(COALESCE(p_meals_used_this_week, 0), 0),
        meals_used_this_month = GREATEST(COALESCE(p_meals_used_this_month, 0), 0),
        price = GREATEST(COALESCE(p_price, 0), 0),
        end_date = v_effective_end_date,
        active = p_status = 'active',
        week_start_date = COALESCE(week_start_date, v_today),
        month_start_date = COALESCE(month_start_date, v_today),
        updated_at = NOW()
    WHERE id = p_subscription_id
      AND user_id = p_user_id
    RETURNING id INTO v_subscription_id;

    IF v_subscription_id IS NULL THEN
      RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
    END IF;
  END IF;

  IF p_status = 'active' THEN
    UPDATE public.subscriptions
    SET active = FALSE,
        status = 'expired',
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND id <> v_subscription_id
      AND status = 'active';
  END IF;

  IF p_wallet_balance IS NOT NULL THEN
    v_next_balance := ROUND(GREATEST(COALESCE(p_wallet_balance, 0), 0), 2);

    INSERT INTO public.customer_wallets (user_id, balance, total_credits, total_debits, is_active)
    VALUES (p_user_id, 0, 0, 0, TRUE)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT *
      INTO v_wallet
    FROM public.customer_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    v_current_balance := COALESCE(v_wallet.balance, 0);
    v_delta := ROUND(v_next_balance - v_current_balance, 2);

    UPDATE public.customer_wallets
    SET balance = v_next_balance,
        total_credits = COALESCE(total_credits, 0) + CASE WHEN v_delta > 0 THEN v_delta ELSE 0 END,
        total_debits = COALESCE(total_debits, 0) + CASE WHEN v_delta < 0 THEN ABS(v_delta) ELSE 0 END,
        is_active = TRUE,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    IF ABS(v_delta) >= 0.01 THEN
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
        CASE WHEN v_delta > 0 THEN 'credit' ELSE 'debit' END,
        ABS(v_delta),
        v_next_balance,
        NULL,
        v_subscription_id,
        'Admin adjusted wallet balance',
        jsonb_build_object(
          'source', 'admin_adjustment',
          'actor_id', v_actor_id,
          'previous_balance', v_current_balance,
          'new_balance', v_next_balance,
          'delta', v_delta
        )
      )
      RETURNING id INTO v_transaction_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'subscription_id', v_subscription_id,
    'wallet_balance', COALESCE(v_next_balance, v_current_balance),
    'wallet_transaction_id', v_transaction_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_subscription_wallet(
  UUID, UUID, TEXT, public.subscription_status, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, DATE, BOOLEAN, NUMERIC
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
