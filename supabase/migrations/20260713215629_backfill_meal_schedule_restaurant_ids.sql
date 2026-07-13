-- Restore the restaurant link on legacy schedules so every portal resolves
-- the same historical owner without depending on a mutable meal record.

WITH resolved_restaurants AS (
  SELECT
    ms.id AS schedule_id,
    COALESCE(
      (
        SELECT dj.restaurant_id
        FROM public.delivery_jobs dj
        WHERE dj.schedule_id = ms.id
          AND dj.restaurant_id IS NOT NULL
        ORDER BY dj.created_at DESC
        LIMIT 1
      ),
      m.restaurant_id
    ) AS restaurant_id
  FROM public.meal_schedules ms
  JOIN public.meals m ON m.id = ms.meal_id
  WHERE ms.restaurant_id IS NULL
)
UPDATE public.meal_schedules ms
SET restaurant_id = resolved.restaurant_id
FROM resolved_restaurants resolved
WHERE ms.id = resolved.schedule_id
  AND resolved.restaurant_id IS NOT NULL;
