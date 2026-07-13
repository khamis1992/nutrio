-- Remove direct client execution from operational RPCs and bind user-facing RPCs to auth.uid().

CREATE OR REPLACE FUNCTION public.assert_self_or_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR (auth.uid() <> p_user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role))) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_self_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_self_or_admin(uuid) TO authenticated, service_role;

-- These functions are called by backend jobs, payment handlers, or database workflows.
DO $do$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'add_to_delivery_queue',
        'assign_driver_with_lock',
        'authenticate_partner_api_request',
        'auto_rotate_api_keys',
        'calculate_daily_margin',
        'calculate_delivery_priority',
        'calculate_nps_score',
        'calculate_restaurant_rating',
        'claim_delivery_atomic',
        'cleanup_old_top_meals',
        'cleanup_rate_limits',
        'cleanup_revoked_tokens',
        'credit_wallet',
        'feature_nps_response',
        'generate_invoice_number',
        'increment_restaurant_order_count',
        'mark_webhook_delivered',
        'mark_webhook_failed',
        'refresh_analytics_stats',
        'reset_daily_capacity_counts',
        'reset_weekly_meal_quotas',
        'schedule_webhook',
        'select_nearest_branch_for_meal'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$do$;

-- Preserve implementation bodies while exposing identity-bound wrappers.
ALTER FUNCTION public.submit_meal_review(uuid, uuid, integer, text, text, text[], boolean, text[])
  RENAME TO submit_meal_review_trusted;
ALTER FUNCTION public.delete_meal_review(uuid, uuid)
  RENAME TO delete_meal_review_trusted;
ALTER FUNCTION public.send_friend_request(uuid, uuid)
  RENAME TO send_friend_request_trusted;
ALTER FUNCTION public.accept_friend_request(uuid, uuid)
  RENAME TO accept_friend_request_trusted;
ALTER FUNCTION public.reject_friend_request(uuid, uuid)
  RENAME TO reject_friend_request_trusted;
ALTER FUNCTION public.remove_friend(uuid, uuid)
  RENAME TO remove_friend_trusted;
ALTER FUNCTION public.get_friends(uuid)
  RENAME TO get_friends_trusted;
ALTER FUNCTION public.get_friend_requests(uuid)
  RENAME TO get_friend_requests_trusted;
ALTER FUNCTION public.generate_weekly_report(uuid, date)
  RENAME TO generate_weekly_report_trusted;
ALTER FUNCTION public.submit_skip_reason(uuid, uuid, uuid, character varying, text, date, character varying, numeric)
  RENAME TO submit_skip_reason_trusted;
ALTER FUNCTION public.get_active_challenges(uuid)
  RENAME TO get_active_challenges_trusted;
ALTER FUNCTION public.get_customer_driver_ids(uuid)
  RENAME TO get_customer_driver_ids_trusted;
ALTER FUNCTION public.get_skip_analytics(uuid, date, date)
  RENAME TO get_skip_analytics_trusted;
ALTER FUNCTION public.get_user_health_goal(uuid)
  RENAME TO get_user_health_goal_trusted;
ALTER FUNCTION public.calculate_user_streak(uuid)
  RENAME TO calculate_user_streak_trusted;
ALTER FUNCTION public.calculate_weekly_adherence(uuid, date)
  RENAME TO calculate_weekly_adherence_trusted;
ALTER FUNCTION public.calculate_weight_change_rate(uuid, integer)
  RENAME TO calculate_weight_change_rate_trusted;
ALTER FUNCTION public.check_and_award_badges(uuid)
  RENAME TO check_and_award_badges_trusted;
ALTER FUNCTION public.update_challenge_progress(uuid, uuid, integer)
  RENAME TO update_challenge_progress_trusted;
ALTER FUNCTION public.partner_confirm_handover(uuid, uuid)
  RENAME TO partner_confirm_handover_trusted;

DO $do$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE '%\_trusted' ESCAPE '\'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', fn.proname, fn.args);
  END LOOP;
END;
$do$;

