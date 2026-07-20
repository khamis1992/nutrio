BEGIN;

-- Delivery is a logistics fact. Nutrition is applied only after the customer
-- records what was actually consumed.

CREATE OR REPLACE FUNCTION public.get_meal_nutrition_snapshot(p_meal_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'meal_id', m.id,
    'meal_name', m.name,
    'image_url', m.image_url,
    'calories', COALESCE(m.calories, 0),
    'protein_g', COALESCE(m.protein_g, m.protein, 0),
    'carbs_g', COALESCE(m.carbs_g, m.carbs, 0),
    'fat_g', COALESCE(m.fat_g, m.fats, 0),
    'fiber_g', COALESCE(m.fiber_g, 0),
    'captured_at', NOW()
  )
  FROM public.meals m
  WHERE m.id = p_meal_id;
$$;

REVOKE ALL ON FUNCTION public.get_meal_nutrition_snapshot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_meal_nutrition_snapshot(UUID) TO service_role;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS nutrition_snapshot JSONB;

ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS nutrition_snapshot JSONB;

UPDATE public.order_items oi
SET nutrition_snapshot = public.get_meal_nutrition_snapshot(oi.meal_id)
WHERE oi.meal_id IS NOT NULL
  AND oi.nutrition_snapshot IS NULL;

UPDATE public.meal_schedules ms
SET nutrition_snapshot = public.get_meal_nutrition_snapshot(ms.meal_id)
WHERE ms.meal_id IS NOT NULL
  AND ms.nutrition_snapshot IS NULL;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_nutrition_snapshot_object,
  ADD CONSTRAINT order_items_nutrition_snapshot_object
    CHECK (nutrition_snapshot IS NULL OR jsonb_typeof(nutrition_snapshot) = 'object');

ALTER TABLE public.meal_schedules
  DROP CONSTRAINT IF EXISTS meal_schedules_nutrition_snapshot_object,
  ADD CONSTRAINT meal_schedules_nutrition_snapshot_object
    CHECK (nutrition_snapshot IS NULL OR jsonb_typeof(nutrition_snapshot) = 'object');

CREATE OR REPLACE FUNCTION public.set_order_item_nutrition_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.nutrition_snapshot := public.get_meal_nutrition_snapshot(NEW.meal_id);
  ELSIF NEW.meal_id IS DISTINCT FROM OLD.meal_id THEN
    NEW.nutrition_snapshot := public.get_meal_nutrition_snapshot(NEW.meal_id);
  ELSE
    NEW.nutrition_snapshot := OLD.nutrition_snapshot;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_schedule_nutrition_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.nutrition_snapshot := public.get_meal_nutrition_snapshot(NEW.meal_id);
  ELSIF NEW.meal_id IS DISTINCT FROM OLD.meal_id THEN
    NEW.nutrition_snapshot := public.get_meal_nutrition_snapshot(NEW.meal_id);
  ELSE
    NEW.nutrition_snapshot := OLD.nutrition_snapshot;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_item_nutrition_snapshot_trigger ON public.order_items;
CREATE TRIGGER set_order_item_nutrition_snapshot_trigger
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_item_nutrition_snapshot();

DROP TRIGGER IF EXISTS set_schedule_nutrition_snapshot_trigger ON public.meal_schedules;
CREATE TRIGGER set_schedule_nutrition_snapshot_trigger
  BEFORE INSERT OR UPDATE ON public.meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_schedule_nutrition_snapshot();

