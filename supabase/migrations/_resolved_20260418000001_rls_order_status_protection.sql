-- SEC-5: Prevent direct UPDATE of order_status on meal_schedules
-- order_status should only be changed through RPC functions (cancel_meal_schedule,
-- admin_cancel_meal_schedule, complete_meal_atomic, uncomplete_meal_atomic, update_order_status)
--
-- Strategy: Replace existing UPDATE policy with one that excludes order_status
-- from direct client updates. Clients can still update other columns (delivery_time_slot, etc.)

-- Drop existing UPDATE policies on meal_schedules if they exist
-- We'll recreate with order_status restriction
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'meal_schedules' AND schemaname = 'public' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.meal_schedules', pol.policyname);
  END LOOP;
END $$;

-- Create new UPDATE policies that prevent direct order_status changes

-- Policy 1: Users can update their own meal_schedules, but NOT order_status
-- (They should use cancel_meal_schedule RPC instead)
CREATE POLICY "Users can update own schedules except order_status"
  ON public.meal_schedules
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND order_status = (SELECT order_status FROM public.meal_schedules WHERE id = meal_schedules.id)
  );

-- Policy 2: Admin users can update any meal_schedule
-- (Admins use admin_cancel_meal_schedule and update_order_status RPCs for status changes)
CREATE POLICY "Admins can update schedules except order_status"
  ON public.meal_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin')
    )
    AND order_status = (SELECT order_status FROM public.meal_schedules WHERE id = meal_schedules.id)
  );

-- Policy 3: Partners can update delivery details on their meals' schedules
-- but NOT order_status (use update_order_status RPC)
CREATE POLICY "Partners can update schedule delivery details"
  ON public.meal_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meals m
      INNER JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_schedules.meal_id
      AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meals m
      INNER JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_schedules.meal_id
      AND r.owner_id = auth.uid()
    )
    AND order_status = (SELECT order_status FROM public.meal_schedules WHERE id = meal_schedules.id)
  );