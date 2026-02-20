-- Fix RLS policies for restaurants to allow admin full access
-- This ensures admins can view ALL restaurants including pending ones

-- Enable RLS (if not already enabled)
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view approved restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Partners can view their own restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Partners can manage their own restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Admins can manage all restaurants" ON public.restaurants;

-- Policy 1: Admins can do EVERYTHING (must be first for proper evaluation)
CREATE POLICY "Admins have full access"
ON public.restaurants 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy 2: Partners can view their own restaurants
CREATE POLICY "Partners can view their restaurants"
ON public.restaurants 
FOR SELECT 
TO authenticated
USING (owner_id = auth.uid());

-- Policy 3: Partners can update their own restaurants
CREATE POLICY "Partners can update their restaurants"
ON public.restaurants 
FOR UPDATE 
TO authenticated
USING (owner_id = auth.uid());

-- Policy 4: Partners can insert their own restaurants
CREATE POLICY "Partners can insert restaurants"
ON public.restaurants 
FOR INSERT 
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Policy 5: Public can view approved restaurants
CREATE POLICY "Public can view approved"
ON public.restaurants 
FOR SELECT 
TO anon, authenticated
USING (approval_status = 'approved' AND is_active = true);

-- Ensure proper grants
GRANT ALL ON public.restaurants TO authenticated;
GRANT SELECT ON public.restaurants TO anon;

-- Verify policies
SELECT 
  policyname,
  permissive,
  roles::text,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'restaurants';
