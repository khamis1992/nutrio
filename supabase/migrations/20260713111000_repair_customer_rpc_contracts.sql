BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_discount_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_expires_at DATE;

CREATE OR REPLACE FUNCTION public.get_meal_reviews(
  p_meal_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0,
  p_sort_by TEXT DEFAULT 'newest'
) RETURNS TABLE(
  review_id UUID,
  user_id UUID,
  user_name TEXT,
  user_avatar TEXT,
  rating INTEGER,
  title TEXT,
  review_text TEXT,
  photo_urls TEXT[],
  is_verified_purchase BOOLEAN,
  would_recommend BOOLEAN,
  tags TEXT[],
  helpful_count INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mr.id,
    mr.user_id,
    COALESCE(p.full_name, 'Anonymous')::TEXT,
    p.avatar_url::TEXT,
    mr.rating,
    mr.title::TEXT,
    mr.review_text,
    COALESCE(mr.photo_urls, ARRAY[]::TEXT[]),
    COALESCE(mr.is_verified_purchase, false),
    mr.would_recommend,
    COALESCE(mr.tags, ARRAY[]::TEXT[]),
    COALESCE(mr.helpful_count, 0),
    mr.created_at
  FROM public.meal_reviews mr
  LEFT JOIN public.profiles p ON p.user_id = mr.user_id
  WHERE mr.meal_id = p_meal_id
    AND COALESCE(mr.is_approved, false)
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN mr.created_at END DESC,
    CASE WHEN p_sort_by = 'highest' THEN mr.rating END DESC,
    CASE WHEN p_sort_by = 'lowest' THEN mr.rating END ASC,
    CASE WHEN p_sort_by = 'helpful' THEN mr.helpful_count END DESC,
    mr.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
  OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_requester_id UUID,
  p_target_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.friendships%ROWTYPE;
  v_new_id UUID;
  v_requester_name TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_requester_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF p_requester_id = p_target_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot add yourself');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_existing
  FROM public.friendships
  WHERE (requester_id = p_requester_id AND target_id = p_target_id)
     OR (requester_id = p_target_id AND target_id = p_requester_id)
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_existing.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already friends');
  ELSIF FOUND AND v_existing.status = 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friend request already sent');
  ELSIF FOUND THEN
    UPDATE public.friendships
    SET requester_id = p_requester_id,
        target_id = p_target_id,
        status = 'pending',
        updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_new_id;
  ELSE
    INSERT INTO public.friendships (requester_id, target_id, status)
    VALUES (p_requester_id, p_target_id, 'pending')
    RETURNING id INTO v_new_id;
  END IF;

  SELECT COALESCE(full_name, 'Someone') INTO v_requester_name
  FROM public.profiles WHERE user_id = p_requester_id;

  INSERT INTO public.notifications (user_id, type, title, message, status, data)
  VALUES (
    p_target_id, 'general', 'New Friend Request',
    v_requester_name || ' wants to be friends!', 'unread',
    jsonb_build_object('friendship_id', v_new_id, 'requester_id', p_requester_id)
  );

  RETURN jsonb_build_object('success', true, 'id', v_new_id, 'message', 'Friend request sent');
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(
  p_friendship_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_friendship public.friendships%ROWTYPE;
  v_name TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_friendship
  FROM public.friendships
  WHERE id = p_friendship_id
    AND target_id = p_user_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending request found');
  END IF;

  UPDATE public.friendships SET status = 'accepted', updated_at = now()
  WHERE id = p_friendship_id;

  SELECT COALESCE(full_name, 'Someone') INTO v_name
  FROM public.profiles WHERE user_id = p_user_id;

  INSERT INTO public.notifications (user_id, type, title, message, status, data)
  VALUES (
    v_friendship.requester_id, 'general', 'Friend Request Accepted',
    v_name || ' accepted your friend request!', 'unread',
    jsonb_build_object('friendship_id', p_friendship_id, 'friend_id', p_user_id)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Friend request accepted');
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_meal(
  p_schedule_id UUID,
  p_new_date DATE DEFAULT NULL,
  p_new_meal_type TEXT DEFAULT NULL,
  p_new_time_slot TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule public.meal_schedules%ROWTYPE;
  v_updates INTEGER := 0;
BEGIN
  SELECT * INTO v_schedule
  FROM public.meal_schedules
  WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Schedule not found');
  END IF;
  IF auth.uid() IS NULL OR v_schedule.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF v_schedule.order_status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This order can no longer be rescheduled');
  END IF;
  IF p_new_date IS NOT NULL AND p_new_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'New date cannot be in the past');
  END IF;

  UPDATE public.meal_schedules
  SET scheduled_date = COALESCE(p_new_date, scheduled_date),
      meal_type = COALESCE(NULLIF(p_new_meal_type, ''), meal_type),
      delivery_time_slot = COALESCE(NULLIF(p_new_time_slot, ''), delivery_time_slot),
      updated_at = now()
  WHERE id = p_schedule_id
    AND (
      (p_new_date IS NOT NULL AND p_new_date IS DISTINCT FROM scheduled_date)
      OR (NULLIF(p_new_meal_type, '') IS NOT NULL AND p_new_meal_type IS DISTINCT FROM meal_type)
      OR (NULLIF(p_new_time_slot, '') IS NOT NULL AND p_new_time_slot IS DISTINCT FROM delivery_time_slot)
    );
  GET DIAGNOSTICS v_updates = ROW_COUNT;

  IF v_updates = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No changes provided');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, status, data)
  VALUES (
    v_schedule.user_id, 'order_update', 'Meal Rescheduled',
    'Your meal schedule has been updated.', 'unread',
    jsonb_build_object('schedule_id', p_schedule_id, 'new_date', p_new_date,
      'new_meal_type', p_new_meal_type, 'new_time_slot', p_new_time_slot)
  );

  RETURN jsonb_build_object('success', true, 'updates', v_updates);
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_wallet_id UUID;
  v_new_balance NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  INSERT INTO public.customer_wallets (user_id, balance, total_credits, total_debits, is_active)
  VALUES (p_user_id, 0, 0, 0, true)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.customer_wallets
  SET balance = COALESCE(balance, 0) + p_amount,
      total_credits = COALESCE(total_credits, 0) + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id AND COALESCE(is_active, true)
  RETURNING id, balance INTO v_wallet_id, v_new_balance;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found or inactive';
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_after,
    reference_type, reference_id, description, metadata
  ) VALUES (
    v_wallet_id, p_user_id, p_type, p_amount, v_new_balance,
    p_reference_type, p_reference_id, p_description, COALESCE(p_metadata, '{}'::JSONB)
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN COALESCE((
    SELECT balance FROM public.customer_wallets WHERE user_id = p_user_id
  ), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recovery_status(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recovery public.subscription_recovery%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_recovery
  FROM public.subscription_recovery
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', v_recovery.id,
    'subscription_id', v_recovery.subscription_id,
    'status', v_recovery.recovery_status,
    'expired_at', v_recovery.expired_at,
    'recovery_offer_id', v_recovery.accepted_offer_id,
    'offer_applied_at', v_recovery.accepted_at,
    'reactivated_at', v_recovery.reactivated_at,
    'notification_stage', 0,
    'days_since_expiry', GREATEST(0, EXTRACT(DAY FROM now() - v_recovery.expired_at)::INTEGER)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recovery_offers()
RETURNS TABLE(
  id UUID,
  offer_type TEXT,
  name TEXT,
  description TEXT,
  discount_percent INTEGER,
  bonus_credits INTEGER,
  free_days INTEGER,
  downgrade_to_tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER;
  v_recovery_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT sr.id, GREATEST(0, EXTRACT(DAY FROM now() - sr.expired_at)::INTEGER)
  INTO v_recovery_id, v_days
  FROM public.subscription_recovery sr
  WHERE sr.user_id = auth.uid()
    AND sr.recovery_status IN ('pending', 'offer_viewed')
  ORDER BY sr.created_at DESC LIMIT 1;

  IF v_recovery_id IS NULL THEN RETURN; END IF;

  UPDATE public.subscription_recovery
  SET recovery_status = 'offer_viewed', viewed_at = COALESCE(viewed_at, now()), updated_at = now()
  WHERE subscription_recovery.id = v_recovery_id;

  RETURN QUERY
  SELECT ro.id,
    CASE WHEN ro.offer_type = 'downgrade' THEN 'downgrade_retention' ELSE ro.offer_type END::TEXT,
    ro.name::TEXT, ro.description,
    ro.discount_percent, ro.bonus_credits, ro.free_days, ro.target_tier::TEXT
  FROM public.recovery_offers ro
  WHERE ro.is_active
    AND v_days BETWEEN ro.days_since_expiry_min AND ro.days_since_expiry_max
  ORDER BY ro.priority, ro.created_at DESC
  LIMIT 3;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_subscription(p_subscription_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions
  WHERE id = p_subscription_id FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Subscription not found'); END IF;
  IF auth.uid() IS NULL OR v_sub.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF v_sub.status NOT IN ('expired', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription is not eligible for reactivation');
  END IF;

  UPDATE public.subscriptions
  SET status = 'active', active = true, expired_at = NULL,
      start_date = CURRENT_DATE, end_date = CURRENT_DATE + 30,
      next_renewal_date = CURRENT_DATE + 30,
      meals_used_this_month = 0, meals_used_this_week = 0,
      week_start_date = CURRENT_DATE, month_start_date = CURRENT_DATE,
      updated_at = now()
  WHERE id = p_subscription_id;

  UPDATE public.subscription_recovery
  SET recovery_status = 'reactivated', reactivated_at = now(),
      reactivation_tier = v_sub.tier, new_subscription_id = p_subscription_id,
      updated_at = now()
  WHERE user_id = v_sub.user_id
    AND subscription_id = p_subscription_id
    AND recovery_status IN ('pending', 'offer_viewed', 'offer_accepted');

  INSERT INTO public.retention_audit_logs
    (user_id, subscription_id, action_type, action_details, triggered_by, triggered_by_user_id)
  VALUES
    (v_sub.user_id, p_subscription_id, 'subscription_renewed',
     jsonb_build_object('action', 'reactivated'), 'user', auth.uid());

  RETURN jsonb_build_object('success', true, 'message', 'Subscription reactivated successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_recovery_offer(
  p_subscription_id UUID,
  p_offer_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_offer public.recovery_offers%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions
  WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Subscription not found'); END IF;
  IF auth.uid() IS NULL OR v_sub.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_offer FROM public.recovery_offers
  WHERE id = p_offer_id AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Offer not found or inactive'); END IF;

  SELECT * INTO v_plan FROM public.subscription_plans
  WHERE tier = COALESCE(v_offer.target_tier, v_sub.tier)
    AND is_active
  ORDER BY CASE WHEN billing_interval = COALESCE(v_sub.billing_interval, 'monthly') THEN 0 ELSE 1 END,
    price_qar
  LIMIT 1;

  UPDATE public.subscriptions
  SET status = 'active', active = true, expired_at = NULL,
      tier = COALESCE(v_offer.target_tier, tier),
      plan = COALESCE(v_offer.target_tier, plan),
      start_date = CURRENT_DATE,
      end_date = CURRENT_DATE + GREATEST(COALESCE(v_offer.free_days, 30), 1),
      next_renewal_date = CURRENT_DATE + 30,
      meals_per_month = COALESCE(v_plan.meals_per_month, meals_per_month, 0)
        + COALESCE(v_offer.bonus_credits, 0),
      meals_used_this_month = 0, meals_used_this_week = 0,
      week_start_date = CURRENT_DATE, month_start_date = CURRENT_DATE,
      current_discount_percent = COALESCE(v_offer.discount_percent, 0),
      discount_expires_at = CASE WHEN COALESCE(v_offer.discount_percent, 0) > 0
        THEN CURRENT_DATE + GREATEST(COALESCE(v_offer.discount_duration_months, 1), 1) * 30
        ELSE NULL END,
      updated_at = now()
  WHERE id = p_subscription_id;

  UPDATE public.subscription_recovery
  SET recovery_status = 'reactivated', accepted_offer_id = v_offer.id,
      accepted_at = now(), reactivated_at = now(),
      reactivation_tier = COALESCE(v_offer.target_tier, v_sub.tier),
      new_subscription_id = p_subscription_id,
      conversion_value_qar = COALESCE(v_plan.price_qar, 0), updated_at = now()
  WHERE user_id = v_sub.user_id
    AND subscription_id = p_subscription_id
    AND recovery_status IN ('pending', 'offer_viewed', 'offer_accepted');

  INSERT INTO public.retention_audit_logs
    (user_id, subscription_id, action_type, action_details, triggered_by, triggered_by_user_id)
  VALUES
    (v_sub.user_id, p_subscription_id, 'subscription_renewed',
     jsonb_build_object('action', 'recovery_reactivation', 'offer_id', v_offer.id,
       'offer_type', v_offer.offer_type), 'user', auth.uid());

  RETURN jsonb_build_object('success', true, 'message', 'Recovery offer applied');
END;
$$;

DROP FUNCTION IF EXISTS public.dismiss_recovery(UUID);

CREATE FUNCTION public.dismiss_recovery(p_subscription_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_recovery_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM public.subscriptions WHERE id = p_subscription_id;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Subscription not found'); END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.subscription_recovery
  SET recovery_status = 'dismissed', updated_at = now()
  WHERE id = (
    SELECT sr.id FROM public.subscription_recovery sr
    WHERE sr.user_id = v_user_id
      AND sr.subscription_id = p_subscription_id
      AND sr.recovery_status IN ('pending', 'offer_viewed')
    ORDER BY sr.created_at DESC LIMIT 1
  ) RETURNING id INTO v_recovery_id;

  IF v_recovery_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active recovery found');
  END IF;

  INSERT INTO public.retention_audit_logs
    (user_id, subscription_id, action_type, action_details, triggered_by, triggered_by_user_id)
  VALUES
    (v_user_id, p_subscription_id, 'recovery_dismissed',
     jsonb_build_object('recovery_id', v_recovery_id), 'user', auth.uid());

  RETURN jsonb_build_object('success', true, 'message', 'Recovery dismissed');
END;
$$;

REVOKE ALL ON FUNCTION public.credit_wallet(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, JSONB)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_wallet_balance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_recovery_status(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_recovery_offers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_subscription(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_recovery_offer(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dismiss_recovery(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recovery_status(UUID),
  public.get_recovery_offers(),
  public.reactivate_subscription(UUID),
  public.apply_recovery_offer(UUID, UUID),
  public.dismiss_recovery(UUID)
  TO authenticated;

REVOKE ALL ON FUNCTION public.send_friend_request(UUID, UUID),
  public.accept_friend_request(UUID, UUID),
  public.reschedule_meal(UUID, DATE, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID, UUID),
  public.accept_friend_request(UUID, UUID),
  public.reschedule_meal(UUID, DATE, TEXT, TEXT)
  TO authenticated;

DROP FUNCTION IF EXISTS public.get_recovery_offers(UUID);
DROP FUNCTION IF EXISTS public.apply_recovery_offer(UUID, VARCHAR);

COMMIT;
