-- Secure coach subscriptions and ensure access/earnings are created only from
-- a provider-verified payment fulfilled by the SADAD service role flow.

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_type_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type IN (
    'wallet_topup',
    'subscription',
    'order',
    'coach_subscription'
  ));

ALTER TABLE public.coach_subscriptions
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS coach_subscriptions_payment_id_unique
  ON public.coach_subscriptions (payment_id)
  WHERE payment_id IS NOT NULL;

ALTER TABLE public.coach_subscriptions
  DROP CONSTRAINT IF EXISTS coach_subscriptions_coach_id_client_id_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS coach_subscriptions_one_active_pair
  ON public.coach_subscriptions (coach_id, client_id)
  WHERE status = 'active';

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coach_subscriptions'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.coach_subscriptions',
      v_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY coach_subscription_participant_read
  ON public.coach_subscriptions
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR coach_id = auth.uid());

CREATE POLICY coach_subscription_admin_manage
  ON public.coach_subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.coach_subscriptions
  FROM anon, authenticated;
GRANT SELECT ON public.coach_subscriptions TO authenticated;
GRANT ALL ON public.coach_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_coach_subscription(
  p_subscription_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subscription public.coach_subscriptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT *
    INTO v_subscription
  FROM public.coach_subscriptions
  WHERE id = p_subscription_id
    AND client_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COACH_SUBSCRIPTION_NOT_FOUND';
  END IF;

  IF v_subscription.status = 'active' THEN
    UPDATE public.coach_subscriptions
    SET status = 'cancelled',
        auto_renew = FALSE,
        updated_at = NOW()
    WHERE id = v_subscription.id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'subscription_id', v_subscription.id,
    'status', CASE
      WHEN v_subscription.status = 'active' THEN 'cancelled'
      ELSE v_subscription.status
    END,
    'access_until', v_subscription.end_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_coach_subscription(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_coach_subscription(UUID)
  TO authenticated, service_role;

-- Paid recurring billing is not configured. Expire ended access instead of
-- extending subscriptions and creating unbacked earnings.
CREATE OR REPLACE FUNCTION public.process_coach_subscription_renewal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.coach_subscriptions
  SET status = 'expired',
      auto_renew = FALSE,
      updated_at = NOW()
  WHERE status IN ('active', 'cancelled')
    AND end_date <= NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.process_coach_subscription_renewal()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_coach_subscription_renewal()
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_initial_coach_earning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_commission NUMERIC;
BEGIN
  IF NEW.status <> 'active'
    OR NEW.payment_id IS NULL
    OR NEW.transaction_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.id = NEW.payment_id
        AND p.user_id = NEW.client_id
        AND p.payment_type = 'coach_subscription'
        AND ROUND(p.amount::NUMERIC, 2) = ROUND(NEW.price::NUMERIC, 2)
    ) THEN
    RAISE EXCEPTION 'VERIFIED_COACH_PAYMENT_REQUIRED';
  END IF;

  SELECT commission_pct
    INTO v_commission
  FROM public.platform_commission_config
  ORDER BY updated_at DESC
  LIMIT 1;

  v_commission := COALESCE(v_commission, 20);

  INSERT INTO public.coach_earnings (
    coach_id,
    client_id,
    subscription_id,
    amount,
    commission_pct,
    commission_amount,
    net_amount,
    transaction_type,
    status
  ) VALUES (
    NEW.coach_id,
    NEW.client_id,
    NEW.id,
    NEW.price,
    v_commission,
    ROUND(NEW.price * v_commission / 100, 2),
    ROUND(NEW.price - (NEW.price * v_commission / 100), 2),
    'subscription',
    'pending'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_initial_coach_earning()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.cancel_coach_subscription(UUID) IS
  'Cancels the authenticated client coach subscription without granting direct table writes.';
COMMENT ON FUNCTION public.process_coach_subscription_renewal() IS
  'Expires ended coach subscriptions. Automatic paid renewal is disabled until provider-backed recurring billing exists.';
