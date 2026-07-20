-- Bind schedules to the exact subscription and make cancellation/delivery edits replay-safe.

BEGIN;

ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quota_month_start DATE,
  ADD COLUMN IF NOT EXISTS quota_week_start DATE,
  ADD COLUMN IF NOT EXISTS snack_quota_consumed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS meal_schedules_subscription_date_idx
  ON public.meal_schedules (subscription_id, scheduled_date DESC)
  WHERE subscription_id IS NOT NULL;

UPDATE public.meal_schedules schedule
SET subscription_id = (
  SELECT subscription.id
  FROM public.subscriptions subscription
  WHERE subscription.user_id = schedule.user_id
    AND subscription.created_at <= COALESCE(schedule.created_at, now())
  ORDER BY
    (subscription.status IN ('active', 'cancelled')) DESC,
    subscription.created_at DESC
  LIMIT 1
)
WHERE schedule.subscription_id IS NULL;

ALTER FUNCTION public.schedule_meals_atomic(UUID, JSONB, UUID)
  RENAME TO schedule_meals_atomic_legacy_20260720;

REVOKE ALL ON FUNCTION public.schedule_meals_atomic_legacy_20260720(UUID, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.schedule_meals_atomic(
  p_subscription_id UUID,
  p_items JSONB,
  p_request_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
  v_schedule_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions subscription
    WHERE subscription.id = p_subscription_id
      AND subscription.user_id = v_user_id
  ) THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;

  v_result := public.schedule_meals_atomic_legacy_20260720(
    p_subscription_id,
    p_items,
    p_request_batch_id
  );

  FOR v_schedule_id IN
    SELECT value::UUID FROM jsonb_array_elements_text(v_result -> 'schedule_ids') value
  LOOP
    UPDATE public.meal_schedules
    SET subscription_id = p_subscription_id,
        quota_month_start = COALESCE(quota_month_start, date_trunc('month', CURRENT_DATE)::DATE),
        quota_week_start = COALESCE(quota_week_start, date_trunc('week', CURRENT_DATE)::DATE),
        snack_quota_consumed = CASE
          WHEN meal_type = 'snack' THEN TRUE
          ELSE snack_quota_consumed
        END,
        updated_at = now()
    WHERE id = v_schedule_id
      AND user_id = v_user_id
      AND (subscription_id IS NULL OR subscription_id = p_subscription_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'SCHEDULE_SUBSCRIPTION_MISMATCH'; END IF;
  END LOOP;

  RETURN v_result || jsonb_build_object('subscription_id', p_subscription_id);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_meals_atomic(UUID, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_meals_atomic(UUID, JSONB, UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.schedule_operation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.meal_schedules(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (operation IN ('cancelled', 'delivery_updated')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin')),
  request_fingerprint TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS schedule_operation_single_cancel_idx
  ON public.schedule_operation_events (schedule_id, operation)
  WHERE operation = 'cancelled';

ALTER TABLE public.schedule_operation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_operation_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_operation_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.schedule_operation_events TO service_role;

CREATE POLICY schedule_operation_owner_read ON public.schedule_operation_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
GRANT SELECT ON public.schedule_operation_events TO authenticated;

ALTER FUNCTION public.cancel_meal_schedule(UUID, TEXT)
  RENAME TO cancel_meal_schedule_legacy_20260720;
ALTER FUNCTION public.admin_cancel_meal_schedule(UUID, TEXT)
  RENAME TO admin_cancel_meal_schedule_legacy_20260720;
REVOKE ALL ON FUNCTION public.cancel_meal_schedule_legacy_20260720(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_cancel_meal_schedule_legacy_20260720(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_meal_schedule_core(
  p_schedule_id UUID,
  p_reason TEXT,
  p_actor_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_schedule public.meal_schedules%ROWTYPE;
  v_meal_name TEXT;
  v_restaurant_id UUID;
  v_restaurant_owner UUID;
  v_active_jobs INTEGER;
  v_cancelled_jobs INTEGER := 0;
  v_refund_transaction UUID;
  v_quota_restored BOOLEAN := FALSE;
  v_subscription public.subscriptions%ROWTYPE;
  v_corporate_redemption public.corporate_benefit_events%ROWTYPE;
  v_corporate_reversed BOOLEAN := FALSE;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_actor_type NOT IN ('customer', 'admin') THEN RAISE EXCEPTION 'INVALID_CANCELLATION_ACTOR'; END IF;
  IF p_actor_type = 'admin' AND (
    COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    OR NOT public.has_role(v_actor_id, 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;

  SELECT * INTO v_schedule
  FROM public.meal_schedules schedule
  WHERE schedule.id = p_schedule_id
    AND (p_actor_type = 'admin' OR schedule.user_id = v_actor_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SCHEDULE_NOT_FOUND'; END IF;

  IF v_schedule.order_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'already_cancelled', TRUE,
      'schedule_id', v_schedule.id,
      'refunded_addons', 0
    );
  END IF;
  IF v_schedule.order_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'SCHEDULE_CANNOT_BE_CANCELLED';
  END IF;

  SELECT count(*) INTO v_active_jobs
  FROM public.delivery_jobs job
  WHERE job.schedule_id = v_schedule.id
    AND job.status IN ('picked_up', 'in_transit', 'delivered', 'completed');
  IF v_active_jobs > 0 THEN RAISE EXCEPTION 'DELIVERY_ALREADY_IN_PROGRESS'; END IF;

  SELECT meal.name, meal.restaurant_id
  INTO v_meal_name, v_restaurant_id
  FROM public.meals meal
  WHERE meal.id = v_schedule.meal_id;

  UPDATE public.delivery_jobs
  SET status = 'cancelled',
      failure_reason = LEFT(COALESCE(NULLIF(TRIM(p_reason), ''), 'Schedule cancelled'), 500),
      updated_at = now()
  WHERE schedule_id = v_schedule.id
    AND status IN ('pending', 'assigned', 'accepted');
  GET DIAGNOSTICS v_cancelled_jobs = ROW_COUNT;

  DELETE FROM public.delivery_queue
  WHERE metadata ->> 'schedule_id' = v_schedule.id::TEXT
    AND status IN ('queued', 'assigned', 'accepted');

  UPDATE public.meal_schedules
  SET order_status = 'cancelled',
      cancellation_reason = LEFT(NULLIF(TRIM(p_reason), ''), 500),
      updated_at = now()
  WHERE id = v_schedule.id;

  IF v_schedule.subscription_id IS NOT NULL THEN
    SELECT * INTO v_subscription
    FROM public.subscriptions subscription
    WHERE subscription.id = v_schedule.subscription_id
      AND subscription.user_id = v_schedule.user_id
    FOR UPDATE;

    v_quota_restored := FOUND AND (
      (v_subscription.month_start_date = v_schedule.quota_month_start
        AND COALESCE(v_subscription.meals_used_this_month, 0) > 0)
      OR (v_subscription.week_start_date = v_schedule.quota_week_start
        AND COALESCE(v_subscription.meals_used_this_week, 0) > 0)
      OR (v_schedule.snack_quota_consumed
        AND v_subscription.month_start_date = v_schedule.quota_month_start
        AND COALESCE(v_subscription.snacks_used_this_month, 0) > 0)
    );

    UPDATE public.subscriptions subscription
    SET meals_used_this_month = CASE
          WHEN subscription.month_start_date = v_schedule.quota_month_start
            THEN greatest(0, COALESCE(subscription.meals_used_this_month, 0) - 1)
          ELSE subscription.meals_used_this_month
        END,
        meals_used_this_week = CASE
          WHEN subscription.week_start_date = v_schedule.quota_week_start
            THEN greatest(0, COALESCE(subscription.meals_used_this_week, 0) - 1)
          ELSE subscription.meals_used_this_week
        END,
        snacks_used_this_month = CASE
          WHEN v_schedule.snack_quota_consumed
            AND subscription.month_start_date = v_schedule.quota_month_start
            THEN greatest(0, COALESCE(subscription.snacks_used_this_month, 0) - 1)
          ELSE subscription.snacks_used_this_month
        END,
        updated_at = now()
    WHERE subscription.id = v_schedule.subscription_id
      AND subscription.user_id = v_schedule.user_id;
  END IF;

  SELECT * INTO v_corporate_redemption
  FROM public.corporate_benefit_events event
  WHERE event.schedule_id = v_schedule.id
    AND event.event_type = 'redeemed'
  FOR UPDATE;

  IF FOUND AND NOT EXISTS (
    SELECT 1 FROM public.corporate_benefit_events reversal
    WHERE reversal.schedule_id = v_schedule.id
      AND reversal.event_type = 'reversed'
  ) THEN
    INSERT INTO public.corporate_benefit_events (
      organization_id, membership_id, user_id, schedule_id, event_type,
      sponsor_amount, allowance_period_start, source_event_id
    ) VALUES (
      v_corporate_redemption.organization_id,
      v_corporate_redemption.membership_id,
      v_corporate_redemption.user_id,
      v_corporate_redemption.schedule_id,
      'reversed',
      v_corporate_redemption.sponsor_amount,
      v_corporate_redemption.allowance_period_start,
      v_corporate_redemption.id
    );

    UPDATE public.corporate_memberships membership
    SET allowance_used = greatest(0, allowance_used - 1),
        updated_at = now()
    WHERE membership.id = v_corporate_redemption.membership_id
      AND membership.allowance_period_start = v_corporate_redemption.allowance_period_start;
    v_corporate_reversed := TRUE;
  END IF;

  IF COALESCE(v_schedule.addons_total, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions wallet_entry
      WHERE wallet_entry.user_id = v_schedule.user_id
        AND wallet_entry.reference_type = 'schedule_addon_refund'
        AND wallet_entry.reference_id = v_schedule.id
    ) THEN
    v_refund_transaction := public.credit_wallet(
      v_schedule.user_id,
      v_schedule.addons_total,
      'refund',
      'schedule_addon_refund',
      v_schedule.id,
      'Scheduled meal add-on refund',
      jsonb_build_object('schedule_id', v_schedule.id, 'reason', LEFT(COALESCE(p_reason, ''), 200))
    );
  END IF;

  UPDATE public.partner_earnings
  SET status = 'cancelled'
  WHERE meal_schedule_id = v_schedule.id
    AND status = 'pending';

  UPDATE public.notifications
  SET status = 'read'
  WHERE user_id = v_schedule.user_id
    AND type = 'meal_scheduled'
    AND data ->> 'schedule_id' = v_schedule.id::TEXT
    AND status = 'unread';

  SELECT restaurant.owner_id INTO v_restaurant_owner
  FROM public.restaurants restaurant
  WHERE restaurant.id = v_restaurant_id;

  IF v_restaurant_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, status, data)
    VALUES (
      v_restaurant_owner,
      'order_update',
      'Order cancelled',
      'A scheduled meal was cancelled before preparation.',
      'unread',
      jsonb_build_object('schedule_id', v_schedule.id, 'cancelled_by', p_actor_type)
    );
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, status, data)
  VALUES (
    v_schedule.user_id,
    'order_update',
    'Meal cancelled',
    'Your scheduled meal was cancelled and eligible credits were restored.',
    'unread',
    jsonb_build_object('schedule_id', v_schedule.id, 'action', 'cancelled', 'quota_restored', v_quota_restored)
  );

  INSERT INTO public.schedule_operation_events (
    schedule_id, user_id, operation, actor_id, actor_type, details
  ) VALUES (
    v_schedule.id,
    v_schedule.user_id,
    'cancelled',
    v_actor_id,
    p_actor_type,
    jsonb_build_object(
      'reason', LEFT(COALESCE(p_reason, ''), 500),
      'quota_restored', v_quota_restored,
      'corporate_benefit_reversed', v_corporate_reversed,
      'refunded_addons', COALESCE(v_schedule.addons_total, 0),
      'refund_transaction_id', v_refund_transaction,
      'cancelled_jobs', v_cancelled_jobs,
      'meal_name', COALESCE(v_meal_name, '')
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'already_cancelled', FALSE,
    'schedule_id', v_schedule.id,
    'quota_restored', v_quota_restored,
    'corporate_benefit_reversed', v_corporate_reversed,
    'refunded_addons', COALESCE(v_schedule.addons_total, 0),
    'cancelled_jobs', v_cancelled_jobs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_meal_schedule_core(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_meal_schedule(
  p_schedule_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.cancel_meal_schedule_core(p_schedule_id, p_reason, 'customer');
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_meal_schedule(
  p_schedule_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.cancel_meal_schedule_core(p_schedule_id, p_reason, 'admin');
$$;

REVOKE ALL ON FUNCTION public.cancel_meal_schedule(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_meal_schedule(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_meal_schedule(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_meal_schedule(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_scheduled_delivery(
  p_schedule_id UUID,
  p_delivery_time_slot TEXT,
  p_delivery_address_id UUID,
  p_delivery_quote_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_schedule public.meal_schedules%ROWTYPE;
  v_route JSONB;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF char_length(btrim(COALESCE(p_delivery_time_slot, ''))) NOT BETWEEN 3 AND 100 THEN
    RAISE EXCEPTION 'DELIVERY_TIME_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_addresses address
    WHERE address.id = p_delivery_address_id AND address.user_id = v_user_id
  ) THEN RAISE EXCEPTION 'DELIVERY_ADDRESS_NOT_FOUND'; END IF;

  SELECT * INTO v_schedule
  FROM public.meal_schedules schedule
  WHERE schedule.id = p_schedule_id AND schedule.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SCHEDULE_NOT_FOUND'; END IF;
  IF v_schedule.order_status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'DELIVERY_EDIT_NOT_ALLOWED'; END IF;
  IF v_schedule.scheduled_date < CURRENT_DATE THEN RAISE EXCEPTION 'DELIVERY_EDIT_NOT_ALLOWED'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.delivery_jobs job
    WHERE job.schedule_id = v_schedule.id
      AND job.status IN ('picked_up', 'in_transit', 'delivered', 'completed')
  ) THEN RAISE EXCEPTION 'DELIVERY_ALREADY_IN_PROGRESS'; END IF;

  v_route := public.route_meal_schedule_branch(
    v_schedule.restaurant_id,
    v_schedule.meal_id,
    p_delivery_address_id,
    v_schedule.scheduled_date,
    btrim(p_delivery_time_slot),
    v_schedule.meal_type
  );

  UPDATE public.meal_schedules
  SET delivery_time_slot = btrim(p_delivery_time_slot),
      delivery_address_id = p_delivery_address_id,
      restaurant_branch_id = NULLIF(v_route ->> 'branch_id', '')::UUID,
      routing_metadata = COALESCE(v_route, '{}'::JSONB),
      customization_data = CASE
        WHEN p_delivery_quote_id IS NULL THEN COALESCE(customization_data, '{}'::JSONB)
        ELSE COALESCE(customization_data, '{}'::JSONB)
          || jsonb_build_object('_delivery_quote_id', p_delivery_quote_id)
      END,
      updated_at = now()
  WHERE id = v_schedule.id
  RETURNING jsonb_build_object(
    'success', TRUE,
    'schedule_id', id,
    'delivery_time_slot', delivery_time_slot,
    'delivery_address_id', delivery_address_id,
    'restaurant_branch_id', restaurant_branch_id,
    'delivery_fee', delivery_fee,
    'delivery_fee_base', delivery_fee_base,
    'delivery_fee_surge', delivery_fee_surge
  ) INTO v_result;

  INSERT INTO public.schedule_operation_events (
    schedule_id, user_id, operation, actor_id, actor_type, request_fingerprint, details
  ) VALUES (
    v_schedule.id,
    v_user_id,
    'delivery_updated',
    v_user_id,
    'customer',
    encode(extensions.digest(concat_ws('|', v_schedule.id, p_delivery_address_id, btrim(p_delivery_time_slot), COALESCE(p_delivery_quote_id::TEXT, '')), 'sha256'), 'hex'),
    v_result - 'success'
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_scheduled_delivery(UUID, TEXT, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_scheduled_delivery(UUID, TEXT, UUID, UUID)
  TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.meal_schedules FROM authenticated;
GRANT SELECT ON public.meal_schedules TO authenticated;

COMMIT;
