-- Debug: Check if restaurants exist and admin can see them
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if restaurants table has data
SELECT 
  'Total restaurants' as check_type,
  COUNT(*) as count
FROM public.restaurants

UNION ALL

-- 2. Check pending restaurants
SELECT 
  'Pending restaurants' as check_type,
  COUNT(*) as count
FROM public.restaurants
WHERE approval_status = 'pending'

UNION ALL

-- 3. Check if user has admin role
SELECT 
  'User has admin role' as check_type,
  COUNT(*) as count
FROM public.user_roles
WHERE user_id = 'e6a0b5cc-c93e-46b0-91fc-1c04c06dee13'  -- khamis-1992@hotmail.com
AND role = 'admin';

-- 4. Show sample restaurant data
SELECT 
  id,
  name,
  owner_id,
  approval_status,
  is_active,
  created_at
FROM public.restaurants
LIMIT 5;

-- 5. Check RLS policies
SELECT 
  policyname,
  permissive,
  roles::text,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'restaurants'
ORDER BY policyname;
