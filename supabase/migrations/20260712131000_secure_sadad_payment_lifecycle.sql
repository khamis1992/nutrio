-- Secure SADAD payment intents and fulfillment.
-- Client applications may only read their payment records. Creation and
-- fulfillment are performed by the sadad-payment Edge Function.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS meals_per_week INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snacks_per_month INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_meals INTEGER,
  ADD COLUMN IF NOT EXISTS daily_snacks INTEGER,
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS short_description_ar TEXT,
  ADD COLUMN IF NOT EXISTS price_per_snack NUMERIC(10, 2);

UPDATE public.subscription_plans
SET meals_per_week = COALESCE(meals_per_week, 0),
    snacks_per_month = COALESCE(snacks_per_month, 0),
    daily_meals = COALESCE(
      daily_meals,
      CEIL(COALESCE(meals_per_month, 0)::NUMERIC / 30)::INTEGER
    ),
    daily_snacks = COALESCE(
      daily_snacks,
      CEIL(COALESCE(snacks_per_month, 0)::NUMERIC / 30)::INTEGER
    );

ALTER TABLE public.subscription_plans
  ALTER COLUMN daily_meals SET DEFAULT 0,
  ALTER COLUMN daily_snacks SET DEFAULT 0;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan TEXT,
  ADD COLUMN IF NOT EXISTS plan_type TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'plan_name'
  ) THEN
    UPDATE public.subscriptions
    SET plan = COALESCE(plan, plan_name),
        tier = COALESCE(tier, LOWER(plan_name)),
        plan_type = COALESCE(plan_type, LOWER(plan_name));

    ALTER TABLE public.subscriptions
      ALTER COLUMN plan_name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE public.subscriptions
      ALTER COLUMN billing_cycle DROP NOT NULL;
  END IF;
END;
$$;

UPDATE public.subscriptions
SET status = 'pending',
    updated_at = NOW()
WHERE status::TEXT = 'paused';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check,
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

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

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fulfillment_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_fulfillment_status_check'
      AND conrelid = 'public.payments'::REGCLASS
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_fulfillment_status_check
      CHECK (fulfillment_status IN ('pending', 'completed', 'failed'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_unique
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_transaction_unique
  ON public.payments (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_pending_user_created_idx
  ON public.payments (user_id, created_at DESC)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.subscription_renewal_processed
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS source_cycle_end DATE,
  ADD COLUMN IF NOT EXISTS new_period_start DATE,
  ADD COLUMN IF NOT EXISTS new_period_end DATE,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2);

UPDATE public.subscription_renewal_processed
SET source_cycle_end = renewal_date - 1
WHERE source_cycle_end IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY subscription_id, source_cycle_end
      ORDER BY
        CASE status WHEN 'success' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        processed_at DESC,
        id DESC
    ) AS row_number
  FROM public.subscription_renewal_processed
  WHERE source_cycle_end IS NOT NULL
)
DELETE FROM public.subscription_renewal_processed srp
USING ranked
WHERE srp.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_renewal_source_cycle_unique
  ON public.subscription_renewal_processed (subscription_id, source_cycle_end)
  WHERE source_cycle_end IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_renewal_payment_unique
  ON public.subscription_renewal_processed (payment_id)
  WHERE payment_id IS NOT NULL;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_id_unique
  ON public.subscriptions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'sadad',
  source TEXT NOT NULL CHECK (source IN ('callback', 'webhook')),
  provider_transaction_id TEXT,
  provider_status TEXT,
  checksum_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

CREATE INDEX IF NOT EXISTS payment_provider_events_payment_idx
  ON public.payment_provider_events (payment_id, received_at DESC);