CREATE TABLE IF NOT EXISTS public.meal_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('order', 'meal_schedule')),
  source_id UUID NOT NULL,
  source_meal_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('full', 'partial', 'skipped', 'substituted', 'reversed')),
  portion_percent NUMERIC(5, 2) NOT NULL DEFAULT 100
    CHECK (portion_percent >= 0 AND portion_percent <= 100),
  substitute_meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL,
  nutrition_snapshot JSONB NOT NULL CHECK (jsonb_typeof(nutrition_snapshot) = 'object'),
  applied_calories INTEGER NOT NULL DEFAULT 0 CHECK (applied_calories >= 0),
  applied_protein_g INTEGER NOT NULL DEFAULT 0 CHECK (applied_protein_g >= 0),
  applied_carbs_g INTEGER NOT NULL DEFAULT 0 CHECK (applied_carbs_g >= 0),
  applied_fat_g INTEGER NOT NULL DEFAULT 0 CHECK (applied_fat_g >= 0),
  applied_fiber_g INTEGER NOT NULL DEFAULT 0 CHECK (applied_fiber_g >= 0),
  log_date DATE NOT NULL,
  meal_history_id UUID,
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_type, source_id, source_meal_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_consumptions_user_log_date
  ON public.meal_consumptions (user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_consumptions_source
  ON public.meal_consumptions (source_type, source_id);

ALTER TABLE public.meal_history
  ADD COLUMN IF NOT EXISTS source_consumption_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_history_source_consumption
  ON public.meal_history (source_consumption_id)
  WHERE source_consumption_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_history_source_consumption_id_fkey'
      AND conrelid = 'public.meal_history'::regclass
  ) THEN
    ALTER TABLE public.meal_history
      ADD CONSTRAINT meal_history_source_consumption_id_fkey
      FOREIGN KEY (source_consumption_id)
      REFERENCES public.meal_consumptions(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_consumptions_meal_history_id_fkey'
      AND conrelid = 'public.meal_consumptions'::regclass
  ) THEN
    ALTER TABLE public.meal_consumptions
      ADD CONSTRAINT meal_consumptions_meal_history_id_fkey
      FOREIGN KEY (meal_history_id)
      REFERENCES public.meal_history(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.meal_consumption_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumption_id UUID NOT NULL REFERENCES public.meal_consumptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  event_version INTEGER NOT NULL CHECK (event_version > 0),
  previous_state JSONB,
  current_state JSONB NOT NULL,
  nutrition_delta JSONB NOT NULL,
  result_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id),
  UNIQUE (consumption_id, event_version)
);

CREATE INDEX IF NOT EXISTS idx_meal_consumption_events_consumption
  ON public.meal_consumption_events (consumption_id, event_version DESC);
CREATE INDEX IF NOT EXISTS idx_meal_consumption_events_user_created
  ON public.meal_consumption_events (user_id, created_at DESC);

ALTER TABLE public.meal_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_consumption_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_consumptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meal_consumption_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers view own meal consumptions" ON public.meal_consumptions;
CREATE POLICY "Customers view own meal consumptions"
  ON public.meal_consumptions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Customers view own meal consumption events" ON public.meal_consumption_events;
CREATE POLICY "Customers view own meal consumption events"
  ON public.meal_consumption_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.meal_consumptions, public.meal_consumption_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_consumptions, public.meal_consumption_events TO authenticated;
GRANT ALL ON public.meal_consumptions, public.meal_consumption_events TO service_role;

-- Adopt previously logged schedule meals so the new flow cannot count them twice.
INSERT INTO public.meal_consumptions (
  user_id, source_type, source_id, source_meal_id, status, portion_percent,
  nutrition_snapshot, applied_calories, applied_protein_g, applied_carbs_g,
  applied_fat_g, applied_fiber_g, log_date, meal_history_id, event_version,
  created_at, updated_at
)
SELECT DISTINCT ON (mh.user_id, mh.schedule_id)
  mh.user_id,
  'meal_schedule',
  mh.schedule_id,
  ms.meal_id,
  'full',
  100,
  jsonb_build_object(
    'meal_id', ms.meal_id,
    'meal_name', mh.name,
    'image_url', mh.image_url,
    'calories', mh.calories,
    'protein_g', mh.protein_g,
    'carbs_g', mh.carbs_g,
    'fat_g', mh.fat_g,
    'fiber_g', 0,
    'captured_at', COALESCE(mh.created_at, mh.logged_at, NOW())
  ),
  GREATEST(mh.calories, 0),
  GREATEST(mh.protein_g, 0),
  GREATEST(mh.carbs_g, 0),
  GREATEST(mh.fat_g, 0),
  0,
  (COALESCE(mh.logged_at, mh.created_at, NOW()) AT TIME ZONE 'Asia/Qatar')::DATE,
  mh.id,
  1,
  COALESCE(mh.created_at, mh.logged_at, NOW()),
  NOW()
FROM public.meal_history mh
JOIN public.meal_schedules ms ON ms.id = mh.schedule_id
WHERE mh.schedule_id IS NOT NULL
ORDER BY mh.user_id, mh.schedule_id, mh.logged_at DESC, mh.id
ON CONFLICT (user_id, source_type, source_id, source_meal_id) DO NOTHING;

