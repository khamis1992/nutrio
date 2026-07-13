-- Read-only restaurant diagnostics. Run with an authorized database role.
SELECT
  COUNT(*) AS total_restaurants,
  COUNT(*) FILTER (WHERE approval_status = 'pending') AS pending_restaurants,
  COUNT(*) FILTER (WHERE is_active IS TRUE) AS active_restaurants
FROM public.restaurants;

SELECT
  id,
  name,
  owner_id,
  approval_status,
  is_active,
  created_at
FROM public.restaurants
ORDER BY created_at DESC
LIMIT 5;

SELECT
  policyname,
  permissive,
  roles::text,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'restaurants'
ORDER BY policyname;
