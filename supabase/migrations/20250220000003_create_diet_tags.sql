-- Migration: Create diet_tags and meal_diet_tags tables
-- Created: 2025-02-20
-- Purpose: Create tables for managing dietary tags for meals

-- =====================
-- DIET TAGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.diet_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.diet_tags ENABLE ROW LEVEL SECURITY;

-- =====================
-- MEAL DIET TAGS (junction table)
-- =====================
CREATE TABLE IF NOT EXISTS public.meal_diet_tags (
  meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  diet_tag_id UUID REFERENCES public.diet_tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (meal_id, diet_tag_id)
);

ALTER TABLE public.meal_diet_tags ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES
-- =====================

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Anyone can view diet tags" ON public.diet_tags;
DROP POLICY IF EXISTS "Admins can manage diet tags" ON public.diet_tags;
DROP POLICY IF EXISTS "Anyone can view meal diet tags" ON public.meal_diet_tags;
DROP POLICY IF EXISTS "Partners can manage meal tags for their meals" ON public.meal_diet_tags;

-- Diet Tags policies (public read)
CREATE POLICY "Anyone can view diet tags" ON public.diet_tags
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage diet tags" ON public.diet_tags
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Meal Diet Tags policies
CREATE POLICY "Anyone can view meal diet tags" ON public.meal_diet_tags
  FOR SELECT USING (true);

CREATE POLICY "Partners can manage meal tags for their meals" ON public.meal_diet_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.meals m
      JOIN public.restaurants r ON m.restaurant_id = r.id
      WHERE m.id = meal_id AND r.owner_id = auth.uid()
    )
  );

-- =====================
-- DEFAULT DIET TAGS
-- =====================
INSERT INTO public.diet_tags (name, description) VALUES
  ('Vegan', 'Contains no animal products'),
  ('Vegetarian', 'Contains no meat, may include dairy and eggs'),
  ('Gluten-Free', 'Contains no gluten or wheat products'),
  ('Keto', 'Low carb, high fat for ketogenic diet'),
  ('Paleo', 'Based on foods presumed to be available to paleolithic humans'),
  ('Dairy-Free', 'Contains no milk or dairy products'),
  ('Nut-Free', 'Contains no tree nuts or peanuts'),
  ('Halal', 'Prepared according to Islamic dietary laws'),
  ('Kosher', 'Prepared according to Jewish dietary laws'),
  ('Low-Carb', 'Reduced carbohydrate content'),
  ('High-Protein', 'High protein content for muscle building'),
  ('Organic', 'Made with organic ingredients')
ON CONFLICT (name) DO NOTHING;