-- Adopt delivered orders already logged through the legacy full-meal action.
INSERT INTO public.meal_consumptions (
  user_id, source_type, source_id, source_meal_id, status, portion_percent,
  nutrition_snapshot, applied_calories, applied_protein_g, applied_carbs_g,
  applied_fat_g, applied_fiber_g, log_date, meal_history_id, event_version,
  created_at, updated_at
)
SELECT DISTINCT ON (mh.user_id, mh.source_order_id, mh.source_meal_id)
  mh.user_id,
  'order',
  mh.source_order_id,
  mh.source_meal_id,
  'full',
  100,
  jsonb_build_object(
    'meal_id', mh.source_meal_id,
    'meal_name', mh.name,
    'image_url', mh.image_url,
    'calories', mh.calories,
    'protein_g', mh.protein_g,
    'carbs_g', mh.carbs_g,
    'fat_g', mh.fat_g,
    'fiber_g', 0,
    'captured_at', COALESCE(mh.created_at, mh.logged_at, NOW())
  ),
  GREATEST(mh.calories, 0),
  GREATEST(mh.protein_g, 0),
  GREATEST(mh.carbs_g, 0),
  GREATEST(mh.fat_g, 0),
  0,
  (COALESCE(mh.logged_at, mh.created_at, NOW()) AT TIME ZONE 'Asia/Qatar')::DATE,
  mh.id,
  1,
  COALESCE(mh.created_at, mh.logged_at, NOW()),
  NOW()
FROM public.meal_history mh
WHERE mh.source_order_id IS NOT NULL
  AND mh.source_meal_id IS NOT NULL
ORDER BY mh.user_id, mh.source_order_id, mh.source_meal_id, mh.logged_at DESC, mh.id
ON CONFLICT (user_id, source_type, source_id, source_meal_id) DO NOTHING;

UPDATE public.meal_history mh
SET source_consumption_id = mc.id
FROM public.meal_consumptions mc
WHERE mc.meal_history_id = mh.id
  AND mh.source_consumption_id IS NULL;

INSERT INTO public.meal_consumption_events (
  consumption_id, user_id, request_id, event_version, previous_state,
  current_state, nutrition_delta, result_snapshot
)
SELECT
  mc.id,
  mc.user_id,
  gen_random_uuid(),
  1,
  NULL,
  jsonb_build_object(
    'status', mc.status,
    'portion_percent', mc.portion_percent,
    'substitute_meal_id', mc.substitute_meal_id,
    'log_date', mc.log_date
  ),
  jsonb_build_object(
    'calories', mc.applied_calories,
    'protein_g', mc.applied_protein_g,
    'carbs_g', mc.applied_carbs_g,
    'fat_g', mc.applied_fat_g,
    'fiber_g', mc.applied_fiber_g
  ),
  jsonb_build_object(
    'success', TRUE,
    'already_processed', TRUE,
    'consumption_id', mc.id,
    'event_version', mc.event_version,
    'status', mc.status,
    'portion_percent', mc.portion_percent,
    'nutrition', jsonb_build_object(
      'calories', mc.applied_calories,
      'protein_g', mc.applied_protein_g,
      'carbs_g', mc.applied_carbs_g,
      'fat_g', mc.applied_fat_g,
      'fiber_g', mc.applied_fiber_g
    )
  )
FROM public.meal_consumptions mc
WHERE NOT EXISTS (
  SELECT 1 FROM public.meal_consumption_events mce
  WHERE mce.consumption_id = mc.id
);

