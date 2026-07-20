-- Agent 6: reusable equipment profiles for plate calculations and safe substitutions.

CREATE TABLE IF NOT EXISTS public.workout_equipment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  bar_weight_kg numeric NOT NULL DEFAULT 20 CHECK (bar_weight_kg BETWEEN 0 AND 100),
  plate_pairs jsonb NOT NULL DEFAULT '[{"weightKg":20,"count":1},{"weightKg":15,"count":1},{"weightKg":10,"count":1},{"weightKg":5,"count":1},{"weightKg":2.5,"count":1},{"weightKg":1.25,"count":1}]'::jsonb,
  equipment text[] NOT NULL DEFAULT ARRAY['barbell','dumbbell','body weight']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_equipment_profiles_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT workout_equipment_profiles_plate_pairs_check CHECK (jsonb_typeof(plate_pairs) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_equipment_profiles_one_default
  ON public.workout_equipment_profiles(user_id)
  WHERE is_default;
CREATE INDEX IF NOT EXISTS idx_workout_equipment_profiles_user
  ON public.workout_equipment_profiles(user_id, updated_at DESC);

ALTER TABLE public.workout_equipment_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_workout_equipment_profiles" ON public.workout_equipment_profiles;
CREATE POLICY "users_manage_own_workout_equipment_profiles"
  ON public.workout_equipment_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_workout_equipment_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_workout_equipment_profile ON public.workout_equipment_profiles;
CREATE TRIGGER trg_touch_workout_equipment_profile
  BEFORE UPDATE ON public.workout_equipment_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_workout_equipment_profile();

COMMENT ON TABLE public.workout_equipment_profiles IS
  'User-owned gym or home equipment inventory used by workout tools; it does not alter coach prescriptions.';
