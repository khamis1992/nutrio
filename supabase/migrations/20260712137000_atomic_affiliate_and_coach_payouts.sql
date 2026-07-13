-- Canonical, atomic payout state machines for affiliate and coach funds.
-- Requests reserve funds once; admin transitions never debit twice.

ALTER TABLE public.affiliate_payouts
  ADD COLUMN IF NOT EXISTS request_key UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_reference TEXT;

ALTER TABLE public.coach_withdrawal_requests
  ADD COLUMN IF NOT EXISTS request_key UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_payouts_request_key
  ON public.affiliate_payouts (user_id, request_key)
  WHERE request_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_withdrawals_request_key
  ON public.coach_withdrawal_requests (coach_id, request_key)
  WHERE request_key IS NOT NULL;

DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT c.conname, c.conrelid::REGCLASS AS relation_name
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid IN (
        'public.affiliate_payouts'::REGCLASS,
        'public.coach_withdrawal_requests'::REGCLASS
      )
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      v_constraint.relation_name,
      v_constraint.conname
    );
  END LOOP;
END;
$$;

UPDATE public.affiliate_payouts
SET status = CASE status
  WHEN 'approved' THEN 'processing'
  WHEN 'failed' THEN 'rejected'
  ELSE status
END
WHERE status IN ('approved', 'failed');

ALTER TABLE public.affiliate_payouts
  ADD CONSTRAINT affiliate_payouts_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'rejected'));

ALTER TABLE public.coach_withdrawal_requests
  ADD CONSTRAINT coach_withdrawal_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'processed'));

ALTER TABLE public.affiliate_payouts
  DROP CONSTRAINT IF EXISTS affiliate_payouts_amount_positive;
ALTER TABLE public.affiliate_payouts
  ADD CONSTRAINT affiliate_payouts_amount_positive CHECK (amount > 0);

DROP TRIGGER IF EXISTS mark_commissions_paid_trigger ON public.affiliate_payouts;
DROP TRIGGER IF EXISTS notify_affiliate_payout_status_trigger ON public.affiliate_payouts;

