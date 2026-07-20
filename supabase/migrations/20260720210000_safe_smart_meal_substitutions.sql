-- Server-authoritative meal substitutions. Safety and delivery eligibility are
-- rechecked in the same transaction that changes the scheduled meal.

CREATE TABLE IF NOT EXISTS public.meal_schedule_substitution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.meal_schedules(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  previous_meal_id UUID NOT NULL REFERENCES public.meals(id),
  substitute_meal_id UUID NOT NULL REFERENCES public.meals(id),
  score NUMERIC(6, 4) NOT NULL CHECK (score BETWEEN 0 AND 1),
  reason_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  previous_state JSONB NOT NULL,
  result_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (user_id, request_id)
);

ALTER TABLE public.meal_schedule_substitution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_schedule_substitution_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_schedule_substitution_events_owner_read
  ON public.meal_schedule_substitution_events;
CREATE POLICY meal_schedule_substitution_events_owner_read
  ON public.meal_schedule_substitution_events
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.meal_schedule_substitution_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_schedule_substitution_events TO authenticated;
GRANT ALL ON public.meal_schedule_substitution_events TO service_role;

CREATE INDEX IF NOT EXISTS meal_schedule_substitution_events_schedule_created_idx
  ON public.meal_schedule_substitution_events (schedule_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_direct_meal_schedule_substitution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.meal_id IS DISTINCT FROM NEW.meal_id
    AND COALESCE(current_setting('nutrio.safe_substitution', TRUE), '') <> 'on'
    AND COALESCE(auth.role(), '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'USE_SAFE_MEAL_SUBSTITUTION';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_direct_meal_schedule_substitution_trigger
  ON public.meal_schedules;
CREATE TRIGGER guard_direct_meal_schedule_substitution_trigger
  BEFORE UPDATE OF meal_id ON public.meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_direct_meal_schedule_substitution();

CREATE OR REPLACE FUNCTION public.get_safe_meal_substitutes(
  p_schedule_id UUID,
  p_limit INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_schedule public.meal_schedules%ROWTYPE;
  v_original public.meals%ROWTYPE;
  v_allergies TEXT[] := ARRAY[]::TEXT[];
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_schedule_id IS NULL THEN
    RAISE EXCEPTION 'SCHEDULE_REQUIRED';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'SUBSTITUTE_LIMIT_INVALID';
  END IF;

  SELECT ms.* INTO v_schedule
  FROM public.meal_schedules ms
  WHERE ms.id = p_schedule_id AND ms.user_id = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SCHEDULE_NOT_FOUND';
  END IF;
  IF COALESCE(v_schedule.order_status, 'pending') NOT IN ('pending', 'confirmed')
    OR COALESCE(v_schedule.is_completed, FALSE)
    OR v_schedule.scheduled_date < CURRENT_DATE
  THEN
    RAISE EXCEPTION 'SCHEDULE_NOT_SUBSTITUTABLE';
  END IF;
  IF COALESCE(v_schedule.schedule_source, 'customer') <> 'customer' THEN
    RAISE EXCEPTION 'COACH_SCHEDULE_REQUIRES_COACH_REPLACEMENT';
  END IF;
  IF COALESCE(v_schedule.addons_total, 0) > 0
    OR EXISTS (SELECT 1 FROM public.schedule_addons sa WHERE sa.schedule_id = v_schedule.id)
  THEN
    RAISE EXCEPTION 'SUBSTITUTION_ADDONS_REQUIRE_SUPPORT';
  END IF;
  IF COALESCE(v_schedule.customization_data, '{}'::JSONB) <> '{}'::JSONB
    OR v_schedule.restaurant_note IS NOT NULL
  THEN
    RAISE EXCEPTION 'SUBSTITUTION_CUSTOMIZATION_REQUIRES_REVIEW';
  END IF;

  SELECT m.* INTO v_original
  FROM public.meals m
  WHERE m.id = v_schedule.meal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORIGINAL_MEAL_NOT_FOUND';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lower(trim(allergy))), ARRAY[]::TEXT[])
  INTO v_allergies
  FROM (
    SELECT unnest(COALESCE(p.allergies, ARRAY[]::TEXT[])) AS allergy
    FROM public.profiles p WHERE p.user_id = v_actor
    UNION ALL
    SELECT unnest(COALESCE(up.allergies, ARRAY[]::TEXT[])) AS allergy
    FROM public.user_preferences up WHERE up.user_id = v_actor
  ) allergies
  WHERE NULLIF(trim(allergy), '') IS NOT NULL;

  WITH prequalified AS (
    SELECT
      m.*,
      (
        0.40 * (1 - LEAST(ABS(COALESCE(m.calories, 0) - COALESCE(v_original.calories, 0))
          / GREATEST(COALESCE(v_original.calories, 0), 1)::NUMERIC, 1))
        + 0.30 * (1 - LEAST(ABS(COALESCE(m.protein_g, 0) - COALESCE(v_original.protein_g, 0))
          / GREATEST(COALESCE(v_original.protein_g, 0), 1)::NUMERIC, 1))
        + 0.15 * (1 - LEAST(ABS(COALESCE(m.carbs_g, 0) - COALESCE(v_original.carbs_g, 0))
          / GREATEST(COALESCE(v_original.carbs_g, 0), 1)::NUMERIC, 1))
        + 0.15 * (1 - LEAST(ABS(COALESCE(m.fat_g, 0) - COALESCE(v_original.fat_g, 0))
          / GREATEST(COALESCE(v_original.fat_g, 0), 1)::NUMERIC, 1))
      )::NUMERIC(6, 4) AS similarity_score
    FROM public.meals m
    JOIN public.restaurants r ON r.id = m.restaurant_id
    WHERE m.id <> v_original.id
      AND COALESCE(m.is_available, FALSE) = TRUE
      AND m.deleted_at IS NULL
      AND (m.approval_status IS NULL OR m.approval_status = 'approved')
      AND COALESCE(r.is_active, FALSE) = TRUE
      AND (r.approval_status IS NULL OR r.approval_status = 'approved')
      AND lower(COALESCE(m.meal_type, '')) = lower(COALESCE(v_schedule.meal_type, ''))
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_dietary_preferences udp
        WHERE udp.user_id = v_actor
          AND NOT EXISTS (
            SELECT 1 FROM public.meal_diet_tags mdt
            WHERE mdt.meal_id = m.id AND mdt.diet_tag_id = udp.diet_tag_id
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.meal_allergens ma
        JOIN public.allergen_tags at ON at.id = ma.allergen_id
        WHERE ma.meal_id = m.id
          AND EXISTS (
            SELECT 1 FROM unnest(v_allergies) selected(allergy)
            WHERE lower(trim(at.name)) = selected.allergy
              OR lower(trim(COALESCE(at.name_ar, ''))) = selected.allergy
              OR lower(trim(at.name)) LIKE '%' || selected.allergy || '%'
              OR selected.allergy LIKE '%' || lower(trim(at.name)) || '%'
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_medications um
        JOIN public.food_medicine_interactions fmi
          ON lower(trim(fmi.active_ingredient)) = lower(trim(um.active_ingredient))
        JOIN public.meal_ingredients mi ON mi.meal_id = m.id
        WHERE um.user_id = v_actor
          AND (
            lower(mi.name) LIKE '%' || lower(fmi.food_ingredient) || '%'
            OR lower(fmi.food_ingredient) LIKE '%' || lower(mi.name) || '%'
          )
      )
    ORDER BY similarity_score DESC, m.rating DESC NULLS LAST, m.id
    LIMIT 30
  ), routed AS (
    SELECT
      p.*,
      public.route_meal_schedule_branch(
        p.restaurant_id,
        p.id,
        v_schedule.delivery_address_id,
        v_schedule.scheduled_date,
        v_schedule.delivery_time_slot,
        v_schedule.meal_type
      ) AS route
    FROM prequalified p
  ), eligible AS (
    SELECT * FROM routed
    WHERE route ->> 'status' IN ('routed', 'single_kitchen')
      AND similarity_score >= 0.55
    ORDER BY similarity_score DESC, rating DESC NULLS LAST, id
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'meal_id', e.id,
    'name', e.name,
    'image_url', e.image_url,
    'restaurant_id', e.restaurant_id,
    'calories', e.calories,
    'protein_g', e.protein_g,
    'carbs_g', e.carbs_g,
    'fat_g', e.fat_g,
    'fiber_g', e.fiber_g,
    'prep_time_minutes', e.prep_time_minutes,
    'score', e.similarity_score,
    'reason_codes', ARRAY['safety_checked', 'diet_checked', 'delivery_checked', 'nutrition_match'],
    'routing', e.route
  ) ORDER BY e.similarity_score DESC), '[]'::JSONB)
  INTO v_results
  FROM eligible e;

  RETURN jsonb_build_object(
    'schedule_id', v_schedule.id,
    'original_meal_id', v_original.id,
    'candidates', v_results,
    'checked_at', clock_timestamp()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.perform_safe_meal_substitution(
  p_schedule_id UUID,
  p_substitute_meal_id UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_schedule public.meal_schedules%ROWTYPE;
  v_candidate JSONB;
  v_candidates JSONB;
  v_route JSONB;
  v_existing public.meal_schedule_substitution_events%ROWTYPE;
  v_previous JSONB;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_schedule_id IS NULL OR p_substitute_meal_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'SUBSTITUTION_INPUT_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::TEXT || ':' || p_request_id::TEXT, 0));

  SELECT * INTO v_existing
  FROM public.meal_schedule_substitution_events e
  WHERE e.user_id = v_actor AND e.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.schedule_id <> p_schedule_id
      OR v_existing.substitute_meal_id <> p_substitute_meal_id
    THEN
      RAISE EXCEPTION 'SUBSTITUTION_REQUEST_ID_REUSED';
    END IF;
    RETURN v_existing.result_state || jsonb_build_object('already_processed', TRUE);
  END IF;

  SELECT ms.* INTO v_schedule
  FROM public.meal_schedules ms
  WHERE ms.id = p_schedule_id AND ms.user_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SCHEDULE_NOT_FOUND'; END IF;

  v_candidates := public.get_safe_meal_substitutes(p_schedule_id, 10) -> 'candidates';
  SELECT candidate INTO v_candidate
  FROM jsonb_array_elements(v_candidates) candidate
  WHERE candidate ->> 'meal_id' = p_substitute_meal_id::TEXT
  LIMIT 1;
  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'SUBSTITUTE_NOT_ELIGIBLE';
  END IF;

  v_route := v_candidate -> 'routing';
  v_previous := jsonb_build_object(
    'meal_id', v_schedule.meal_id,
    'restaurant_id', v_schedule.restaurant_id,
    'restaurant_branch_id', v_schedule.restaurant_branch_id,
    'routing_metadata', v_schedule.routing_metadata,
    'nutrition_snapshot', v_schedule.nutrition_snapshot,
    'meal_price_snapshot', v_schedule.meal_price_snapshot
  );

  PERFORM set_config('nutrio.safe_substitution', 'on', TRUE);
  UPDATE public.meal_schedules ms
  SET meal_id = p_substitute_meal_id,
      restaurant_id = (v_candidate ->> 'restaurant_id')::UUID,
      restaurant_branch_id = NULLIF(v_route ->> 'branch_id', '')::UUID,
      routing_metadata = v_route || jsonb_build_object(
        'substitution_request_id', p_request_id,
        'substituted_at', clock_timestamp()
      ),
      meal_price_snapshot = candidate.price,
      customization_data = '{}'::JSONB,
      restaurant_note = NULL,
      updated_at = clock_timestamp()
  FROM public.meals candidate
  WHERE ms.id = v_schedule.id AND candidate.id = p_substitute_meal_id;

  v_result := jsonb_build_object(
    'success', TRUE,
    'already_processed', FALSE,
    'schedule_id', v_schedule.id,
    'previous_meal_id', v_schedule.meal_id,
    'substitute_meal_id', p_substitute_meal_id,
    'score', (v_candidate ->> 'score')::NUMERIC,
    'reason_codes', v_candidate -> 'reason_codes',
    'routing', v_route
  );

  INSERT INTO public.meal_schedule_substitution_events (
    user_id, schedule_id, request_id, previous_meal_id, substitute_meal_id,
    score, reason_codes, previous_state, result_state
  ) VALUES (
    v_actor, v_schedule.id, p_request_id, v_schedule.meal_id, p_substitute_meal_id,
    (v_candidate ->> 'score')::NUMERIC,
    ARRAY(SELECT jsonb_array_elements_text(v_candidate -> 'reason_codes')),
    v_previous,
    v_result
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_safe_meal_substitutes(UUID, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_safe_meal_substitutes(UUID, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_safe_meal_substitutes(UUID, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.perform_safe_meal_substitution(UUID, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_safe_meal_substitution(UUID, UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.perform_safe_meal_substitution(UUID, UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.guard_direct_meal_schedule_substitution()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_direct_meal_schedule_substitution()
  TO service_role;

COMMENT ON FUNCTION public.get_safe_meal_substitutes(UUID, INTEGER) IS
  'Returns server-eligible substitutions after dietary, allergy, medicine, availability, and branch checks.';
COMMENT ON FUNCTION public.perform_safe_meal_substitution(UUID, UUID, UUID) IS
  'Atomically substitutes an owned schedule using a freshly revalidated candidate and an idempotent audit event.';
