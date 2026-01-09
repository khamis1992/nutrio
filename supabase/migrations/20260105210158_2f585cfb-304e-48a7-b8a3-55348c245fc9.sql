-- Allow partners to view meal schedules for their restaurant's meals
CREATE POLICY "Partners can view schedules for their meals"
ON public.meal_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meals m
    JOIN restaurants r ON r.id = m.restaurant_id
    WHERE m.id = meal_schedules.meal_id
    AND r.owner_id = auth.uid()
  )
);

-- Allow partners to update meal schedules for their restaurant's meals (to mark as completed)
CREATE POLICY "Partners can update schedules for their meals"
ON public.meal_schedules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM meals m
    JOIN restaurants r ON r.id = m.restaurant_id
    WHERE m.id = meal_schedules.meal_id
    AND r.owner_id = auth.uid()
  )
);

-- Allow partners to view customer profiles for orders (limited fields)
CREATE POLICY "Partners can view customer profiles for their orders"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meal_schedules ms
    JOIN meals m ON m.id = ms.meal_id
    JOIN restaurants r ON r.id = m.restaurant_id
    WHERE ms.user_id = profiles.user_id
    AND r.owner_id = auth.uid()
  )
);