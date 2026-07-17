BEGIN;

-- Keep test payment simulation atomic and unreachable from browser RPC calls.
-- The Edge function additionally fails closed outside explicit non-production
-- environments, but authorization is repeated here as defense in depth.
CREATE OR REPLACE FUNCTION public.admin_simulate_wallet_payment(
  p_actor_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_requested_method TEXT DEFAULT 'card',
  p_idempotency_key UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_payment_id UUID;
  v_transaction_id UUID;
  v_reference TEXT := 'SIM-' || gen_random_uuid()::TEXT;
  v_method TEXT := lower(trim(COALESCE(p_requested_method, 'card')));
  v_existing public.payments%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_actor_id
      AND ur.role::TEXT = 'admin'
  ) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_user_id
  ) THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'INVALID_SIMULATION_AMOUNT';
  END IF;

  IF v_method NOT IN ('card', 'wallet', 'sadad') THEN
    RAISE EXCEPTION 'INVALID_SIMULATION_METHOD';
  END IF;

  SELECT p.*
  INTO v_existing
  FROM public.payments p
  WHERE p.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.gateway <> 'simulation'
       OR v_existing.user_id IS DISTINCT FROM p_user_id
       OR v_existing.amount IS DISTINCT FROM round(p_amount, 2) THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';
    END IF;

    RETURN jsonb_build_object(
      'success', v_existing.status = 'completed',
      'payment_id', v_existing.id,
      'transaction_id', v_existing.gateway_reference,
      'idempotent_replay', TRUE
    );
  END IF;

  INSERT INTO public.payments (
    user_id,
    payment_type,
    amount,
    currency,
    status,
    payment_method,
    gateway,
    gateway_reference,
    gateway_response,
    idempotency_key,
    description,
    metadata,
    fulfillment_status,
    wallet_credited
  ) VALUES (
    p_user_id,
    'wallet_topup',
    round(p_amount, 2),
    'QAR',
    'pending',
    v_method,
    'simulation',
    v_reference,
    jsonb_build_object('simulated', TRUE),
    p_idempotency_key,
    'Admin payment simulation',
    jsonb_build_object(
      'simulation', TRUE,
      'actor_id', p_actor_id,
      'requested_method', v_method
    ),
    'pending',
    FALSE
  )
  RETURNING id INTO v_payment_id;

  v_transaction_id := public.credit_wallet(
    p_user_id,
    round(p_amount, 2),
    'credit',
    'wallet_topup',
    v_payment_id,
    'Admin payment simulation',
    jsonb_build_object(
      'simulation', TRUE,
      'actor_id', p_actor_id,
      'idempotency_key', p_idempotency_key
    )
  );

  UPDATE public.payments
  SET status = 'completed',
      wallet_transaction_id = v_transaction_id,
      wallet_credited = TRUE,
      fulfillment_status = 'completed',
      verified_at = now(),
      processed_at = now(),
      completed_at = now(),
      updated_at = now()
  WHERE id = v_payment_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'payment_id', v_payment_id,
    'transaction_id', v_reference,
    'wallet_transaction_id', v_transaction_id,
    'idempotent_replay', FALSE
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_simulate_wallet_payment(UUID, UUID, NUMERIC, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_simulate_wallet_payment(UUID, UUID, NUMERIC, TEXT, UUID)
  TO service_role;

COMMENT ON FUNCTION public.admin_simulate_wallet_payment(UUID, UUID, NUMERIC, TEXT, UUID) IS
  'Non-production-only payment simulation transaction. Browser roles cannot execute it directly.';

NOTIFY pgrst, 'reload schema';

COMMIT;
