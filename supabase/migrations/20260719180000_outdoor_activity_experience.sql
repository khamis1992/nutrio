-- Outdoor activity capture with private routes and idempotent completion.

CREATE TABLE IF NOT EXISTS public.outdoor_activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_session_id uuid NOT NULL UNIQUE REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  local_session_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('gps', 'import_gpx', 'import_tcx', 'import_fit', 'google_fit', 'health_connect', 'apple_health')),
  source_fingerprint text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('walking', 'running', 'cycling')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 604800),
  moving_seconds integer NOT NULL CHECK (moving_seconds >= 0 AND moving_seconds <= duration_seconds),
  distance_m numeric(12,2) NOT NULL DEFAULT 0 CHECK (distance_m >= 0 AND distance_m <= 1000000),
  elevation_gain_m numeric(10,2) NOT NULL DEFAULT 0 CHECK (elevation_gain_m >= 0 AND elevation_gain_m <= 50000),
  average_pace_seconds_per_km numeric(10,2),
  calories_burned integer NOT NULL DEFAULT 0 CHECK (calories_burned >= 0 AND calories_burned <= 50000),
  calorie_source text NOT NULL CHECK (calorie_source IN ('gps_met_estimate', 'heart_rate_estimate', 'device_sync', 'imported_file')),
  average_heart_rate integer CHECK (average_heart_rate BETWEEN 25 AND 260),
  max_heart_rate integer CHECK (max_heart_rate BETWEEN 25 AND 260),
  heart_rate_zones jsonb NOT NULL DEFAULT '{}'::jsonb,
  route_visibility text NOT NULL DEFAULT 'private' CHECK (route_visibility IN ('private', 'followers', 'public')),
  auto_pause_enabled boolean NOT NULL DEFAULT true,
  import_format text CHECK (import_format IN ('gpx', 'tcx', 'fit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_session_id),
  UNIQUE (user_id, source, source_fingerprint),
  CHECK (ended_at >= started_at)
);

CREATE TABLE IF NOT EXISTS public.outdoor_activity_route_points (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.outdoor_activity_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL CHECK (sequence_number >= 0),
  recorded_at timestamptz NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m numeric(8,2) CHECK (accuracy_m > 0 AND accuracy_m <= 1000),
  altitude_m numeric(10,2),
  speed_mps numeric(8,3) CHECK (speed_mps IS NULL OR speed_mps >= 0),
  heading_degrees numeric(6,2) CHECK (heading_degrees IS NULL OR heading_degrees BETWEEN 0 AND 360),
  heart_rate integer CHECK (heart_rate IS NULL OR heart_rate BETWEEN 25 AND 260),
  UNIQUE (session_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_outdoor_activity_sessions_user_started
  ON public.outdoor_activity_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_outdoor_route_points_session_sequence
  ON public.outdoor_activity_route_points(session_id, sequence_number);

ALTER TABLE public.outdoor_activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outdoor_activity_route_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outdoor_sessions_owner_read ON public.outdoor_activity_sessions;
CREATE POLICY outdoor_sessions_owner_read ON public.outdoor_activity_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS outdoor_route_points_owner_read ON public.outdoor_activity_route_points;
CREATE POLICY outdoor_route_points_owner_read ON public.outdoor_activity_route_points
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.outdoor_activity_sessions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.outdoor_activity_route_points FROM anon, authenticated;
GRANT SELECT ON public.outdoor_activity_sessions TO authenticated;
GRANT SELECT ON public.outdoor_activity_route_points TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_outdoor_activity(
  p_activity jsonb,
  p_points jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.outdoor_activity_sessions%ROWTYPE;
  v_outdoor_id uuid;
  v_workout_id uuid;
  v_source text := trim(COALESCE(p_activity->>'source', 'gps'));
  v_fingerprint text := trim(COALESCE(p_activity->>'source_fingerprint', ''));
  v_local_id text := trim(COALESCE(p_activity->>'local_session_id', ''));
  v_type text := lower(trim(COALESCE(p_activity->>'activity_type', '')));
  v_started_at timestamptz;
  v_ended_at timestamptz;
  v_duration integer;
  v_moving integer;
  v_calories integer;
  v_point_count integer;
  v_source_external_id text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF v_local_id = '' OR length(v_local_id) > 160 THEN RAISE EXCEPTION 'INVALID_LOCAL_SESSION_ID'; END IF;
  IF v_fingerprint = '' OR length(v_fingerprint) > 160 THEN RAISE EXCEPTION 'INVALID_SOURCE_FINGERPRINT'; END IF;
  IF v_type NOT IN ('walking', 'running', 'cycling') THEN RAISE EXCEPTION 'INVALID_ACTIVITY_TYPE'; END IF;
  IF v_source NOT IN ('gps', 'import_gpx', 'import_tcx', 'import_fit', 'google_fit', 'health_connect', 'apple_health') THEN
    RAISE EXCEPTION 'INVALID_ACTIVITY_SOURCE';
  END IF;
  IF jsonb_typeof(p_points) <> 'array' THEN RAISE EXCEPTION 'INVALID_ROUTE_POINTS'; END IF;

  v_point_count := jsonb_array_length(p_points);
  IF v_point_count > 20000 THEN RAISE EXCEPTION 'ROUTE_POINT_LIMIT_EXCEEDED'; END IF;
  IF v_source = 'gps' AND v_point_count < 2 THEN RAISE EXCEPTION 'ROUTE_POINTS_REQUIRED'; END IF;

  v_started_at := (p_activity->>'started_at')::timestamptz;
  v_ended_at := (p_activity->>'ended_at')::timestamptz;
  v_duration := (p_activity->>'duration_seconds')::integer;
  v_moving := COALESCE((p_activity->>'moving_seconds')::integer, v_duration);
  v_calories := COALESCE((p_activity->>'calories_burned')::integer, 0);
  IF v_ended_at < v_started_at OR v_duration <= 0 OR v_duration > 604800 THEN RAISE EXCEPTION 'INVALID_ACTIVITY_TIME'; END IF;
  IF v_moving < 0 OR v_moving > v_duration THEN RAISE EXCEPTION 'INVALID_MOVING_TIME'; END IF;

  SELECT * INTO v_existing
  FROM public.outdoor_activity_sessions
  WHERE user_id = v_user_id
    AND (local_session_id = v_local_id OR (source = v_source AND source_fingerprint = v_fingerprint))
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'deduplicated', true,
      'outdoor_session_id', v_existing.id,
      'workout_session_id', v_existing.workout_session_id
    );
  END IF;

  -- Include the user in the external key because the legacy unique index is global.
  v_source_external_id := v_user_id::text || ':' || v_fingerprint;
  INSERT INTO public.workout_sessions (
    user_id, session_date, workout_type, duration_minutes, calories_burned,
    source, source_external_id, confirmed, created_at, external_metadata
  ) VALUES (
    v_user_id,
    (v_started_at AT TIME ZONE 'Asia/Qatar')::date,
    initcap(v_type),
    GREATEST(1, round(v_moving / 60.0)::integer),
    v_calories,
    'outdoor_activity',
    v_source_external_id,
    true,
    v_started_at,
    jsonb_build_object(
      'distance_m', COALESCE((p_activity->>'distance_m')::numeric, 0),
      'calorie_source', p_activity->>'calorie_source',
      'route_visibility', COALESCE(p_activity->>'route_visibility', 'private')
    )
  )
  ON CONFLICT (source, source_external_id) DO UPDATE
    SET confirmed = true
    WHERE public.workout_sessions.user_id = v_user_id
  RETURNING id INTO v_workout_id;
  IF v_workout_id IS NULL THEN RAISE EXCEPTION 'ACTIVITY_OWNERSHIP_CONFLICT'; END IF;

  INSERT INTO public.outdoor_activity_sessions (
    user_id, workout_session_id, local_session_id, source, source_fingerprint,
    activity_type, started_at, ended_at, duration_seconds, moving_seconds,
    distance_m, elevation_gain_m, average_pace_seconds_per_km,
    calories_burned, calorie_source, average_heart_rate, max_heart_rate,
    heart_rate_zones, route_visibility, auto_pause_enabled, import_format
  ) VALUES (
    v_user_id, v_workout_id, v_local_id, v_source, v_fingerprint,
    v_type, v_started_at, v_ended_at, v_duration, v_moving,
    COALESCE((p_activity->>'distance_m')::numeric, 0),
    COALESCE((p_activity->>'elevation_gain_m')::numeric, 0),
    NULLIF(p_activity->>'average_pace_seconds_per_km', '')::numeric,
    v_calories, COALESCE(p_activity->>'calorie_source', 'gps_met_estimate'),
    NULLIF(p_activity->>'average_heart_rate', '')::integer,
    NULLIF(p_activity->>'max_heart_rate', '')::integer,
    COALESCE(p_activity->'heart_rate_zones', '{}'::jsonb),
    COALESCE(p_activity->>'route_visibility', 'private'),
    COALESCE((p_activity->>'auto_pause_enabled')::boolean, true),
    NULLIF(p_activity->>'import_format', '')
  ) RETURNING id INTO v_outdoor_id;

  INSERT INTO public.outdoor_activity_route_points (
    session_id, user_id, sequence_number, recorded_at, latitude, longitude,
    accuracy_m, altitude_m, speed_mps, heading_degrees, heart_rate
  )
  SELECT
    v_outdoor_id, v_user_id, point.ordinality - 1,
    (point.value->>'recorded_at')::timestamptz,
    (point.value->>'latitude')::double precision,
    (point.value->>'longitude')::double precision,
    NULLIF(point.value->>'accuracy', '')::numeric,
    NULLIF(point.value->>'altitude', '')::numeric,
    NULLIF(point.value->>'speed', '')::numeric,
    NULLIF(point.value->>'heading', '')::numeric,
    NULLIF(point.value->>'heart_rate', '')::integer
  FROM jsonb_array_elements(p_points) WITH ORDINALITY AS point(value, ordinality);

  RETURN jsonb_build_object(
    'success', true,
    'deduplicated', false,
    'outdoor_session_id', v_outdoor_id,
    'workout_session_id', v_workout_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_outdoor_activity(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_outdoor_activity(jsonb, jsonb) TO authenticated;

COMMENT ON COLUMN public.outdoor_activity_sessions.calorie_source IS
  'Identifies whether calories came from GPS/MET estimation, heart rate, device sync, or an imported file.';
COMMENT ON COLUMN public.outdoor_activity_sessions.route_visibility IS
  'Routes default to private and no public route-reading policy is installed.';
