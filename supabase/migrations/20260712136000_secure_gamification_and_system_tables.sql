-- Protect system-owned notification, gamification, prediction, and profile
-- fields from cross-user writes and caller-supplied financial rewards.

CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN := COALESCE(public.has_role(auth.uid(), 'admin'), FALSE);
BEGIN
  IF current_user <> 'authenticated' OR v_is_admin THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'PROFILE_OWNER_MISMATCH';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.xp := 0;
    NEW.level := 1;
    NEW.badges_count := 0;
    NEW.streak_days := 0;
    NEW.total_meals_logged := 0;
    NEW.affiliate_balance := 0;
    NEW.affiliate_tier := 'bronze';
    NEW.total_affiliate_earnings := 0;
    NEW.referral_rewards_earned := 0;
    NEW.referred_by := NULL;
    NEW.tier1_referrer_id := NULL;
    NEW.tier2_referrer_id := NULL;
    NEW.tier3_referrer_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.xp IS DISTINCT FROM OLD.xp
    OR NEW.level IS DISTINCT FROM OLD.level
    OR NEW.badges_count IS DISTINCT FROM OLD.badges_count
    OR NEW.streak_days IS DISTINCT FROM OLD.streak_days
    OR NEW.total_meals_logged IS DISTINCT FROM OLD.total_meals_logged
    OR NEW.affiliate_balance IS DISTINCT FROM OLD.affiliate_balance
    OR NEW.affiliate_tier IS DISTINCT FROM OLD.affiliate_tier
    OR NEW.total_affiliate_earnings IS DISTINCT FROM OLD.total_affiliate_earnings
    OR NEW.referral_rewards_earned IS DISTINCT FROM OLD.referral_rewards_earned
    OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
    OR NEW.tier1_referrer_id IS DISTINCT FROM OLD.tier1_referrer_id
    OR NEW.tier2_referrer_id IS DISTINCT FROM OLD.tier2_referrer_id
    OR NEW.tier3_referrer_id IS DISTINCT FROM OLD.tier3_referrer_id THEN
    RAISE EXCEPTION 'PROTECTED_PROFILE_FIELD';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_system_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_system_fields_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_system_fields();

REVOKE ALL ON FUNCTION public.protect_profile_system_fields()
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.notifications',
      v_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY notifications_owner_read
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notifications_owner_update
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY notifications_owner_delete
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notifications_authorized_insert
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'staff')
    )
    OR EXISTS (
      SELECT 1
      FROM public.coach_client_assignments cca
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = notifications.user_id
        AND cca.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs dj
      JOIN public.drivers d ON d.id = dj.driver_id
      JOIN public.restaurants r ON r.id = dj.restaurant_id
      WHERE dj.id = NULLIF(notifications.data ->> 'delivery_job_id', '')::UUID
        AND d.user_id = notifications.user_id
        AND r.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DO $$
DECLARE
  v_table TEXT;
  v_policy RECORD;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'behavior_predictions',
    'user_badges',
    'subscription_recovery'
  ]
  LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())',
      v_table || '_owner_read',
      v_table
    );
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  IF to_regclass('public.deliveries') IS NOT NULL THEN
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'deliveries'
        AND cmd = 'INSERT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.deliveries', v_policy.policyname);
    END LOOP;
    REVOKE INSERT ON public.deliveries FROM anon, authenticated;
    GRANT ALL ON public.deliveries TO service_role;
  END IF;
END;
$$;

-- Financial rewards remain disabled until every earning source is derived
-- from server-owned events. Badge-only achievements continue to work.
UPDATE public.reward_definitions
SET is_active = FALSE,
    updated_at = NOW()
WHERE reward_type <> 'badge_only';

DO $$
DECLARE
  v_function RECORD;
BEGIN
  FOR v_function IN
    SELECT p.oid::REGPROCEDURE AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'award_xp',
        'award_xp_for_meal_log',
        'grant_badge_reward',
        'grant_progress_rewards',
        'increment_meals_logged',
        'decrement_meals_logged'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.signature
    );
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function.signature);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_own_meals_logged_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_count
  FROM public.meal_history mh
  WHERE mh.user_id = v_user_id;

  UPDATE public.profiles
  SET total_meals_logged = v_count,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_own_meals_logged_count()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_own_meals_logged_count()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.protect_profile_system_fields() IS
  'Prevents authenticated clients from mutating XP, referral, and affiliate ledger projections directly.';
