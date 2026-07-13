-- Migration: Exercise and Meal Completion Tracking
-- Enables clients to mark individual exercises and meals as completed within their programs

-- Exercise completions: tracks which exercises a client has done
CREATE TABLE IF NOT EXISTS program_exercise_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_exercise_id uuid NOT NULL REFERENCES program_exercises(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_exercise_id, client_id, completed_at)
);

CREATE INDEX IF NOT EXISTS idx_exercise_completions_client
  ON program_exercise_completions(client_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_completions_exercise
  ON program_exercise_completions(program_exercise_id);

-- Meal completions: tracks which meals a client has eaten
CREATE TABLE IF NOT EXISTS program_meal_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_meal_id uuid NOT NULL REFERENCES program_meals(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_meal_id, client_id, completed_at)
);

CREATE INDEX IF NOT EXISTS idx_meal_completions_client
  ON program_meal_completions(client_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_completions_meal
  ON program_meal_completions(program_meal_id);

-- Enable RLS
ALTER TABLE program_exercise_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_meal_completions ENABLE ROW LEVEL SECURITY;

-- Exercise completion policies
-- Clients can manage their own completions
DO $$ BEGIN
CREATE POLICY "clients_manage_own_exercise_completions" ON program_exercise_completions
  FOR ALL
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Coaches can view completions for their programs
DO $$ BEGIN
CREATE POLICY "coaches_view_program_exercise_completions" ON program_exercise_completions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_exercises pe
      JOIN coach_programs cp ON cp.id = pe.program_id
      WHERE pe.id = program_exercise_completions.program_exercise_id
      AND cp.coach_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Meal completion policies
-- Clients can manage their own completions
DO $$ BEGIN
CREATE POLICY "clients_manage_own_meal_completions" ON program_meal_completions
  FOR ALL
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Coaches can view completions for their programs
DO $$ BEGIN
CREATE POLICY "coaches_view_program_meal_completions" ON program_meal_completions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_meals pm
      JOIN coach_programs cp ON cp.id = pm.program_id
      WHERE pm.id = program_meal_completions.program_meal_id
      AND cp.coach_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

