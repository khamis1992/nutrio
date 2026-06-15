-- Allow coaches to update nutrition targets for their active clients

-- Profiles: coaches can update nutrition target columns for their active clients
DO $$ BEGIN
CREATE POLICY "coaches_update_client_targets" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_coach_of(user_id))
  WITH CHECK (public.is_coach_of(user_id));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Nutrition goals: coaches can view their active clients' goals
DO $$ BEGIN
CREATE POLICY "coaches_view_client_goals" ON public.nutrition_goals
  FOR SELECT TO authenticated
  USING (public.is_coach_of(user_id));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Nutrition goals: coaches can update their active clients' goals
DO $$ BEGIN
CREATE POLICY "coaches_update_client_goals" ON public.nutrition_goals
  FOR UPDATE TO authenticated
  USING (public.is_coach_of(user_id));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Nutrition goals: coaches can insert goals for their active clients
DO $$ BEGIN
CREATE POLICY "coaches_insert_client_goals" ON public.nutrition_goals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_coach_of(user_id));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

