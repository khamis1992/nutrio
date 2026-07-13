-- Canonical partner/driver payout ledgers and atomic balance reservation.

-- ---------------------------------------------------------------------------
-- Partner earnings and payouts
-- ---------------------------------------------------------------------------

ALTER TABLE public.partner_payouts
  ADD COLUMN IF NOT EXISTS request_key UUID,
  ADD COLUMN IF NOT EXISTS request_source TEXT NOT NULL DEFAULT 'partner',
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.partner_payouts'::REGCLASS
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.partner_payouts DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$$;

UPDATE public.partner_payouts
SET status = CASE status
  WHEN 'paid' THEN 'completed'
  WHEN 'processed' THEN 'completed'
  WHEN 'rejected' THEN 'failed'
  ELSE COALESCE(status, 'pending')
END;

DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.partner_payouts'::REGCLASS
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.partner_payouts DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.partner_payouts
  ADD CONSTRAINT partner_payouts_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_payouts_request_key
  ON public.partner_payouts (request_key)
  WHERE request_key IS NOT NULL;

UPDATE public.partner_earnings
SET status = CASE status
  WHEN 'paid' THEN 'paid'
  WHEN 'processing' THEN 'processing'
  WHEN 'cancelled' THEN 'cancelled'
  WHEN 'failed' THEN 'failed'
  ELSE 'pending'
END;

DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.partner_earnings'::REGCLASS
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.partner_earnings DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.partner_earnings
  ADD CONSTRAINT partner_earnings_status_check
  CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled'));

