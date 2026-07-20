-- Flexible adherence goals and replay-safe challenge reward compensation.

CREATE TABLE IF NOT EXISTS public.adherence_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('meal_logging', 'activity', 'water')),
  frequency_per_week INTEGER NOT NULL CHECK (frequency_per_week BETWEEN 1 AND 7),
  target_value NUMERIC NOT NULL CHECK (target_value > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric)
);

CREATE INDEX IF NOT EXISTS adherence_goals_user_active_idx
  ON public.adherence_goals (user_id, is_active, metric);

ALTER TABLE public.adherence_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_goals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.adherence_goals FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_my_adherence_goals()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  INSERT INTO public.adherence_goals (user_id, metric, frequency_per_week, target_value)
  VALUES
    (v_user_id, 'meal_logging', 5, 1),
    (v_user_id, 'activity', 3, 20),
    (v_user_id, 'water', 5, 2000)
  ON CONFLICT (user_id, metric) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_my_adherence_goal(
  p_metric TEXT,
  p_frequency_per_week INTEGER,
  p_target_value NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_goal_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_metric NOT IN ('meal_logging', 'activity', 'water') THEN
    RAISE EXCEPTION 'INVALID_ADHERENCE_METRIC';
  END IF;
  IF p_frequency_per_week NOT BETWEEN 1 AND 7 THEN
    RAISE EXCEPTION 'INVALID_WEEKLY_FREQUENCY';
  END IF;
  IF p_target_value IS NULL OR p_target_value <= 0 THEN
    RAISE EXCEPTION 'INVALID_TARGET_VALUE';
  END IF;

  INSERT INTO public.adherence_goals (
    user_id, metric, frequency_per_week, target_value, is_active, updated_at
  ) VALUES (
    v_user_id, p_metric, p_frequency_per_week, p_target_value, TRUE, now()
  )
  ON CONFLICT (user_id, metric) DO UPDATE SET
    frequency_per_week = EXCLUDED.frequency_per_week,
    target_value = EXCLUDED.target_value,
    is_active = TRUE,
    updated_at = now()
  RETURNING id INTO v_goal_id;

  RETURN v_goal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.adherence_daily_value(
  p_user_id UUID,
  p_metric TEXT,
  p_day DATE
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_metric
    WHEN 'meal_logging' THEN (
      SELECT count(DISTINCT mh.id)::NUMERIC
      FROM public.meal_history mh
      WHERE mh.user_id = p_user_id
        AND mh.logged_at >= (p_day::TIMESTAMP AT TIME ZONE 'Asia/Qatar')
        AND mh.logged_at < ((p_day + 1)::TIMESTAMP AT TIME ZONE 'Asia/Qatar')
    )
    WHEN 'activity' THEN (
      SELECT coalesce(sum(greatest(coalesce(ws.duration_minutes, 0), 0)), 0)::NUMERIC
      FROM public.workout_sessions ws
      WHERE ws.user_id = p_user_id AND ws.session_date = p_day
    )
    WHEN 'water' THEN (
      SELECT coalesce(sum(greatest(coalesce(we.amount_ml, 0), 0)), 0)::NUMERIC
      FROM public.water_entries we
      WHERE we.user_id = p_user_id AND we.log_date = p_day
    )
    ELSE 0::NUMERIC
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_adherence_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (now() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_week_start DATE;
  v_goal public.adherence_goals%ROWTYPE;
  v_completed_days INTEGER;
  v_strength INTEGER;
  v_rows JSONB := '[]'::JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_week_start := v_today - (extract(isodow FROM v_today)::INTEGER - 1);

  FOR v_goal IN
    SELECT * FROM public.adherence_goals
    WHERE user_id = v_user_id AND is_active
    ORDER BY metric
  LOOP
    SELECT count(*)::INTEGER INTO v_completed_days
    FROM generate_series(v_week_start, v_today, interval '1 day') AS day(value)
    WHERE public.adherence_daily_value(v_user_id, v_goal.metric, day.value::DATE)
      >= v_goal.target_value;

    SELECT coalesce(round(
      100 * sum(weekly.ratio * weekly.weight) / nullif(sum(weekly.weight), 0)
    ), 0)::INTEGER
    INTO v_strength
    FROM (
      SELECT
        least(
          1::NUMERIC,
          count(*) FILTER (
            WHERE evidence.day::DATE <= v_today
              AND public.adherence_daily_value(
                v_user_id,
                v_goal.metric,
                evidence.day::DATE
              ) >= v_goal.target_value
          )::NUMERIC / v_goal.frequency_per_week
        ) AS ratio,
        power(0.84::NUMERIC, age.week_age)::NUMERIC AS weight
      FROM generate_series(0, 11) AS age(week_age)
      CROSS JOIN LATERAL generate_series(
        v_week_start - (age.week_age * 7),
        v_week_start - (age.week_age * 7) + 6,
        interval '1 day'
      ) AS evidence(day)
      GROUP BY age.week_age
    ) weekly;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'id', v_goal.id,
      'metric', v_goal.metric,
      'frequency_per_week', v_goal.frequency_per_week,
      'target_value', v_goal.target_value,
      'completed_days', v_completed_days,
      'remaining_days', greatest(v_goal.frequency_per_week - v_completed_days, 0),
      'strength', least(greatest(coalesce(v_strength, 0), 0), 100),
      'reason_code', CASE
        WHEN v_completed_days >= v_goal.frequency_per_week THEN 'on_track'
        WHEN coalesce(v_strength, 0) >= 70 THEN 'strong_history'
        WHEN coalesce(v_strength, 0) >= 35 THEN 'building'
        ELSE 'getting_started'
      END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'week_start', v_week_start,
    'today', v_today,
    'goals', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_adherence_goals() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_my_adherence_goal(TEXT, INTEGER, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adherence_daily_value(UUID, TEXT, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_adherence_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_adherence_goals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_my_adherence_goal(TEXT, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_adherence_summary() TO authenticated;

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS completion_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_source_id TEXT,
  ADD COLUMN IF NOT EXISTS reward_xp_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_reversed_at TIMESTAMPTZ;

UPDATE public.challenge_participants participant
SET completion_version = greatest(participant.completion_version, 1),
    reward_source_id = coalesce(participant.reward_source_id, participant.challenge_id::TEXT),
    reward_xp_amount = CASE
      WHEN participant.reward_xp_amount <> 0 THEN participant.reward_xp_amount
      ELSE coalesce(challenge.xp_reward, challenge.reward_points, 100)
    END
FROM public.community_challenges challenge
WHERE challenge.id = participant.challenge_id
  AND participant.completed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rebuild_xp_profile_from_ledger(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining INTEGER;
  v_level INTEGER := 1;
  v_threshold INTEGER := 100;
BEGIN
  SELECT greatest(coalesce(sum(xp_amount), 0), 0)::INTEGER INTO v_remaining
  FROM public.xp_transactions WHERE user_id = p_user_id;

  WHILE v_remaining >= v_threshold LOOP
    v_remaining := v_remaining - v_threshold;
    v_level := v_level + 1;
    v_threshold := greatest(100, v_level * 100);
  END LOOP;

  UPDATE public.profiles SET xp = v_remaining, level = v_level
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_community_challenge_progress(
  p_user_id UUID,
  p_challenge_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant public.challenge_participants%ROWTYPE;
  v_challenge public.community_challenges%ROWTYPE;
  v_progress INTEGER;
  v_new_progress INTEGER;
  v_reward_version INTEGER;
  v_reward_source TEXT;
  v_reward_amount INTEGER;
  v_xp_result JSONB := NULL;
BEGIN
  SELECT * INTO v_participant
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not participating in this challenge');
  END IF;

  SELECT * INTO v_challenge FROM public.community_challenges
  WHERE id = p_challenge_id AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge not found or inactive');
  END IF;

  v_progress := public.calculate_community_challenge_progress(p_user_id, p_challenge_id);
  v_new_progress := least(greatest(v_progress, 0), greatest(coalesce(v_challenge.target_value, 0), 0));

  IF v_challenge.target_value > 0
     AND v_new_progress >= v_challenge.target_value
     AND v_participant.completed_at IS NULL THEN
    v_reward_version := v_participant.completion_version + 1;
    v_reward_source := p_challenge_id::TEXT || ':v' || v_reward_version;
    v_reward_amount := coalesce(v_challenge.xp_reward, v_challenge.reward_points, 100);

    IF v_reward_amount > 0 THEN
      v_xp_result := public.award_xp(
        p_user_id, v_reward_amount,
        'Community challenge completed: ' || coalesce(v_challenge.title, 'Challenge'),
        'community_challenge_complete', v_reward_source,
        jsonb_build_object('challenge_id', p_challenge_id, 'completion_version', v_reward_version)
      );
    END IF;

    UPDATE public.challenge_participants SET
      current_progress = v_new_progress,
      completed_at = now(),
      completion_version = v_reward_version,
      reward_source_id = v_reward_source,
      reward_xp_amount = v_reward_amount,
      reward_reversed_at = NULL,
      updated_at = now()
    WHERE id = v_participant.id;

  ELSIF (v_challenge.target_value <= 0 OR v_new_progress < v_challenge.target_value)
     AND v_participant.completed_at IS NOT NULL THEN
    IF v_participant.reward_xp_amount > 0 AND v_participant.reward_source_id IS NOT NULL THEN
      v_xp_result := public.award_xp(
        p_user_id, -v_participant.reward_xp_amount,
        'Community challenge evidence reversed: ' || coalesce(v_challenge.title, 'Challenge'),
        'community_challenge_reversed', v_participant.reward_source_id,
        jsonb_build_object(
          'challenge_id', p_challenge_id,
          'completion_version', v_participant.completion_version,
          'compensates_action', 'community_challenge_complete'
        )
      );
      PERFORM public.rebuild_xp_profile_from_ledger(p_user_id);
    END IF;

    UPDATE public.challenge_participants SET
      current_progress = v_new_progress,
      completed_at = NULL,
      reward_reversed_at = now(),
      updated_at = now()
    WHERE id = v_participant.id;
  ELSE
    UPDATE public.challenge_participants SET
      current_progress = v_new_progress,
      updated_at = now()
    WHERE id = v_participant.id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'completed', v_challenge.target_value > 0 AND v_new_progress >= v_challenge.target_value,
    'progress', v_new_progress,
    'target', v_challenge.target_value,
    'reward_version', coalesce(v_reward_version, v_participant.completion_version),
    'xp', v_xp_result,
    'reason_code', CASE lower(coalesce(v_challenge.challenge_type, ''))
      WHEN 'meals' THEN 'verified_meal_logs'
      WHEN 'meal_logging' THEN 'verified_meal_logs'
      WHEN 'activity' THEN 'verified_activity_days'
      WHEN 'workout' THEN 'verified_activity_days'
      WHEN 'water' THEN 'verified_hydration_days'
      WHEN 'hydration' THEN 'verified_hydration_days'
      ELSE 'verified_challenge_evidence'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_xp_profile_from_ledger(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_community_challenge_progress(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.adherence_goals IS
  'Private weekly-frequency goals. Progress is derived from trusted Nutrio evidence tables.';
COMMENT ON COLUMN public.challenge_participants.reward_source_id IS
  'Versioned XP ledger source used to make completion and reversal replay-safe.';
