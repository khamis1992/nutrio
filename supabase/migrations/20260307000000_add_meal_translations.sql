-- ============================================================================
-- Multi-Language Support for Meals
-- Hybrid Translation System with Azure Translator
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Language Support Enum
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'language_code') THEN
    CREATE TYPE public.language_code AS ENUM ('en', 'ar');
  END IF;
END
$$;

-- ============================================================================
-- STEP 2: Add Primary Language to Meals Table
-- ============================================================================
ALTER TABLE public.meals
ADD COLUMN IF NOT EXISTS primary_language public.language_code DEFAULT 'en';

-- Add index for language lookups
CREATE INDEX IF NOT EXISTS idx_meals_language ON public.meals(primary_language);

-- ============================================================================
-- STEP 3: Create Meal Translations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meal_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  language_code public.language_code NOT NULL,
  
  -- Translated content
  name TEXT NOT NULL,
  description TEXT,
  
  -- Translation metadata
  is_auto_translated BOOLEAN DEFAULT false,
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'needs_review')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Source tracking
  source_text_hash TEXT, -- Hash of original text to detect changes
  translation_api TEXT DEFAULT 'azure', -- Which API was used
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints
  UNIQUE(meal_id, language_code)
);

-- ============================================================================
-- STEP 4: Create Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_meal_translations_meal_id ON public.meal_translations(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_translations_language ON public.meal_translations(language_code);
CREATE INDEX IF NOT EXISTS idx_meal_translations_review ON public.meal_translations(review_status) 
  WHERE review_status IN ('pending', 'needs_review');
CREATE INDEX IF NOT EXISTS idx_meal_translations_auto ON public.meal_translations(is_auto_translated) 
  WHERE is_auto_translated = true;

-- ============================================================================
-- STEP 5: Enable RLS
-- ============================================================================
ALTER TABLE public.meal_translations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS Policies
-- ============================================================================

-- Everyone can view translations (for customer browsing)
CREATE POLICY "Anyone can view meal translations" ON public.meal_translations
  FOR SELECT USING (true);

-- Only meal owners (restaurant partners) and admins can create/update translations
CREATE POLICY "Partners can manage their meal translations" ON public.meal_translations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.meals m
      JOIN public.restaurants r ON m.restaurant_id = r.id
      WHERE m.id = meal_translations.meal_id
      AND r.owner_id = auth.uid()
    )
  );

-- Admins can manage all translations
CREATE POLICY "Admins can manage all translations" ON public.meal_translations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- STEP 7: Create Function to Get Translated Meal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_meal_with_translation(
  p_meal_id UUID,
  p_language_code public.language_code DEFAULT 'en'
)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  name TEXT,
  description TEXT,
  image_url TEXT,
  price NUMERIC,
  calories INTEGER,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  prep_time_minutes INTEGER,
  is_available BOOLEAN,
  rating NUMERIC,
  order_count INTEGER,
  is_translated BOOLEAN,
  is_auto_translated BOOLEAN,
  review_status TEXT
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.id,
    m.restaurant_id,
    COALESCE(mt.name, m.name) as name,
    COALESCE(mt.description, m.description) as description,
    m.image_url,
    m.price,
    m.calories,
    m.protein_g,
    m.carbs_g,
    m.fat_g,
    m.fiber_g,
    m.prep_time_minutes,
    m.is_available,
    m.rating,
    m.order_count,
    (mt.id IS NOT NULL) as is_translated,
    COALESCE(mt.is_auto_translated, false) as is_auto_translated,
    COALESCE(mt.review_status, 'none') as review_status
  FROM public.meals m
  LEFT JOIN public.meal_translations mt ON m.id = mt.meal_id AND mt.language_code = p_language_code
  WHERE m.id = p_meal_id;
$$;

-- ============================================================================
-- STEP 8: Create Function to Auto-Translate on Meal Creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_meal_translation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Detect language of the meal name (basic detection)
  -- For now, assume English if not specified
  IF NEW.primary_language IS NULL THEN
    NEW.primary_language := 'en';
  END IF;
  
  -- Mark meal for translation if primary language is English
  -- The actual translation will be done via Edge Function
  IF NEW.primary_language = 'en' THEN
    -- Insert placeholder translation record (Edge Function will fill it)
    INSERT INTO public.meal_translations (
      meal_id,
      language_code,
      name,
      description,
      is_auto_translated,
      review_status,
      source_text_hash
    ) VALUES (
      NEW.id,
      'ar',
      NEW.name, -- Temporary: will be overwritten by translation
      NEW.description,
      true,
      'pending',
      md5(COALESCE(NEW.name, '') || COALESCE(NEW.description, ''))
    )
    ON CONFLICT (meal_id, language_code) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS auto_translate_meal ON public.meals;

-- Create trigger for new meals
CREATE TRIGGER auto_translate_meal
  AFTER INSERT ON public.meals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meal_translation();

-- ============================================================================
-- STEP 9: Create Function to Update Translation Timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_translation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_translation_updated_at ON public.meal_translations;

-- Create trigger
CREATE TRIGGER update_translation_updated_at
  BEFORE UPDATE ON public.meal_translations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_translation_timestamp();

-- ============================================================================
-- STEP 10: Add User Language Preference to Profiles
-- ============================================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language public.language_code DEFAULT 'en';

-- ============================================================================
-- STEP 11: Create View for Translation Statistics (Admin Dashboard)
-- ============================================================================
CREATE OR REPLACE VIEW public.translation_statistics AS
SELECT 
  'total_meals' as metric,
  COUNT(*)::text as value
FROM public.meals
WHERE deleted_at IS NULL

UNION ALL

SELECT 
  'translated_meals' as metric,
  COUNT(DISTINCT meal_id)::text as value
FROM public.meal_translations
WHERE language_code = 'ar'

UNION ALL

SELECT 
  'pending_review' as metric,
  COUNT(*)::text as value
FROM public.meal_translations
WHERE language_code = 'ar' AND review_status = 'pending'

UNION ALL

SELECT 
  'approved_translations' as metric,
  COUNT(*)::text as value
FROM public.meal_translations
WHERE language_code = 'ar' AND review_status = 'approved'

UNION ALL

SELECT 
  'auto_translated_count' as metric,
  COUNT(*)::text as value
FROM public.meal_translations
WHERE language_code = 'ar' AND is_auto_translated = true;

-- ============================================================================
-- STEP 12: Migration Complete - Grant Permissions
-- ============================================================================
GRANT SELECT ON public.translation_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meal_with_translation TO authenticated;

-- ============================================================================
-- NOTES:
-- 1. After migration, run Edge Function to translate existing meals
-- 2. Partners will see "pending" translations in their dashboard
-- 3. Customers will see English until Arabic translation is available
-- ============================================================================
