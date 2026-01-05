
-- Make owner_id nullable for sample/demo restaurants
ALTER TABLE public.restaurants ALTER COLUMN owner_id DROP NOT NULL;

-- Update RLS policy to allow viewing sample restaurants (those without owners)
DROP POLICY IF EXISTS "Anyone can view approved restaurants" ON public.restaurants;
CREATE POLICY "Anyone can view approved restaurants" 
ON public.restaurants 
FOR SELECT 
USING ((approval_status = 'approved') AND (is_active = true));
