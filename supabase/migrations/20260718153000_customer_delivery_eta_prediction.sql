-- Add live ETA prediction to the customer-safe delivery tracking projection.
-- The RPC still exposes only the latest driver snapshot, while the destination
-- coordinates remain server-side and are used only to calculate ETA.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_customer_delivery_tracking(
  p_source_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_driver JSONB;
  v_location JSONB;
  v_eta JSONB;
  v_driver_lat DOUBLE PRECISION;
  v_driver_lng DOUBLE PRECISION;
  v_delivery_lat DOUBLE PRECISION;
  v_delivery_lng DOUBLE PRECISION;
  v_speed_kmh DOUBLE PRECISION;
  v_gps_age_minutes DOUBLE PRECISION;
  v_distance_km DOUBLE PRECISION;
  v_eta_minutes INTEGER;
  v_total_minutes INTEGER;
  v_elapsed_minutes DOUBLE PRECISION;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT dj.* INTO v_job
  FROM public.delivery_jobs dj
  WHERE (dj.schedule_id = p_source_id OR dj.order_id = p_source_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.meal_schedules ms
        WHERE ms.id = dj.schedule_id AND ms.user_id = v_actor
      )
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = dj.order_id AND o.user_id = v_actor
      )
    )
  ORDER BY dj.created_at DESC, dj.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'delivery_job', NULL,
      'latest_location', NULL,
      'eta_prediction', NULL
    );
  END IF;

  IF v_job.driver_id IS NOT NULL
     AND v_job.status IN ('assigned', 'accepted', 'picked_up', 'in_transit') THEN
    SELECT jsonb_build_object(
      'id', d.id,
      'full_name', d.full_name,
      'phone_number', d.phone_number,
      'vehicle_type', d.vehicle_type,
      'vehicle_make', d.vehicle_make,
      'vehicle_model', d.vehicle_model,
      'license_plate', d.license_plate,
      'rating', d.rating,
      'total_deliveries', d.total_deliveries
    )
    INTO v_driver
    FROM public.drivers d
    WHERE d.id = v_job.driver_id
      AND d.city_id = v_job.city_id;
  END IF;

  IF v_job.driver_id IS NOT NULL
     AND v_job.status IN ('assigned', 'accepted', 'picked_up', 'in_transit') THEN
    SELECT jsonb_build_object(
      'lat', d.current_lat,
      'lng', d.current_lng,
      'updated_at', GREATEST(dl.timestamp, d.last_location_update, d.last_location_at),
      'speed_kmh', dl.speed_kmh,
      'heading', dl.heading
    )
    INTO v_location
    FROM public.drivers d
    LEFT JOIN LATERAL (
      SELECT l.timestamp, l.speed_kmh, l.heading
      FROM public.driver_locations l
      WHERE l.driver_id = d.id
      ORDER BY l.timestamp DESC NULLS LAST, l.id DESC
      LIMIT 1
    ) dl ON true
    WHERE d.id = v_job.driver_id
      AND d.city_id = v_job.city_id
      AND d.current_lat IS NOT NULL
      AND d.current_lng IS NOT NULL
      AND GREATEST(dl.timestamp, d.last_location_update, d.last_location_at)
        >= COALESCE(v_job.accepted_at, v_job.assigned_at, v_job.created_at);
  END IF;

  IF v_location IS NOT NULL
     AND v_job.delivery_lat IS NOT NULL
     AND v_job.delivery_lng IS NOT NULL THEN
    v_driver_lat := (v_location ->> 'lat')::DOUBLE PRECISION;
    v_driver_lng := (v_location ->> 'lng')::DOUBLE PRECISION;
    v_delivery_lat := v_job.delivery_lat::DOUBLE PRECISION;
    v_delivery_lng := v_job.delivery_lng::DOUBLE PRECISION;
    v_speed_kmh := NULLIF((v_location ->> 'speed_kmh')::DOUBLE PRECISION, 0);
    v_gps_age_minutes := EXTRACT(EPOCH FROM (now() - ((v_location ->> 'updated_at')::TIMESTAMPTZ))) / 60;

    v_distance_km := GREATEST(
      0.05,
      6371 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(v_delivery_lat - v_driver_lat) / 2), 2)
        + COS(RADIANS(v_driver_lat))
        * COS(RADIANS(v_delivery_lat))
        * POWER(SIN(RADIANS(v_delivery_lng - v_driver_lng) / 2), 2)
      )) * 1.22
    );

    v_speed_kmh := CASE
      WHEN v_speed_kmh IS NULL OR v_speed_kmh < 3 THEN 28
      WHEN v_gps_age_minutes > 5 THEN GREATEST(12, LEAST(75, v_speed_kmh * 0.8))
      ELSE GREATEST(12, LEAST(75, v_speed_kmh))
    END;

    v_eta_minutes := GREATEST(1, CEIL((v_distance_km / v_speed_kmh) * 60 + 2)::INTEGER);
    v_eta := jsonb_build_object(
      'minutes', v_eta_minutes,
      'distanceKm', ROUND(v_distance_km::NUMERIC, 2),
      'confidence', CASE WHEN v_gps_age_minutes > 5 THEN 'stale' ELSE 'live' END,
      'source', 'gps',
      'gpsAgeMinutes', ROUND(GREATEST(0, v_gps_age_minutes)::NUMERIC, 0)
    );
  ELSIF v_job.estimated_distance_km IS NOT NULL AND v_job.estimated_distance_km > 0 THEN
    v_total_minutes := CEIL((v_job.estimated_distance_km::DOUBLE PRECISION / 28) * 60 + 2)::INTEGER;
    v_elapsed_minutes := CASE
      WHEN v_job.picked_up_at IS NULL THEN 0
      ELSE GREATEST(0, EXTRACT(EPOCH FROM (now() - v_job.picked_up_at)) / 60)
    END;
    v_eta_minutes := GREATEST(1, CEIL(v_total_minutes - v_elapsed_minutes)::INTEGER);
    v_eta := jsonb_build_object(
      'minutes', v_eta_minutes,
      'distanceKm', ROUND(v_job.estimated_distance_km::NUMERIC, 2),
      'confidence', 'estimated',
      'source', 'distance',
      'gpsAgeMinutes', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'delivery_job', jsonb_build_object(
      'id', v_job.id,
      'status', v_job.status,
      'schedule_id', v_job.schedule_id,
      'order_id', v_job.order_id,
      'driver_id', v_job.driver_id,
      'assigned_at', v_job.assigned_at,
      'picked_up_at', v_job.picked_up_at,
      'delivered_at', v_job.delivered_at,
      'created_at', v_job.created_at,
      'driver', v_driver
    ),
    'latest_location', v_location,
    'eta_prediction', v_eta
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_delivery_tracking(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_delivery_tracking(UUID)
  TO authenticated;

COMMIT;
