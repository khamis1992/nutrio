-- Secure and complete community challenge progress integration.
-- Progress is now calculated from trusted tables, not from client-supplied values.

DO $do$
DECLARE
  v_missing TEXT[];
BEGIN
  SELECT array_agg(table_name)
  INTO v_missing
  FROM (
    VALUES
      ('public.community_challenges'),
      ('public.challenge_participants'),
      ('public.meal_history'),
      ('public.progress_logs'),
      ('public.water_entries'),
      ('public.workout_sessions'),
      ('public.subscriptions')
  ) AS required_tables(table_name)
  WHERE to_regclass(required_tables.table_name) IS NULL;

  IF coalesce(array_length(v_missing, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Missing required community challenge integration tables: %', array_to_string(v_missing, ', ');
  END IF;
END $do$;

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  reward_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(referral_code)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their referrals" ON public.referrals;
CREATE POLICY "Users can view their referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Users can create referral codes" ON public.referrals;
CREATE POLICY "Users can create referral codes"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Users can update their referrals" ON public.referrals;
CREATE POLICY "Users can update their referrals"
  ON public.referrals FOR UPDATE
  TO authenticated
  USING (auth.uid() = referrer_id)
  WITH CHECK (auth.uid() = referrer_id);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_user
  ON public.challenge_participants(challenge_id, user_id);

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

WITH ranked_participants AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY challenge_id, user_id
      ORDER BY joined_at ASC NULLS LAST, id
    ) AS row_num
  FROM public.challenge_participants
)
DELETE FROM public.challenge_participants cp
USING ranked_participants rp
WHERE cp.id = rp.id
  AND rp.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_participants_unique_user_challenge
  ON public.challenge_participants(challenge_id, user_id);

DO $do$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date
    ON public.workout_sessions(user_id, session_date);

  CREATE INDEX IF NOT EXISTS idx_referrals_referrer_completed
    ON public.referrals(referrer_id, completed_at)
    WHERE status = 'completed';

  CREATE INDEX IF NOT EXISTS idx_subscriptions_user_dates
    ON public.subscriptions(user_id, start_date, end_date, status);
END $do$;

