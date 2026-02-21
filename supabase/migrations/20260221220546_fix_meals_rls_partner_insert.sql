-- Fix RLS policies for meals table to allow partners to insert meals
-- Error 42501: new row violates row-level security policy for table 'meals'
-- 
-- The issue: The existing policy "Partners can manage meals for their restaurants" uses
-- FOR ALL USING (...) which doesn't properly handle INSERT operations.
-- For INSERT, we need an explicit WITH CHECK clause.

-- Enable RLS (ensure it's on)
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

-- Drop existing partner policies for meals to avoid conflicts
DROP POLICY IF EXISTS "Partners can manage meals for their restaurants" ON public.meals;
DROP POLICY IF EXISTS "Partners can insert meals for their restaurants" ON public.meals;
DROP POLICY IF EXISTS "Partners can view their meals" ON public.meals;
DROP POLICY IF EXISTS "Partners can update their meals" ON public.meals;
DROP POLICY IF EXISTS "Partners can delete their meals" ON public.meals;

-- Drop existing admin policies to recreate them
DROP POLICY IF EXISTS "Admins can manage all meals" ON public.meals;

-- Policy 1: Partners can VIEW their own restaurant's meals
CREATE POLICY "Partners can view their meals"
ON public.meals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = restaurant_id
    AND owner_id = auth.uid()
  )
);

-- Policy 2: Partners can INSERT meals for their restaurants (CRITICAL FIX)
-- WITH CHECK is required for INSERT operations
CREATE POLICY "Partners can insert meals for their restaurants"
ON public.meals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = restaurant_id
    AND owner_id = auth.uid()
  )
);

-- Policy 3: Partners can UPDATE their own restaurant's meals
CREATE POLICY "Partners can update their meals"
ON public.meals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = restaurant_id
    AND owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = restaurant_id
    AND owner_id = auth.uid()
  )
);

-- Policy 4: Partners can DELETE their own restaurant's meals
CREATE POLICY "Partners can delete their meals"
ON public.meals
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = restaurant_id
    AND owner_id = auth.uid()
  )
);

-- Policy 5: Admins can manage ALL meals
CREATE POLICY "Admins can manage all meals"
ON public.meals
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ensure proper grants
GRANT ALL ON public.meals TO authenticated;
GRANT SELECT ON public.meals TO anon;

-- Also fix meal_diet_tags RLS policies for completeness
DROP POLICY IF EXISTS "Partners can manage meal tags for their meals" ON public.meal_diet_tags;
DROP POLICY IF EXISTS "Partners can insert meal tags" ON public.meal_diet_tags;
DROP POLICY IF EXISTS "Partners can delete meal tags" ON public.meal_diet_tags;

-- Partners can view meal diet tags
CREATE POLICY "Partners can view meal tags"
ON public.meal_diet_tags
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    JOIN public.restaurants r ON m.restaurant_id = r.id
    WHERE m.id = meal_id AND r.owner_id = auth.uid()
  )
);

-- Partners can INSERT meal diet tags (WITH CHECK required)
CREATE POLICY "Partners can insert meal tags"
ON public.meal_diet_tags
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meals m
    JOIN public.restaurants r ON m.restaurant_id = r.id
    WHERE m.id = meal_id AND r.owner_id = auth.uid()
  )
);

-- Partners can DELETE meal diet tags
CREATE POLICY "Partners can delete meal tags"
ON public.meal_diet_tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    JOIN public.restaurants r ON m.restaurant_id = r.id
    WHERE m.id = meal_id AND r.owner_id = auth.uid()
  )
);

-- Verify policies were created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('meals', 'meal_diet_tags')
ORDER BY tablename, policyname;
