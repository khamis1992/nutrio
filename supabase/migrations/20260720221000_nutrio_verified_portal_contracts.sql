-- Portal-specific read contracts for Nutrio Verified. Each RPC returns only the
-- fields needed by its caller and keeps reviewer identity and evidence private.

CREATE OR REPLACE FUNCTION public.get_current_meal_nutrition_verification(
  p_meal_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'meal_id', v.meal_id,
        'tier', v.tier,
        'nutrition_version', v.nutrition_version,
        'public_summary', v.public_summary,
        'verified_at', v.verified_at,
        'expires_at', v.expires_at,
        'nutrition_source', v.nutrition_source
      )
      FROM public.current_meal_nutrition_verifications v
      WHERE v.meal_id = p_meal_id
      LIMIT 1
    ),
    '{}'::JSONB
  );
$$;

CREATE OR REPLACE FUNCTION public.partner_list_meal_nutrition_verification_statuses()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'meal_id', m.id,
    'nutrition_version', m.nutrition_version,
    'completeness_score', m.nutrient_completeness_score,
    'verification', CASE WHEN cv.meal_id IS NULL THEN NULL ELSE jsonb_build_object(
      'tier', cv.tier,
      'verified_at', cv.verified_at,
      'expires_at', cv.expires_at,
      'public_summary', cv.public_summary
    ) END,
    'latest_request', CASE WHEN rq.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', rq.id,
      'tier', rq.requested_tier,
      'status', rq.status,
      'nutrition_version', rq.submitted_nutrition_version,
      'review_notes', rq.review_notes,
      'created_at', rq.created_at
    ) END
  ) ORDER BY m.name), '[]'::JSONB)
  INTO v_result
  FROM public.meals m
  JOIN public.restaurants r ON r.id = m.restaurant_id AND r.owner_id = v_actor
  LEFT JOIN public.current_meal_nutrition_verifications cv ON cv.meal_id = m.id
  LEFT JOIN LATERAL (
    SELECT q.id, q.requested_tier, q.status, q.submitted_nutrition_version,
           q.review_notes, q.created_at
    FROM public.meal_nutrition_verification_requests q
    WHERE q.meal_id = m.id AND q.requested_by = v_actor
    ORDER BY q.created_at DESC
    LIMIT 1
  ) rq ON TRUE;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_nutrition_verification_operations()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_requests JSONB;
  v_current JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'meal_id', q.meal_id,
    'meal_name', m.name,
    'restaurant_id', q.restaurant_id,
    'restaurant_name', r.name,
    'tier', q.requested_tier,
    'nutrition_version', q.submitted_nutrition_version,
    'evidence_reference', q.evidence_reference,
    'partner_notes', q.partner_notes,
    'status', q.status,
    'created_at', q.created_at
  ) ORDER BY q.created_at), '[]'::JSONB)
  INTO v_requests
  FROM public.meal_nutrition_verification_requests q
  JOIN public.meals m ON m.id = q.meal_id
  JOIN public.restaurants r ON r.id = q.restaurant_id
  WHERE q.status IN ('pending', 'needs_info');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'meal_id', v.meal_id,
    'meal_name', m.name,
    'restaurant_name', r.name,
    'tier', v.tier,
    'nutrition_version', v.nutrition_version,
    'public_summary', v.public_summary,
    'verified_at', v.verified_at,
    'expires_at', v.expires_at,
    'next_sample_due_at', v.next_sample_due_at,
    'is_expired', v.expires_at <= clock_timestamp(),
    'sample_due', v.next_sample_due_at <= clock_timestamp()
  ) ORDER BY v.next_sample_due_at), '[]'::JSONB)
  INTO v_current
  FROM public.meal_nutrition_verifications v
  JOIN public.meals m ON m.id = v.meal_id
  JOIN public.restaurants r ON r.id = v.restaurant_id
  WHERE v.status = 'current';

  RETURN jsonb_build_object(
    'requests', v_requests,
    'current', v_current,
    'generated_at', clock_timestamp()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_meal_nutrition_verification(UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_meal_nutrition_verification(UUID)
  TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.partner_list_meal_nutrition_verification_statuses()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_list_meal_nutrition_verification_statuses()
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_get_nutrition_verification_operations()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_nutrition_verification_operations()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_current_meal_nutrition_verification(UUID) IS
  'Returns the privacy-safe, current Nutrio Verified claim for one public meal.';
COMMENT ON FUNCTION public.partner_list_meal_nutrition_verification_statuses() IS
  'Returns verification status only for meals owned by the authenticated partner.';
COMMENT ON FUNCTION public.admin_get_nutrition_verification_operations() IS
  'AAL2 admin operations queue for verification requests, expiry, and sampling.';
