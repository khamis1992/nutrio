-- Emergency Fix: Missing Tables and Columns for Customer App
-- Fixes: meals columns, user_dietary_preferences table, foreign key issues

-- ============================================
-- 1. ADD MISSING COLUMNS TO MEALS TABLE
-- ============================================

-- Add nutrition columns if missing
ALTER TABLE public.meals 
ADD COLUMN IF NOT EXISTS protein_g NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS carbs_g NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fat_g NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS calories INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure restaurant_id exists
ALTER TABLE public.meals 
ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_meals_restaurant_id ON public.meals(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_meals_calories ON public.meals(calories);

-- ============================================
-- 2. CREATE USER_DIETARY_PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_dietary_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  diet_tag_id UUID REFERENCES public.diet_tags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, diet_tag_id)
);

-- Enable RLS
ALTER TABLE public.user_dietary_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own dietary preferences"
  ON public.user_dietary_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dietary preferences"
  ON public.user_dietary_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dietary preferences"
  ON public.user_dietary_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. FIX MEAL_SCHEDULES TABLE
-- ============================================

-- Ensure all necessary columns exist
ALTER TABLE public.meal_schedules
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS scheduled_date DATE NOT NULL,
ADD COLUMN IF NOT EXISTS meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_dietary_prefs_user_id ON public.user_dietary_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dietary_prefs_tag_id ON public.user_dietary_preferences(diet_tag_id);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_user_date ON public.meal_schedules(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_meal_id ON public.meal_schedules(meal_id);

-- ============================================
-- 5. FIX RESTAURANTS TABLE (if needed)
-- ============================================

-- Ensure total_orders exists
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;

-- ============================================
-- 6. BACKFILL DEFAULT DATA (Optional)
-- ============================================

-- Update existing meals with default nutrition values if null
UPDATE public.meals 
SET 
  calories = COALESCE(calories, 500),
  protein_g = COALESCE(protein_g, 20),
  carbs_g = COALESCE(carbs_g, 50),
  fat_g = COALESCE(fat_g, 15)
WHERE calories IS NULL OR protein_g IS NULL OR carbs_g IS NULL OR fat_g IS NULL;
