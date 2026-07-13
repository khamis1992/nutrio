-- Secure cross-portal handoff and user-private recommendation RPCs.

CREATE OR REPLACE FUNCTION public.verify_pickup_by_code(
  p_verification_code TEXT,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_hash TEXT;
  v_attempts INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_driver_id IS NULL OR p_verification_code !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid verification code');
  END IF;

  SELECT dj.*
  INTO v_job
  FROM public.delivery_jobs dj
  JOIN public.drivers d ON d.id = dj.driver_id
  WHERE d.id = p_driver_id
    AND d.user_id = v_actor
    AND dj.status IN ('assigned', 'accepted')
  ORDER BY (d.current_job_id = dj.id) DESC, dj.assigned_at DESC NULLS LAST, dj.created_at DESC
  LIMIT 1
  FOR UPDATE OF dj;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No assigned delivery is ready for verification');
  END IF;

  IF COALESCE(v_job.is_verification_locked, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification is locked. Ask the restaurant for a new code.');
  END IF;

  IF v_job.verification_expires_at IS NOT NULL AND v_job.verification_expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification code has expired');
  END IF;

  v_hash := encode(sha256(convert_to(p_verification_code, 'UTF8')), 'hex');

  IF NOT (
    v_job.verification_code_hash = v_hash
    OR v_job.pickup_verification_code = p_verification_code
  ) THEN
    v_attempts := COALESCE(v_job.verification_attempts, 0) + 1;

    UPDATE public.delivery_jobs
    SET verification_attempts = v_attempts,
        is_verification_locked = v_attempts >= 5,
        updated_at = now()
    WHERE id = v_job.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', CASE
        WHEN v_attempts >= 5 THEN 'Verification is locked. Ask the restaurant for a new code.'
        ELSE 'Invalid verification code'
      END,
      'remaining_attempts', GREATEST(0, 5 - v_attempts)
    );
  END IF;

  UPDATE public.delivery_jobs
  SET status = 'picked_up',
      picked_up_at = COALESCE(picked_up_at, now()),
      qr_scanned_at = NULL,
      handover_method = 'manual',
      verification_attempts = 0,
      is_verification_locked = false,
      verification_code_hash = NULL,
      pickup_verification_code = NULL,
      verification_expires_at = NULL,
      updated_at = now()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pickup verified successfully',
    'job_id', v_job.id,
    'status', 'picked_up'
  );
END;
$$;

