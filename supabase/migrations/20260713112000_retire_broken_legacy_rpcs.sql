BEGIN;

-- These RPCs belong to the retired delivery_queue/deliveries workflow. The
-- launch flow uses delivery_jobs plus the role-scoped functions introduced in
-- 20260712130000 and 20260712138000.
DROP FUNCTION IF EXISTS public.accept_delivery_assignment(UUID);
DROP FUNCTION IF EXISTS public.auto_group_deliveries(UUID, DATE);
DROP FUNCTION IF EXISTS public.get_available_deliveries(NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.manual_assign_driver(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.optimize_delivery_route(UUID);
DROP FUNCTION IF EXISTS public.generate_pickup_qr_code(UUID);

-- Superseded by cancel_customer_order/cancel_meal_schedule and the verified
-- subscription payment lifecycle. Keeping broken SECURITY DEFINER endpoints
-- callable would be a larger risk than removing these unused contracts.
DROP FUNCTION IF EXISTS public.cancel_order(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_subscription(UUID, VARCHAR, VARCHAR, UUID);
DROP FUNCTION IF EXISTS public.ensure_fleet_manager_role(UUID);
DROP FUNCTION IF EXISTS public.auto_complete_delivered_orders();
DROP FUNCTION IF EXISTS public.test_func();

DROP FUNCTION IF EXISTS public.check_and_expire_subscriptions();

CREATE FUNCTION public.check_and_expire_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_expired_count INTEGER := 0;
  v_recovery_count INTEGER := 0;
BEGIN
  FOR v_subscription IN
    SELECT s.id, s.user_id, s.end_date, s.tier
    FROM public.subscriptions s
    WHERE s.status = 'cancelled'
      AND s.end_date IS NOT NULL
      AND s.end_date < CURRENT_DATE
      AND s.expired_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.subscriptions s
    SET status = 'expired',
        active = false,
        expired_at = COALESCE(s.expired_at, now()),
        updated_at = now()
    WHERE s.id = v_subscription.id;
    v_expired_count := v_expired_count + 1;

    IF NOT EXISTS (
      SELECT 1 FROM public.subscription_recovery sr
      WHERE sr.subscription_id = v_subscription.id
        AND sr.recovery_status IN ('pending', 'offer_viewed', 'offer_accepted')
    ) THEN
      INSERT INTO public.subscription_recovery (
        user_id, subscription_id, expired_at, recovery_status,
        next_notif_due_at, reactivation_tier, created_at, updated_at
      ) VALUES (
        v_subscription.user_id, v_subscription.id,
        COALESCE(v_subscription.end_date::TIMESTAMPTZ, now()),
        'pending', now(), v_subscription.tier, now(), now()
      );
      v_recovery_count := v_recovery_count + 1;
    END IF;

    INSERT INTO public.retention_audit_logs (
      user_id, subscription_id, action_type, action_details, triggered_by
    ) VALUES (
      v_subscription.user_id, v_subscription.id, 'subscription_expired',
      jsonb_build_object('end_date', v_subscription.end_date), 'system'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_subscriptions', v_expired_count,
    'recoveries_created', v_recovery_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_expire_subscriptions()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_expire_subscriptions()
  TO service_role;

COMMIT;
