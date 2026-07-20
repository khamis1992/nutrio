-- Branch-level supplier quality signals and bounded routing impact.

BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_quality_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('late_delivery', 'food_quality', 'wrong_item', 'portion', 'nutrition_mismatch', 'packaging', 'other')),
  severity SMALLINT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 3),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolution_note TEXT CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 500),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, order_id, category)
);

CREATE TABLE IF NOT EXISTS public.supplier_quality_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  delivered_orders INTEGER NOT NULL DEFAULT 0,
  on_time_orders INTEGER NOT NULL DEFAULT 0,
  prep_measured_orders INTEGER NOT NULL DEFAULT 0,
  prep_within_sla_orders INTEGER NOT NULL DEFAULT 0,
  verified_review_count INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(4,2),
  weighted_incident_count INTEGER NOT NULL DEFAULT 0,
  nutrition_sample_count INTEGER NOT NULL DEFAULT 0,
  nutrition_pass_count INTEGER NOT NULL DEFAULT 0,
  substitution_count INTEGER NOT NULL DEFAULT 0,
  delivery_score NUMERIC(5,2) NOT NULL,
  preparation_score NUMERIC(5,2) NOT NULL,
  review_score NUMERIC(5,2) NOT NULL,
  incident_score NUMERIC(5,2) NOT NULL,
  nutrition_score NUMERIC(5,2) NOT NULL,
  quality_score NUMERIC(5,2) NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  quality_status TEXT NOT NULL CHECK (quality_status IN ('excellent', 'healthy', 'watch', 'restricted')),
  routing_adjustment NUMERIC(6,2) NOT NULL CHECK (routing_adjustment BETWEEN -20 AND 10),
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(evidence) = 'object'),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS supplier_quality_incidents_branch_created_idx
  ON public.supplier_quality_incidents (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_quality_snapshots_branch_calculated_idx
  ON public.supplier_quality_snapshots (branch_id, calculated_at DESC);

ALTER TABLE public.supplier_quality_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quality_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quality_incidents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quality_snapshots FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_quality_incidents, public.supplier_quality_snapshots FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.supplier_quality_incidents, public.supplier_quality_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.create_my_supplier_quality_incident(
  p_order_id UUID,
  p_category TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid(); v_order public.orders%ROWTYPE; v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_category NOT IN ('late_delivery', 'food_quality', 'wrong_item', 'portion', 'nutrition_mismatch', 'packaging', 'other') THEN
    RAISE EXCEPTION 'INVALID_SUPPLIER_INCIDENT_CATEGORY';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = v_user_id;
  IF NOT FOUND OR v_order.restaurant_id IS NULL THEN RAISE EXCEPTION 'ELIGIBLE_ORDER_REQUIRED'; END IF;
  INSERT INTO public.supplier_quality_incidents (
    user_id, order_id, restaurant_id, branch_id, category, description
  ) VALUES (
    v_user_id, v_order.id, v_order.restaurant_id, v_order.restaurant_branch_id,
    p_category, NULLIF(btrim(p_description), '')
  )
  ON CONFLICT (user_id, order_id, category) DO UPDATE SET
    description = COALESCE(EXCLUDED.description, public.supplier_quality_incidents.description),
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_supplier_quality_incident(
  p_incident_id UUID,
  p_status TEXT,
  p_resolution_note TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_admin UUID := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED'; END IF;
  IF p_status NOT IN ('investigating', 'resolved', 'dismissed') THEN RAISE EXCEPTION 'INVALID_INCIDENT_STATUS'; END IF;
  UPDATE public.supplier_quality_incidents SET
    status = p_status,
    resolution_note = NULLIF(btrim(p_resolution_note), ''),
    resolved_by = CASE WHEN p_status IN ('resolved', 'dismissed') THEN v_admin ELSE resolved_by END,
    resolved_at = CASE WHEN p_status IN ('resolved', 'dismissed') THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_incident_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_supplier_quality_snapshots(
  p_window_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor UUID := auth.uid(); v_start DATE; v_end DATE := CURRENT_DATE; v_count INTEGER;
BEGIN
  IF p_window_days NOT BETWEEN 30 AND 365 THEN RAISE EXCEPTION 'INVALID_QUALITY_WINDOW'; END IF;
  IF auth.role() <> 'service_role' AND (v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;
  v_start := v_end - p_window_days;

  WITH order_metrics AS (
    SELECT rb.id AS branch_id,
      count(o.id) FILTER (WHERE o.delivered_at IS NOT NULL)::INTEGER AS delivered_orders,
      count(o.id) FILTER (WHERE o.delivered_at IS NOT NULL AND (o.estimated_delivery_time IS NULL OR o.delivered_at <= o.estimated_delivery_time))::INTEGER AS on_time_orders,
      count(o.id) FILTER (WHERE o.preparing_at IS NOT NULL AND o.ready_for_pickup_at IS NOT NULL)::INTEGER AS prep_measured_orders,
      count(o.id) FILTER (WHERE o.preparing_at IS NOT NULL AND o.ready_for_pickup_at IS NOT NULL
        AND o.ready_for_pickup_at <= o.preparing_at + make_interval(mins => COALESCE(rb.avg_prep_time_minutes, 20) + 10))::INTEGER AS prep_within_sla_orders
    FROM public.restaurant_branches rb
    LEFT JOIN public.orders o ON o.restaurant_branch_id = rb.id AND o.created_at::DATE BETWEEN v_start AND v_end
    GROUP BY rb.id
  ), review_metrics AS (
    SELECT rb.id AS branch_id,
      count(mr.id) FILTER (WHERE mr.is_verified_purchase = TRUE AND mr.is_approved = TRUE)::INTEGER AS verified_review_count,
      avg(mr.rating) FILTER (WHERE mr.is_verified_purchase = TRUE AND mr.is_approved = TRUE)::NUMERIC(4,2) AS average_rating
    FROM public.restaurant_branches rb
    LEFT JOIN public.meal_reviews mr ON mr.restaurant_id = rb.restaurant_id AND mr.created_at::DATE BETWEEN v_start AND v_end
    GROUP BY rb.id
  ), incident_metrics AS (
    SELECT rb.id AS branch_id,
      COALESCE(sum(i.severity) FILTER (WHERE i.status <> 'dismissed'), 0)::INTEGER AS weighted_incident_count
    FROM public.restaurant_branches rb
    LEFT JOIN public.supplier_quality_incidents i ON i.branch_id = rb.id AND i.created_at::DATE BETWEEN v_start AND v_end
    GROUP BY rb.id
  ), nutrition_metrics AS (
    SELECT rb.id AS branch_id,
      count(s.id)::INTEGER AS nutrition_sample_count,
      count(s.id) FILTER (WHERE s.outcome = 'pass')::INTEGER AS nutrition_pass_count
    FROM public.restaurant_branches rb
    LEFT JOIN public.meal_nutrition_verifications v ON v.restaurant_id = rb.restaurant_id
    LEFT JOIN public.meal_nutrition_verification_samples s ON s.verification_id = v.id AND s.created_at::DATE BETWEEN v_start AND v_end
    GROUP BY rb.id
  ), substitution_metrics AS (
    SELECT rb.id AS branch_id, count(e.id)::INTEGER AS substitution_count
    FROM public.restaurant_branches rb
    LEFT JOIN public.meal_schedules ms ON ms.restaurant_branch_id = rb.id
    LEFT JOIN public.meal_schedule_substitution_events e ON e.schedule_id = ms.id AND e.created_at::DATE BETWEEN v_start AND v_end
    GROUP BY rb.id
  ), scored AS (
    SELECT rb.id AS branch_id,
      om.delivered_orders, om.on_time_orders, om.prep_measured_orders, om.prep_within_sla_orders,
      rm.verified_review_count, rm.average_rating, im.weighted_incident_count,
      nm.nutrition_sample_count, nm.nutrition_pass_count, sm.substitution_count,
      CASE WHEN om.delivered_orders = 0 THEN 80 ELSE round(100.0 * om.on_time_orders / om.delivered_orders, 2) END AS delivery_score,
      CASE WHEN om.prep_measured_orders = 0 THEN 80 ELSE round(100.0 * om.prep_within_sla_orders / om.prep_measured_orders, 2) END AS preparation_score,
      CASE WHEN rm.verified_review_count = 0 THEN 80 ELSE round(20.0 * rm.average_rating, 2) END AS review_score,
      greatest(0, 100 - CASE WHEN om.delivered_orders = 0 THEN im.weighted_incident_count * 20 ELSE 100.0 * im.weighted_incident_count / om.delivered_orders END) AS incident_score,
      CASE WHEN nm.nutrition_sample_count = 0 THEN 70 ELSE round(100.0 * nm.nutrition_pass_count / nm.nutrition_sample_count, 2) END AS nutrition_score
    FROM public.restaurant_branches rb
    JOIN order_metrics om ON om.branch_id = rb.id
    JOIN review_metrics rm ON rm.branch_id = rb.id
    JOIN incident_metrics im ON im.branch_id = rb.id
    JOIN nutrition_metrics nm ON nm.branch_id = rb.id
    JOIN substitution_metrics sm ON sm.branch_id = rb.id
  ), final AS (
    SELECT scored.*,
      round(delivery_score * .35 + preparation_score * .25 + review_score * .15 + incident_score * .10 + nutrition_score * .15, 2) AS quality_score
    FROM scored
  )
  INSERT INTO public.supplier_quality_snapshots (
    branch_id, window_start, window_end, delivered_orders, on_time_orders,
    prep_measured_orders, prep_within_sla_orders, verified_review_count, average_rating,
    weighted_incident_count, nutrition_sample_count, nutrition_pass_count, substitution_count,
    delivery_score, preparation_score, review_score, incident_score, nutrition_score,
    quality_score, quality_status, routing_adjustment, evidence, calculated_at
  )
  SELECT branch_id, v_start, v_end, delivered_orders, on_time_orders,
    prep_measured_orders, prep_within_sla_orders, verified_review_count, average_rating,
    weighted_incident_count, nutrition_sample_count, nutrition_pass_count, substitution_count,
    delivery_score, preparation_score, review_score, incident_score, nutrition_score,
    quality_score,
    CASE WHEN quality_score >= 90 THEN 'excellent' WHEN quality_score >= 75 THEN 'healthy' WHEN quality_score >= 60 THEN 'watch' ELSE 'restricted' END,
    CASE WHEN quality_score >= 90 THEN 10 WHEN quality_score >= 75 THEN 0 WHEN quality_score >= 60 THEN -8 ELSE -20 END,
    jsonb_build_object('weights', jsonb_build_object('delivery', .35, 'preparation', .25, 'reviews', .15, 'incidents', .10, 'nutrition', .15), 'window_days', p_window_days), now()
  FROM final
  ON CONFLICT (branch_id, window_start, window_end) DO UPDATE SET
    delivered_orders = EXCLUDED.delivered_orders, on_time_orders = EXCLUDED.on_time_orders,
    prep_measured_orders = EXCLUDED.prep_measured_orders, prep_within_sla_orders = EXCLUDED.prep_within_sla_orders,
    verified_review_count = EXCLUDED.verified_review_count, average_rating = EXCLUDED.average_rating,
    weighted_incident_count = EXCLUDED.weighted_incident_count,
    nutrition_sample_count = EXCLUDED.nutrition_sample_count, nutrition_pass_count = EXCLUDED.nutrition_pass_count,
    substitution_count = EXCLUDED.substitution_count, delivery_score = EXCLUDED.delivery_score,
    preparation_score = EXCLUDED.preparation_score, review_score = EXCLUDED.review_score,
    incident_score = EXCLUDED.incident_score, nutrition_score = EXCLUDED.nutrition_score,
    quality_score = EXCLUDED.quality_score, quality_status = EXCLUDED.quality_status,
    routing_adjustment = EXCLUDED.routing_adjustment, evidence = EXCLUDED.evidence, calculated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_supplier_quality_snapshots()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor UUID := auth.uid(); v_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.quality_score ASC, row_data.restaurant_name, row_data.branch_name), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT s.*, rb.name AS branch_name, r.name AS restaurant_name
    FROM public.supplier_quality_snapshots s
    JOIN public.restaurant_branches rb ON rb.id = s.branch_id
    JOIN public.restaurants r ON r.id = rb.restaurant_id
    WHERE (s.branch_id, s.calculated_at) IN (
      SELECT branch_id, max(calculated_at) FROM public.supplier_quality_snapshots GROUP BY branch_id
    )
  ) row_data;
  RETURN v_result;
END;
$$;

-- Preserve the existing router as a base implementation, then apply a bounded
-- quality adjustment while retaining all capacity and distance eligibility gates.
ALTER FUNCTION public.route_meal_schedule_branch(UUID, UUID, UUID, DATE, TEXT, TEXT)
  RENAME TO route_meal_schedule_branch_base;

CREATE OR REPLACE FUNCTION public.route_meal_schedule_branch(
  p_restaurant_id UUID,
  p_meal_id UUID,
  p_delivery_address_id UUID,
  p_scheduled_date DATE,
  p_delivery_time_slot TEXT,
  p_meal_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_base JSONB; v_best JSONB;
BEGIN
  v_base := public.route_meal_schedule_branch_base(
    p_restaurant_id, p_meal_id, p_delivery_address_id,
    p_scheduled_date, p_delivery_time_slot, p_meal_type
  );
  IF v_base ->> 'status' <> 'routed' THEN RETURN v_base; END IF;

  SELECT candidate INTO v_best
  FROM jsonb_array_elements(COALESCE(v_base -> 'candidates', '[]'::JSONB)) candidate
  LEFT JOIN LATERAL (
    SELECT s.routing_adjustment, s.quality_score, s.quality_status
    FROM public.supplier_quality_snapshots s
    WHERE s.branch_id = NULLIF(candidate ->> 'branch_id', '')::UUID
    ORDER BY s.calculated_at DESC LIMIT 1
  ) quality ON TRUE
  WHERE COALESCE((candidate ->> 'eligible')::BOOLEAN, FALSE)
  ORDER BY COALESCE((candidate ->> 'score')::NUMERIC, 0) + COALESCE(quality.routing_adjustment, 0) DESC,
    NULLIF(candidate ->> 'distance_km', '')::NUMERIC ASC NULLS LAST
  LIMIT 1;

  IF v_best IS NULL THEN RETURN v_base; END IF;
  RETURN v_base || jsonb_build_object(
    'branch_id', v_best ->> 'branch_id',
    'branch_name', v_best ->> 'name',
    'score', COALESCE((v_best ->> 'score')::NUMERIC, 0) + COALESCE((
      SELECT s.routing_adjustment FROM public.supplier_quality_snapshots s
      WHERE s.branch_id = NULLIF(v_best ->> 'branch_id', '')::UUID
      ORDER BY s.calculated_at DESC LIMIT 1
    ), 0),
    'reason', 'best_distance_capacity_quality_score',
    'quality_adjustment_applied', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.route_meal_schedule_branch_base(UUID, UUID, UUID, DATE, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_meal_schedule_branch_base(UUID, UUID, UUID, DATE, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.route_meal_schedule_branch(UUID, UUID, UUID, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.route_meal_schedule_branch(UUID, UUID, UUID, DATE, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_my_supplier_quality_incident(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_supplier_quality_incident(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_supplier_quality_snapshots(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_supplier_quality_snapshots() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_supplier_quality_incident(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_supplier_quality_incident(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_supplier_quality_snapshots(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_supplier_quality_snapshots() TO authenticated;

COMMIT;
