-- One auditable daily decision across workout, nutrition, recovery, and coach direction.

CREATE TABLE IF NOT EXISTS public.coach_performance_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 2 AND 500),
  calorie_min INTEGER CHECK (calorie_min IS NULL OR calorie_min BETWEEN 800 AND 6000),
  calorie_max INTEGER CHECK (calorie_max IS NULL OR calorie_max BETWEEN 800 AND 6000),
  protein_min_g INTEGER CHECK (protein_min_g IS NULL OR protein_min_g BETWEEN 0 AND 400),
  carbs_target_g INTEGER CHECK (carbs_target_g IS NULL OR carbs_target_g BETWEEN 0 AND 800),
  hydration_min_ml INTEGER CHECK (hydration_min_ml IS NULL OR hydration_min_ml BETWEEN 500 AND 8000),
  carb_focus TEXT NOT NULL DEFAULT 'balanced'
    CHECK (carb_focus IN ('none', 'balanced', 'pre_workout', 'post_workout')),
  workout_intensity_cap INTEGER CHECK (
    workout_intensity_cap IS NULL OR workout_intensity_cap BETWEEN 30 AND 100
  ),
  excluded_meal_types TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  priority SMALLINT NOT NULL DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from),
  CHECK (calorie_min IS NULL OR calorie_max IS NULL OR calorie_min <= calorie_max),
  CHECK (excluded_meal_types <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack']::TEXT[])
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_performance_directives_one_active_idx
  ON public.coach_performance_directives (coach_id, client_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS coach_performance_directives_client_window_idx
  ON public.coach_performance_directives (client_id, valid_from DESC, valid_until DESC)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.daily_performance_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_date DATE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  decision_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('train', 'recover', 'rest')),
  confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('low', 'medium', 'high')),
  workout_program_id UUID REFERENCES public.coach_programs(id) ON DELETE SET NULL,
  workout_day_id UUID REFERENCES public.program_workout_days(id) ON DELETE SET NULL,
  workout_title TEXT,
  workout_day_type TEXT CHECK (
    workout_day_type IS NULL OR workout_day_type IN ('workout', 'rest', 'recovery')
  ),
  workout_intensity_percent INTEGER NOT NULL DEFAULT 0
    CHECK (workout_intensity_percent BETWEEN 0 AND 100),
  exercise_count INTEGER NOT NULL DEFAULT 0 CHECK (exercise_count >= 0),
  calorie_min INTEGER NOT NULL CHECK (calorie_min BETWEEN 0 AND 10000),
  calorie_max INTEGER NOT NULL CHECK (calorie_max BETWEEN 0 AND 10000),
  protein_min_g INTEGER NOT NULL CHECK (protein_min_g BETWEEN 0 AND 600),
  carbs_target_g INTEGER NOT NULL CHECK (carbs_target_g BETWEEN 0 AND 1000),
  hydration_min_ml INTEGER NOT NULL CHECK (hydration_min_ml BETWEEN 0 AND 10000),
  carb_focus TEXT NOT NULL CHECK (
    carb_focus IN ('none', 'balanced', 'pre_workout', 'post_workout')
  ),
  meal_calorie_min INTEGER NOT NULL CHECK (meal_calorie_min BETWEEN 0 AND 3000),
  meal_calorie_max INTEGER NOT NULL CHECK (meal_calorie_max BETWEEN 0 AND 3000),
  meal_protein_min_g INTEGER NOT NULL CHECK (meal_protein_min_g BETWEEN 0 AND 250),
  excluded_meal_types TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  coach_directive_id UUID REFERENCES public.coach_performance_directives(id) ON DELETE SET NULL,
  coach_message TEXT,
  recommended_meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL,
  recommendation_source TEXT,
  reasons JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(reasons) = 'array'),
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(evidence) = 'object'),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, decision_date),
  CHECK (calorie_min <= calorie_max),
  CHECK (meal_calorie_min <= meal_calorie_max)
);

CREATE INDEX IF NOT EXISTS daily_performance_decisions_user_date_idx
  ON public.daily_performance_decisions (user_id, decision_date DESC);
CREATE INDEX IF NOT EXISTS daily_performance_decisions_directive_idx
  ON public.daily_performance_decisions (coach_directive_id)
  WHERE coach_directive_id IS NOT NULL;

