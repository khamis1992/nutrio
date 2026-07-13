ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS partner_response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

DROP POLICY IF EXISTS "Partners can respond to reviews" ON public.reviews;
CREATE POLICY "Partners can respond to reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = reviews.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = reviews.restaurant_id
      AND r.owner_id = auth.uid()
  )
);
