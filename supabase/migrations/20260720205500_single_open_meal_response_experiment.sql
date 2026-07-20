BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_response_one_open_experiment_per_user
  ON public.meal_response_experiments (user_id)
  WHERE status IN ('draft', 'active', 'paused');

COMMIT;
