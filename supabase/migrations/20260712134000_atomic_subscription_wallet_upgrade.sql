-- Atomically price, charge, and apply subscription changes paid by wallet.

REVOKE INSERT, UPDATE, DELETE ON public.promotion_usage
  FROM anon, authenticated;
GRANT SELECT ON public.promotion_usage TO authenticated;
GRANT ALL ON public.promotion_usage TO service_role;

CREATE OR REPLACE FUNCTION public.upgrade_subscription_with_wallet(
  p_user_id UUID,
  p_subscription_id UUID,
  p_plan_id UUID,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_promotion public.promotions%ROWTYPE;
  v_payment_id UUID := gen_random_uuid();
  v_wallet_transaction_id UUID;
  v_period_days INTEGER;
  v_remaining_days INTEGER;
  v_prorated_credit NUMERIC(10, 2) := 0;
  v_amount_before_discount NUMERIC(10, 2);
  v_discount NUMERIC(10, 2) := 0;
  v_amount_due NUMERIC(10, 2);
  v_user_promo_uses INTEGER := 0;
  v_period_end DATE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  SELECT *
    INTO v_subscription
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id
    AND s.user_id = p_user_id
    AND s.status IN ('active', 'cancelled')
    AND (
      s.status = 'active'
      OR COALESCE(s.end_date, CURRENT_DATE - 1) >= CURRENT_DATE
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
  END IF;

  SELECT *
    INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = p_plan_id
    AND sp.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_PLAN_NOT_FOUND';
  END IF;

  IF v_subscription.plan_id = v_plan.id
    OR (
      v_subscription.plan_id IS NULL
      AND v_subscription.tier = v_plan.tier
      AND COALESCE(v_subscription.billing_interval, 'monthly') = v_plan.billing_interval
    ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_PLAN_UNCHANGED';
  END IF;

  IF v_subscription.end_date IS NOT NULL
    AND v_subscription.start_date IS NOT NULL
    AND v_subscription.end_date::DATE > CURRENT_DATE THEN
    v_period_days := GREATEST(
      1,
      v_subscription.end_date::DATE - v_subscription.start_date::DATE
    );
    v_remaining_days := GREATEST(
      0,
      v_subscription.end_date::DATE - CURRENT_DATE
    );
    v_prorated_credit := ROUND(
      COALESCE(v_subscription.price, 0)::NUMERIC
        * v_remaining_days::NUMERIC
        / v_period_days::NUMERIC,
      2
    );
  END IF;

  v_amount_before_discount := ROUND(
    GREATEST(0, v_plan.price_qar::NUMERIC - v_prorated_credit),
    2
  );

  IF NULLIF(TRIM(p_promo_code), '') IS NOT NULL THEN
    SELECT *
      INTO v_promotion
    FROM public.promotions p
    WHERE UPPER(p.code) = UPPER(TRIM(p_promo_code))
      AND p.is_active = TRUE
      AND p.valid_from <= NOW()
      AND (p.valid_until IS NULL OR p.valid_until > NOW())
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROMOTION_INVALID';
    END IF;

    IF v_promotion.max_uses IS NOT NULL
      AND COALESCE(v_promotion.uses_count, 0) >= v_promotion.max_uses THEN
      RAISE EXCEPTION 'PROMOTION_LIMIT_REACHED';
    END IF;

    IF v_plan.price_qar < COALESCE(v_promotion.min_order_amount, 0) THEN
      RAISE EXCEPTION 'PROMOTION_MINIMUM_NOT_MET';
    END IF;

    SELECT COUNT(*)::INTEGER
      INTO v_user_promo_uses
    FROM public.promotion_usage pu
    WHERE pu.promotion_id = v_promotion.id
      AND pu.user_id = p_user_id;

    IF v_user_promo_uses >= COALESCE(v_promotion.max_uses_per_user, 1) THEN
      RAISE EXCEPTION 'PROMOTION_USER_LIMIT_REACHED';
    END IF;

    IF v_promotion.discount_type::TEXT = 'percentage' THEN
      v_discount := ROUND(
        v_plan.price_qar::NUMERIC * v_promotion.discount_value::NUMERIC / 100,
        2
      );
      IF v_promotion.max_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_promotion.max_discount_amount::NUMERIC);
      END IF;
    ELSE
      v_discount := LEAST(
        v_plan.price_qar::NUMERIC,
        v_promotion.discount_value::NUMERIC
      );
    END IF;
  END IF;

  v_amount_due := ROUND(
    GREATEST(0, v_amount_before_discount - v_discount),
    2
  );

  IF v_amount_due > 0 THEN
    v_wallet_transaction_id := public.debit_wallet(
      p_user_id,
      v_amount_due,
      'subscription_upgrade',
      v_payment_id,
      'Subscription change to ' || v_plan.tier,
      jsonb_build_object(
        'subscription_id', p_subscription_id,
        'plan_id', v_plan.id,
        'prorated_credit', v_prorated_credit,
        'discount', v_discount
      )
    );
  END IF;

  v_period_end := CASE
    WHEN v_plan.billing_interval = 'annual'
      THEN CURRENT_DATE + INTERVAL '1 year'
    ELSE CURRENT_DATE + INTERVAL '1 month'
  END;

  INSERT INTO public.payments (
    id,
    user_id,
    payment_type,
    amount,
    currency,
    status,
    payment_method,
    gateway,
    gateway_reference,
    provider_transaction_id,
    wallet_transaction_id,
    description,
    metadata,
    idempotency_key,
    fulfillment_status,
    verified_at,
    completed_at,
    processed_at,
    created_at,
    updated_at
  ) VALUES (
    v_payment_id,
    p_user_id,
    'subscription',
    v_amount_due,
    'QAR',
    'completed',
    'wallet',
    'wallet',
    v_payment_id::TEXT,
    v_wallet_transaction_id::TEXT,
    v_wallet_transaction_id,
    'Subscription change to ' || v_plan.tier,
    jsonb_build_object(
      'mode', 'upgrade',
      'subscription_id', p_subscription_id,
      'plan_id', v_plan.id,
      'price_qar', v_plan.price_qar,
      'prorated_credit', v_prorated_credit,
      'discount', v_discount,
      'promotion_id', v_promotion.id
    ),
    gen_random_uuid(),
    'completed',
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    NOW()
  );

  UPDATE public.subscriptions
  SET plan_id = v_plan.id,
      payment_id = v_payment_id,
      plan = v_plan.tier,
      plan_type = v_plan.tier,
      tier = v_plan.tier,
      status = 'active',
      active = TRUE,
      billing_interval = v_plan.billing_interval,
      price = v_plan.price_qar,
      price_per_meal = v_plan.price_per_meal,
      start_date = CURRENT_DATE,
      end_date = v_period_end,
      next_renewal_date = v_period_end,
      annual_renewal_date = CASE
        WHEN v_plan.billing_interval = 'annual' THEN v_period_end
        ELSE NULL
      END,
      meals_per_month = v_plan.meals_per_month,
      meals_used_this_month = 0,
      month_start_date = DATE_TRUNC('month', CURRENT_DATE)::DATE,
      meals_per_week = COALESCE(v_plan.meals_per_week, 0),
      meals_used_this_week = 0,
      week_start_date = DATE_TRUNC('week', CURRENT_DATE)::DATE,
      snacks_per_month = COALESCE(v_plan.snacks_per_month, 0),
      snacks_used_this_month = 0,
      annual_discount_percent = COALESCE(v_plan.discount_percent, 0),
      prorated_credit = v_prorated_credit,
      updated_at = NOW()
  WHERE id = v_subscription.id;

  IF v_promotion.id IS NOT NULL THEN
    INSERT INTO public.promotion_usage (
      promotion_id,
      user_id,
      discount_applied
    ) VALUES (
      v_promotion.id,
      p_user_id,
      v_discount
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'payment_id', v_payment_id,
    'subscription_id', v_subscription.id,
    'plan_id', v_plan.id,
    'prorated_credit', v_prorated_credit,
    'discount', v_discount,
    'amount_due', v_amount_due,
    'new_tier', v_plan.tier,
    'new_billing_interval', v_plan.billing_interval
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upgrade_subscription_with_wallet(
  UUID, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_subscription_with_wallet(
  UUID, UUID, UUID, TEXT
) TO service_role;

COMMENT ON FUNCTION public.upgrade_subscription_with_wallet(UUID, UUID, UUID, TEXT) IS
  'Service-only atomic wallet charge, promotion redemption, payment audit, and subscription plan change.';
