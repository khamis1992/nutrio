ALTER TABLE public.nutrition_goals
  ADD COLUMN IF NOT EXISTS calculation_source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS activity_level_snapshot TEXT;

CREATE TABLE IF NOT EXISTS public.nutrition_goal_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.nutrition_goals(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'recalculated', 'smart_adjusted', 'coach_updated', 'archived', 'activated')),
  previous_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.nutrition_goal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nutrition goal events"
  ON public.nutrition_goal_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition goal events"
  ON public.nutrition_goal_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_goal_events_user_created
  ON public.nutrition_goal_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_goal_events_goal
  ON public.nutrition_goal_events(goal_id);