DROP FUNCTION IF EXISTS public.verify_pickup_by_qr(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.verify_pickup_by_qr(
  p_delivery_id UUID,
  p_qr_code TEXT,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_delivery_id IS NULL OR p_driver_id IS NULL OR p_qr_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery and QR code are required');
  END IF;

  SELECT dj.*
  INTO v_job
  FROM public.delivery_jobs dj
  JOIN public.drivers d ON d.id = dj.driver_id
  WHERE dj.id = p_delivery_id
    AND dj.driver_id = p_driver_id
    AND d.user_id = v_actor
    AND dj.status IN ('assigned', 'accepted')
  FOR UPDATE OF dj;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery is not assigned to this driver');
  END IF;

  IF p_qr_code <> v_job.id::TEXT THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid QR code');
  END IF;

  UPDATE public.delivery_jobs
  SET status = 'picked_up',
      picked_up_at = COALESCE(picked_up_at, now()),
      qr_scanned_at = now(),
      handover_method = 'qr',
      verification_attempts = 0,
      is_verification_locked = false,
      verification_code_hash = NULL,
      pickup_verification_code = NULL,
      verification_expires_at = NULL,
      updated_at = now()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pickup verified successfully',
    'job_id', v_job.id,
    'status', 'picked_up'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_verification_code(
  p_delivery_job_id UUID,
  p_partner_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_actor IS NULL OR p_partner_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT dj.*
  INTO v_job
  FROM public.delivery_jobs dj
  LEFT JOIN public.meal_schedules ms ON ms.id = dj.schedule_id
  LEFT JOIN public.meals m ON m.id = ms.meal_id
  WHERE dj.id = p_delivery_job_id
    AND dj.status IN ('pending', 'assigned', 'accepted')
    AND (
      public.has_role(v_actor, 'admin')
      OR public.is_restaurant_operator(COALESCE(dj.restaurant_id, m.restaurant_id), v_actor)
    )
  FOR UPDATE OF dj;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery is not available for this restaurant');
  END IF;

  v_code := lpad(floor(random() * 1000000)::TEXT, 6, '0');
  v_expires_at := now() + interval '15 minutes';

  UPDATE public.delivery_jobs
  SET pickup_verification_code = v_code,
      verification_code_hash = encode(sha256(convert_to(v_code, 'UTF8')), 'hex'),
      verification_expires_at = v_expires_at,
      verification_attempts = 0,
      is_verification_locked = false,
      updated_at = now()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification code refreshed',
    'verification_code', v_code,
    'expires_at', v_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_confirm_handover(
  p_delivery_job_id UUID,
  p_partner_user_id UUID,
  p_reason TEXT DEFAULT 'Partner override'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_partner_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF length(trim(COALESCE(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A short handover reason is required');
  END IF;

  SELECT dj.*
  INTO v_job
  FROM public.delivery_jobs dj
  LEFT JOIN public.meal_schedules ms ON ms.id = dj.schedule_id
  LEFT JOIN public.meals m ON m.id = ms.meal_id
  WHERE dj.id = p_delivery_job_id
    AND dj.status IN ('assigned', 'accepted')
    AND dj.driver_id IS NOT NULL
    AND (
      public.has_role(v_actor, 'admin')
      OR public.is_restaurant_operator(COALESCE(dj.restaurant_id, m.restaurant_id), v_actor)
    )
  FOR UPDATE OF dj;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery is not ready for handover');
  END IF;

  UPDATE public.delivery_jobs
  SET status = 'picked_up',
      picked_up_at = COALESCE(picked_up_at, now()),
      handover_method = 'partner_override',
      verification_attempts = 0,
      is_verification_locked = false,
      verification_code_hash = NULL,
      pickup_verification_code = NULL,
      verification_expires_at = NULL,
      delivery_notes = concat_ws(E'\n', NULLIF(delivery_notes, ''), 'Handover override: ' || trim(p_reason)),
      updated_at = now()
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Handover confirmed by partner',
    'job_id', v_job.id,
    'status', 'picked_up'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_delivery_verification(
  p_delivery_job_id UUID,
  p_partner_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR (p_partner_user_id IS NOT NULL AND p_partner_user_id <> v_actor) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN public.refresh_verification_code(p_delivery_job_id, v_actor);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_pickup_by_code(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_pickup_by_qr(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_verification_code(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_confirm_handover(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.initialize_delivery_verification(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_pickup_by_code(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pickup_by_qr(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_verification_code(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_confirm_handover(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_delivery_verification(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_pickup_verification_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_meal_interactions(
  p_user_id UUID,
  p_meal_id UUID
)
RETURNS TABLE(
  interaction_id UUID,
  active_ingredient TEXT,
  medication_name TEXT,
  food_ingredient TEXT,
  severity TEXT,
  description TEXT,
  recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT q.*
  FROM (
    SELECT DISTINCT
      fmi.id,
      fmi.active_ingredient,
      um.medication_name,
      fmi.food_ingredient,
      fmi.severity,
      fmi.description,
      fmi.recommendation
    FROM public.user_medications um
    JOIN public.food_medicine_interactions fmi
      ON lower(fmi.active_ingredient) = lower(um.active_ingredient)
    JOIN public.meal_ingredients mi
      ON lower(mi.name) LIKE '%' || lower(fmi.food_ingredient) || '%'
        OR lower(fmi.food_ingredient) LIKE '%' || lower(mi.name) || '%'
    WHERE um.user_id = p_user_id
      AND mi.meal_id = p_meal_id
  ) q
  ORDER BY CASE q.severity
    WHEN 'severe' THEN 1
    WHEN 'moderate' THEN 2
    WHEN 'mild' THEN 3
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_ingredient_interactions(
  p_user_id UUID,
  p_ingredient_names TEXT[]
)
RETURNS TABLE(
  interaction_id UUID,
  active_ingredient TEXT,
  medication_name TEXT,
  food_ingredient TEXT,
  severity TEXT,
  description TEXT,
  recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF COALESCE(cardinality(p_ingredient_names), 0) > 100 THEN
    RAISE EXCEPTION 'TOO_MANY_INGREDIENTS';
  END IF;

  RETURN QUERY
  SELECT q.*
  FROM (
    SELECT DISTINCT
      fmi.id,
      fmi.active_ingredient,
      um.medication_name,
      fmi.food_ingredient,
      fmi.severity,
      fmi.description,
      fmi.recommendation
    FROM public.user_medications um
    JOIN public.food_medicine_interactions fmi
      ON lower(fmi.active_ingredient) = lower(um.active_ingredient)
    JOIN unnest(p_ingredient_names) ing(name)
      ON lower(ing.name) LIKE '%' || lower(fmi.food_ingredient) || '%'
        OR lower(fmi.food_ingredient) LIKE '%' || lower(ing.name) || '%'
    WHERE um.user_id = p_user_id
  ) q
  ORDER BY CASE q.severity
    WHEN 'severe' THEN 1
    WHEN 'moderate' THEN 2
    WHEN 'mild' THEN 3
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.check_meal_interactions(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_ingredient_interactions(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_meal_interactions(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ingredient_interactions(UUID, TEXT[]) TO authenticated;

-- The newer lifecycle trigger is the sole delivery audit writer.
DO $$
DECLARE
  v_signature REGPROCEDURE;
BEGIN
  FOR v_signature IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('log_order_status_change', 'assign_driver_to_queue')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
  END LOOP;
END;
$$;
