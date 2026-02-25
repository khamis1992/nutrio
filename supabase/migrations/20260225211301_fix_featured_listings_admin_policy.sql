-- Fix admin featured listings RLS policy
-- The policy was missing TO authenticated clause

DROP POLICY IF EXISTS "Admins can manage all featured listings" ON public.featured_listings;

CREATE POLICY "Admins can manage all featured listings"
ON public.featured_listings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
