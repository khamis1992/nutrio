BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_meal_response_experiment_consumption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_consumed_meal_id UUID;
  v_assignment_id UUID;
  v_experiment_id UUID;
  v_expected_meal_id UUID;
BEGIN
  IF NEW.status NOT IN ('full', 'partial', 'substituted')
     OR NEW.started_consuming_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_consumed_meal_id := COALESCE(NEW.substitute_meal_id, NEW.source_meal_id);
  IF v_consumed_meal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT assignments.id,
         assignments.experiment_id,
         (arm.value ->> 'meal_id')::UUID
  INTO v_assignment_id, v_experiment_id, v_expected_meal_id
  FROM public.meal_response_experiments experiments
  JOIN public.meal_response_experiment_assignments assignments
    ON assignments.experiment_id = experiments.id
  CROSS JOIN LATERAL jsonb_array_elements(experiments.arms) arm(value)
  WHERE experiments.user_id = NEW.user_id
    AND experiments.status = 'active'
    AND assignments.consumed_consumption_id IS NULL
    AND arm.value ->> 'key' = assignments.arm_key
  ORDER BY experiments.started_at, assignments.sequence_number
  LIMIT 1
  FOR UPDATE OF assignments;

  IF NOT FOUND OR v_expected_meal_id IS DISTINCT FROM v_consumed_meal_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.meal_response_experiment_assignments
  SET consumed_consumption_id = NEW.id,
      completed_at = clock_timestamp()
  WHERE id = v_assignment_id
    AND consumed_consumption_id IS NULL;

  IF FOUND AND NOT EXISTS (
    SELECT 1
    FROM public.meal_response_experiment_assignments remaining
    WHERE remaining.experiment_id = v_experiment_id
      AND remaining.consumed_consumption_id IS NULL
  ) THEN
    UPDATE public.meal_response_experiments
    SET status = 'completed',
        completed_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = v_experiment_id
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS auto_link_meal_response_experiment_consumption
  ON public.meal_consumptions;
CREATE TRIGGER auto_link_meal_response_experiment_consumption
  AFTER INSERT OR UPDATE OF status, started_consuming_at, source_meal_id, substitute_meal_id
  ON public.meal_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_meal_response_experiment_consumption();

REVOKE ALL ON FUNCTION public.auto_link_meal_response_experiment_consumption()
  FROM PUBLIC, anon, authenticated;

COMMIT;
