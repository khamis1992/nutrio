-- Quarantine legacy catalogue fixtures that were attached to the driver test
-- account, plus the explicitly named test restaurant. Keep the rows and meals
-- for auditability; they must not appear as live launch inventory.
UPDATE public.restaurants
SET is_active = FALSE,
    approval_status = 'rejected',
    updated_at = now()
WHERE owner_id = '2f2ab6d4-12db-46fe-a922-b9c80f9bda39'::UUID
  AND name IN (
    'Organic Harvest',
    'Healthy Bites Cafe',
    'Fitness Fuel Station',
    'Lebanese Kitchen',
    'Mediterranean Delights',
    'Green Garden Vegan'
  );

UPDATE public.restaurants
SET is_active = FALSE,
    approval_status = 'rejected',
    updated_at = now()
WHERE id = '13fc6d8f-f746-4cef-b517-95ebfd6b869c'::UUID
  AND lower(trim(name)) = 'test';

UPDATE public.featured_listings
SET status = 'cancelled',
    updated_at = now()
WHERE restaurant_id IN (
  SELECT id
  FROM public.restaurants
  WHERE owner_id = '2f2ab6d4-12db-46fe-a922-b9c80f9bda39'::UUID
    AND approval_status = 'rejected'
);
