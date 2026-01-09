-- Create junction table for user dietary preferences
CREATE TABLE public.user_dietary_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diet_tag_id UUID NOT NULL REFERENCES public.diet_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, diet_tag_id)
);

-- Enable RLS
ALTER TABLE public.user_dietary_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own dietary preferences"
ON public.user_dietary_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can manage their own preferences
CREATE POLICY "Users can manage their own dietary preferences"
ON public.user_dietary_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);