DELETE FROM public.partner_earnings duplicate
USING public.partner_earnings keeper
WHERE duplicate.id <> keeper.id
  AND duplicate.meal_schedule_id IS NOT NULL
  AND duplicate.meal_schedule_id = keeper.meal_schedule_id
  AND (
    (duplicate.payout_id IS NULL AND keeper.payout_id IS NOT NULL)
    OR (
      (duplicate.payout_id IS NULL) = (keeper.payout_id IS NULL)
      AND (COALESCE(duplicate.created_at, 'epoch'::TIMESTAMPTZ), duplicate.id)
        > (COALESCE(keeper.created_at, 'epoch'::TIMESTAMPTZ), keeper.id)
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_earnings_schedule
  ON public.partner_earnings (meal_schedule_id)
  WHERE meal_schedule_id IS NOT NULL;

DELETE FROM public.partner_earnings duplicate
USING public.partner_earnings keeper
WHERE duplicate.id <> keeper.id
  AND duplicate.order_id IS NOT NULL
  AND duplicate.order_id = keeper.order_id
  AND (
    (duplicate.payout_id IS NULL AND keeper.payout_id IS NOT NULL)
    OR (
      (duplicate.payout_id IS NULL) = (keeper.payout_id IS NULL)
      AND (COALESCE(duplicate.created_at, 'epoch'::TIMESTAMPTZ), duplicate.id)
        > (COALESCE(keeper.created_at, 'epoch'::TIMESTAMPTZ), keeper.id)
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_earnings_order
  ON public.partner_earnings (order_id)
  WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_partner_earning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant_id UUID;
  v_payout_amount NUMERIC(10, 2);
BEGIN
  IF NEW.order_status::TEXT <> 'delivered'
    OR (TG_OP = 'UPDATE' AND OLD.order_status::TEXT = 'delivered') THEN
    RETURN NEW;
  END IF;

  SELECT r.id, GREATEST(COALESCE(r.payout_rate, 0), 0)
  INTO v_restaurant_id, v_payout_amount
  FROM public.meals m
  JOIN public.restaurants r ON r.id = m.restaurant_id
  WHERE m.id = NEW.meal_id;

  IF v_restaurant_id IS NULL OR v_payout_amount <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.partner_earnings (
    restaurant_id,
    meal_schedule_id,
    gross_amount,
    platform_fee,
    delivery_fee,
    net_amount,
    status
  )
  VALUES (
    v_restaurant_id,
    NEW.id,
    v_payout_amount,
    0,
    0,
    v_payout_amount,
    'pending'
  )
  ON CONFLICT (meal_schedule_id) WHERE meal_schedule_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_meal_schedule_confirmed ON public.meal_schedules;
CREATE TRIGGER on_meal_schedule_delivered_earning
  AFTER UPDATE OF order_status ON public.meal_schedules
  FOR EACH ROW
  WHEN (NEW.order_status::TEXT = 'delivered' AND OLD.order_status::TEXT IS DISTINCT FROM 'delivered')
  EXECUTE FUNCTION public.create_partner_earning();

CREATE OR REPLACE FUNCTION public.create_partner_order_earning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rate NUMERIC;
  v_gross NUMERIC;
  v_fee NUMERIC;
  v_net NUMERIC;
BEGIN
  IF NEW.user_id IS NULL
    OR NEW.restaurant_id IS NULL
    OR NEW.status::TEXT <> 'delivered'
    OR (TG_OP = 'UPDATE' AND OLD.status::TEXT = 'delivered') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(r.commission_rate, 18)
  INTO v_rate
  FROM public.restaurants r
  WHERE r.id = NEW.restaurant_id;

  v_gross := GREATEST(COALESCE(NEW.total_amount, 0) - COALESCE(NEW.delivery_fee, 0), 0);
  v_fee := ROUND(v_gross * LEAST(GREATEST(COALESCE(v_rate, 18), 0), 100) / 100, 2);
  v_net := GREATEST(v_gross - v_fee, 0);

  IF v_net <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.partner_earnings (
    restaurant_id,
    order_id,
    gross_amount,
    platform_fee,
    delivery_fee,
    net_amount,
    status
  )
  VALUES (
    NEW.restaurant_id,
    NEW.id,
    v_gross,
    v_fee,
    COALESCE(NEW.delivery_fee, 0),
    v_net,
    'pending'
  )
  ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_delivered_partner_earning ON public.orders;
CREATE TRIGGER on_order_delivered_partner_earning
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_partner_order_earning();

CREATE OR REPLACE FUNCTION public.request_partner_payout(
  p_restaurant_id UUID,
  p_request_key UUID,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL,
  p_request_source TEXT DEFAULT 'partner'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_existing public.partner_payouts%ROWTYPE;
  v_amount NUMERIC(10, 2);
  v_start DATE;
  v_end DATE;
  v_threshold NUMERIC := 50;
  v_bank JSONB;
  v_payout_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  v_is_admin := public.has_role(v_actor, 'admin');

  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND r.owner_id = v_actor
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_request_key IS NULL
    OR p_request_source NOT IN ('partner', 'admin')
    OR (NOT v_is_admin AND p_request_source <> 'partner')
    OR (p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND p_period_start > p_period_end) THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_REQUEST';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.partner_payouts
  WHERE request_key = p_request_key;

  IF FOUND THEN
    IF v_existing.restaurant_id <> p_restaurant_id THEN
      RAISE EXCEPTION 'REQUEST_KEY_CONFLICT';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'payout_id', v_existing.id,
      'status', v_existing.status,
      'amount', v_existing.amount
    );
  END IF;

  PERFORM 1
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND';
  END IF;

  PERFORM 1
  FROM public.partner_earnings pe
  WHERE pe.restaurant_id = p_restaurant_id
    AND pe.status = 'pending'
    AND pe.payout_id IS NULL
    AND (p_period_start IS NULL OR pe.created_at::DATE >= p_period_start)
    AND (p_period_end IS NULL OR pe.created_at::DATE <= p_period_end)
  FOR UPDATE;

  SELECT
    COALESCE(SUM(pe.net_amount), 0),
    COALESCE(MIN(pe.created_at)::DATE, COALESCE(p_period_start, CURRENT_DATE)),
    COALESCE(MAX(pe.created_at)::DATE, COALESCE(p_period_end, CURRENT_DATE))
  INTO v_amount, v_start, v_end
  FROM public.partner_earnings pe
  WHERE pe.restaurant_id = p_restaurant_id
    AND pe.status = 'pending'
    AND pe.payout_id IS NULL
    AND (p_period_start IS NULL OR pe.created_at::DATE >= p_period_start)
    AND (p_period_end IS NULL OR pe.created_at::DATE <= p_period_end);

  SELECT COALESCE((ps.value ->> 'minimum_partner_payout')::NUMERIC, 50)
  INTO v_threshold
  FROM public.platform_settings ps
  WHERE ps.key = 'partner_settings'
  ORDER BY ps.updated_at DESC
  LIMIT 1;

  v_threshold := COALESCE(v_threshold, 50);

  IF v_amount <= 0 OR (NOT v_is_admin AND v_amount < v_threshold) THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_PARTNER_BALANCE';
  END IF;

  SELECT jsonb_build_object(
    'bank_name', rd.bank_name,
    'bank_account_name', rd.bank_account_name,
    'bank_account_number', rd.bank_account_number,
    'bank_iban', rd.bank_iban,
    'swift_code', rd.swift_code
  )
  INTO v_bank
  FROM public.restaurant_details rd
  WHERE rd.restaurant_id = p_restaurant_id;

  IF v_bank IS NULL OR COALESCE(v_bank ->> 'bank_name', '') = ''
    OR (
      COALESCE(v_bank ->> 'bank_iban', '') = ''
      AND COALESCE(v_bank ->> 'bank_account_number', '') = ''
    ) THEN
    RAISE EXCEPTION 'BANK_DETAILS_REQUIRED';
  END IF;

  INSERT INTO public.partner_payouts (
    restaurant_id,
    amount,
    period_start,
    period_end,
    status,
    payout_method,
    payout_details,
    request_key,
    request_source,
    requested_by
  )
  VALUES (
    p_restaurant_id,
    v_amount,
    COALESCE(p_period_start, v_start),
    COALESCE(p_period_end, v_end),
    'pending',
    'bank_transfer',
    v_bank,
    p_request_key,
    p_request_source,
    v_actor
  )
  RETURNING id INTO v_payout_id;

  UPDATE public.partner_earnings pe
  SET payout_id = v_payout_id,
      status = 'processing'
  WHERE pe.restaurant_id = p_restaurant_id
    AND pe.status = 'pending'
    AND pe.payout_id IS NULL
    AND (p_period_start IS NULL OR pe.created_at::DATE >= p_period_start)
    AND (p_period_end IS NULL OR pe.created_at::DATE <= p_period_end);

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'payout_id', v_payout_id,
    'status', 'pending',
    'amount', v_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_partner_payout(
  p_restaurant_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  v_result := public.request_partner_payout(
    p_restaurant_id,
    gen_random_uuid(),
    p_period_start,
    p_period_end,
    'admin'
  );

  RETURN (v_result ->> 'payout_id')::UUID;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_partner_payout(
  p_payout_id UUID,
  p_action TEXT,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_payout public.partner_payouts%ROWTYPE;
  v_new_status TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  SELECT *
  INTO v_payout
  FROM public.partner_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND';
  END IF;

  v_new_status := CASE p_action
    WHEN 'start' THEN 'processing'
    WHEN 'complete' THEN 'completed'
    WHEN 'reject' THEN 'failed'
    ELSE NULL
  END;

  IF v_new_status IS NULL
    OR (p_action = 'start' AND v_payout.status <> 'pending')
    OR (p_action IN ('complete', 'reject') AND v_payout.status NOT IN ('pending', 'processing')) THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_TRANSITION';
  END IF;

  IF p_action = 'complete' AND length(trim(COALESCE(p_reference_number, ''))) < 3 THEN
    RAISE EXCEPTION 'TRANSFER_REFERENCE_REQUIRED';
  END IF;

  UPDATE public.partner_payouts
  SET status = v_new_status,
      reference_number = CASE
        WHEN p_action = 'complete' THEN trim(p_reference_number)
        ELSE reference_number
      END,
      processed_at = CASE WHEN p_action IN ('complete', 'reject') THEN now() ELSE processed_at END,
      processed_by = v_actor,
      rejection_reason = CASE WHEN p_action = 'reject' THEN NULLIF(trim(p_notes), '') ELSE NULL END,
      updated_at = now()
  WHERE id = v_payout.id;

  IF p_action = 'complete' THEN
    UPDATE public.partner_earnings
    SET status = 'paid'
    WHERE payout_id = v_payout.id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.partner_earnings
    SET status = 'pending',
        payout_id = NULL
    WHERE payout_id = v_payout.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout.id,
    'status', v_new_status,
    'amount', v_payout.amount
  );
END;
$$;

-- Legacy payout batches stay readable but cannot generate new duplicate money.
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_order_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_deducted NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_reference TEXT,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.payouts'::REGCLASS
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.payouts DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$$;

UPDATE public.payouts
SET status = CASE status
  WHEN 'processing' THEN 'pending'
  WHEN 'completed' THEN 'processed'
  WHEN 'failed' THEN 'rejected'
  ELSE COALESCE(status, 'pending')
END;

DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.payouts'::REGCLASS
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.payouts DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_status_check CHECK (status IN ('pending', 'processed', 'rejected'));

CREATE OR REPLACE FUNCTION public.transition_legacy_partner_payout(
  p_payout_id UUID,
  p_action TEXT,
  p_reference_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_payout public.payouts%ROWTYPE;
  v_status TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  SELECT * INTO v_payout
  FROM public.payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND OR v_payout.status <> 'pending' THEN
    RAISE EXCEPTION 'INVALID_LEGACY_PAYOUT_TRANSITION';
  END IF;

  v_status := CASE p_action WHEN 'process' THEN 'processed' WHEN 'reject' THEN 'rejected' END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'INVALID_LEGACY_PAYOUT_ACTION';
  END IF;

  IF p_action = 'process' AND length(trim(COALESCE(p_reference_number, ''))) < 3 THEN
    RAISE EXCEPTION 'TRANSFER_REFERENCE_REQUIRED';
  END IF;

  UPDATE public.payouts
  SET status = v_status,
      processed_at = CASE WHEN v_status = 'processed' THEN now() ELSE processed_at END,
      transfer_reference = CASE WHEN v_status = 'processed' THEN trim(p_reference_number) ELSE transfer_reference END,
      processed_by = v_actor,
      updated_at = now()
  WHERE id = v_payout.id;

  RETURN jsonb_build_object('success', true, 'payout_id', v_payout.id, 'status', v_status);
END;
$$;

-- ---------------------------------------------------------------------------
-- Driver earning and payout ledger
-- ---------------------------------------------------------------------------

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS payout_details JSONB;

ALTER TABLE public.driver_payouts
  ADD COLUMN IF NOT EXISTS request_key UUID,
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE public.driver_payouts
SET status = CASE status
  WHEN 'completed' THEN 'paid'
  WHEN 'processed' THEN 'paid'
  WHEN 'rejected' THEN 'failed'
  ELSE COALESCE(status, 'pending')
END;

CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_payouts_request_key
  ON public.driver_payouts (request_key)
  WHERE request_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_driver_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance
    OR OLD.total_earnings IS DISTINCT FROM NEW.total_earnings
    OR OLD.total_deliveries IS DISTINCT FROM NEW.total_deliveries
  )
  AND COALESCE(current_setting('app.driver_finance_authorized', true), '') <> 'true'
  AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'DRIVER_FINANCIAL_FIELDS_ARE_SERVER_MANAGED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_driver_financial_fields ON public.drivers;
CREATE TRIGGER guard_driver_financial_fields
  BEFORE UPDATE OF wallet_balance, total_earnings, total_deliveries ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_driver_financial_fields();

CREATE OR REPLACE FUNCTION public.calculate_driver_earnings(
  p_delivery_fee NUMERIC,
  p_tip_amount NUMERIC DEFAULT 0,
  p_city TEXT DEFAULT NULL,
  p_restaurant_id UUID DEFAULT NULL,
  p_distance_km NUMERIC DEFAULT NULL,
  p_order_time TIMESTAMPTZ DEFAULT now()
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings JSONB;
  v_base NUMERIC := 0;
  v_percentage NUMERIC := 80;
BEGIN
  SELECT ps.value
  INTO v_settings
  FROM public.platform_settings ps
  WHERE ps.key = 'driver_settings'
  ORDER BY ps.updated_at DESC
  LIMIT 1;

  v_base := COALESCE(NULLIF(v_settings ->> 'default_base_earning', '')::NUMERIC, 0);
  v_percentage := LEAST(
    GREATEST(COALESCE(NULLIF(v_settings ->> 'default_percentage', '')::NUMERIC, 80), 0),
    100
  );

  RETURN ROUND(
    v_base
      + GREATEST(COALESCE(p_delivery_fee, 0), 0) * v_percentage / 100
      + GREATEST(COALESCE(p_tip_amount, 0), 0),
    2
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_delivery_job_driver_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.driver_earnings := public.calculate_driver_earnings(
    COALESCE(NEW.delivery_fee, 0),
    COALESCE(NEW.tip_amount, 0),
    NULL,
    NEW.restaurant_id,
    NEW.estimated_distance_km,
    COALESCE(NEW.created_at, now())
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_driver_earnings ON public.delivery_jobs;
DROP TRIGGER IF EXISTS set_delivery_job_driver_earnings ON public.delivery_jobs;
CREATE TRIGGER set_delivery_job_driver_earnings
  BEFORE INSERT OR UPDATE OF delivery_fee, tip_amount, estimated_distance_km, restaurant_id
  ON public.delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivery_job_driver_earnings();

WITH ranked_credits AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY driver_id, reference_id
      ORDER BY created_at, id
    ) AS position
  FROM public.driver_wallet_transactions
  WHERE type = 'credit'
    AND reference_type = 'delivery'
    AND reference_id IS NOT NULL
)
DELETE FROM public.driver_wallet_transactions dwt
USING ranked_credits ranked
WHERE dwt.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_wallet_delivery_credit
  ON public.driver_wallet_transactions (driver_id, reference_id)
  WHERE type = 'credit' AND reference_type = 'delivery' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.credit_driver_wallet_from_delivery_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount NUMERIC(10, 2);
  v_balance NUMERIC(10, 2);
BEGIN
  IF NEW.status::TEXT <> 'delivered'
    OR OLD.status::TEXT = 'delivered'
    OR NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.drivers WHERE id = NEW.driver_id FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.driver_wallet_transactions dwt
    WHERE dwt.driver_id = NEW.driver_id
      AND dwt.reference_type = 'delivery'
      AND dwt.reference_id = NEW.id
      AND dwt.type = 'credit'
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(
    NULLIF(NEW.driver_earnings, 0),
    public.calculate_driver_earnings(
      COALESCE(NEW.delivery_fee, 0),
      COALESCE(NEW.tip_amount, 0),
      NULL,
      NEW.restaurant_id,
      NEW.estimated_distance_km,
      COALESCE(NEW.created_at, now())
    )
  );

  PERFORM set_config('app.driver_finance_authorized', 'true', true);

  UPDATE public.drivers
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount,
      total_earnings = COALESCE(total_earnings, 0) + v_amount,
      total_deliveries = COALESCE(total_deliveries, 0) + 1,
      updated_at = now()
  WHERE id = NEW.driver_id
  RETURNING wallet_balance INTO v_balance;

  INSERT INTO public.driver_wallet_transactions (
    driver_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    metadata
  )
  VALUES (
    NEW.driver_id,
    'credit',
    v_amount,
    v_balance,
    'delivery',
    NEW.id,
    'Delivery earnings',
    jsonb_build_object('delivery_job_id', NEW.id)
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_delivery_status_transition ON public.delivery_jobs;
DROP TRIGGER IF EXISTS debit_driver_wallet_on_cancellation ON public.delivery_jobs;
DROP TRIGGER IF EXISTS trg_credit_driver_wallet ON public.delivery_jobs;
DROP TRIGGER IF EXISTS credit_driver_wallet_from_delivery_job ON public.delivery_jobs;
CREATE TRIGGER credit_driver_wallet_from_delivery_job
  AFTER UPDATE OF status ON public.delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_driver_wallet_from_delivery_job();

CREATE OR REPLACE FUNCTION public.reserve_driver_payout(
  p_driver_id UUID,
  p_request_key UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_payout_details JSONB,
  p_requested_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_existing public.driver_payouts%ROWTYPE;
  v_threshold NUMERIC := 10;
  v_payout_id UUID;
BEGIN
  SELECT * INTO v_existing
  FROM public.driver_payouts
  WHERE request_key = p_request_key;

  IF FOUND THEN
    IF v_existing.driver_id <> p_driver_id THEN
      RAISE EXCEPTION 'REQUEST_KEY_CONFLICT';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'payout_id', v_existing.id,
      'status', v_existing.status,
      'amount', v_existing.amount
    );
  END IF;

  IF p_request_key IS NULL OR p_period_start > p_period_end THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_REQUEST';
  END IF;

  IF COALESCE(p_payout_details ->> 'bankName', '') = ''
    OR COALESCE(p_payout_details ->> 'accountNumber', '') = ''
    OR COALESCE(p_payout_details ->> 'accountName', '') = '' THEN
    RAISE EXCEPTION 'BANK_DETAILS_REQUIRED';
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND OR v_driver.approval_status::TEXT <> 'approved' OR NOT COALESCE(v_driver.is_active, false) THEN
    RAISE EXCEPTION 'ACTIVE_DRIVER_REQUIRED';
  END IF;

  SELECT COALESCE((ps.value ->> 'minimum_payout_threshold')::NUMERIC, 10)
  INTO v_threshold
  FROM public.platform_settings ps
  WHERE ps.key = 'driver_settings'
  ORDER BY ps.updated_at DESC
  LIMIT 1;

  v_threshold := COALESCE(v_threshold, 10);

  IF COALESCE(v_driver.wallet_balance, 0) < v_threshold THEN
    RAISE EXCEPTION 'MINIMUM_PAYOUT_NOT_REACHED';
  END IF;

  INSERT INTO public.driver_payouts (
    driver_id,
    amount,
    period_start,
    period_end,
    status,
    payout_method,
    payout_details,
    request_key,
    requested_by
  )
  VALUES (
    p_driver_id,
    v_driver.wallet_balance,
    p_period_start,
    p_period_end,
    'pending',
    'bank_transfer',
    p_payout_details,
    p_request_key,
    p_requested_by
  )
  RETURNING id INTO v_payout_id;

  PERFORM set_config('app.driver_finance_authorized', 'true', true);

  UPDATE public.drivers
  SET wallet_balance = 0,
      payout_details = p_payout_details,
      updated_at = now()
  WHERE id = p_driver_id;

  INSERT INTO public.driver_wallet_transactions (
    driver_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description
  )
  VALUES (
    p_driver_id,
    'withdrawal',
    v_driver.wallet_balance,
    0,
    'withdrawal',
    v_payout_id,
    'Driver payout reserved'
  );

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'payout_id', v_payout_id,
    'status', 'pending',
    'amount', v_driver.wallet_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_driver_payout(
  p_request_key UUID,
  p_bank_name TEXT,
  p_account_number TEXT,
  p_account_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_driver_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT d.id INTO v_driver_id
  FROM public.drivers d
  WHERE d.user_id = v_actor;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;

  RETURN public.reserve_driver_payout(
    v_driver_id,
    p_request_key,
    date_trunc('month', CURRENT_DATE)::DATE,
    CURRENT_DATE,
    jsonb_build_object(
      'bankName', trim(p_bank_name),
      'accountNumber', trim(p_account_number),
      'accountName', trim(p_account_name)
    ),
    v_actor
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_driver_payout_for_operator(
  p_driver_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_request_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_details JSONB;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.has_role(v_actor, 'admin')
    OR public.is_active_fleet_operator(v_actor)
  ) THEN
    RAISE EXCEPTION 'FLEET_OPERATOR_REQUIRED';
  END IF;

  SELECT d.payout_details INTO v_details
  FROM public.drivers d
  WHERE d.id = p_driver_id;

  IF v_details IS NULL THEN
    RAISE EXCEPTION 'DRIVER_BANK_DETAILS_REQUIRED';
  END IF;

  RETURN public.reserve_driver_payout(
    p_driver_id,
    p_request_key,
    p_period_start,
    p_period_end,
    v_details,
    v_actor
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_driver_payout(
  p_payout_id UUID,
  p_action TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_payout public.driver_payouts%ROWTYPE;
  v_new_status TEXT;
  v_balance NUMERIC(10, 2);
BEGIN
  IF v_actor IS NULL OR NOT (
    public.has_role(v_actor, 'admin')
    OR public.is_active_fleet_operator(v_actor)
  ) THEN
    RAISE EXCEPTION 'FLEET_OPERATOR_REQUIRED';
  END IF;

  SELECT * INTO v_payout
  FROM public.driver_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND';
  END IF;

  v_new_status := CASE p_action
    WHEN 'start' THEN 'processing'
    WHEN 'pay' THEN 'paid'
    WHEN 'reject' THEN 'failed'
    ELSE NULL
  END;

  IF v_new_status IS NULL
    OR (p_action = 'start' AND v_payout.status <> 'pending')
    OR (p_action IN ('pay', 'reject') AND v_payout.status NOT IN ('pending', 'processing')) THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_TRANSITION';
  END IF;

  IF p_action = 'pay' AND length(trim(COALESCE(p_payment_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED';
  END IF;

  UPDATE public.driver_payouts
  SET status = v_new_status,
      payment_reference = CASE WHEN p_action = 'pay' THEN trim(p_payment_reference) ELSE payment_reference END,
      rejection_reason = CASE WHEN p_action = 'reject' THEN NULLIF(trim(p_notes), '') ELSE NULL END,
      processed_at = CASE WHEN p_action IN ('pay', 'reject') THEN now() ELSE processed_at END,
      processed_by = v_actor,
      updated_at = now()
  WHERE id = v_payout.id;

  IF p_action = 'reject' THEN
    PERFORM 1 FROM public.drivers WHERE id = v_payout.driver_id FOR UPDATE;
    PERFORM set_config('app.driver_finance_authorized', 'true', true);

    UPDATE public.drivers
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_payout.amount,
        updated_at = now()
    WHERE id = v_payout.driver_id
    RETURNING wallet_balance INTO v_balance;

    INSERT INTO public.driver_wallet_transactions (
      driver_id,
      type,
      amount,
      balance_after,
      reference_type,
      reference_id,
      description
    )
    VALUES (
      v_payout.driver_id,
      'adjustment',
      v_payout.amount,
      v_balance,
      'withdrawal',
      v_payout.id,
      'Rejected payout returned to driver balance'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout.id,
    'status', v_new_status,
    'amount', v_payout.amount
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS, grants, and retirement of unsafe legacy financial entry points
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_policy RECORD;
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['partner_earnings', 'partner_payouts', 'driver_payouts', 'driver_withdrawals'] LOOP
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

ALTER TABLE public.partner_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner operators and admins can view earnings"
  ON public.partner_earnings
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_restaurant_operator(restaurant_id, (SELECT auth.uid()))
  );

CREATE POLICY "Partner operators and admins can view payouts"
  ON public.partner_payouts
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_restaurant_operator(restaurant_id, (SELECT auth.uid()))
  );

CREATE POLICY "Authorized users can view driver payouts"
  ON public.driver_payouts
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_active_fleet_operator((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_payouts.driver_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Authorized users can view legacy driver withdrawals"
  ON public.driver_withdrawals
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_active_fleet_operator((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_withdrawals.driver_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.partner_earnings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.partner_payouts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payouts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.driver_payouts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.driver_withdrawals FROM authenticated;
GRANT SELECT ON public.partner_earnings, public.partner_payouts, public.payouts TO authenticated;
GRANT SELECT ON public.driver_payouts, public.driver_withdrawals TO authenticated;

REVOKE ALL ON FUNCTION public.request_partner_payout(UUID, UUID, DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_partner_payout(UUID, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_partner_payout(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_legacy_partner_payout(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_driver_payout(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_driver_payout_for_operator(UUID, DATE, DATE, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_driver_payout(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_driver_payout(UUID, UUID, DATE, DATE, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_driver_earnings(NUMERIC, NUMERIC, TEXT, UUID, NUMERIC, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.request_partner_payout(UUID, UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_partner_payout(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_partner_payout(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_legacy_partner_payout(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_driver_payout(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_driver_payout_for_operator(UUID, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_driver_payout(UUID, TEXT, TEXT, TEXT) TO authenticated;

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
        'process_driver_withdrawal',
        'aggregate_restaurant_payouts',
        'process_payout_transfer',
        'generate_partner_api_credentials',
        'create_wallet_topup_invoice'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
  END LOOP;
END;
$$;