CREATE OR REPLACE FUNCTION public.record_order_meal_consumption(
  p_source_type TEXT,
  p_source_id UUID,
  p_source_meal_id UUID,
  p_status TEXT,
  p_portion_percent NUMERIC DEFAULT 100,
  p_substitute_meal_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_source_type TEXT := LOWER(COALESCE(p_source_type, ''));
  v_status TEXT := LOWER(COALESCE(p_status, ''));
  v_source_snapshot JSONB;
  v_effective_snapshot JSONB;
  v_order public.orders%ROWTYPE;
  v_consumption public.meal_consumptions%ROWTYPE;
  v_existing_result JSONB;
  v_consumption_id UUID;
  v_event_version INTEGER;
  v_log_date DATE := (NOW() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_old_log_date DATE;
  v_old_calories INTEGER := 0;
  v_old_protein INTEGER := 0;
  v_old_carbs INTEGER := 0;
  v_old_fat INTEGER := 0;
  v_old_fiber INTEGER := 0;
  v_new_calories INTEGER := 0;
  v_new_protein INTEGER := 0;
  v_new_carbs INTEGER := 0;
  v_new_fat INTEGER := 0;
  v_new_fiber INTEGER := 0;
  v_history_id UUID;
  v_result JSONB;
  v_previous_state JSONB;
  v_current_state JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED';
  END IF;
  IF v_source_type NOT IN ('order', 'meal_schedule') THEN
    RAISE EXCEPTION 'INVALID_CONSUMPTION_SOURCE';
  END IF;
  IF v_status NOT IN ('full', 'partial', 'skipped', 'substituted', 'reversed') THEN
    RAISE EXCEPTION 'INVALID_CONSUMPTION_STATUS';
  END IF;

  PERFORM 1
  FROM public.profiles p
  WHERE p.user_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_actor::TEXT || ':' || p_request_id::TEXT, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_actor::TEXT || ':' || v_source_type || ':' || p_source_id::TEXT || ':' || p_source_meal_id::TEXT,
      0
    )
  );

  SELECT mce.result_snapshot
  INTO v_existing_result
  FROM public.meal_consumption_events mce
  WHERE mce.user_id = v_actor
    AND mce.request_id = p_request_id;

  IF FOUND THEN
    RETURN v_existing_result || jsonb_build_object('already_processed', TRUE);
  END IF;

  IF v_source_type = 'meal_schedule' THEN
    SELECT COALESCE(ms.nutrition_snapshot, public.get_meal_nutrition_snapshot(ms.meal_id))
    INTO v_source_snapshot
    FROM public.meal_schedules ms
    WHERE ms.id = p_source_id
      AND ms.user_id = v_actor
      AND ms.meal_id = p_source_meal_id
      AND ms.order_status IN ('delivered', 'completed')
    FOR UPDATE OF ms;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DELIVERED_SCHEDULE_NOT_FOUND';
    END IF;
  ELSE
    SELECT *
    INTO v_order
    FROM public.orders o
    WHERE o.id = p_source_id
      AND o.user_id = v_actor
      AND o.status::TEXT IN ('delivered', 'completed')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DELIVERED_ORDER_NOT_FOUND';
    END IF;

    SELECT jsonb_build_object(
      'meal_id', p_source_meal_id,
      'meal_name', MAX(COALESCE(oi.nutrition_snapshot ->> 'meal_name', oi.meal_name, m.name)),
      'image_url', MAX(COALESCE(oi.nutrition_snapshot ->> 'image_url', m.image_url)),
      'calories', SUM(COALESCE((oi.nutrition_snapshot ->> 'calories')::NUMERIC, m.calories, 0) * GREATEST(oi.quantity, 1)),
      'protein_g', SUM(COALESCE((oi.nutrition_snapshot ->> 'protein_g')::NUMERIC, m.protein_g, m.protein, 0) * GREATEST(oi.quantity, 1)),
      'carbs_g', SUM(COALESCE((oi.nutrition_snapshot ->> 'carbs_g')::NUMERIC, m.carbs_g, m.carbs, 0) * GREATEST(oi.quantity, 1)),
      'fat_g', SUM(COALESCE((oi.nutrition_snapshot ->> 'fat_g')::NUMERIC, m.fat_g, m.fats, 0) * GREATEST(oi.quantity, 1)),
      'fiber_g', SUM(COALESCE((oi.nutrition_snapshot ->> 'fiber_g')::NUMERIC, m.fiber_g, 0) * GREATEST(oi.quantity, 1)),
      'captured_at', MIN(COALESCE(oi.nutrition_snapshot ->> 'captured_at', oi.created_at::TEXT))
    )
    INTO v_source_snapshot
    FROM public.order_items oi
    LEFT JOIN public.meals m ON m.id = oi.meal_id
    WHERE oi.order_id = p_source_id
      AND oi.meal_id = p_source_meal_id
    HAVING COUNT(*) > 0;

    IF v_source_snapshot IS NULL THEN
      IF v_order.meal_id = p_source_meal_id THEN
        v_source_snapshot := public.get_meal_nutrition_snapshot(v_order.meal_id);
      END IF;
    END IF;

    IF v_source_snapshot IS NULL THEN
      RAISE EXCEPTION 'MEAL_NOT_IN_ORDER';
    END IF;
  END IF;

  IF v_status = 'full' THEN
    p_portion_percent := 100;
    p_substitute_meal_id := NULL;
  ELSIF v_status = 'partial' THEN
    IF p_portion_percent IS NULL OR p_portion_percent <= 0 OR p_portion_percent >= 100 THEN
      RAISE EXCEPTION 'PARTIAL_PORTION_MUST_BE_BETWEEN_0_AND_100';
    END IF;
    p_substitute_meal_id := NULL;
  ELSIF v_status = 'substituted' THEN
    IF p_substitute_meal_id IS NULL OR p_substitute_meal_id = p_source_meal_id THEN
      RAISE EXCEPTION 'SUBSTITUTE_MEAL_REQUIRED';
    END IF;
    IF p_portion_percent IS NULL OR p_portion_percent <= 0 OR p_portion_percent > 100 THEN
      RAISE EXCEPTION 'INVALID_PORTION_PERCENT';
    END IF;
  ELSE
    p_portion_percent := 0;
    p_substitute_meal_id := NULL;
  END IF;

  IF v_status = 'substituted' THEN
    v_effective_snapshot := public.get_meal_nutrition_snapshot(p_substitute_meal_id);
    IF v_effective_snapshot IS NULL THEN
      RAISE EXCEPTION 'SUBSTITUTE_MEAL_NOT_FOUND';
    END IF;
  ELSE
    v_effective_snapshot := v_source_snapshot;
  END IF;

  SELECT *
  INTO v_consumption
  FROM public.meal_consumptions mc
  WHERE mc.user_id = v_actor
    AND mc.source_type = v_source_type
    AND mc.source_id = p_source_id
    AND mc.source_meal_id = p_source_meal_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_consumption.status = v_status
      AND v_consumption.portion_percent = p_portion_percent
      AND v_consumption.substitute_meal_id IS NOT DISTINCT FROM p_substitute_meal_id THEN
      RETURN jsonb_build_object(
        'success', TRUE,
        'already_processed', TRUE,
        'consumption_id', v_consumption.id,
        'event_version', v_consumption.event_version,
        'status', v_consumption.status,
        'portion_percent', v_consumption.portion_percent,
        'nutrition', jsonb_build_object(
          'calories', v_consumption.applied_calories,
          'protein_g', v_consumption.applied_protein_g,
          'carbs_g', v_consumption.applied_carbs_g,
          'fat_g', v_consumption.applied_fat_g,
          'fiber_g', v_consumption.applied_fiber_g
        )
      );
    END IF;

    v_consumption_id := v_consumption.id;
    v_event_version := v_consumption.event_version + 1;
    v_old_log_date := v_consumption.log_date;
    v_old_calories := v_consumption.applied_calories;
    v_old_protein := v_consumption.applied_protein_g;
    v_old_carbs := v_consumption.applied_carbs_g;
    v_old_fat := v_consumption.applied_fat_g;
    v_old_fiber := v_consumption.applied_fiber_g;
    v_previous_state := jsonb_build_object(
      'status', v_consumption.status,
      'portion_percent', v_consumption.portion_percent,
      'substitute_meal_id', v_consumption.substitute_meal_id,
      'log_date', v_consumption.log_date
    );
  ELSE
    v_consumption_id := gen_random_uuid();
    v_event_version := 1;
    v_old_log_date := v_log_date;
    v_previous_state := NULL;
  END IF;

  IF p_portion_percent > 0 THEN
    v_new_calories := ROUND(COALESCE((v_effective_snapshot ->> 'calories')::NUMERIC, 0) * p_portion_percent / 100)::INTEGER;
    v_new_protein := ROUND(COALESCE((v_effective_snapshot ->> 'protein_g')::NUMERIC, 0) * p_portion_percent / 100)::INTEGER;
    v_new_carbs := ROUND(COALESCE((v_effective_snapshot ->> 'carbs_g')::NUMERIC, 0) * p_portion_percent / 100)::INTEGER;
    v_new_fat := ROUND(COALESCE((v_effective_snapshot ->> 'fat_g')::NUMERIC, 0) * p_portion_percent / 100)::INTEGER;
    v_new_fiber := ROUND(COALESCE((v_effective_snapshot ->> 'fiber_g')::NUMERIC, 0) * p_portion_percent / 100)::INTEGER;
  END IF;

  IF v_old_calories + v_old_protein + v_old_carbs + v_old_fat + v_old_fiber > 0 THEN
    UPDATE public.progress_logs
    SET calories_consumed = GREATEST(0, COALESCE(calories_consumed, 0) - v_old_calories),
        protein_consumed_g = GREATEST(0, COALESCE(protein_consumed_g, 0) - v_old_protein),
        carbs_consumed_g = GREATEST(0, COALESCE(carbs_consumed_g, 0) - v_old_carbs),
        fat_consumed_g = GREATEST(0, COALESCE(fat_consumed_g, 0) - v_old_fat),
        fiber_consumed_g = GREATEST(0, COALESCE(fiber_consumed_g, 0) - v_old_fiber),
        updated_at = NOW()
    WHERE user_id = v_actor
      AND log_date = v_old_log_date;
  END IF;

  IF v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 THEN
    INSERT INTO public.progress_logs (
      user_id, log_date, calories_consumed, protein_consumed_g,
      carbs_consumed_g, fat_consumed_g, fiber_consumed_g, created_at, updated_at
    ) VALUES (
      v_actor, v_log_date, v_new_calories, v_new_protein,
      v_new_carbs, v_new_fat, v_new_fiber, NOW(), NOW()
    )
    ON CONFLICT (user_id, log_date) DO UPDATE
    SET calories_consumed = COALESCE(public.progress_logs.calories_consumed, 0) + EXCLUDED.calories_consumed,
        protein_consumed_g = COALESCE(public.progress_logs.protein_consumed_g, 0) + EXCLUDED.protein_consumed_g,
        carbs_consumed_g = COALESCE(public.progress_logs.carbs_consumed_g, 0) + EXCLUDED.carbs_consumed_g,
        fat_consumed_g = COALESCE(public.progress_logs.fat_consumed_g, 0) + EXCLUDED.fat_consumed_g,
        fiber_consumed_g = COALESCE(public.progress_logs.fiber_consumed_g, 0) + EXCLUDED.fiber_consumed_g,
        updated_at = NOW();
  END IF;

  IF v_consumption.id IS NULL THEN
    INSERT INTO public.meal_consumptions (
      id, user_id, source_type, source_id, source_meal_id, status,
      portion_percent, substitute_meal_id, nutrition_snapshot,
      applied_calories, applied_protein_g, applied_carbs_g, applied_fat_g,
      applied_fiber_g, log_date, event_version, created_at, updated_at
    ) VALUES (
      v_consumption_id, v_actor, v_source_type, p_source_id, p_source_meal_id, v_status,
      p_portion_percent, p_substitute_meal_id, v_effective_snapshot,
      v_new_calories, v_new_protein, v_new_carbs, v_new_fat,
      v_new_fiber, v_log_date, v_event_version, NOW(), NOW()
    );
  ELSE
    UPDATE public.meal_consumptions
    SET status = v_status,
        portion_percent = p_portion_percent,
        substitute_meal_id = p_substitute_meal_id,
        nutrition_snapshot = v_effective_snapshot,
        applied_calories = v_new_calories,
        applied_protein_g = v_new_protein,
        applied_carbs_g = v_new_carbs,
        applied_fat_g = v_new_fat,
        applied_fiber_g = v_new_fiber,
        log_date = v_log_date,
        event_version = v_event_version,
        updated_at = NOW()
    WHERE id = v_consumption_id;
  END IF;

  SELECT mh.id
  INTO v_history_id
  FROM public.meal_history mh
  WHERE mh.source_consumption_id = v_consumption_id
  FOR UPDATE;

  IF v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 THEN
    IF v_history_id IS NULL THEN
      INSERT INTO public.meal_history (
        user_id, name, calories, protein_g, carbs_g, fat_g, fiber_g, image_url,
        logged_at, source, schedule_id, source_order_id, source_meal_id,
        source_consumption_id
      ) VALUES (
        v_actor,
        COALESCE(v_effective_snapshot ->> 'meal_name', 'Meal'),
        v_new_calories,
        v_new_protein,
        v_new_carbs,
        v_new_fat,
        v_new_fiber,
        NULLIF(v_effective_snapshot ->> 'image_url', ''),
        NOW(),
        'order_consumption',
        CASE WHEN v_source_type = 'meal_schedule' THEN p_source_id ELSE NULL END,
        CASE WHEN v_source_type = 'order' THEN p_source_id ELSE NULL END,
        p_source_meal_id,
        v_consumption_id
      )
      RETURNING id INTO v_history_id;
    ELSE
      UPDATE public.meal_history
      SET name = COALESCE(v_effective_snapshot ->> 'meal_name', name),
          calories = v_new_calories,
          protein_g = v_new_protein,
          carbs_g = v_new_carbs,
          fat_g = v_new_fat,
          fiber_g = v_new_fiber,
          image_url = NULLIF(v_effective_snapshot ->> 'image_url', ''),
          logged_at = NOW(),
          source = 'order_consumption'
      WHERE id = v_history_id;
    END IF;
  ELSIF v_history_id IS NOT NULL THEN
    -- The existing generic delete trigger reverses fiber. This RPC already
    -- applied the complete nutrient delta above, so neutralize that one field.
    UPDATE public.meal_history SET fiber_g = 0 WHERE id = v_history_id;
    DELETE FROM public.meal_history WHERE id = v_history_id;
    v_history_id := NULL;
  END IF;

  UPDATE public.meal_consumptions
  SET meal_history_id = v_history_id
  WHERE id = v_consumption_id;

  IF v_source_type = 'meal_schedule' THEN
    UPDATE public.meal_schedules
    SET is_completed = v_status IN ('full', 'partial', 'substituted'),
        completed_at = CASE
          WHEN v_status IN ('full', 'partial', 'substituted') THEN NOW()
          ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = p_source_id
      AND user_id = v_actor;
  END IF;

  UPDATE public.profiles p
  SET total_meals_logged = counts.meal_count,
      updated_at = NOW()
  FROM (
    SELECT COUNT(*)::INTEGER AS meal_count
    FROM public.meal_history mh
    WHERE mh.user_id = v_actor
  ) counts
  WHERE p.user_id = v_actor;

  IF v_old_calories + v_old_protein + v_old_carbs + v_old_fat + v_old_fiber = 0
    AND v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 THEN
    PERFORM public.award_xp(
      v_actor,
      10,
      'Delivered meal logged',
      'delivered_meal_log',
      v_consumption_id::TEXT,
      jsonb_build_object(
        'consumption_id', v_consumption_id,
        'source_type', v_source_type,
        'source_id', p_source_id,
        'source_meal_id', p_source_meal_id
      )
    );
  END IF;

  v_current_state := jsonb_build_object(
    'status', v_status,
    'portion_percent', p_portion_percent,
    'substitute_meal_id', p_substitute_meal_id,
    'log_date', v_log_date
  );

  v_result := jsonb_build_object(
    'success', TRUE,
    'already_processed', FALSE,
    'consumption_id', v_consumption_id,
    'meal_history_id', v_history_id,
    'event_version', v_event_version,
    'status', v_status,
    'portion_percent', p_portion_percent,
    'nutrition', jsonb_build_object(
      'calories', v_new_calories,
      'protein_g', v_new_protein,
      'carbs_g', v_new_carbs,
      'fat_g', v_new_fat,
      'fiber_g', v_new_fiber
    )
  );

  INSERT INTO public.meal_consumption_events (
    consumption_id, user_id, request_id, event_version, previous_state,
    current_state, nutrition_delta, result_snapshot
  ) VALUES (
    v_consumption_id,
    v_actor,
    p_request_id,
    v_event_version,
    v_previous_state,
    v_current_state,
    jsonb_build_object(
      'calories', v_new_calories - v_old_calories,
      'protein_g', v_new_protein - v_old_protein,
      'carbs_g', v_new_carbs - v_old_carbs,
      'fat_g', v_new_fat - v_old_fat,
      'fiber_g', v_new_fiber - v_old_fiber
    ),
    v_result
  );

  UPDATE public.notifications
  SET status = 'read',
      read_at = COALESCE(read_at, NOW())
  WHERE user_id = v_actor
    AND type::TEXT = 'order_delivered'
    AND related_entity_id = p_source_id
    AND data ->> 'meal_id' = p_source_meal_id::TEXT;

  IF v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 THEN
    PERFORM public.check_and_award_badges(v_actor);
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_meal_consumption(TEXT, UUID, UUID, TEXT, NUMERIC, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_order_meal_consumption(TEXT, UUID, UUID, TEXT, NUMERIC, UUID, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_order_meal_consumption(
  p_source_type TEXT,
  p_source_id UUID,
  p_source_meal_id UUID
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT to_jsonb(mc)
      FROM public.meal_consumptions mc
      WHERE mc.user_id = (SELECT auth.uid())
        AND mc.source_type = LOWER(p_source_type)
        AND mc.source_id = p_source_id
        AND mc.source_meal_id = p_source_meal_id
    ),
    'null'::JSONB
  );
$$;

REVOKE ALL ON FUNCTION public.get_order_meal_consumption(TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_meal_consumption(TEXT, UUID, UUID) TO authenticated;

-- Keep the old app action compatible while routing it through the lifecycle.
CREATE OR REPLACE FUNCTION public.add_delivered_meal_to_progress(
  p_order_id UUID,
  p_meal_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.record_order_meal_consumption(
    'order',
    p_order_id,
    p_meal_id,
    'full',
    100,
    NULL,
    gen_random_uuid()
  );
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.add_delivered_meal_to_progress(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_delivered_meal_to_progress(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_scheduled_meal_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  IF NEW.user_id IS NULL
    OR NEW.order_status <> 'delivered'
    OR (TG_OP = 'UPDATE' AND OLD.order_status = 'delivered') THEN
    RETURN NEW;
  END IF;

  v_snapshot := COALESCE(
    NEW.nutrition_snapshot,
    public.get_meal_nutrition_snapshot(NEW.meal_id)
  );

  INSERT INTO public.notifications (
    user_id, type, title, message, status, data,
    related_entity_type, related_entity_id, created_at
  ) VALUES (
    NEW.user_id,
    'order_delivered'::public.notification_type,
    'Meal delivered - confirm what you ate',
    format('%s was delivered. Record the portion you actually ate.', COALESCE(v_snapshot ->> 'meal_name', 'Your meal')),
    'unread'::public.notification_status,
    jsonb_build_object(
      'source_type', 'meal_schedule',
      'source_id', NEW.id,
      'order_id', NEW.id,
      'meal_id', NEW.meal_id,
      'meal_name', v_snapshot ->> 'meal_name',
      'calories', COALESCE((v_snapshot ->> 'calories')::NUMERIC, 0),
      'protein_g', COALESCE((v_snapshot ->> 'protein_g')::NUMERIC, 0),
      'carbs_g', COALESCE((v_snapshot ->> 'carbs_g')::NUMERIC, 0),
      'fat_g', COALESCE((v_snapshot ->> 'fat_g')::NUMERIC, 0),
      'action', 'confirm_consumption'
    ),
    'meal_schedule',
    NEW.id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_schedule_delivered_consumption_notification ON public.meal_schedules;
CREATE TRIGGER tr_schedule_delivered_consumption_notification
  AFTER UPDATE OF order_status ON public.meal_schedules
  FOR EACH ROW
  WHEN (NEW.order_status = 'delivered' AND OLD.order_status IS DISTINCT FROM 'delivered')
  EXECUTE FUNCTION public.notify_scheduled_meal_delivered();

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumption_confirmation_notification
  ON public.notifications (user_id, related_entity_type, related_entity_id, ((data ->> 'meal_id')))
  WHERE type = 'order_delivered'::public.notification_type
    AND data ->> 'action' = 'confirm_consumption';

CREATE OR REPLACE FUNCTION public.notify_meal_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meal RECORD;
BEGIN
  IF NEW.user_id IS NULL
    OR NEW.status::TEXT <> 'delivered'
    OR (TG_OP = 'UPDATE' AND OLD.status::TEXT = 'delivered') THEN
    RETURN NEW;
  END IF;

  FOR v_meal IN
    WITH ordered_meals AS (
      SELECT
        oi.meal_id,
        MAX(COALESCE(oi.nutrition_snapshot ->> 'meal_name', oi.meal_name, m.name)) AS meal_name,
        SUM(COALESCE((oi.nutrition_snapshot ->> 'calories')::NUMERIC, m.calories, 0) * GREATEST(oi.quantity, 1)) AS calories,
        SUM(COALESCE((oi.nutrition_snapshot ->> 'protein_g')::NUMERIC, m.protein_g, m.protein, 0) * GREATEST(oi.quantity, 1)) AS protein_g,
        SUM(COALESCE((oi.nutrition_snapshot ->> 'carbs_g')::NUMERIC, m.carbs_g, m.carbs, 0) * GREATEST(oi.quantity, 1)) AS carbs_g,
        SUM(COALESCE((oi.nutrition_snapshot ->> 'fat_g')::NUMERIC, m.fat_g, m.fats, 0) * GREATEST(oi.quantity, 1)) AS fat_g
      FROM public.order_items oi
      LEFT JOIN public.meals m ON m.id = oi.meal_id
      WHERE oi.order_id = NEW.id
        AND oi.meal_id IS NOT NULL
      GROUP BY oi.meal_id
    ), fallback_meal AS (
      SELECT
        NEW.meal_id AS meal_id,
        snapshot ->> 'meal_name' AS meal_name,
        COALESCE((snapshot ->> 'calories')::NUMERIC, 0) AS calories,
        COALESCE((snapshot ->> 'protein_g')::NUMERIC, 0) AS protein_g,
        COALESCE((snapshot ->> 'carbs_g')::NUMERIC, 0) AS carbs_g,
        COALESCE((snapshot ->> 'fat_g')::NUMERIC, 0) AS fat_g
      FROM (SELECT public.get_meal_nutrition_snapshot(NEW.meal_id) AS snapshot) source
      WHERE NEW.meal_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM ordered_meals)
    )
    SELECT * FROM ordered_meals
    UNION ALL
    SELECT * FROM fallback_meal
  LOOP
    INSERT INTO public.notifications (
      user_id, type, title, message, status, data,
      related_entity_type, related_entity_id, created_at
    ) VALUES (
      NEW.user_id,
      'order_delivered'::public.notification_type,
      'Meal delivered - confirm what you ate',
      format('%s was delivered. Record the portion you actually ate.', COALESCE(v_meal.meal_name, 'Your meal')),
      'unread'::public.notification_status,
      jsonb_build_object(
        'source_type', 'order',
        'source_id', NEW.id,
        'order_id', NEW.id,
        'meal_id', v_meal.meal_id,
        'meal_name', v_meal.meal_name,
        'calories', v_meal.calories,
        'protein_g', v_meal.protein_g,
        'carbs_g', v_meal.carbs_g,
        'fat_g', v_meal.fat_g,
        'action', 'confirm_consumption'
      ),
      'order',
      NEW.id,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMIT;