CREATE OR REPLACE FUNCTION public.calculate_community_challenge_progress(
  p_user_id UUID,
  p_challenge_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_challenge public.community_challenges%ROWTYPE;
  v_type TEXT;
  v_progress INTEGER := 0;
  v_protein_target INTEGER := 120;
BEGIN
  SELECT *
  INTO v_challenge
  FROM public.community_challenges
  WHERE id = p_challenge_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_type := lower(coalesce(v_challenge.challenge_type, ''));

  IF v_type IN ('meals', 'meal_logging') THEN
    v_progress := (
      SELECT count(*)::INTEGER
      FROM public.meal_history mh
      WHERE mh.user_id = p_user_id
        AND mh.logged_at >= v_challenge.start_date::timestamptz
        AND mh.logged_at < (v_challenge.end_date + 1)::timestamptz
    );

  ELSIF v_type = 'streak' THEN
    v_progress := (
      SELECT count(DISTINCT pl.log_date)::INTEGER
      FROM public.progress_logs pl
      WHERE pl.user_id = p_user_id
        AND pl.log_date BETWEEN v_challenge.start_date AND v_challenge.end_date
        AND coalesce(pl.calories_consumed, 0) > 0
    );

  ELSIF v_type IN ('protein', 'nutrition') THEN
    v_protein_target := coalesce((
      SELECT ng.protein_target_g
      FROM public.nutrition_goals ng
      WHERE ng.user_id = p_user_id
        AND ng.is_active = true
      ORDER BY ng.created_at DESC
      LIMIT 1
    ), 120);

    v_progress := (
      SELECT count(DISTINCT pl.log_date)::INTEGER
      FROM public.progress_logs pl
      WHERE pl.user_id = p_user_id
        AND pl.log_date BETWEEN v_challenge.start_date AND v_challenge.end_date
        AND coalesce(pl.protein_consumed_g, 0) >= greatest(v_protein_target, 1)
    );

  ELSIF v_type IN ('water', 'hydration') THEN
    v_progress := (
      SELECT count(*)::INTEGER
      FROM (
        SELECT sum(coalesce(we.amount_ml, 0)) AS total_ml
        FROM public.water_entries we
        WHERE we.user_id = p_user_id
          AND we.log_date BETWEEN v_challenge.start_date AND v_challenge.end_date
        GROUP BY we.log_date
      ) AS hydration_days
      WHERE hydration_days.total_ml >= 2500
    );

  ELSIF v_type IN ('activity', 'workout') THEN
    v_progress := (
      SELECT count(DISTINCT ws.session_date)::INTEGER
      FROM public.workout_sessions ws
      WHERE ws.user_id = p_user_id
        AND ws.session_date BETWEEN v_challenge.start_date AND v_challenge.end_date
        AND (
          coalesce(ws.duration_minutes, 0) > 0
          OR coalesce(ws.calories_burned, 0) > 0
        )
    );

  ELSIF v_type = 'coach' THEN
    IF to_regclass('public.program_meal_completions') IS NOT NULL THEN
      v_progress := (
        SELECT count(*)::INTEGER
        FROM public.program_meal_completions pmc
        WHERE pmc.client_id = p_user_id
          AND pmc.completed_at BETWEEN v_challenge.start_date AND v_challenge.end_date
      );
    END IF;

    IF to_regclass('public.program_exercise_completions') IS NOT NULL THEN
      v_progress := v_progress + coalesce((
        SELECT count(*)::INTEGER
        FROM public.program_exercise_completions
        WHERE client_id = p_user_id
          AND completed_at BETWEEN v_challenge.start_date AND v_challenge.end_date
      ), 0);
    END IF;

    IF to_regclass('public.coach_workout_sessions') IS NOT NULL THEN
      v_progress := v_progress + coalesce((
        SELECT count(*)::INTEGER
        FROM public.coach_workout_sessions
        WHERE user_id = p_user_id
          AND completed_at IS NOT NULL
          AND completed_at >= v_challenge.start_date::timestamptz
          AND completed_at < (v_challenge.end_date + 1)::timestamptz
      ), 0);
    END IF;

  ELSIF v_type = 'referral' THEN
    v_progress := (
      SELECT count(*)::INTEGER
      FROM public.referrals r
      WHERE r.referrer_id = p_user_id
        AND r.status = 'completed'
        AND r.completed_at >= v_challenge.start_date::timestamptz
        AND r.completed_at < (v_challenge.end_date + 1)::timestamptz
    );

  ELSIF v_type = 'subscription' THEN
    v_progress := (
      SELECT count(*)::INTEGER
      FROM generate_series(v_challenge.start_date, v_challenge.end_date, interval '1 day') AS challenge_day(day)
      WHERE EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.user_id = p_user_id
          AND (
            s.active = true
            OR s.status = 'active'
          )
          AND coalesce(s.start_date::date, s.created_at::date, v_challenge.start_date) <= challenge_day.day::date
          AND coalesce(s.end_date::date, s.next_renewal_date::date, v_challenge.end_date) >= challenge_day.day::date
      )
    );

  ELSE
    v_progress := coalesce((
      SELECT cp.current_progress
      FROM public.challenge_participants cp
      WHERE cp.user_id = p_user_id
        AND cp.challenge_id = p_challenge_id
      LIMIT 1
    ), 0);
  END IF;

  RETURN greatest(coalesce(v_progress, 0), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_community_challenge_progress(
  p_user_id UUID,
  p_challenge_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_participant public.challenge_participants%ROWTYPE;
  v_challenge public.community_challenges%ROWTYPE;
  v_progress INTEGER;
  v_new_progress INTEGER;
  v_xp_result JSONB := NULL;
  v_was_completed BOOLEAN := false;
BEGIN
  SELECT *
  INTO v_participant
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not participating in this challenge');
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.community_challenges
  WHERE id = p_challenge_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge not found or inactive');
  END IF;

  v_was_completed := v_participant.completed_at IS NOT NULL;
  v_progress := public.calculate_community_challenge_progress(p_user_id, p_challenge_id);
  v_new_progress := least(greatest(v_progress, 0), coalesce(v_challenge.target_value, 0));

  UPDATE public.challenge_participants
  SET current_progress = v_new_progress,
      completed_at = CASE
        WHEN v_new_progress >= v_challenge.target_value AND completed_at IS NULL THEN now()
        ELSE completed_at
      END,
      updated_at = now()
  WHERE id = v_participant.id;

  IF NOT v_was_completed AND v_new_progress >= v_challenge.target_value THEN
    v_xp_result := public.award_xp(
      p_user_id,
      coalesce(v_challenge.xp_reward, v_challenge.reward_points, 100),
      'Community challenge completed: ' || coalesce(v_challenge.title, 'Challenge'),
      'community_challenge_complete',
      p_challenge_id::text,
      jsonb_build_object(
        'challenge_id', p_challenge_id,
        'challenge_type', v_challenge.challenge_type,
        'target', v_challenge.target_value
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'completed', v_new_progress >= v_challenge.target_value,
    'progress', v_new_progress,
    'target', v_challenge.target_value,
    'xp', v_xp_result
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_community_challenge_progress_for_user(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_participant RECORD;
  v_result JSONB;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing user id');
  END IF;

  FOR v_participant IN
    SELECT cp.challenge_id
    FROM public.challenge_participants cp
    JOIN public.community_challenges cc ON cc.id = cp.challenge_id
    WHERE cp.user_id = p_user_id
      AND cc.is_active = true
      AND cc.start_date <= current_date
      AND cc.end_date >= current_date
  LOOP
    v_result := public.apply_community_challenge_progress(p_user_id, v_participant.challenge_id);
    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'challenge_id', v_participant.challenge_id,
        'result', v_result
      )
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'results', v_results);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_my_community_challenges()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  RETURN public.sync_community_challenge_progress_for_user(auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_challenge(
  p_challenge_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := coalesce(p_user_id, auth.uid());
  v_challenge public.community_challenges%ROWTYPE;
  v_participant_id UUID;
BEGIN
  IF auth.uid() IS NULL OR v_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.community_challenges
  WHERE id = p_challenge_id
    AND is_active = true
    AND start_date <= current_date
    AND end_date >= current_date;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge not found or inactive');
  END IF;

  INSERT INTO public.challenge_participants (challenge_id, user_id, current_progress)
  VALUES (p_challenge_id, v_user_id, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_participant_id;

  IF v_participant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already joined this challenge');
  END IF;

  UPDATE public.community_challenges
  SET participant_count = (
    SELECT count(*)::INTEGER
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
  )
  WHERE id = p_challenge_id;

  RETURN public.apply_community_challenge_progress(v_user_id, p_challenge_id)
    || jsonb_build_object('participant_id', v_participant_id, 'joined', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_challenge_progress(
  p_challenge_id UUID,
  p_user_id UUID,
  p_progress INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- p_progress is intentionally ignored. Progress is calculated from trusted tables.
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  RETURN public.apply_community_challenge_progress(p_user_id, p_challenge_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_sync_community_challenges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := coalesce(
      nullif(to_jsonb(OLD)->>'user_id', '')::uuid,
      nullif(to_jsonb(OLD)->>'client_id', '')::uuid,
      nullif(to_jsonb(OLD)->>'referrer_id', '')::uuid
    );
  ELSE
    v_user_id := coalesce(
      nullif(to_jsonb(NEW)->>'user_id', '')::uuid,
      nullif(to_jsonb(NEW)->>'client_id', '')::uuid,
      nullif(to_jsonb(NEW)->>'referrer_id', '')::uuid
    );
  END IF;

  IF v_user_id IS NOT NULL THEN
    PERFORM public.sync_community_challenge_progress_for_user(v_user_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

DO $do$
BEGIN
  DROP TRIGGER IF EXISTS trg_community_challenges_meal_history ON public.meal_history;
  CREATE TRIGGER trg_community_challenges_meal_history
  AFTER INSERT OR UPDATE OR DELETE ON public.meal_history
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();

  DROP TRIGGER IF EXISTS trg_community_challenges_progress_logs ON public.progress_logs;
  CREATE TRIGGER trg_community_challenges_progress_logs
  AFTER INSERT OR UPDATE OR DELETE ON public.progress_logs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();

  DROP TRIGGER IF EXISTS trg_community_challenges_water_entries ON public.water_entries;
  CREATE TRIGGER trg_community_challenges_water_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.water_entries
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();

  DROP TRIGGER IF EXISTS trg_community_challenges_workout_sessions ON public.workout_sessions;
  CREATE TRIGGER trg_community_challenges_workout_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();

  IF to_regclass('public.program_meal_completions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_community_challenges_program_meals ON public.program_meal_completions;
    CREATE TRIGGER trg_community_challenges_program_meals
    AFTER INSERT OR UPDATE OR DELETE ON public.program_meal_completions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();
  END IF;

  IF to_regclass('public.program_exercise_completions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_community_challenges_program_exercises ON public.program_exercise_completions;
    CREATE TRIGGER trg_community_challenges_program_exercises
    AFTER INSERT OR UPDATE OR DELETE ON public.program_exercise_completions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();
  END IF;

  IF to_regclass('public.coach_workout_sessions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_community_challenges_coach_workouts ON public.coach_workout_sessions;
    CREATE TRIGGER trg_community_challenges_coach_workouts
    AFTER INSERT OR UPDATE OR DELETE ON public.coach_workout_sessions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();
  END IF;

  DROP TRIGGER IF EXISTS trg_community_challenges_referrals ON public.referrals;
  CREATE TRIGGER trg_community_challenges_referrals
  AFTER INSERT OR UPDATE OR DELETE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();

  DROP TRIGGER IF EXISTS trg_community_challenges_subscriptions ON public.subscriptions;
  CREATE TRIGGER trg_community_challenges_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_community_challenges();
END $do$;

REVOKE ALL ON FUNCTION public.calculate_community_challenge_progress(UUID, UUID) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.apply_community_challenge_progress(UUID, UUID) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.sync_community_challenge_progress_for_user(UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_community_challenges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_challenge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_challenge_progress(UUID, UUID, INTEGER) TO authenticated;
