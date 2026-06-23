-- Route order completion and referral XP through the centralized XP ledger.

CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id UUID,
    p_new_status VARCHAR,
    p_user_role VARCHAR DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_status VARCHAR;
    v_valid_statuses TEXT[];
    v_order_user_id UUID;
BEGIN
    SELECT order_status, user_id
    INTO v_current_status, v_order_user_id
    FROM public.meal_schedules
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    v_valid_statuses := public.get_valid_next_statuses(v_current_status);

    IF NOT p_new_status = ANY(v_valid_statuses) THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
    END IF;

    CASE p_user_role
        WHEN 'customer' THEN
            IF NOT (
                (v_current_status = 'pending' AND p_new_status = 'cancelled') OR
                (v_current_status = 'out_for_delivery' AND p_new_status = 'delivered')
            ) THEN
                RAISE EXCEPTION 'Customers cannot perform this status change';
            END IF;

        WHEN 'partner' THEN
            IF NOT (
                (v_current_status = 'pending' AND p_new_status = 'confirmed') OR
                (v_current_status = 'confirmed' AND p_new_status = 'preparing') OR
                (v_current_status = 'preparing' AND p_new_status = 'ready') OR
                (v_current_status IN ('pending', 'confirmed', 'preparing') AND p_new_status = 'cancelled')
            ) THEN
                RAISE EXCEPTION 'Partners cannot perform this status change';
            END IF;

        WHEN 'driver' THEN
            IF NOT (
                (v_current_status = 'ready' AND p_new_status = 'out_for_delivery') OR
                (v_current_status = 'out_for_delivery' AND p_new_status = 'delivered')
            ) THEN
                RAISE EXCEPTION 'Drivers cannot perform this status change';
            END IF;

        WHEN 'admin' THEN
            IF p_new_status != 'cancelled' THEN
                RAISE EXCEPTION 'Admins can only cancel orders';
            END IF;

        ELSE
            RAISE EXCEPTION 'Invalid user role: %', p_user_role;
    END CASE;

    PERFORM set_config('app.current_user_role', p_user_role, true);

    UPDATE public.meal_schedules
    SET order_status = p_new_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF p_new_status IN ('delivered', 'completed') THEN
        PERFORM public.award_xp(
            v_order_user_id,
            20,
            'Order completed',
            'order_completed',
            p_order_id::text,
            jsonb_build_object('order_id', p_order_id, 'status', p_new_status)
        );
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_referral_milestones()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_count INTEGER;
  milestone RECORD;
  existing_achievement UUID;
BEGIN
  IF NEW.tier1_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR OLD.tier1_referrer_id IS DISTINCT FROM NEW.tier1_referrer_id THEN
    PERFORM public.award_xp(
      NEW.tier1_referrer_id,
      100,
      'Friend referred',
      'friend_referred',
      NEW.user_id::text,
      jsonb_build_object('referred_user_id', NEW.user_id)
    );

    UPDATE public.profiles
    SET referral_rewards_earned = COALESCE(referral_rewards_earned, 0) + 1
    WHERE user_id = NEW.tier1_referrer_id;
  END IF;

  SELECT COUNT(*) INTO v_referral_count
  FROM public.profiles
  WHERE tier1_referrer_id = NEW.tier1_referrer_id;

  FOR milestone IN
    SELECT id, referral_count AS required_count, bonus_amount
    FROM public.referral_milestones
    WHERE is_active = true AND referral_count <= v_referral_count
    ORDER BY referral_count ASC
  LOOP
    SELECT id INTO existing_achievement
    FROM public.user_milestone_achievements
    WHERE user_id = NEW.tier1_referrer_id AND milestone_id = milestone.id;

    IF existing_achievement IS NULL THEN
      INSERT INTO public.user_milestone_achievements (user_id, milestone_id, bonus_credited, credited_at)
      VALUES (NEW.tier1_referrer_id, milestone.id, true, now());

      UPDATE public.profiles
      SET
        affiliate_balance = COALESCE(affiliate_balance, 0) + milestone.bonus_amount,
        total_affiliate_earnings = COALESCE(total_affiliate_earnings, 0) + milestone.bonus_amount
      WHERE user_id = NEW.tier1_referrer_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS check_referral_milestones_trigger ON public.profiles;
CREATE TRIGGER check_referral_milestones_trigger
  AFTER INSERT OR UPDATE OF tier1_referrer_id ON public.profiles
  FOR EACH ROW
  WHEN (NEW.tier1_referrer_id IS NOT NULL)
  EXECUTE FUNCTION public.check_referral_milestones();

GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, VARCHAR, VARCHAR) TO authenticated;