ALTER TABLE public.coach_performance_directives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_performance_directives FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_performance_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_performance_decisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_performance_directives FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.daily_performance_decisions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.coach_performance_directives TO service_role;
GRANT ALL ON public.daily_performance_decisions TO service_role;

CREATE OR REPLACE FUNCTION public.is_active_performance_coach(
  p_coach_id UUID,
  p_client_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_client_assignments assignment
    WHERE assignment.coach_id = p_coach_id
      AND assignment.client_id = p_client_id
      AND assignment.status = 'active'
  );
$$;

-- Forward declaration: coach write RPCs refresh the decision immediately. The
-- complete implementation below replaces this body before any grants are made.
CREATE OR REPLACE FUNCTION public.resolve_daily_performance_decision_internal(
  p_user_id UUID,
  p_decision_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'PERFORMANCE_RESOLVER_NOT_READY';
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_coach_performance_directive(
  p_client_id UUID,
  p_directive_id UUID DEFAULT NULL,
  p_message TEXT DEFAULT '',
  p_calorie_min INTEGER DEFAULT NULL,
  p_calorie_max INTEGER DEFAULT NULL,
  p_protein_min_g INTEGER DEFAULT NULL,
  p_carbs_target_g INTEGER DEFAULT NULL,
  p_hydration_min_ml INTEGER DEFAULT NULL,
  p_carb_focus TEXT DEFAULT 'balanced',
  p_workout_intensity_cap INTEGER DEFAULT NULL,
  p_excluded_meal_types TEXT[] DEFAULT '{}'::TEXT[],
  p_priority SMALLINT DEFAULT 50,
  p_valid_from TIMESTAMPTZ DEFAULT now(),
  p_valid_until TIMESTAMPTZ DEFAULT (now() + interval '7 days')
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coach_id UUID := auth.uid();
  v_directive public.coach_performance_directives%ROWTYPE;
BEGIN
  IF v_coach_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.is_active_performance_coach(v_coach_id, p_client_id) THEN
    RAISE EXCEPTION 'ACTIVE_COACH_ASSIGNMENT_REQUIRED';
  END IF;
  IF char_length(btrim(COALESCE(p_message, ''))) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'INVALID_DIRECTIVE_MESSAGE';
  END IF;
  IF p_valid_until <= now()
     OR p_valid_until <= p_valid_from
     OR p_valid_until > p_valid_from + interval '90 days' THEN
    RAISE EXCEPTION 'INVALID_DIRECTIVE_WINDOW';
  END IF;
  IF p_calorie_min IS NOT NULL AND p_calorie_max IS NOT NULL
     AND p_calorie_min > p_calorie_max THEN
    RAISE EXCEPTION 'INVALID_CALORIE_RANGE';
  END IF;
  IF p_carb_focus NOT IN ('none', 'balanced', 'pre_workout', 'post_workout') THEN
    RAISE EXCEPTION 'INVALID_CARB_FOCUS';
  END IF;
  IF NOT COALESCE(p_excluded_meal_types, '{}'::TEXT[])
    <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack']::TEXT[] THEN
    RAISE EXCEPTION 'INVALID_EXCLUDED_MEAL_TYPE';
  END IF;

  IF p_directive_id IS NULL THEN
    UPDATE public.coach_performance_directives
    SET status = 'archived', updated_at = now()
    WHERE coach_id = v_coach_id AND client_id = p_client_id AND status = 'active';

    INSERT INTO public.coach_performance_directives (
      coach_id, client_id, message, calorie_min, calorie_max, protein_min_g,
      carbs_target_g, hydration_min_ml, carb_focus, workout_intensity_cap,
      excluded_meal_types, priority, valid_from, valid_until
    ) VALUES (
      v_coach_id, p_client_id, btrim(p_message), p_calorie_min, p_calorie_max,
      p_protein_min_g, p_carbs_target_g, p_hydration_min_ml, p_carb_focus,
      p_workout_intensity_cap, COALESCE(p_excluded_meal_types, '{}'::TEXT[]),
      p_priority, p_valid_from, p_valid_until
    ) RETURNING * INTO v_directive;
  ELSE
    SELECT * INTO v_directive
    FROM public.coach_performance_directives
    WHERE id = p_directive_id AND coach_id = v_coach_id AND client_id = p_client_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'DIRECTIVE_NOT_FOUND'; END IF;

    UPDATE public.coach_performance_directives
    SET status = 'archived', updated_at = now()
    WHERE coach_id = v_coach_id
      AND client_id = p_client_id
      AND status = 'active'
      AND id <> p_directive_id;

    UPDATE public.coach_performance_directives SET
      message = btrim(p_message), calorie_min = p_calorie_min,
      calorie_max = p_calorie_max, protein_min_g = p_protein_min_g,
      carbs_target_g = p_carbs_target_g, hydration_min_ml = p_hydration_min_ml,
      carb_focus = p_carb_focus, workout_intensity_cap = p_workout_intensity_cap,
      excluded_meal_types = COALESCE(p_excluded_meal_types, '{}'::TEXT[]),
      priority = p_priority, valid_from = p_valid_from, valid_until = p_valid_until,
      status = 'active', version = version + 1, updated_at = now()
    WHERE id = p_directive_id
    RETURNING * INTO v_directive;
  END IF;

  INSERT INTO public.coach_messages (coach_id, client_id, sender_role, message)
  VALUES (v_coach_id, p_client_id, 'coach', v_directive.message);

  PERFORM public.resolve_daily_performance_decision_internal(
    p_client_id,
    (now() AT TIME ZONE 'Asia/Qatar')::DATE
  );
  RETURN to_jsonb(v_directive);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_coach_performance_directive(p_directive_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coach_id UUID := auth.uid();
  v_client_id UUID;
BEGIN
  IF v_coach_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  UPDATE public.coach_performance_directives
  SET status = 'archived', updated_at = now()
  WHERE id = p_directive_id AND coach_id = v_coach_id AND status = 'active'
  RETURNING client_id INTO v_client_id;
  IF v_client_id IS NULL THEN RETURN FALSE; END IF;
  PERFORM public.resolve_daily_performance_decision_internal(
    v_client_id,
    (now() AT TIME ZONE 'Asia/Qatar')::DATE
  );
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_daily_performance_decision_internal(
  p_user_id UUID,
  p_decision_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_snapshot public.daily_performance_snapshots%ROWTYPE;
  v_health public.health_daily_metrics%ROWTYPE;
  v_directive public.coach_performance_directives%ROWTYPE;
  v_program_id UUID;
  v_program_title TEXT;
  v_program_start DATE;
  v_program_days SMALLINT;
  v_day_id UUID;
  v_day_number INTEGER;
  v_day_title TEXT;
  v_day_type TEXT;
  v_exercise_count INTEGER := 0;
  v_calorie_target INTEGER := 2000;
  v_protein_target INTEGER := 120;
  v_carbs_target INTEGER := 250;
  v_calories_consumed INTEGER := 0;
  v_protein_consumed INTEGER := 0;
  v_water_ml INTEGER := 0;
  v_readiness INTEGER;
  v_readiness_weight NUMERIC := 0;
  v_readiness_total NUMERIC := 0;
  v_mode TEXT;
  v_intensity INTEGER;
  v_calorie_min INTEGER;
  v_calorie_max INTEGER;
  v_protein_min INTEGER;
  v_hydration_min INTEGER;
  v_carb_focus TEXT;
  v_meal_calorie_min INTEGER;
  v_meal_calorie_max INTEGER;
  v_meal_protein_min INTEGER;
  v_confidence INTEGER := 25;
  v_confidence_level TEXT;
  v_reasons JSONB := '[]'::JSONB;
  v_evidence JSONB;
  v_hash TEXT;
  v_result public.daily_performance_decisions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'USER_REQUIRED'; END IF;
  IF p_decision_date < v_today - 30 OR p_decision_date > v_today + 14 THEN
    RAISE EXCEPTION 'DECISION_DATE_OUT_OF_RANGE';
  END IF;

  SELECT * INTO v_snapshot
  FROM public.daily_performance_snapshots
  WHERE user_id = p_user_id AND snapshot_date = p_decision_date;

  IF FOUND THEN
    v_calorie_target := COALESCE(NULLIF(v_snapshot.calorie_target, 0), v_calorie_target);
    v_protein_target := COALESCE(NULLIF(v_snapshot.protein_target_g, 0), v_protein_target);
    v_calories_consumed := COALESCE(v_snapshot.calories_consumed, 0);
    v_protein_consumed := COALESCE(v_snapshot.protein_consumed_g, 0);
    v_confidence := v_confidence + 25;
  ELSE
    SELECT
      COALESCE(ng.daily_calorie_target, 2000),
      COALESCE(ng.protein_target_g, 120),
      COALESCE(ng.carbs_target_g, 250)
    INTO v_calorie_target, v_protein_target, v_carbs_target
    FROM public.nutrition_goals ng
    WHERE ng.user_id = p_user_id AND COALESCE(ng.is_active, TRUE)
    ORDER BY ng.updated_at DESC NULLS LAST, ng.created_at DESC NULLS LAST
    LIMIT 1;

    v_calorie_target := COALESCE(v_calorie_target, 2000);
    v_protein_target := COALESCE(v_protein_target, 120);
    v_carbs_target := COALESCE(v_carbs_target, 250);

    SELECT COALESCE(round(sum(mh.calories)), 0)::INTEGER,
           COALESCE(round(sum(mh.protein_g)), 0)::INTEGER
    INTO v_calories_consumed, v_protein_consumed
    FROM public.meal_history mh
    WHERE mh.user_id = p_user_id
      AND mh.logged_at >= (p_decision_date::TIMESTAMP AT TIME ZONE 'Asia/Qatar')
      AND mh.logged_at < ((p_decision_date + 1)::TIMESTAMP AT TIME ZONE 'Asia/Qatar');
  END IF;

  SELECT COALESCE(ng.carbs_target_g, v_carbs_target)
  INTO v_carbs_target
  FROM public.nutrition_goals ng
  WHERE ng.user_id = p_user_id AND COALESCE(ng.is_active, TRUE)
  ORDER BY ng.updated_at DESC NULLS LAST, ng.created_at DESC NULLS LAST
  LIMIT 1;

  v_carbs_target := COALESCE(v_carbs_target, 250);

  SELECT COALESCE(sum(we.amount_ml), 0)::INTEGER INTO v_water_ml
  FROM public.water_entries we
  WHERE we.user_id = p_user_id AND we.log_date = p_decision_date;

  SELECT * INTO v_health
  FROM public.health_daily_metrics
  WHERE user_id = p_user_id AND metric_date <= p_decision_date
  ORDER BY metric_date DESC
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(v_health.sleep_minutes, 0) > 0 THEN
      v_readiness_total := v_readiness_total
        + LEAST(100, v_health.sleep_minutes::NUMERIC * 100 / 480) * 0.65;
      v_readiness_weight := v_readiness_weight + 0.65;
    END IF;
    IF COALESCE(v_health.hrv, 0) > 0 THEN
      v_readiness_total := v_readiness_total + LEAST(100, v_health.hrv * 100 / 60) * 0.20;
      v_readiness_weight := v_readiness_weight + 0.20;
    END IF;
    IF COALESCE(v_health.resting_heart_rate, 0) > 0 THEN
      v_readiness_total := v_readiness_total + CASE
        WHEN v_health.resting_heart_rate <= 60 THEN 100
        WHEN v_health.resting_heart_rate <= 75 THEN 75
        WHEN v_health.resting_heart_rate <= 90 THEN 50
        ELSE 30 END * 0.15;
      v_readiness_weight := v_readiness_weight + 0.15;
    END IF;
    IF v_readiness_weight > 0 THEN
      v_readiness := round(v_readiness_total / v_readiness_weight)::INTEGER;
      v_confidence := v_confidence + CASE
        WHEN v_health.metric_date = p_decision_date THEN 25 ELSE 10 END;
    END IF;
  END IF;

  SELECT program.id, program.title, program.start_date, program.days_per_week
  INTO v_program_id, v_program_title, v_program_start, v_program_days
  FROM public.coach_programs program
  WHERE program.client_id = p_user_id
    AND program.type = 'workout_plan'
    AND program.status = 'active'
    AND p_decision_date BETWEEN program.start_date AND program.end_date
  ORDER BY program.start_date DESC, program.created_at DESC
  LIMIT 1;

  IF v_program_id IS NOT NULL THEN
    SELECT day.id, day.day_number, day.title, day.day_type
    INTO v_day_id, v_day_number, v_day_title, v_day_type
    FROM public.program_workout_days day
    WHERE day.program_id = v_program_id
      AND (
        day.preferred_weekday = extract(dow FROM p_decision_date)::INTEGER
        OR day.day_number = mod(p_decision_date - v_program_start, GREATEST(v_program_days, 1)) + 1
      )
    ORDER BY (day.preferred_weekday = extract(dow FROM p_decision_date)::INTEGER) DESC,
             day.day_number
    LIMIT 1;

    IF v_day_id IS NULL THEN
      v_day_title := v_program_title;
      v_day_type := 'workout';
      v_day_number := mod(p_decision_date - v_program_start, GREATEST(v_program_days, 1)) + 1;
    END IF;
    SELECT count(*)::INTEGER INTO v_exercise_count
    FROM public.program_exercises exercise
    WHERE exercise.program_id = v_program_id AND exercise.day_number = v_day_number;
    v_confidence := v_confidence + 10;
  END IF;

  SELECT * INTO v_directive
  FROM public.coach_performance_directives directive
  WHERE directive.client_id = p_user_id
    AND directive.status = 'active'
    AND p_decision_date >= (directive.valid_from AT TIME ZONE 'Asia/Qatar')::DATE
    AND p_decision_date <= (directive.valid_until AT TIME ZONE 'Asia/Qatar')::DATE
  ORDER BY directive.priority DESC, directive.updated_at DESC
  LIMIT 1;
  IF FOUND THEN v_confidence := v_confidence + 10; END IF;

  v_mode := CASE
    WHEN v_day_type = 'rest' THEN 'rest'
    WHEN v_day_type = 'recovery' THEN 'recover'
    WHEN v_readiness IS NOT NULL AND v_readiness < 55 THEN 'recover'
    WHEN v_day_type = 'workout' THEN 'train'
    WHEN v_readiness IS NOT NULL AND v_readiness < 55 THEN 'recover'
    ELSE 'rest'
  END;
  v_intensity := CASE v_mode WHEN 'train' THEN 100 WHEN 'recover' THEN 60 ELSE 0 END;
  IF v_directive.id IS NOT NULL AND v_directive.workout_intensity_cap IS NOT NULL THEN
    v_intensity := LEAST(v_intensity, v_directive.workout_intensity_cap);
  END IF;

  v_calorie_min := COALESCE(v_directive.calorie_min, round(v_calorie_target * 0.85));
  v_calorie_max := COALESCE(v_directive.calorie_max, round(v_calorie_target * 1.10));
  v_protein_min := GREATEST(round(v_protein_target * 0.85), COALESCE(v_directive.protein_min_g, 0));
  v_carbs_target := COALESCE(v_directive.carbs_target_g, v_carbs_target);
  v_hydration_min := COALESCE(v_directive.hydration_min_ml, 2500);
  v_carb_focus := COALESCE(
    v_directive.carb_focus,
    CASE WHEN v_mode = 'train' THEN 'post_workout' ELSE 'balanced' END
  );
  v_meal_calorie_max := LEAST(650, GREATEST(250, v_calorie_max - v_calories_consumed));
  v_meal_calorie_min := GREATEST(200, v_meal_calorie_max - 220);
  v_meal_protein_min := LEAST(50, GREATEST(20, v_protein_min - v_protein_consumed));

  IF v_program_id IS NOT NULL THEN
    v_reasons := v_reasons || jsonb_build_array('planned_workout');
  ELSE
    v_reasons := v_reasons || jsonb_build_array('no_planned_workout');
  END IF;
  IF v_readiness IS NULL THEN
    v_reasons := v_reasons || jsonb_build_array('missing_recovery_data');
  ELSIF v_readiness < 55 THEN
    v_reasons := v_reasons || jsonb_build_array('low_readiness_reduced_load');
  ELSE
    v_reasons := v_reasons || jsonb_build_array('readiness_supports_plan');
  END IF;
  IF v_protein_consumed < v_protein_min THEN
    v_reasons := v_reasons || jsonb_build_array('protein_gap');
  END IF;
  IF v_water_ml < v_hydration_min THEN
    v_reasons := v_reasons || jsonb_build_array('hydration_gap');
  END IF;
  IF v_directive.id IS NOT NULL THEN
    v_reasons := v_reasons || jsonb_build_array('coach_limits_applied');
  END IF;

  v_confidence := LEAST(100, GREATEST(0, v_confidence));
  v_confidence_level := CASE WHEN v_confidence >= 75 THEN 'high'
    WHEN v_confidence >= 50 THEN 'medium' ELSE 'low' END;
  v_evidence := jsonb_build_object(
    'snapshot_updated_at', v_snapshot.updated_at,
    'health_metric_date', v_health.metric_date,
    'health_synced_at', v_health.synced_at,
    'readiness_score', v_readiness,
    'calories_consumed', v_calories_consumed,
    'protein_consumed_g', v_protein_consumed,
    'water_consumed_ml', v_water_ml,
    'calorie_target', v_calorie_target,
    'protein_target_g', v_protein_target,
    'workout_program_id', v_program_id,
    'workout_day_id', v_day_id,
    'workout_day_number', v_day_number,
    'coach_directive_version', v_directive.version
  );
  v_hash := md5(jsonb_build_object(
    'mode', v_mode, 'readiness', v_readiness, 'program', v_program_id,
    'day', v_day_id, 'intensity', v_intensity, 'calorie_min', v_calorie_min,
    'calorie_max', v_calorie_max, 'protein_min', v_protein_min,
    'carbs_target', v_carbs_target, 'hydration_min', v_hydration_min,
    'carb_focus', v_carb_focus, 'meal_calorie_min', v_meal_calorie_min,
    'meal_calorie_max', v_meal_calorie_max, 'meal_protein_min', v_meal_protein_min,
    'directive', v_directive.id, 'directive_version', v_directive.version,
    'reasons', v_reasons
  )::TEXT);

  INSERT INTO public.daily_performance_decisions (
    user_id, decision_date, decision_hash, mode, confidence_score,
    confidence_level, workout_program_id, workout_day_id, workout_title,
    workout_day_type, workout_intensity_percent, exercise_count, calorie_min,
    calorie_max, protein_min_g, carbs_target_g, hydration_min_ml, carb_focus,
    meal_calorie_min, meal_calorie_max, meal_protein_min_g, excluded_meal_types,
    coach_directive_id, coach_message, reasons, evidence, expires_at
  ) VALUES (
    p_user_id, p_decision_date, v_hash, v_mode, v_confidence,
    v_confidence_level, v_program_id, v_day_id, v_day_title, v_day_type,
    v_intensity, v_exercise_count, v_calorie_min, v_calorie_max, v_protein_min,
    v_carbs_target, v_hydration_min, v_carb_focus, v_meal_calorie_min,
    v_meal_calorie_max, v_meal_protein_min,
    COALESCE(v_directive.excluded_meal_types, '{}'::TEXT[]), v_directive.id,
    v_directive.message, v_reasons, v_evidence,
    ((p_decision_date + 1)::TIMESTAMP AT TIME ZONE 'Asia/Qatar')
  )
  ON CONFLICT (user_id, decision_date) DO UPDATE SET
    version = CASE
      WHEN daily_performance_decisions.decision_hash IS DISTINCT FROM EXCLUDED.decision_hash
      THEN daily_performance_decisions.version + 1
      ELSE daily_performance_decisions.version END,
    decision_hash = EXCLUDED.decision_hash, mode = EXCLUDED.mode,
    confidence_score = EXCLUDED.confidence_score,
    confidence_level = EXCLUDED.confidence_level,
    workout_program_id = EXCLUDED.workout_program_id,
    workout_day_id = EXCLUDED.workout_day_id,
    workout_title = EXCLUDED.workout_title,
    workout_day_type = EXCLUDED.workout_day_type,
    workout_intensity_percent = EXCLUDED.workout_intensity_percent,
    exercise_count = EXCLUDED.exercise_count, calorie_min = EXCLUDED.calorie_min,
    calorie_max = EXCLUDED.calorie_max, protein_min_g = EXCLUDED.protein_min_g,
    carbs_target_g = EXCLUDED.carbs_target_g,
    hydration_min_ml = EXCLUDED.hydration_min_ml, carb_focus = EXCLUDED.carb_focus,
    meal_calorie_min = EXCLUDED.meal_calorie_min,
    meal_calorie_max = EXCLUDED.meal_calorie_max,
    meal_protein_min_g = EXCLUDED.meal_protein_min_g,
    excluded_meal_types = EXCLUDED.excluded_meal_types,
    coach_directive_id = EXCLUDED.coach_directive_id,
    coach_message = EXCLUDED.coach_message, reasons = EXCLUDED.reasons,
    evidence = EXCLUDED.evidence,
    recommended_meal_id = CASE
      WHEN daily_performance_decisions.decision_hash = EXCLUDED.decision_hash
      THEN daily_performance_decisions.recommended_meal_id ELSE NULL END,
    recommendation_source = CASE
      WHEN daily_performance_decisions.decision_hash = EXCLUDED.decision_hash
      THEN daily_performance_decisions.recommendation_source ELSE NULL END,
    expires_at = EXCLUDED.expires_at, updated_at = now()
  RETURNING * INTO v_result;

  RETURN to_jsonb(v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_daily_performance_decision(
  p_decision_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_date DATE := COALESCE(p_decision_date, (now() AT TIME ZONE 'Asia/Qatar')::DATE);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  RETURN public.resolve_daily_performance_decision_internal(v_user_id, v_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_client_daily_performance_decision(
  p_client_id UUID,
  p_decision_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coach_id UUID := auth.uid();
  v_date DATE := COALESCE(p_decision_date, (now() AT TIME ZONE 'Asia/Qatar')::DATE);
BEGIN
  IF v_coach_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.is_active_performance_coach(v_coach_id, p_client_id) THEN
    RAISE EXCEPTION 'ACTIVE_COACH_ASSIGNMENT_REQUIRED';
  END IF;
  RETURN public.resolve_daily_performance_decision_internal(p_client_id, v_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_coach_performance_directive(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coach_id UUID := auth.uid();
  v_directive public.coach_performance_directives%ROWTYPE;
BEGIN
  IF v_coach_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.is_active_performance_coach(v_coach_id, p_client_id) THEN
    RAISE EXCEPTION 'ACTIVE_COACH_ASSIGNMENT_REQUIRED';
  END IF;
  SELECT * INTO v_directive
  FROM public.coach_performance_directives
  WHERE coach_id = v_coach_id
    AND client_id = p_client_id
    AND status = 'active'
    AND now() BETWEEN valid_from AND valid_until
  ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_directive);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_daily_performance_meal(
  p_decision_date DATE,
  p_meal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_decision public.daily_performance_decisions%ROWTYPE;
  v_meal public.meals%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT * INTO v_decision FROM public.daily_performance_decisions
  WHERE user_id = v_user_id AND decision_date = p_decision_date FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.resolve_daily_performance_decision_internal(v_user_id, p_decision_date);
    SELECT * INTO v_decision FROM public.daily_performance_decisions
    WHERE user_id = v_user_id AND decision_date = p_decision_date FOR UPDATE;
  END IF;

  SELECT * INTO v_meal FROM public.meals
  WHERE id = p_meal_id AND COALESCE(is_available, TRUE) = TRUE
    AND COALESCE(approval_status, 'approved') = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'MEAL_UNAVAILABLE'; END IF;
  IF (CASE WHEN v_meal.meal_type = 'snacks' THEN 'snack'
           ELSE COALESCE(v_meal.meal_type, '') END) = ANY(v_decision.excluded_meal_types) THEN
    RAISE EXCEPTION 'MEAL_TYPE_EXCLUDED_BY_COACH';
  END IF;
  IF COALESCE(v_meal.calories, 0) NOT BETWEEN v_decision.meal_calorie_min AND v_decision.meal_calorie_max
     OR COALESCE(v_meal.protein_g, 0) < v_decision.meal_protein_min_g THEN
    RAISE EXCEPTION 'MEAL_OUTSIDE_PERFORMANCE_ENVELOPE';
  END IF;

  UPDATE public.daily_performance_decisions
  SET recommended_meal_id = p_meal_id,
      recommendation_source = 'meal_ranking_v2', updated_at = now()
  WHERE id = v_decision.id RETURNING * INTO v_decision;
  RETURN to_jsonb(v_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.is_active_performance_coach(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_daily_performance_decision_internal(UUID, DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_coach_performance_directive(
  UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT,
  INTEGER, TEXT[], SMALLINT, TIMESTAMPTZ, TIMESTAMPTZ
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_coach_performance_directive(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_daily_performance_decision(DATE)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_client_daily_performance_decision(UUID, DATE)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_coach_performance_directive(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_daily_performance_meal(DATE, UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.upsert_coach_performance_directive(
  UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT,
  INTEGER, TEXT[], SMALLINT, TIMESTAMPTZ, TIMESTAMPTZ
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_coach_performance_directive(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_daily_performance_decision(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_daily_performance_decision(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coach_performance_directive(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_daily_performance_meal(DATE, UUID) TO authenticated;

COMMENT ON TABLE public.coach_performance_directives IS
  'Structured, time-bounded coach constraints used by the daily performance resolver.';
COMMENT ON TABLE public.daily_performance_decisions IS
  'One versioned server-derived decision joining workout, nutrition, recovery, and coach direction.';