CREATE INDEX IF NOT EXISTS payment_provider_events_transaction_idx
  ON public.payment_provider_events (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_provider_events_admin_read
  ON public.payment_provider_events;
CREATE POLICY payment_provider_events_admin_read
  ON public.payment_provider_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
REVOKE ALL ON public.payment_provider_events FROM anon, authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.payment_provider_events TO authenticated;
GRANT ALL ON public.payment_provider_events TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_sadad_payment(
  p_user_id UUID,
  p_payment_type TEXT,
  p_reference_id UUID,
  p_subscription_id UUID DEFAULT NULL,
  p_coach_plan TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_id UUID := gen_random_uuid();
  v_amount NUMERIC(10, 2);
  v_description TEXT;
  v_metadata JSONB;
  v_package RECORD;
  v_plan RECORD;
  v_coach_pricing RECORD;
  v_current_subscription RECORD;
  v_renewal_reservation public.subscription_renewal_processed%ROWTYPE;
  v_existing_payment public.payments%ROWTYPE;
  v_period_days INTEGER;
  v_remaining_days INTEGER;
  v_prorated_credit NUMERIC(10, 2) := 0;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_user_id
  ) THEN
    RAISE EXCEPTION 'PAYMENT_USER_NOT_FOUND';
  END IF;

  IF p_payment_type = 'wallet_topup' THEN
    SELECT id, name, amount, bonus_amount
      INTO v_package
    FROM public.wallet_topup_packages
    WHERE id = p_reference_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PAYMENT_PACKAGE_NOT_FOUND';
    END IF;

    v_amount := ROUND(v_package.amount::NUMERIC, 2);
    v_description := 'Wallet top-up - ' || v_package.name;
    v_metadata := jsonb_build_object(
      'package_id', v_package.id,
      'package_name', v_package.name,
      'paid_amount', v_amount,
      'bonus_amount', COALESCE(v_package.bonus_amount, 0)
    );
  ELSIF p_payment_type = 'subscription' THEN
    SELECT
      id,
      tier,
      billing_interval,
      price_qar,
      meals_per_month,
      meals_per_week,
      snacks_per_month,
      daily_meals,
      daily_snacks,
      discount_percent
      INTO v_plan
    FROM public.subscription_plans
    WHERE id = p_reference_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PAYMENT_PLAN_NOT_FOUND';
    END IF;

    IF p_subscription_id IS NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.user_id = p_user_id
          AND (
            s.status = 'active'
            OR (
              s.status = 'cancelled'
              AND COALESCE(s.end_date, CURRENT_DATE - 1) >= CURRENT_DATE
            )
          )
      ) THEN
        RAISE EXCEPTION 'ACTIVE_SUBSCRIPTION_EXISTS';
      END IF;

      v_amount := ROUND(v_plan.price_qar::NUMERIC, 2);
      v_description := 'Subscription purchase - ' || v_plan.tier;
      v_metadata := jsonb_build_object('mode', 'purchase');
    ELSE
      PERFORM pg_advisory_xact_lock(
        hashtextextended(p_subscription_id::TEXT, 0)
      );

      SELECT *
        INTO v_current_subscription
      FROM public.subscriptions s
      WHERE s.id = p_subscription_id
        AND s.user_id = p_user_id
        AND s.status IN ('active', 'cancelled', 'expired')
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
      END IF;

      IF v_current_subscription.plan_id = v_plan.id
        OR (
          v_current_subscription.plan_id IS NULL
          AND v_current_subscription.tier = v_plan.tier
          AND COALESCE(v_current_subscription.billing_interval, 'monthly')
            = v_plan.billing_interval
        ) THEN
        IF v_current_subscription.end_date IS NULL
          OR v_current_subscription.end_date::DATE >= CURRENT_DATE THEN
          RAISE EXCEPTION 'SUBSCRIPTION_RENEWAL_TOO_EARLY';
        END IF;

        SELECT *
          INTO v_renewal_reservation
        FROM public.subscription_renewal_processed srp
        WHERE srp.subscription_id = p_subscription_id
          AND srp.source_cycle_end = COALESCE(
            v_current_subscription.end_date::DATE,
            CURRENT_DATE
          )
        FOR UPDATE;

        IF v_renewal_reservation.id IS NOT NULL
          AND v_renewal_reservation.status = 'success' THEN
          RAISE EXCEPTION 'SUBSCRIPTION_CYCLE_ALREADY_RENEWED';
        END IF;

        IF v_renewal_reservation.payment_id IS NOT NULL THEN
          SELECT *
            INTO v_existing_payment
          FROM public.payments p
          WHERE p.id = v_renewal_reservation.payment_id;

          IF v_existing_payment.id IS NOT NULL
            AND v_existing_payment.status = 'completed' THEN
            RAISE EXCEPTION 'PAYMENT_FULFILLMENT_RETRY_REQUIRED';
          END IF;

          IF v_existing_payment.id IS NOT NULL
            AND v_existing_payment.status IN ('pending', 'processing')
            AND v_existing_payment.fulfillment_status = 'pending'
            AND COALESCE(v_existing_payment.created_at, NOW() - INTERVAL '1 day')
              >= NOW() - INTERVAL '30 minutes' THEN
            RETURN jsonb_build_object(
              'payment_id', v_existing_payment.id,
              'amount', v_existing_payment.amount,
              'currency', v_existing_payment.currency,
              'payment_type', v_existing_payment.payment_type,
              'description', v_existing_payment.description,
              'metadata', v_existing_payment.metadata,
              'reused', TRUE
            );
          END IF;
        END IF;

        v_amount := ROUND(v_plan.price_qar::NUMERIC, 2);
        v_description := 'Subscription renewal - ' || v_plan.tier;
        v_metadata := jsonb_build_object(
          'mode', 'renewal',
          'subscription_id', p_subscription_id,
          'previous_end_date', v_current_subscription.end_date,
          'source_cycle_end', COALESCE(
            v_current_subscription.end_date::DATE,
            CURRENT_DATE
          )
        );
      ELSE
        IF v_current_subscription.end_date IS NOT NULL
          AND v_current_subscription.start_date IS NOT NULL
          AND v_current_subscription.end_date::DATE > CURRENT_DATE THEN
          v_period_days := GREATEST(
            1,
            v_current_subscription.end_date::DATE
              - v_current_subscription.start_date::DATE
          );
          v_remaining_days := GREATEST(
            0,
            v_current_subscription.end_date::DATE - CURRENT_DATE
          );
          v_prorated_credit := ROUND(
            COALESCE(v_current_subscription.price, 0)::NUMERIC
              * v_remaining_days::NUMERIC
              / v_period_days::NUMERIC,
            2
          );
        END IF;

        v_amount := ROUND(
          GREATEST(0, v_plan.price_qar::NUMERIC - v_prorated_credit),
          2
        );
        v_description := 'Subscription change - ' || v_plan.tier;
        v_metadata := jsonb_build_object(
          'mode', 'upgrade',
          'subscription_id', p_subscription_id,
          'prorated_credit', v_prorated_credit
        );
      END IF;
    END IF;

    v_metadata := v_metadata || jsonb_build_object(
      'plan_id', v_plan.id,
      'tier', v_plan.tier,
      'billing_interval', v_plan.billing_interval,
      'price_qar', v_plan.price_qar,
      'meals_per_month', v_plan.meals_per_month,
      'meals_per_week', v_plan.meals_per_week,
      'snacks_per_month', v_plan.snacks_per_month,
      'daily_meals', v_plan.daily_meals,
      'daily_snacks', v_plan.daily_snacks,
      'discount_percent', v_plan.discount_percent
    );
  ELSIF p_payment_type = 'coach_subscription' THEN
    IF p_reference_id = p_user_id THEN
      RAISE EXCEPTION 'COACH_SELF_SUBSCRIPTION_NOT_ALLOWED';
    END IF;

    IF p_coach_plan NOT IN ('weekly', 'monthly') THEN
      RAISE EXCEPTION 'COACH_PLAN_INVALID';
    END IF;

    SELECT
      coach_id,
      price_per_week,
      price_per_month,
      currency,
      is_active
      INTO v_coach_pricing
    FROM public.coach_pricing
    WHERE coach_id = p_reference_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'COACH_PRICING_NOT_FOUND';
    END IF;

    UPDATE public.coach_subscriptions
    SET status = 'expired',
        updated_at = NOW()
    WHERE coach_id = p_reference_id
      AND client_id = p_user_id
      AND status IN ('active', 'cancelled')
      AND end_date <= NOW();

    IF EXISTS (
      SELECT 1
      FROM public.coach_subscriptions cs
      WHERE cs.coach_id = p_reference_id
        AND cs.client_id = p_user_id
        AND cs.status = 'active'
        AND cs.end_date > NOW()
    ) THEN
      RAISE EXCEPTION 'ACTIVE_COACH_SUBSCRIPTION_EXISTS';
    END IF;

    v_amount := ROUND(
      CASE
        WHEN p_coach_plan = 'weekly'
          THEN v_coach_pricing.price_per_week::NUMERIC
        ELSE v_coach_pricing.price_per_month::NUMERIC
      END,
      2
    );
    v_description := 'Coach subscription - ' || p_coach_plan;
    v_metadata := jsonb_build_object(
      'coach_id', p_reference_id,
      'coach_plan', p_coach_plan,
      'price_qar', v_amount,
      'currency', COALESCE(v_coach_pricing.currency, 'QAR')
    );
  ELSE
    RAISE EXCEPTION 'PAYMENT_TYPE_NOT_SUPPORTED';
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_NOT_REQUIRED';
  END IF;

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
    description,
    metadata,
    idempotency_key,
    fulfillment_status,
    wallet_credited,
    created_at,
    updated_at
  ) VALUES (
    v_payment_id,
    p_user_id,
    p_payment_type,
    v_amount,
    'QAR',
    'pending',
    'sadad',
    'sadad',
    v_payment_id::TEXT,
    v_description,
    v_metadata,
    gen_random_uuid(),
    'pending',
    FALSE,
    NOW(),
    NOW()
  );

  IF p_payment_type = 'subscription'
    AND v_metadata ->> 'mode' = 'renewal' THEN
    IF v_renewal_reservation.id IS NOT NULL THEN
      UPDATE public.subscription_renewal_processed
      SET payment_id = v_payment_id,
          plan_id = (v_metadata ->> 'plan_id')::UUID,
          idempotency_key = format(
            'renewal_%s_%s',
            p_subscription_id,
            v_metadata ->> 'source_cycle_end'
          ),
          processed_at = NOW(),
          renewal_date = (v_metadata ->> 'source_cycle_end')::DATE + 1,
          credits_added = 0,
          rollover_credits = 0,
          amount = v_amount,
          status = 'pending',
          error_message = NULL,
          new_period_start = NULL,
          new_period_end = NULL,
          created_by = p_user_id
      WHERE id = v_renewal_reservation.id;
    ELSE
      INSERT INTO public.subscription_renewal_processed (
        subscription_id,
        payment_id,
        plan_id,
        idempotency_key,
        processed_at,
        renewal_date,
        source_cycle_end,
        credits_added,
        rollover_credits,
        amount,
        status,
        created_by
      ) VALUES (
        p_subscription_id,
        v_payment_id,
        (v_metadata ->> 'plan_id')::UUID,
        format(
          'renewal_%s_%s',
          p_subscription_id,
          v_metadata ->> 'source_cycle_end'
        ),
        NOW(),
        (v_metadata ->> 'source_cycle_end')::DATE + 1,
        (v_metadata ->> 'source_cycle_end')::DATE,
        0,
        0,
        v_amount,
        'pending',
        p_user_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'amount', v_amount,
    'currency', 'QAR',
    'payment_type', p_payment_type,
    'description', v_description,
    'metadata', v_metadata
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_verified_sadad_payment(
  p_payment_id UUID,
  p_provider_transaction_id TEXT,
  p_gateway_response JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_package RECORD;
  v_total_credit NUMERIC(10, 2);
  v_balance NUMERIC(10, 2);
  v_bonus NUMERIC(10, 2);
  v_plan RECORD;
  v_coach_pricing RECORD;
  v_subscription_id UUID;
  v_coach_subscription_id UUID;
  v_mode TEXT;
  v_existing_subscription_id UUID;
  v_current_subscription public.subscriptions%ROWTYPE;
  v_renewal_reservation public.subscription_renewal_processed%ROWTYPE;
  v_period_start DATE;
  v_period_end DATE;
  v_source_cycle_start DATE;
  v_source_cycle_end DATE;
  v_unused_meals INTEGER := 0;
  v_rollover_amount INTEGER := 0;
BEGIN
  IF p_provider_transaction_id IS NULL
    OR LENGTH(TRIM(p_provider_transaction_id)) < 3 THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_REFERENCE_REQUIRED';
  END IF;

  SELECT *
    INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF v_payment.status = 'completed'
    AND v_payment.fulfillment_status = 'completed' THEN
    IF v_payment.provider_transaction_id IS DISTINCT FROM p_provider_transaction_id THEN
      RAISE EXCEPTION 'PAYMENT_TRANSACTION_REFERENCE_MISMATCH';
    END IF;

    RETURN jsonb_build_object(
      'success', TRUE,
      'already_processed', TRUE,
      'payment_id', v_payment.id
    );
  END IF;

  IF v_payment.status IN ('failed', 'refunded') THEN
    RAISE EXCEPTION 'PAYMENT_IS_NOT_FULFILLABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.provider_transaction_id = p_provider_transaction_id
      AND p.id <> p_payment_id
  ) THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_ALREADY_USED';
  END IF;

  IF v_payment.payment_type = 'wallet_topup' THEN
    SELECT id, amount, bonus_amount
      INTO v_package
    FROM public.wallet_topup_packages
    WHERE id = (v_payment.metadata ->> 'package_id')::UUID;

    IF NOT FOUND OR ROUND(v_package.amount::NUMERIC, 2) <> v_payment.amount THEN
      RAISE EXCEPTION 'PAYMENT_PACKAGE_AMOUNT_MISMATCH';
    END IF;

    v_bonus := COALESCE((v_payment.metadata ->> 'bonus_amount')::NUMERIC, 0);
    v_total_credit := v_payment.amount + v_bonus;

    SELECT *
      INTO v_wallet
    FROM public.customer_wallets
    WHERE user_id = v_payment.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.customer_wallets (
        user_id, balance, total_credits, total_debits, is_active
      ) VALUES (
        v_payment.user_id, 0, 0, 0, TRUE
      )
      RETURNING * INTO v_wallet;
    END IF;

    v_balance := COALESCE(v_wallet.balance, 0) + v_total_credit;

    UPDATE public.customer_wallets
    SET balance = v_balance,
        total_credits = COALESCE(total_credits, 0) + v_total_credit,
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
      v_payment.user_id,
      'credit',
      v_payment.amount,
      COALESCE(v_wallet.balance, 0) + v_payment.amount,
      'topup',
      v_payment.id,
      v_payment.description,
      jsonb_build_object('provider', 'sadad')
    );

    IF v_bonus > 0 THEN
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
        v_payment.user_id,
        'bonus',
        v_bonus,
        v_balance,
        'topup',
        v_payment.id,
        'Wallet top-up bonus',
        jsonb_build_object('package_id', v_payment.metadata ->> 'package_id')
      );
    END IF;
  ELSIF v_payment.payment_type = 'subscription' THEN
    v_mode := COALESCE(v_payment.metadata ->> 'mode', 'purchase');

    SELECT
      id,
      tier,
      billing_interval,
      price_qar,
      meals_per_month,
      meals_per_week,
      snacks_per_month,
      daily_meals,
      daily_snacks,
      discount_percent
      INTO v_plan
    FROM public.subscription_plans
    WHERE id = (v_payment.metadata ->> 'plan_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PAYMENT_PLAN_NOT_FOUND';
    END IF;

    IF ROUND((v_payment.metadata ->> 'price_qar')::NUMERIC, 2)
      <> ROUND(v_plan.price_qar::NUMERIC, 2) THEN
      RAISE EXCEPTION 'PAYMENT_PLAN_SNAPSHOT_MISMATCH';
    END IF;

    v_period_end := CASE
      WHEN v_plan.billing_interval = 'annual'
        THEN CURRENT_DATE + INTERVAL '1 year'
      WHEN v_plan.billing_interval = 'weekly'
        THEN CURRENT_DATE + INTERVAL '7 days'
      ELSE CURRENT_DATE + INTERVAL '1 month'
    END;

    IF v_mode = 'purchase' THEN
      IF EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.user_id = v_payment.user_id
          AND s.status = 'active'
      ) THEN
        RAISE EXCEPTION 'ACTIVE_SUBSCRIPTION_EXISTS';
      END IF;

      INSERT INTO public.subscriptions (
        user_id,
        plan_id,
        payment_id,
        plan,
        plan_type,
        tier,
        status,
        active,
        billing_interval,
        price,
        start_date,
        end_date,
        next_renewal_date,
        annual_renewal_date,
        meals_per_month,
        meals_used_this_month,
        month_start_date,
        meals_per_week,
        meals_used_this_week,
        week_start_date,
        snacks_per_month,
        snacks_used_this_month,
        annual_discount_percent,
        auto_renew,
        updated_at
      ) VALUES (
        v_payment.user_id,
        v_plan.id,
        v_payment.id,
        v_plan.tier,
        v_plan.tier,
        v_plan.tier,
        'active',
        TRUE,
        v_plan.billing_interval,
        v_plan.price_qar,
        CURRENT_DATE,
        v_period_end,
        v_period_end,
        CASE WHEN v_plan.billing_interval = 'annual' THEN v_period_end ELSE NULL END,
        v_plan.meals_per_month,
        0,
        DATE_TRUNC('month', CURRENT_DATE)::DATE,
        COALESCE(v_plan.meals_per_week, 0),
        0,
        DATE_TRUNC('week', CURRENT_DATE)::DATE,
        COALESCE(v_plan.snacks_per_month, 0),
        0,
        COALESCE(v_plan.discount_percent, 0),
        TRUE,
        NOW()
      )
      RETURNING id INTO v_subscription_id;
    ELSIF v_mode = 'upgrade' THEN
      v_existing_subscription_id := (v_payment.metadata ->> 'subscription_id')::UUID;

      UPDATE public.subscriptions
      SET plan_id = v_plan.id,
          payment_id = v_payment.id,
          plan = v_plan.tier,
          plan_type = v_plan.tier,
          tier = v_plan.tier,
          status = 'active',
          active = TRUE,
          billing_interval = v_plan.billing_interval,
          price = v_plan.price_qar,
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
          prorated_credit = COALESCE(
            (v_payment.metadata ->> 'prorated_credit')::NUMERIC,
            0
          ),
          updated_at = NOW()
      WHERE id = v_existing_subscription_id
        AND user_id = v_payment.user_id
        AND status IN ('active', 'cancelled', 'expired')
      RETURNING id INTO v_subscription_id;

      IF v_subscription_id IS NULL THEN
        RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
      END IF;
    ELSIF v_mode = 'renewal' THEN
      v_existing_subscription_id := (v_payment.metadata ->> 'subscription_id')::UUID;

      PERFORM pg_advisory_xact_lock(
        hashtextextended(v_existing_subscription_id::TEXT, 0)
      );

      SELECT *
        INTO v_renewal_reservation
      FROM public.subscription_renewal_processed srp
      WHERE srp.payment_id = v_payment.id
        AND srp.subscription_id = v_existing_subscription_id
        AND srp.plan_id = v_plan.id
        AND srp.source_cycle_end = (v_payment.metadata ->> 'source_cycle_end')::DATE
        AND srp.status = 'pending'
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SUBSCRIPTION_RENEWAL_RESERVATION_INVALID';
      END IF;

      IF ROUND(v_payment.amount::NUMERIC, 2) <> ROUND(v_plan.price_qar::NUMERIC, 2)
        OR ROUND(v_payment.amount::NUMERIC, 2)
          <> ROUND(v_renewal_reservation.amount::NUMERIC, 2) THEN
        RAISE EXCEPTION 'SUBSCRIPTION_RENEWAL_AMOUNT_MISMATCH';
      END IF;

      SELECT *
        INTO v_current_subscription
      FROM public.subscriptions s
      WHERE s.id = v_existing_subscription_id
        AND s.user_id = v_payment.user_id
        AND s.status IN ('active', 'cancelled', 'expired')
        AND COALESCE(s.end_date::DATE, CURRENT_DATE)
          = v_renewal_reservation.source_cycle_end
        AND (
          s.plan_id = v_plan.id
          OR (
            s.plan_id IS NULL
            AND s.tier = v_plan.tier
            AND COALESCE(s.billing_interval, 'monthly') = v_plan.billing_interval
          )
        )
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SUBSCRIPTION_RENEWAL_TARGET_INVALID';
      END IF;

      v_source_cycle_start := COALESCE(
        v_current_subscription.month_start_date,
        v_current_subscription.start_date::DATE,
        CURRENT_DATE
      );
      v_source_cycle_end := COALESCE(
        v_current_subscription.end_date::DATE,
        CURRENT_DATE
      );
      v_period_start := GREATEST(v_source_cycle_end + 1, CURRENT_DATE);
      v_period_end := CASE
        WHEN v_plan.billing_interval = 'annual'
          THEN v_period_start + INTERVAL '1 year' - INTERVAL '1 day'
        WHEN v_plan.billing_interval = 'weekly'
          THEN v_period_start + INTERVAL '7 days' - INTERVAL '1 day'
        ELSE v_period_start + INTERVAL '1 month' - INTERVAL '1 day'
      END;

      v_unused_meals := GREATEST(
        0,
        COALESCE(v_current_subscription.meals_per_month, 0)
          - COALESCE(v_current_subscription.meals_used_this_month, 0)
      );
      v_rollover_amount := LEAST(
        v_unused_meals,
        FLOOR(COALESCE(v_plan.meals_per_month, 0) * 0.20)::INTEGER
      );

      IF v_source_cycle_end < CURRENT_DATE - 30 THEN
        v_rollover_amount := 0;
      END IF;

      UPDATE public.subscription_rollovers
      SET status = 'expired',
          is_consumed = TRUE,
          updated_at = NOW()
      WHERE subscription_id = v_current_subscription.id
        AND status = 'active'
        AND expiry_date < v_period_start;

      IF v_rollover_amount > 0 THEN
        INSERT INTO public.subscription_rollovers (
          user_id,
          subscription_id,
          rollover_credits,
          source_cycle_start,
          source_cycle_end,
          expiry_date,
          status,
          is_consumed,
          updated_at
        ) VALUES (
          v_payment.user_id,
          v_current_subscription.id,
          v_rollover_amount,
          v_source_cycle_start,
          v_source_cycle_end,
          v_period_end,
          'active',
          FALSE,
          NOW()
        )
        ON CONFLICT (subscription_id, source_cycle_start, source_cycle_end)
        DO UPDATE SET
          rollover_credits = EXCLUDED.rollover_credits,
          expiry_date = EXCLUDED.expiry_date,
          status = 'active',
          is_consumed = FALSE,
          updated_at = NOW();
      END IF;

      UPDATE public.subscriptions
      SET plan_id = v_plan.id,
          payment_id = v_payment.id,
          plan = v_plan.tier,
          plan_type = v_plan.tier,
          tier = v_plan.tier,
          status = 'active',
          active = TRUE,
          expired_at = NULL,
          cancelled_at = NULL,
          cancellation_reason = NULL,
          cancellation_details = NULL,
          billing_interval = v_plan.billing_interval,
          price = v_plan.price_qar,
          start_date = v_period_start,
          end_date = v_period_end,
          next_renewal_date = v_period_end,
          annual_renewal_date = CASE
            WHEN v_plan.billing_interval = 'annual' THEN v_period_end
            ELSE NULL
          END,
          meals_per_month = v_plan.meals_per_month,
          meals_used_this_month = 0,
          month_start_date = v_period_start,
          meals_per_week = COALESCE(v_plan.meals_per_week, 0),
          meals_used_this_week = 0,
          week_start_date = DATE_TRUNC('week', v_period_start)::DATE,
          snacks_per_month = COALESCE(v_plan.snacks_per_month, 0),
          snacks_used_this_month = 0,
          annual_discount_percent = COALESCE(v_plan.discount_percent, 0),
          prorated_credit = 0,
          rollover_credits = v_rollover_amount,
          freeze_days_used = 0,
          updated_at = NOW()
      WHERE id = v_current_subscription.id
      RETURNING id INTO v_subscription_id;

      IF v_subscription_id IS NULL THEN
        RAISE EXCEPTION 'SUBSCRIPTION_RENEWAL_UPDATE_FAILED';
      END IF;

      UPDATE public.subscription_renewal_processed
      SET status = 'success',
          processed_at = NOW(),
          credits_added = v_plan.meals_per_month,
          rollover_credits = v_rollover_amount,
          new_period_start = v_period_start,
          new_period_end = v_period_end,
          error_message = NULL
      WHERE id = v_renewal_reservation.id;
    ELSE
      RAISE EXCEPTION 'PAYMENT_SUBSCRIPTION_MODE_INVALID';
    END IF;
  ELSIF v_payment.payment_type = 'coach_subscription' THEN
    v_mode := v_payment.metadata ->> 'coach_plan';

    IF v_mode NOT IN ('weekly', 'monthly') THEN
      RAISE EXCEPTION 'COACH_PLAN_INVALID';
    END IF;

    SELECT coach_id, is_active
      INTO v_coach_pricing
    FROM public.coach_pricing
    WHERE coach_id = (v_payment.metadata ->> 'coach_id')::UUID;

    IF NOT FOUND OR NOT v_coach_pricing.is_active THEN
      RAISE EXCEPTION 'COACH_PRICING_NOT_FOUND';
    END IF;

    IF ROUND((v_payment.metadata ->> 'price_qar')::NUMERIC, 2)
      <> ROUND(v_payment.amount::NUMERIC, 2) THEN
      RAISE EXCEPTION 'COACH_PAYMENT_SNAPSHOT_MISMATCH';
    END IF;

    UPDATE public.coach_subscriptions
    SET status = 'expired',
        updated_at = NOW()
    WHERE coach_id = v_coach_pricing.coach_id
      AND client_id = v_payment.user_id
      AND status IN ('active', 'cancelled')
      AND end_date <= NOW();

    IF EXISTS (
      SELECT 1
      FROM public.coach_subscriptions cs
      WHERE cs.coach_id = v_coach_pricing.coach_id
        AND cs.client_id = v_payment.user_id
        AND cs.status = 'active'
        AND cs.end_date > NOW()
    ) THEN
      RAISE EXCEPTION 'ACTIVE_COACH_SUBSCRIPTION_EXISTS';
    END IF;

    INSERT INTO public.coach_subscriptions (
      coach_id,
      client_id,
      plan,
      price,
      status,
      start_date,
      end_date,
      payment_method,
      payment_id,
      transaction_id,
      updated_at
    ) VALUES (
      v_coach_pricing.coach_id,
      v_payment.user_id,
      v_mode,
      v_payment.amount,
      'active',
      NOW(),
      CASE
        WHEN v_mode = 'weekly' THEN NOW() + INTERVAL '7 days'
        ELSE NOW() + INTERVAL '1 month'
      END,
      'sadad',
      v_payment.id,
      p_provider_transaction_id,
      NOW()
    )
    RETURNING id INTO v_coach_subscription_id;
  ELSE
    RAISE EXCEPTION 'PAYMENT_TYPE_NOT_SUPPORTED';
  END IF;

  UPDATE public.payments
  SET status = 'completed',
      provider_transaction_id = p_provider_transaction_id,
      gateway_response = COALESCE(p_gateway_response, '{}'::JSONB),
      verified_at = NOW(),
      completed_at = NOW(),
      processed_at = NOW(),
      fulfillment_status = 'completed',
      fulfillment_error = NULL,
      wallet_credited = CASE
        WHEN payment_type = 'wallet_topup' THEN TRUE
        ELSE wallet_credited
      END,
      updated_at = NOW()
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'already_processed', FALSE,
    'payment_id', v_payment.id,
    'payment_type', v_payment.payment_type,
    'subscription_id', v_subscription_id,
    'coach_subscription_id', v_coach_subscription_id,
    'wallet_balance', v_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    IF v_payment.id IS NOT NULL THEN
      UPDATE public.payments
      SET status = 'completed',
          provider_transaction_id = p_provider_transaction_id,
          gateway_response = COALESCE(p_gateway_response, '{}'::JSONB),
          verified_at = NOW(),
          completed_at = NOW(),
          processed_at = NOW(),
          fulfillment_status = 'failed',
          fulfillment_error = LEFT(SQLERRM, 1000),
          updated_at = NOW()
      WHERE id = v_payment.id;
    END IF;

    RETURN jsonb_build_object(
      'success', FALSE,
      'payment_id', p_payment_id,
      'error', 'PAYMENT_FULFILLMENT_FAILED',
      'error_code', SQLSTATE
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_sadad_payment_status(
  p_payment_id UUID,
  p_status TEXT,
  p_gateway_response JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('processing', 'failed') THEN
    RAISE EXCEPTION 'PAYMENT_STATUS_INVALID';
  END IF;

  UPDATE public.payments
  SET status = p_status,
      gateway_response = COALESCE(p_gateway_response, '{}'::JSONB),
      failed_at = CASE WHEN p_status = 'failed' THEN NOW() ELSE failed_at END,
      updated_at = NOW()
  WHERE id = p_payment_id
    AND status <> 'completed';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_sadad_payment(UUID, TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_verified_sadad_payment(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_sadad_payment_status(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prepare_sadad_payment(UUID, TEXT, UUID, UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_verified_sadad_payment(UUID, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_sadad_payment_status(UUID, TEXT, JSONB)
  TO service_role;

-- Remove the old client-callable payment shortcuts. They accepted caller-supplied
-- user IDs, amounts, and gateway references without provider verification.
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
        'process_payment_atomic',
        'allocate_subscription_credits',
        'deduct_meal_credit'
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

COMMENT ON FUNCTION public.prepare_sadad_payment(UUID, TEXT, UUID, UUID, TEXT) IS
  'Creates a server-priced SADAD payment intent for an active wallet package, Nutrio plan, or coach plan.';
COMMENT ON FUNCTION public.finalize_verified_sadad_payment(UUID, TEXT, JSONB) IS
  'Idempotently fulfills a checksum-verified SADAD payment. Service role only.';
COMMENT ON TABLE public.payment_provider_events IS
  'Immutable audit log for SADAD callbacks and webhooks, including checksum verification outcome.';
