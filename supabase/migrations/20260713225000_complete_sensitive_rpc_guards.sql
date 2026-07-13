-- Complete identity and operator checks for the remaining sensitive RPCs.

ALTER FUNCTION public.detect_weight_plateau(uuid, integer)
  RENAME TO detect_weight_plateau_trusted;
ALTER FUNCTION public.get_user_affiliate_rank(uuid)
  RENAME TO get_user_affiliate_rank_trusted;
ALTER FUNCTION public.get_user_role(uuid)
  RENAME TO get_user_role_trusted;
ALTER FUNCTION public.get_user_roles(uuid)
  RENAME TO get_user_roles_trusted;
ALTER FUNCTION public.has_user_submitted_nps(uuid, uuid)
  RENAME TO has_user_submitted_nps_trusted;
ALTER FUNCTION public.get_cancellation_stats(date, date, uuid)
  RENAME TO get_cancellation_stats_trusted;
ALTER FUNCTION public.get_nps_trend_by_month(integer)
  RENAME TO get_nps_trend_by_month_trusted;

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

CREATE FUNCTION public.detect_weight_plateau(p_user_id uuid, p_weeks_threshold integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.detect_weight_plateau_trusted(p_user_id, p_weeks_threshold);
END;
$function$;

CREATE FUNCTION public.get_user_affiliate_rank(user_uuid uuid)
RETURNS TABLE(earnings integer, referrals integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(user_uuid);
  RETURN QUERY SELECT * FROM public.get_user_affiliate_rank_trusted(user_uuid);
END;
$function$;

CREATE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(_user_id);
  RETURN public.get_user_role_trusted(_user_id);
END;
$function$;

CREATE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS TABLE(role public.app_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(_user_id);
  RETURN QUERY SELECT * FROM public.get_user_roles_trusted(_user_id);
END;
$function$;

CREATE FUNCTION public.has_user_submitted_nps(p_user_id uuid, p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_self_or_admin(p_user_id);
  RETURN public.has_user_submitted_nps_trusted(p_user_id, p_order_id);
END;
$function$;

CREATE FUNCTION public.get_cancellation_stats(p_start_date date, p_end_date date, p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND (p_restaurant_id IS NULL OR NOT public.is_restaurant_operator(p_restaurant_id, auth.uid())) THEN
    RAISE EXCEPTION 'RESTAURANT_OPERATOR_REQUIRED';
  END IF;
  RETURN public.get_cancellation_stats_trusted(p_start_date, p_end_date, p_restaurant_id);
END;
$function$;

CREATE FUNCTION public.get_nps_trend_by_month(p_months integer)
RETURNS TABLE(month text, total_responses bigint, nps_score numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  RETURN QUERY SELECT * FROM public.get_nps_trend_by_month_trusted(p_months);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_restaurant_capacity(p_restaurant_id uuid, p_max_meals_per_day integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF p_max_meals_per_day < 10 OR p_max_meals_per_day > 1000 THEN
    RAISE EXCEPTION 'INVALID_RESTAURANT_CAPACITY';
  END IF;
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT public.is_restaurant_operator(p_restaurant_id, auth.uid()) THEN
    RAISE EXCEPTION 'RESTAURANT_OPERATOR_REQUIRED';
  END IF;
  UPDATE public.restaurants SET max_meals_per_day = p_max_meals_per_day WHERE id = p_restaurant_id;
END;
$function$;

DO $do$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'detect_weight_plateau','get_user_affiliate_rank','get_user_role','get_user_roles',
        'has_user_submitted_nps','get_cancellation_stats','get_nps_trend_by_month',
        'update_restaurant_capacity'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', fn.proname, fn.args);
  END LOOP;

  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_ip_blocked', 'trigger_whatsapp_notification_processor')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', fn.proname, fn.args);
  END LOOP;
END;
$do$;
