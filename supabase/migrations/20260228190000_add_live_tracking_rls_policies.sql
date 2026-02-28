-- Migration: Add RLS policies for customer live tracking
-- Description: Allow customers to view driver locations for their assigned deliveries

-- ============================================
-- 1. DRIVER LOCATIONS - Customer can view locations for their assigned drivers
-- ============================================

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Customers can view driver locations for their orders" ON driver_locations;
DROP POLICY IF EXISTS "Drivers can insert own locations" ON driver_locations;
DROP POLICY IF EXISTS "Admins can manage driver locations" ON driver_locations;

-- Customers can view driver locations for drivers assigned to their orders
CREATE POLICY "Customers can view driver locations for their orders"
  ON driver_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM delivery_jobs dj
      JOIN meal_schedules ms ON dj.schedule_id = ms.id
      WHERE dj.driver_id = driver_locations.driver_id
      AND ms.user_id = auth.uid()
    )
  );

-- Drivers can insert their own locations
CREATE POLICY "Drivers can insert own locations"
  ON driver_locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_locations.driver_id
      AND d.user_id = auth.uid()
    )
  );

-- Admins can manage all driver locations
CREATE POLICY "Admins can manage driver locations"
  ON driver_locations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. DRIVERS - Customer can view driver info for their assigned deliveries
-- ============================================

-- Drop and recreate driver policies to include customer access
DROP POLICY IF EXISTS "Drivers can view own profile" ON drivers;
DROP POLICY IF EXISTS "Admins can manage drivers" ON drivers;
DROP POLICY IF EXISTS "Customers can view assigned drivers" ON drivers;

-- Drivers can view own profile
CREATE POLICY "Drivers can view own profile"
  ON drivers FOR SELECT
  USING (auth.uid() = user_id);

-- Customers can view drivers assigned to their orders
CREATE POLICY "Customers can view assigned drivers"
  ON drivers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM delivery_jobs dj
      JOIN meal_schedules ms ON dj.schedule_id = ms.id
      WHERE dj.driver_id = drivers.id
      AND ms.user_id = auth.uid()
    )
  );

-- Admins can manage all drivers
CREATE POLICY "Admins can manage drivers"
  ON drivers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 3. DELIVERY JOBS - Ensure customers can view their delivery jobs
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Customers can view their delivery jobs" ON delivery_jobs;
DROP POLICY IF EXISTS "Drivers can view assigned jobs" ON delivery_jobs;
DROP POLICY IF EXISTS "Admins can manage delivery jobs" ON delivery_jobs;

-- Customers can view delivery jobs for their orders
CREATE POLICY "Customers can view their delivery jobs"
  ON delivery_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_schedules ms
      WHERE ms.id = delivery_jobs.schedule_id
      AND ms.user_id = auth.uid()
    )
  );

-- Drivers can view jobs assigned to them
CREATE POLICY "Drivers can view assigned jobs"
  ON delivery_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = delivery_jobs.driver_id
      AND d.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.user_id = auth.uid()
      AND delivery_jobs.status IN ('pending', 'ready_for_pickup')
    )
  );

-- Admins can manage all delivery jobs
CREATE POLICY "Admins can manage delivery jobs"
  ON delivery_jobs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
