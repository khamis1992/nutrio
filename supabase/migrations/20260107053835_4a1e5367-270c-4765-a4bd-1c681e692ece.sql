-- Create meal_history table to store logged meals for quick re-logging
CREATE TABLE public.meal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_g INTEGER NOT NULL DEFAULT 0,
  carbs_g INTEGER NOT NULL DEFAULT 0,
  fat_g INTEGER NOT NULL DEFAULT 0,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_meal_history_user_logged ON public.meal_history(user_id, logged_at DESC);

-- Enable RLS
ALTER TABLE public.meal_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own meal history
CREATE POLICY "Users can view their own meal history"
ON public.meal_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own meal history
CREATE POLICY "Users can insert their own meal history"
ON public.meal_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own meal history
CREATE POLICY "Users can delete their own meal history"
ON public.meal_history
FOR DELETE
USING (auth.uid() = user_id);