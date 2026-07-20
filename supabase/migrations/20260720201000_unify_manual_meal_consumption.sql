BEGIN;

CREATE OR REPLACE FUNCTION public.log_manual_meal_items_v3(
  p_items JSONB,
  p_log_date DATE,
  p_request_id UUID,
  p_source TEXT DEFAULT 'manual',
  p_started_consuming_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  p_time_precision TEXT DEFAULT 'exact',
  p_timezone_name TEXT DEFAULT 'Asia/Qatar',
  p_utc_offset_minutes SMALLINT DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_legacy JSONB;
  v_source_type TEXT;
  v_snapshot JSONB;
  v_consumption public.meal_consumptions%ROWTYPE;
  v_history_id UUID;
  v_semantic_key TEXT;
  v_calories INTEGER;
  v_protein INTEGER;
  v_carbs INTEGER;
  v_fat INTEGER;
  v_fiber INTEGER;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'INVALID_MEAL_ITEMS'; END IF;
  IF p_time_precision NOT IN ('exact', 'estimated_15m', 'estimated_30m', 'date_only') THEN RAISE EXCEPTION 'INVALID_TIME_PRECISION'; END IF;
  IF p_time_precision <> 'date_only' AND p_started_consuming_at IS NULL THEN RAISE EXCEPTION 'CONSUMPTION_START_REQUIRED'; END IF;
  IF p_started_consuming_at > clock_timestamp() + INTERVAL '5 minutes' THEN RAISE EXCEPTION 'CONSUMPTION_TIME_IN_FUTURE'; END IF;
  IF p_timezone_name IS NULL OR char_length(p_timezone_name) NOT BETWEEN 1 AND 80 OR p_utc_offset_minutes NOT BETWEEN -840 AND 840 THEN RAISE EXCEPTION 'VALID_TIMEZONE_REQUIRED'; END IF;

  SELECT * INTO v_consumption FROM public.meal_consumptions consumptions
  WHERE consumptions.user_id = v_actor AND consumptions.source_id = p_request_id
    AND consumptions.source_meal_id = p_request_id
    AND consumptions.source_type IN ('manual_log', 'barcode_product', 'custom_food');
  IF FOUND THEN
    RETURN jsonb_build_object('success', TRUE, 'duplicate', TRUE, 'consumption_id', v_consumption.id,
      'logged_count', jsonb_array_length(v_consumption.consumed_item_snapshot -> 'items'),
      'history_ids', CASE WHEN v_consumption.meal_history_id IS NULL THEN '[]'::JSONB ELSE jsonb_build_array(v_consumption.meal_history_id) END,
      'xp_awarded', 0);
  END IF;

  v_legacy := public.log_manual_meal_items_v2(p_items, p_log_date, p_request_id, COALESCE(NULLIF(trim(p_source), ''), 'manual'));
  IF COALESCE((v_legacy ->> 'success')::BOOLEAN, FALSE) IS NOT TRUE THEN RAISE EXCEPTION 'MANUAL_MEAL_WRITE_FAILED'; END IF;

  SELECT COALESCE(sum((item ->> 'calories')::NUMERIC), 0)::INTEGER,
    COALESCE(sum((item ->> 'protein_g')::NUMERIC), 0)::INTEGER,
    COALESCE(sum((item ->> 'carbs_g')::NUMERIC), 0)::INTEGER,
    COALESCE(sum((item ->> 'fat_g')::NUMERIC), 0)::INTEGER,
    COALESCE(sum((item ->> 'fiber_g')::NUMERIC), 0)::INTEGER
  INTO v_calories, v_protein, v_carbs, v_fat, v_fiber
  FROM jsonb_array_elements(p_items) item;

  v_source_type := CASE WHEN lower(COALESCE(p_source, '')) LIKE '%barcode%' THEN 'barcode_product'
    WHEN lower(COALESCE(p_source, '')) LIKE '%custom%' THEN 'custom_food' ELSE 'manual_log' END;
  v_history_id := NULLIF(v_legacy -> 'history_ids' ->> 0, '')::UUID;
  v_snapshot := jsonb_build_object('schema_version', 1, 'meal_id', NULL,
    'meal_name', CASE WHEN jsonb_array_length(p_items) = 1 THEN COALESCE(p_items -> 0 ->> 'name', 'Meal') ELSE concat(jsonb_array_length(p_items), ' food items') END,
    'image_url', p_items -> 0 ->> 'image_url', 'items', p_items,
    'calories', v_calories, 'protein_g', v_protein, 'carbs_g', v_carbs, 'fat_g', v_fat, 'fiber_g', v_fiber,
    'completeness_score', 1, 'provenance', jsonb_build_object('source', p_source, 'request_id', p_request_id), 'captured_at', clock_timestamp());
  v_semantic_key := concat_ws(':', v_actor::TEXT, v_source_type, p_request_id::TEXT, 'consumed', '1');

  INSERT INTO public.meal_consumptions (user_id, source_type, source_id, source_meal_id, status, portion_percent, portion,
    nutrition_snapshot, source_snapshot, consumed_item_snapshot, applied_calories, applied_protein_g, applied_carbs_g,
    applied_fat_g, applied_fiber_g, log_date, meal_history_id, event_version, semantic_idempotency_key,
    started_consuming_at, time_precision, portion_confirmed_at, timezone_name, utc_offset_minutes)
  VALUES (v_actor, v_source_type, p_request_id, p_request_id, 'full', 100, 1, v_snapshot, v_snapshot, v_snapshot,
    v_calories, v_protein, v_carbs, v_fat, v_fiber, p_log_date, v_history_id, 1, v_semantic_key,
    CASE WHEN p_time_precision = 'date_only' THEN NULL ELSE p_started_consuming_at END,
    p_time_precision, clock_timestamp(), p_timezone_name, p_utc_offset_minutes)
  RETURNING * INTO v_consumption;

  IF v_history_id IS NOT NULL THEN UPDATE public.meal_history SET source_consumption_id = v_consumption.id
    WHERE id = v_history_id AND user_id = v_actor AND source_consumption_id IS NULL; END IF;

  INSERT INTO public.meal_consumption_events (consumption_id, user_id, request_id, event_version, previous_state,
    current_state, nutrition_delta, result_snapshot, source_type, source_id, source_meal_id, event_type, semantic_idempotency_key)
  VALUES (v_consumption.id, v_actor, p_request_id, 1, NULL, to_jsonb(v_consumption),
    jsonb_build_object('calories', v_calories, 'protein_g', v_protein, 'carbs_g', v_carbs, 'fat_g', v_fat, 'fiber_g', v_fiber),
    to_jsonb(v_consumption), v_source_type, p_request_id, p_request_id, 'consumed', v_semantic_key);

  RETURN v_legacy || jsonb_build_object('consumption_id', v_consumption.id, 'source_type', v_source_type,
    'time_precision', v_consumption.time_precision, 'started_consuming_at', v_consumption.started_consuming_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.log_manual_meal_items_v3(JSONB, DATE, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, SMALLINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_manual_meal_items_v3(JSONB, DATE, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, SMALLINT) TO authenticated;

COMMIT;
