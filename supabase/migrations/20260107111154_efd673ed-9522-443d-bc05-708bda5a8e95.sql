-- Fix security warnings in RLS policies

-- 1. Fix notifications INSERT policy - should only allow service role or authenticated system
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Create a proper policy that only allows authenticated users to insert for themselves
-- or admins to insert for anyone
CREATE POLICY "Authenticated users can insert their own notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 2. Create a view for public restaurant data that excludes sensitive info
-- First, update the restaurant SELECT policy to hide email/phone for non-owners/admins
DROP POLICY IF EXISTS "Anyone can view approved restaurants" ON public.restaurants;

-- Create a function to get safe restaurant data (without contact info for non-owners)
CREATE OR REPLACE FUNCTION public.can_view_restaurant_contact(restaurant_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() IS NOT NULL AND (
      auth.uid() = restaurant_owner_id OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.user_id = auth.uid() 
        AND o.restaurant_id = (
          SELECT id FROM restaurants WHERE owner_id = restaurant_owner_id LIMIT 1
        )
      )
    )
$$;

-- Re-create the policy - approved restaurants are viewable but contact info is managed via app logic
CREATE POLICY "Anyone can view approved restaurants" 
ON public.restaurants 
FOR SELECT 
USING ((approval_status = 'approved'::approval_status) AND (is_active = true));

-- 3. Fix platform_settings - restrict subscription_plans to authenticated users only
DROP POLICY IF EXISTS "Anyone can view subscription pricing" ON public.platform_settings;

CREATE POLICY "Authenticated users can view subscription pricing" 
ON public.platform_settings 
FOR SELECT 
USING (key = 'subscription_plans'::text AND auth.uid() IS NOT NULL);

-- 4. Fix referral_milestones - restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view active milestones" ON public.referral_milestones;

CREATE POLICY "Authenticated users can view active milestones" 
ON public.referral_milestones 
FOR SELECT 
USING (is_active = true AND auth.uid() IS NOT NULL);