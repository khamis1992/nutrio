-- Migration: Coach Program Builder
-- Enables coaches to create structured meal plans and workout programs for clients

-- Parent table: program definition
CREATE TABLE IF NOT EXISTS coach_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('meal_plan', 'workout_plan')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coach_id, client_id, type, start_date)
);

-- Index for coach's client programs
CREATE INDEX IF NOT EXISTS idx_coach_programs_coach_client
  ON coach_programs(coach_id, client_id, created_at DESC);

-- Index for client's active programs
CREATE INDEX IF NOT EXISTS idx_coach_programs_client_active
  ON coach_programs(client_id, status)
  WHERE status = 'active';

-- Meal assignments within a meal plan program
CREATE TABLE IF NOT EXISTS program_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES coach_programs(id) ON DELETE CASCADE,
  meal_id uuid REFERENCES meals(id) ON DELETE CASCADE,
  assigned_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, meal_id, assigned_date, meal_type)
);

-- Index for fetching meals within a program
CREATE INDEX IF NOT EXISTS idx_program_meals_program
  ON program_meals(program_id, assigned_date, meal_type);

-- Exercise assignments within a workout plan program
CREATE TABLE IF NOT EXISTS program_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES coach_programs(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  sets int NOT NULL DEFAULT 3 CHECK (sets > 0),
  reps text NOT NULL,
  rest_seconds int DEFAULT 60,
  notes text,
  day_number int NOT NULL CHECK (day_number > 0),
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching exercises within a program day
CREATE INDEX IF NOT EXISTS idx_program_exercises_program_day
  ON program_exercises(program_id, day_number, order_index);

-- Enable RLS on all three tables
ALTER TABLE coach_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;

-- coach_programs policies
CREATE POLICY "coaches_manage_own_programs" ON coach_programs
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "clients_view_own_programs" ON coach_programs
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- program_meals policies
CREATE POLICY "coaches_manage_own_program_meals" ON program_meals
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM coach_programs WHERE id = program_meals.program_id AND coach_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coach_programs WHERE id = program_meals.program_id AND coach_id = auth.uid()));

CREATE POLICY "clients_view_own_program_meals" ON program_meals
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM coach_programs WHERE id = program_meals.program_id AND client_id = auth.uid()));

-- program_exercises policies
CREATE POLICY "coaches_manage_own_program_exercises" ON program_exercises
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM coach_programs WHERE id = program_exercises.program_id AND coach_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coach_programs WHERE id = program_exercises.program_id AND coach_id = auth.uid()));

CREATE POLICY "clients_view_own_program_exercises" ON program_exercises
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM coach_programs WHERE id = program_exercises.program_id AND client_id = auth.uid()));
