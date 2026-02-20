-- Fix RLS policies for restaurants table to allow admin updates
-- This fixes the 400 error when approving/rejecting restaurants

-- First, add missing is_active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.restaurants ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END
$$;

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Anyone can view approved restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Partners can view their own restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Partners can manage their own restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Admins can manage all restaurants" ON public.restaurants;

-- Recreate policies with proper permissions

-- 1. Anyone can view approved restaurants
CREATE POLICY "Anyone can view approved restaurants"
ON public.restaurants FOR SELECT
USING (approval_status = 'approved' AND is_active = true);

-- 2. Partners can view their own restaurants (including pending)
CREATE POLICY "Partners can view their own restaurants"
ON public.restaurants FOR SELECT
USING (owner_id = auth.uid());

-- 3. Partners can manage (update) their own restaurants
CREATE POLICY "Partners can manage their own restaurants"
ON public.restaurants FOR UPDATE
USING (owner_id = auth.uid());

-- 4. Partners can insert their own restaurants
CREATE POLICY "Partners can insert their own restaurants"
ON public.restaurants FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- 5. Admins can manage ALL restaurants (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all restaurants"
ON public.restaurants FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Also ensure the has_role function exists and works properly
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Grant necessary permissions
GRANT ALL ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO anon;

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'restaurants';
