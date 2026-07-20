CREATE OR REPLACE FUNCTION public.resubmit_meal_nutrition_verification_request(
  p_request_id UUID,
  p_evidence_reference TEXT,
  p_partner_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_request public.meal_nutrition_verification_requests%ROWTYPE;
  v_meal public.meals%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT q.* INTO v_request
  FROM public.meal_nutrition_verification_requests q
  JOIN public.restaurants r ON r.id = q.restaurant_id
  WHERE q.id = p_request_id
    AND q.requested_by = v_actor
    AND r.owner_id = v_actor
    AND q.status = 'needs_info'
  FOR UPDATE OF q;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERIFICATION_REQUEST_NOT_RESUBMITTABLE'; END IF;

  SELECT * INTO v_meal FROM public.meals WHERE id = v_request.meal_id FOR UPDATE;
  IF COALESCE(v_meal.nutrient_completeness_score, 0) < 100
    OR COALESCE(cardinality(v_meal.nutrient_missing_codes), 0) > 0
    OR COALESCE(cardinality(v_meal.nutrient_invalid_codes), 0) > 0
  THEN
    RAISE EXCEPTION 'NUTRITION_DATA_INCOMPLETE';
  END IF;
  IF NULLIF(btrim(v_meal.nutrition_provenance ->> 'source_record_id'), '') IS NULL THEN
    RAISE EXCEPTION 'NUTRITION_SOURCE_REFERENCE_REQUIRED';
  END IF;
  IF v_request.requested_tier IN ('dietitian_reviewed', 'lab_tested')
    AND char_length(COALESCE(btrim(p_evidence_reference), '')) < 3
  THEN
    RAISE EXCEPTION 'INDEPENDENT_EVIDENCE_REQUIRED';
  END IF;

  UPDATE public.meal_nutrition_verification_requests
  SET status = 'pending',
      submitted_nutrition_version = v_meal.nutrition_version,
      evidence_reference = NULLIF(btrim(p_evidence_reference), ''),
      partner_notes = NULLIF(btrim(p_partner_notes), ''),
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes = NULL,
      updated_at = clock_timestamp()
  WHERE id = v_request.id;

  INSERT INTO public.meal_nutrition_verification_events (
    meal_id, request_id, actor_id, event_type, metadata
  ) VALUES (
    v_request.meal_id, v_request.id, v_actor, 'requested',
    jsonb_build_object(
      'resubmitted', TRUE,
      'tier', v_request.requested_tier,
      'nutrition_version', v_meal.nutrition_version
    )
  );
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.resubmit_meal_nutrition_verification_request(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_meal_nutrition_verification_request(UUID, TEXT, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.resubmit_meal_nutrition_verification_request(UUID, TEXT, TEXT) IS
  'Lets the owning partner answer an admin needs-info request without creating a duplicate open request.';
