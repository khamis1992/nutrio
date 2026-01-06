-- Add is_vip_exclusive column to meals table
ALTER TABLE public.meals ADD COLUMN is_vip_exclusive boolean DEFAULT false;

-- Update RLS policy for meals to include VIP filtering
-- First drop the existing policy
DROP POLICY IF EXISTS "Anyone can view available meals from approved restaurants" ON public.meals;

-- Create new policy that includes VIP check
CREATE POLICY "Anyone can view available meals from approved restaurants" 
ON public.meals 
FOR SELECT 
USING (
  (is_available = true) AND 
  (EXISTS ( 
    SELECT 1 FROM restaurants 
    WHERE restaurants.id = meals.restaurant_id 
    AND restaurants.approval_status = 'approved'::approval_status 
    AND restaurants.is_active = true
  )) AND
  (
    is_vip_exclusive = false OR 
    EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.user_id = auth.uid() 
      AND s.status = 'active' 
      AND s.tier = 'vip'
    )
  )
);