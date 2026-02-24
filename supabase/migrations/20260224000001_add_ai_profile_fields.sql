-- Migration: Add missing AI nutrition profile fields
-- Adds training_days, food_preferences, and allergies to profiles table

-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS training_days_per_week INTEGER CHECK (training_days_per_week >= 0 AND training_days_per_week <= 7),
ADD COLUMN IF NOT EXISTS food_preferences TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.training_days_per_week IS 'Number of training/exercise days per week (0-7)';
COMMENT ON COLUMN public.profiles.food_preferences IS 'Array of food preferences (e.g., halal, vegetarian, vegan, gluten-free)';
COMMENT ON COLUMN public.profiles.allergies IS 'Array of food allergies (e.g., nuts, dairy, shellfish)';

-- Update nutrition_profile_engine to use these fields
-- The Edge Function already accepts these as input, now the DB can store them

-- Add index for faster lookups when filtering by preferences
CREATE INDEX IF NOT EXISTS idx_profiles_food_preferences ON public.profiles USING GIN (food_preferences);
CREATE INDEX IF NOT EXISTS idx_profiles_allergies ON public.profiles USING GIN (allergies);