CREATE FUNCTION public.submit_meal_review(
  p_meal_id uuid,
  p_user_id uuid,
  p_rating integer,
  p_title text DEFAULT NULL,
  p_review_text text DEFAULT NULL,
  p_photo_urls text[] DEFAULT '{}',
  p_would_recommend boolean DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.submit_meal_review_trusted(p_meal_id, p_user_id, p_rating, p_title, p_review_text, p_photo_urls, p_would_recommend, p_tags);
END;
$function$;

CREATE FUNCTION public.delete_meal_review(p_review_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.delete_meal_review_trusted(p_review_id, p_user_id);
END;
$function$;

CREATE FUNCTION public.send_friend_request(p_requester_id uuid, p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_requester_id);
  RETURN public.send_friend_request_trusted(p_requester_id, p_target_id);
END;
$function$;

CREATE FUNCTION public.accept_friend_request(p_friendship_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.accept_friend_request_trusted(p_friendship_id, p_user_id);
END;
$function$;

CREATE FUNCTION public.reject_friend_request(p_friendship_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.reject_friend_request_trusted(p_friendship_id, p_user_id);
END;
$function$;

CREATE FUNCTION public.remove_friend(p_friendship_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.remove_friend_trusted(p_friendship_id, p_user_id);
END;
$function$;

CREATE FUNCTION public.get_friends(p_user_id uuid)
RETURNS TABLE(
  friendship_id uuid,
  friend_user_id uuid,
  friend_name text,
  friend_email text,
  friend_avatar text,
  current_streak integer,
  show_weight boolean,
  show_progress boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN QUERY SELECT * FROM public.get_friends_trusted(p_user_id);
END;
$function$;

CREATE FUNCTION public.get_friend_requests(p_user_id uuid)
RETURNS TABLE(
  friendship_id uuid,
  requester_name text,
  requester_email text,
  requester_avatar text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN QUERY SELECT * FROM public.get_friend_requests_trusted(p_user_id);
END;
$function$;

CREATE FUNCTION public.generate_weekly_report(p_user_id uuid, p_week_start date)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.generate_weekly_report_trusted(p_user_id, p_week_start);
END;
$function$;

CREATE FUNCTION public.submit_skip_reason(
  p_user_id uuid,
  p_meal_id uuid,
  p_schedule_id uuid,
  p_reason_type varchar,
  p_details text DEFAULT NULL,
  p_scheduled_date date DEFAULT NULL,
  p_meal_type varchar DEFAULT NULL,
  p_ai_confidence_score numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.submit_skip_reason_trusted(p_user_id, p_meal_id, p_schedule_id, p_reason_type, p_details, p_scheduled_date, p_meal_type, p_ai_confidence_score);
END;
$function$;

CREATE FUNCTION public.get_active_challenges(p_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid, title text, description text, challenge_type text, difficulty_level text,
  category text, target_value integer, reward_points integer, xp_reward integer,
  wallet_reward_amount numeric, participant_count integer, start_date date, end_date date,
  is_joined boolean, user_progress integer, user_rank integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  PERFORM public.assert_self_or_admin(v_user_id);
  RETURN QUERY SELECT * FROM public.get_active_challenges_trusted(v_user_id);
END;
$function$;

CREATE FUNCTION public.get_customer_driver_ids(customer_uuid uuid)
RETURNS TABLE(driver_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(customer_uuid);
  RETURN QUERY SELECT * FROM public.get_customer_driver_ids_trusted(customer_uuid);
END;
$function$;

-- Rebind the policy to the guarded wrapper rather than the renamed implementation.
DROP POLICY IF EXISTS "Customers can view assigned drivers" ON public.drivers;
CREATE POLICY "Customers can view assigned drivers"
  ON public.drivers FOR SELECT TO authenticated
  USING (
    id IN (SELECT public.get_customer_driver_ids(auth.uid()))
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.fleet_managers fm
      WHERE fm.auth_user_id = auth.uid() AND fm.is_active = true
    )
  );

CREATE FUNCTION public.get_skip_analytics(
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) RETURNS TABLE(reason_type varchar, total_skips bigint, percentage numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  PERFORM public.assert_self_or_admin(v_user_id);
  RETURN QUERY SELECT * FROM public.get_skip_analytics_trusted(v_user_id, p_start_date, p_end_date);
END;
$function$;

CREATE FUNCTION public.get_user_health_goal(user_uuid uuid)
RETURNS public.user_goals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(user_uuid);
  RETURN public.get_user_health_goal_trusted(user_uuid);
END;
$function$;

CREATE FUNCTION public.calculate_user_streak(user_uuid uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(user_uuid);
  RETURN public.calculate_user_streak_trusted(user_uuid);
END;
$function$;

CREATE FUNCTION public.calculate_weekly_adherence(p_user_id uuid, p_week_start date)
RETURNS TABLE(adherence_rate numeric, avg_calories integer, days_logged integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN QUERY SELECT * FROM public.calculate_weekly_adherence_trusted(p_user_id, p_week_start);
END;
$function$;

CREATE FUNCTION public.calculate_weight_change_rate(p_user_id uuid, p_weeks integer)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.calculate_weight_change_rate_trusted(p_user_id, p_weeks);
END;
$function$;

CREATE FUNCTION public.check_and_award_badges(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.check_and_award_badges_trusted(p_user_id);
END;
$function$;

CREATE FUNCTION public.update_challenge_progress(p_challenge_id uuid, p_user_id uuid, p_progress integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.update_challenge_progress_trusted(p_challenge_id, p_user_id, p_progress);
END;
$function$;

CREATE FUNCTION public.partner_confirm_handover(p_delivery_job_id uuid, p_partner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_partner_user_id);
  RETURN public.partner_confirm_handover_trusted(p_delivery_job_id, p_partner_user_id);
END;
$function$;

-- Add-on counters may only be changed by an operator of the owning restaurant.
CREATE OR REPLACE FUNCTION public.increment_addon_usage(addon_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_restaurant_id uuid;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id FROM public.restaurant_addons WHERE id = addon_id;
  IF v_restaurant_id IS NULL OR NOT (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_restaurant_operator(v_restaurant_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'RESTAURANT_OPERATOR_REQUIRED';
  END IF;
  UPDATE public.restaurant_addons SET usage_count = usage_count + 1 WHERE id = addon_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_addon_usage(addon_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_restaurant_id uuid;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id FROM public.restaurant_addons WHERE id = addon_id;
  IF v_restaurant_id IS NULL OR NOT (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_restaurant_operator(v_restaurant_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'RESTAURANT_OPERATOR_REQUIRED';
  END IF;
  UPDATE public.restaurant_addons SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = addon_id;
END;
$function$;

DO $do$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'submit_meal_review','delete_meal_review','send_friend_request','accept_friend_request',
        'reject_friend_request','remove_friend','get_friends','get_friend_requests',
        'generate_weekly_report','submit_skip_reason','get_active_challenges','get_customer_driver_ids',
        'get_skip_analytics','get_user_health_goal','calculate_user_streak','calculate_weekly_adherence',
        'calculate_weight_change_rate','check_and_award_badges','update_challenge_progress',
        'partner_confirm_handover','increment_addon_usage','decrement_addon_usage'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', fn.proname, fn.args);
  END LOOP;
END;
$do$;