CREATE OR REPLACE FUNCTION public.request_affiliate_payout(
  p_request_key UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_settings JSONB;
  v_minimum NUMERIC(10, 2);
  v_balance NUMERIC(12, 2);
  v_amount NUMERIC(12, 2);
  v_method TEXT := LOWER(BTRIM(COALESCE(p_method, '')));
  v_existing public.affiliate_payouts%ROWTYPE;
  v_payout public.affiliate_payouts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_request_key IS NULL THEN
    RAISE EXCEPTION 'REQUEST_KEY_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('affiliate:' || v_user_id::TEXT, 0));

  SELECT *
  INTO v_existing
  FROM public.affiliate_payouts ap
  WHERE ap.user_id = v_user_id
    AND ap.request_key = p_request_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'duplicate', TRUE,
      'payout_id', v_existing.id,
      'status', v_existing.status,
      'amount', v_existing.amount
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.affiliate_applications aa
    WHERE aa.user_id = v_user_id
      AND aa.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'AFFILIATE_APPROVAL_REQUIRED';
  END IF;

  SELECT ps.value
  INTO v_settings
  FROM public.platform_settings ps
  WHERE ps.key = 'affiliate_settings'
  ORDER BY ps.updated_at DESC
  LIMIT 1;

  IF NOT COALESCE((v_settings ->> 'enabled')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'AFFILIATE_PROGRAM_DISABLED';
  END IF;

  v_minimum := ROUND(COALESCE(NULLIF(v_settings ->> 'min_payout_threshold', '')::NUMERIC, 25), 2);
  v_amount := ROUND(COALESCE(p_amount, 0), 2);

  IF v_amount <= 0 OR v_amount < v_minimum THEN
    RAISE EXCEPTION 'PAYOUT_BELOW_MINIMUM';
  END IF;
  IF v_method NOT IN ('bank_transfer', 'paypal') THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_METHOD';
  END IF;
  IF jsonb_typeof(COALESCE(p_details, '{}'::JSONB)) <> 'object'
    OR pg_column_size(COALESCE(p_details, '{}'::JSONB)) > 8192 THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_DETAILS';
  END IF;

  IF v_method = 'bank_transfer' AND (
    NULLIF(BTRIM(p_details ->> 'accountName'), '') IS NULL
    OR NULLIF(BTRIM(p_details ->> 'bankName'), '') IS NULL
    OR NULLIF(BTRIM(p_details ->> 'accountNumber'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'BANK_DETAILS_REQUIRED';
  END IF;

  IF v_method = 'paypal' AND COALESCE(p_details ->> 'paypalEmail', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'PAYPAL_EMAIL_REQUIRED';
  END IF;

  SELECT COALESCE(p.affiliate_balance, 0)
  INTO v_balance
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;
  IF v_amount > v_balance THEN
    RAISE EXCEPTION 'INSUFFICIENT_AFFILIATE_BALANCE';
  END IF;

  UPDATE public.profiles
  SET affiliate_balance = v_balance - v_amount,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  INSERT INTO public.affiliate_payouts (
    user_id,
    amount,
    status,
    payout_method,
    payout_details,
    request_key,
    requested_at
  )
  VALUES (
    v_user_id,
    v_amount,
    'pending',
    v_method,
    COALESCE(p_details, '{}'::JSONB),
    p_request_key,
    NOW()
  )
  RETURNING * INTO v_payout;

  RETURN jsonb_build_object(
    'success', TRUE,
    'duplicate', FALSE,
    'payout_id', v_payout.id,
    'status', v_payout.status,
    'amount', v_payout.amount,
    'available_balance', v_balance - v_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_affiliate_payout(
  p_payout_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL,
  p_transfer_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_action TEXT := LOWER(BTRIM(COALESCE(p_action, '')));
  v_payout public.affiliate_payouts%ROWTYPE;
  v_new_status TEXT;
BEGIN
  IF v_admin_id IS NULL OR NOT COALESCE(public.has_role(v_admin_id, 'admin'), FALSE) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  IF COALESCE(LENGTH(p_notes), 0) > 1000
    OR COALESCE(LENGTH(p_transfer_reference), 0) > 160 THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_METADATA';
  END IF;

  SELECT *
  INTO v_payout
  FROM public.affiliate_payouts ap
  WHERE ap.id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND';
  END IF;

  IF v_action = 'approve' AND v_payout.status = 'pending' THEN
    v_new_status := 'processing';
    UPDATE public.affiliate_payouts
    SET status = v_new_status,
        approved_at = NOW(),
        processed_by = v_admin_id,
        notes = NULLIF(BTRIM(p_notes), '')
    WHERE id = v_payout.id;
  ELSIF v_action = 'reject' AND v_payout.status IN ('pending', 'processing') THEN
    v_new_status := 'rejected';
    UPDATE public.profiles
    SET affiliate_balance = COALESCE(affiliate_balance, 0) + v_payout.amount,
        updated_at = NOW()
    WHERE user_id = v_payout.user_id;

    UPDATE public.affiliate_payouts
    SET status = v_new_status,
        processed_at = NOW(),
        processed_by = v_admin_id,
        notes = NULLIF(BTRIM(p_notes), '')
    WHERE id = v_payout.id;
  ELSIF v_action = 'complete' AND v_payout.status = 'processing' THEN
    IF NULLIF(BTRIM(p_transfer_reference), '') IS NULL THEN
      RAISE EXCEPTION 'TRANSFER_REFERENCE_REQUIRED';
    END IF;
    v_new_status := 'completed';
    UPDATE public.affiliate_payouts
    SET status = v_new_status,
        processed_at = NOW(),
        processed_by = v_admin_id,
        payout_reference = BTRIM(p_transfer_reference),
        notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes)
    WHERE id = v_payout.id;
  ELSE
    RAISE EXCEPTION 'INVALID_PAYOUT_TRANSITION_%_TO_%', v_payout.status, v_action;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, status, data)
  VALUES (
    v_payout.user_id,
    'general',
    CASE v_new_status
      WHEN 'processing' THEN 'Payout approved'
      WHEN 'completed' THEN 'Payout transferred'
      ELSE 'Payout request rejected'
    END,
    CASE v_new_status
      WHEN 'processing' THEN 'Your affiliate payout was approved and is awaiting transfer.'
      WHEN 'completed' THEN 'Your affiliate payout transfer has been completed.'
      ELSE 'Your affiliate payout was rejected and the reserved balance was returned.'
    END,
    'unread',
    jsonb_build_object('payout_id', v_payout.id, 'status', v_new_status, 'amount', v_payout.amount)
  );

  RETURN jsonb_build_object('success', TRUE, 'payout_id', v_payout.id, 'status', v_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_coach_available_balance(p_coach_id UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_coach_id UUID := COALESCE(p_coach_id, auth.uid());
  v_settled NUMERIC(12, 2);
  v_reserved NUMERIC(12, 2);
BEGIN
  IF v_actor IS NULL OR (
    v_coach_id IS DISTINCT FROM v_actor
    AND NOT COALESCE(public.has_role(v_actor, 'admin'), FALSE)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT COALESCE(SUM(ce.net_amount), 0)
  INTO v_settled
  FROM public.coach_earnings ce
  WHERE ce.coach_id = v_coach_id
    AND ce.status = 'settled';

  SELECT COALESCE(SUM(cwr.amount), 0)
  INTO v_reserved
  FROM public.coach_withdrawal_requests cwr
  WHERE cwr.coach_id = v_coach_id
    AND cwr.status IN ('pending', 'approved', 'processed');

  RETURN GREATEST(0, v_settled - v_reserved);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_coach_withdrawal(
  p_request_key UUID,
  p_amount NUMERIC,
  p_bank_name TEXT,
  p_iban TEXT,
  p_account_holder TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coach_id UUID := auth.uid();
  v_amount NUMERIC(12, 2) := ROUND(COALESCE(p_amount, 0), 2);
  v_minimum NUMERIC(12, 2);
  v_available NUMERIC(12, 2);
  v_iban TEXT := UPPER(REGEXP_REPLACE(COALESCE(p_iban, ''), '[[:space:]-]', '', 'g'));
  v_existing public.coach_withdrawal_requests%ROWTYPE;
  v_request public.coach_withdrawal_requests%ROWTYPE;
BEGIN
  IF v_coach_id IS NULL OR NOT COALESCE(public.has_role(v_coach_id, 'coach'), FALSE) THEN
    RAISE EXCEPTION 'COACH_REQUIRED';
  END IF;
  IF p_request_key IS NULL THEN
    RAISE EXCEPTION 'REQUEST_KEY_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('coach:' || v_coach_id::TEXT, 0));

  SELECT *
  INTO v_existing
  FROM public.coach_withdrawal_requests cwr
  WHERE cwr.coach_id = v_coach_id
    AND cwr.request_key = p_request_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'duplicate', TRUE,
      'withdrawal_id', v_existing.id,
      'status', v_existing.status,
      'amount', v_existing.amount
    );
  END IF;

  SELECT COALESCE(pcc.min_payout_threshold, 100)
  INTO v_minimum
  FROM public.platform_commission_config pcc
  ORDER BY pcc.updated_at DESC
  LIMIT 1;
  v_minimum := COALESCE(v_minimum, 100);

  IF v_amount <= 0 OR v_amount < v_minimum THEN
    RAISE EXCEPTION 'WITHDRAWAL_BELOW_MINIMUM';
  END IF;
  IF LENGTH(BTRIM(COALESCE(p_bank_name, ''))) NOT BETWEEN 2 AND 120
    OR LENGTH(BTRIM(COALESCE(p_account_holder, ''))) NOT BETWEEN 2 AND 120
    OR v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' THEN
    RAISE EXCEPTION 'INVALID_BANK_DETAILS';
  END IF;

  PERFORM 1
  FROM public.coach_earnings ce
  WHERE ce.coach_id = v_coach_id
  FOR UPDATE;
  PERFORM 1
  FROM public.coach_withdrawal_requests cwr
  WHERE cwr.coach_id = v_coach_id
  FOR UPDATE;

  v_available := public.get_coach_available_balance(v_coach_id);
  IF v_amount > v_available THEN
    RAISE EXCEPTION 'INSUFFICIENT_COACH_BALANCE';
  END IF;

  INSERT INTO public.coach_withdrawal_requests (
    coach_id,
    amount,
    bank_name,
    iban,
    account_holder,
    status,
    request_key
  )
  VALUES (
    v_coach_id,
    v_amount,
    BTRIM(p_bank_name),
    v_iban,
    BTRIM(p_account_holder),
    'pending',
    p_request_key
  )
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'success', TRUE,
    'duplicate', FALSE,
    'withdrawal_id', v_request.id,
    'status', v_request.status,
    'amount', v_request.amount,
    'available_balance', v_available - v_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_coach_withdrawal(
  p_withdrawal_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL,
  p_transfer_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_action TEXT := LOWER(BTRIM(COALESCE(p_action, '')));
  v_request public.coach_withdrawal_requests%ROWTYPE;
  v_new_status TEXT;
BEGIN
  IF v_admin_id IS NULL OR NOT COALESCE(public.has_role(v_admin_id, 'admin'), FALSE) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  IF COALESCE(LENGTH(p_notes), 0) > 1000
    OR COALESCE(LENGTH(p_transfer_reference), 0) > 160 THEN
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_METADATA';
  END IF;

  SELECT *
  INTO v_request
  FROM public.coach_withdrawal_requests cwr
  WHERE cwr.id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND';
  END IF;

  IF v_action = 'approve' AND v_request.status = 'pending' THEN
    v_new_status := 'approved';
    UPDATE public.coach_withdrawal_requests
    SET status = v_new_status,
        approved_at = NOW(),
        processed_by = v_admin_id,
        admin_notes = NULLIF(BTRIM(p_notes), '')
    WHERE id = v_request.id;
  ELSIF v_action = 'reject' AND v_request.status IN ('pending', 'approved') THEN
    v_new_status := 'rejected';
    UPDATE public.coach_withdrawal_requests
    SET status = v_new_status,
        processed_at = NOW(),
        processed_by = v_admin_id,
        admin_notes = NULLIF(BTRIM(p_notes), '')
    WHERE id = v_request.id;
  ELSIF v_action = 'process' AND v_request.status = 'approved' THEN
    IF NULLIF(BTRIM(p_transfer_reference), '') IS NULL THEN
      RAISE EXCEPTION 'TRANSFER_REFERENCE_REQUIRED';
    END IF;
    v_new_status := 'processed';
    UPDATE public.coach_withdrawal_requests
    SET status = v_new_status,
        processed_at = NOW(),
        processed_by = v_admin_id,
        transfer_reference = BTRIM(p_transfer_reference),
        admin_notes = COALESCE(NULLIF(BTRIM(p_notes), ''), admin_notes)
    WHERE id = v_request.id;
  ELSE
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_TRANSITION_%_TO_%', v_request.status, v_action;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, status, data)
  VALUES (
    v_request.coach_id,
    'coach_withdrawal',
    CASE v_new_status
      WHEN 'approved' THEN 'Withdrawal approved'
      WHEN 'processed' THEN 'Withdrawal transferred'
      ELSE 'Withdrawal rejected'
    END,
    CASE v_new_status
      WHEN 'approved' THEN 'Your withdrawal was approved and is awaiting bank transfer.'
      WHEN 'processed' THEN 'Your withdrawal transfer has been completed.'
      ELSE 'Your withdrawal was rejected. The reserved amount is available again.'
    END,
    'unread',
    jsonb_build_object('withdrawal_id', v_request.id, 'status', v_new_status, 'amount', v_request.amount)
  );

  RETURN jsonb_build_object('success', TRUE, 'withdrawal_id', v_request.id, 'status', v_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_coach_earnings(p_earning_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_updated_count INTEGER;
  v_released_amount NUMERIC(12, 2);
BEGIN
  IF v_admin_id IS NULL OR NOT COALESCE(public.has_role(v_admin_id, 'admin'), FALSE) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  IF COALESCE(array_length(p_earning_ids, 1), 0) < 1
    OR array_length(p_earning_ids, 1) > 200 THEN
    RAISE EXCEPTION 'INVALID_EARNING_BATCH';
  END IF;

  WITH updated AS (
    UPDATE public.coach_earnings ce
    SET status = 'settled',
        settled_at = NOW()
    WHERE ce.id = ANY(p_earning_ids)
      AND ce.status = 'pending'
    RETURNING ce.net_amount
  )
  SELECT COUNT(*)::INTEGER, COALESCE(SUM(net_amount), 0)
  INTO v_updated_count, v_released_amount
  FROM updated;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'NO_PENDING_EARNINGS';
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'released_count', v_updated_count,
    'released_amount', v_released_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_affiliate_network(p_referrer_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  tier INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.user_id, p.full_name, p.created_at, network.tier
  FROM (
    SELECT p1.user_id, 1 AS tier
    FROM public.profiles p1
    WHERE p1.tier1_referrer_id = p_referrer_id
    UNION ALL
    SELECT p2.user_id, 2 AS tier
    FROM public.profiles p2
    WHERE p2.tier2_referrer_id = p_referrer_id
    UNION ALL
    SELECT p3.user_id, 3 AS tier
    FROM public.profiles p3
    WHERE p3.tier3_referrer_id = p_referrer_id
  ) network
  JOIN public.profiles p ON p.user_id = network.user_id
  WHERE p_referrer_id = auth.uid()
    OR COALESCE(public.has_role(auth.uid(), 'admin'), FALSE)
  ORDER BY network.tier, p.created_at;
$$;

-- Legacy commission creation credited balances while rows were still pending.
-- Remove that unearned portion once; delivery will credit it through the
-- canonical trigger below.
WITH pending_totals AS (
  SELECT user_id, SUM(commission_amount) AS amount
  FROM public.affiliate_commissions
  WHERE status = 'pending'
  GROUP BY user_id
)
UPDATE public.profiles p
SET affiliate_balance = COALESCE(p.affiliate_balance, 0) - pt.amount,
    total_affiliate_earnings = GREATEST(0, COALESCE(p.total_affiliate_earnings, 0) - pt.amount),
    updated_at = NOW()
FROM pending_totals pt
WHERE p.user_id = pt.user_id;

-- Collapse any historical duplicate commission rows before adding the natural
-- order/tier/affiliate key. The duplicate balance had also been credited.
WITH ranked AS (
  SELECT
    id,
    user_id,
    commission_amount,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY order_id, tier, user_id
      ORDER BY created_at, id
    ) AS row_number
  FROM public.affiliate_commissions
  WHERE order_id IS NOT NULL
), duplicate_totals AS (
  SELECT user_id, SUM(commission_amount) AS amount
  FROM ranked
  WHERE row_number > 1
    AND status <> 'pending'
  GROUP BY user_id
)
UPDATE public.profiles p
SET affiliate_balance = COALESCE(p.affiliate_balance, 0) - dt.amount,
    total_affiliate_earnings = GREATEST(0, COALESCE(p.total_affiliate_earnings, 0) - dt.amount),
    updated_at = NOW()
FROM duplicate_totals dt
WHERE p.user_id = dt.user_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY order_id, tier, user_id
      ORDER BY created_at, id
    ) AS row_number
  FROM public.affiliate_commissions
  WHERE order_id IS NOT NULL
)
DELETE FROM public.affiliate_commissions ac
USING ranked r
WHERE ac.id = r.id
  AND r.row_number > 1;

WITH delivered AS (
  UPDATE public.affiliate_commissions ac
  SET status = 'approved'
  FROM public.orders o
  WHERE ac.order_id = o.id
    AND ac.status = 'pending'
    AND o.status::TEXT = 'delivered'
  RETURNING ac.user_id, ac.commission_amount
), delivered_totals AS (
  SELECT user_id, SUM(commission_amount) AS amount
  FROM delivered
  GROUP BY user_id
)
UPDATE public.profiles p
SET affiliate_balance = COALESCE(p.affiliate_balance, 0) + dt.amount,
    total_affiliate_earnings = COALESCE(p.total_affiliate_earnings, 0) + dt.amount,
    updated_at = NOW()
FROM delivered_totals dt
WHERE p.user_id = dt.user_id;

-- Commissions become withdrawable only after delivery. A cancellation after
-- delivery reverses the snapshot so future payouts cannot consume refunded revenue.
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_commissions_order_tier_user
  ON public.affiliate_commissions (order_id, tier, user_id)
  WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.calculate_affiliate_commissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile RECORD;
  v_settings JSONB;
  v_referrers UUID[];
  v_rates NUMERIC[];
  v_index INTEGER;
  v_amount NUMERIC(10, 2);
  v_inserted_id UUID;
  v_commission RECORD;
BEGIN
  IF NEW.status::TEXT = 'delivered'
    AND (TG_OP = 'INSERT' OR OLD.status::TEXT IS DISTINCT FROM 'delivered') THEN
    SELECT tier1_referrer_id, tier2_referrer_id, tier3_referrer_id
    INTO v_profile
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    SELECT value
    INTO v_settings
    FROM public.platform_settings
    WHERE key = 'affiliate_settings'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF NOT COALESCE((v_settings ->> 'enabled')::BOOLEAN, FALSE) THEN
      RETURN NEW;
    END IF;

    v_referrers := ARRAY[
      v_profile.tier1_referrer_id,
      v_profile.tier2_referrer_id,
      v_profile.tier3_referrer_id
    ];
    v_rates := ARRAY[
      COALESCE((v_settings ->> 'tier1_commission')::NUMERIC, 10),
      COALESCE((v_settings ->> 'tier2_commission')::NUMERIC, 5),
      COALESCE((v_settings ->> 'tier3_commission')::NUMERIC, 2)
    ];

    FOR v_index IN 1..3 LOOP
      IF v_referrers[v_index] IS NULL THEN
        CONTINUE;
      END IF;

      v_amount := ROUND(COALESCE(NEW.total_amount, 0) * v_rates[v_index] / 100, 2);
      IF v_amount <= 0 THEN
        CONTINUE;
      END IF;

      v_inserted_id := NULL;

      UPDATE public.affiliate_commissions ac
      SET status = 'approved'
      WHERE ac.order_id = NEW.id
        AND ac.tier = v_index
        AND ac.user_id = v_referrers[v_index]
        AND ac.status = 'pending'
      RETURNING ac.id, ac.commission_amount
      INTO v_inserted_id, v_amount;

      IF v_inserted_id IS NOT NULL THEN
        UPDATE public.profiles
        SET affiliate_balance = COALESCE(affiliate_balance, 0) + v_amount,
            total_affiliate_earnings = COALESCE(total_affiliate_earnings, 0) + v_amount,
            updated_at = NOW()
        WHERE user_id = v_referrers[v_index];
        CONTINUE;
      END IF;

      INSERT INTO public.affiliate_commissions (
        user_id,
        source_user_id,
        order_id,
        tier,
        order_amount,
        commission_rate,
        commission_amount,
        status
      )
      VALUES (
        v_referrers[v_index],
        NEW.user_id,
        NEW.id,
        v_index,
        NEW.total_amount,
        v_rates[v_index],
        v_amount,
        'approved'
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_inserted_id;

      IF v_inserted_id IS NOT NULL THEN
        UPDATE public.profiles
        SET affiliate_balance = COALESCE(affiliate_balance, 0) + v_amount,
            total_affiliate_earnings = COALESCE(total_affiliate_earnings, 0) + v_amount,
            updated_at = NOW()
        WHERE user_id = v_referrers[v_index];
      END IF;
    END LOOP;
  ELSIF NEW.status::TEXT = 'cancelled'
    AND TG_OP = 'UPDATE'
    AND OLD.status::TEXT = 'delivered' THEN
    FOR v_commission IN
      UPDATE public.affiliate_commissions ac
      SET status = 'cancelled'
      WHERE ac.order_id = NEW.id
        AND ac.status IN ('approved', 'paid')
      RETURNING ac.user_id, ac.commission_amount
    LOOP
      UPDATE public.profiles
      SET affiliate_balance = COALESCE(affiliate_balance, 0) - v_commission.commission_amount,
          total_affiliate_earnings = GREATEST(
            0,
            COALESCE(total_affiliate_earnings, 0) - v_commission.commission_amount
          ),
          updated_at = NOW()
      WHERE user_id = v_commission.user_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calculate_affiliate_commissions_trigger ON public.orders;
CREATE TRIGGER calculate_affiliate_commissions_trigger
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_affiliate_commissions();

DO $$
DECLARE
  v_policy RECORD;
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['affiliate_payouts', 'coach_withdrawal_requests'] LOOP
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

CREATE POLICY affiliate_payouts_owner_read
  ON public.affiliate_payouts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR COALESCE(public.has_role(auth.uid(), 'admin'), FALSE));
CREATE POLICY coach_withdrawals_owner_read
  ON public.coach_withdrawal_requests FOR SELECT TO authenticated
  USING (coach_id = auth.uid() OR COALESCE(public.has_role(auth.uid(), 'admin'), FALSE));

REVOKE INSERT, UPDATE, DELETE ON public.affiliate_payouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.coach_withdrawal_requests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.coach_earnings FROM anon, authenticated;
GRANT SELECT ON public.affiliate_payouts, public.coach_withdrawal_requests, public.coach_earnings TO authenticated;
GRANT ALL ON public.affiliate_payouts, public.coach_withdrawal_requests, public.coach_earnings TO service_role;

REVOKE ALL ON FUNCTION public.request_affiliate_payout(UUID, NUMERIC, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_affiliate_payout(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_coach_available_balance(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_coach_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_coach_withdrawal(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_coach_earnings(UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_affiliate_network(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_affiliate_payout(UUID, NUMERIC, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_affiliate_payout(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_coach_available_balance(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_coach_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_coach_withdrawal(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_coach_earnings(UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_affiliate_network(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.request_affiliate_payout(UUID, NUMERIC, TEXT, JSONB) IS
  'Atomically reserves an approved affiliate payout from the authenticated user balance.';
COMMENT ON FUNCTION public.request_coach_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) IS
  'Creates an idempotent coach withdrawal after locking and validating settled available earnings.';
