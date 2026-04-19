-- Migration: Unify delivery tables - Migrate deliveries to delivery_jobs
-- Date: 2026-02-26
-- Description: Consolidate deliveries and delivery_jobs tables into delivery_jobs

-- Step 1: Migrate the one delivery that's only in deliveries table
INSERT INTO delivery_jobs (
  schedule_id,
  driver_id,
  status,
  delivery_fee,
  driver_earnings,
  assigned_at,
  picked_up_at,
  delivered_at,
  delivery_notes,
  delivery_photo_url,
  created_at,
  updated_at
)
SELECT 
  d.schedule_id,
  d.driver_id,
  CASE d.status::text
    WHEN 'pending' THEN 'pending'
    WHEN 'claimed' THEN 'assigned'
    WHEN 'picked_up' THEN 'picked_up'
    WHEN 'on_the_way' THEN 'in_transit'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'cancelled' THEN 'cancelled'
  END,
  d.delivery_fee,
  COALESCE(d.tip_amount, 0) + COALESCE(d.delivery_fee, 0) * 0.8, -- 80% of fee + tip to driver
  d.claimed_at,
  d.picked_up_at,
  d.delivered_at,
  d.delivery_notes,
  d.delivery_photo_url,
  d.created_at,
  d.updated_at
FROM deliveries d
LEFT JOIN delivery_jobs dj ON d.schedule_id = dj.schedule_id
WHERE dj.id IS NULL
ON CONFLICT (schedule_id) DO UPDATE SET
  driver_id = EXCLUDED.driver_id,
  status = EXCLUDED.status;

-- Step 2: Update delivery_jobs records that have duplicates in deliveries
-- Sync any data from deliveries that might be more recent
UPDATE delivery_jobs dj
SET 
  driver_id = COALESCE(d.driver_id, dj.driver_id),
  status = CASE d.status::text
    WHEN 'pending' THEN 'pending'
    WHEN 'claimed' THEN 'assigned'
    WHEN 'picked_up' THEN 'picked_up'
    WHEN 'on_the_way' THEN 'in_transit'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'cancelled' THEN 'cancelled'
  END,
  assigned_at = COALESCE(d.claimed_at, dj.assigned_at),
  picked_up_at = COALESCE(d.picked_up_at, dj.picked_up_at),
  delivered_at = COALESCE(d.delivered_at, dj.delivered_at),
  delivery_notes = COALESCE(d.delivery_notes, dj.delivery_notes),
  delivery_photo_url = COALESCE(d.delivery_photo_url, dj.delivery_photo_url),
  updated_at = NOW()
FROM deliveries d
WHERE dj.schedule_id = d.schedule_id
AND d.status::text NOT IN ('delivered', 'cancelled');

-- Step 3: Rename deliveries table to deliveries_legacy for backup
ALTER TABLE IF EXISTS deliveries RENAME TO deliveries_legacy;

-- Step 4: Create a view for backward compatibility (optional, can be removed later)
CREATE OR REPLACE VIEW deliveries AS
SELECT 
  id,
  schedule_id,
  driver_id,
  CASE status
    WHEN 'assigned' THEN 'claimed'::delivery_status
    WHEN 'in_transit' THEN 'on_the_way'::delivery_status
    ELSE status::delivery_status
  END as status,
  delivery_fee,
  driver_earnings as tip_amount,
  assigned_at as claimed_at,
  picked_up_at,
  delivered_at,
  delivery_notes,
  delivery_photo_url,
  created_at,
  updated_at
FROM delivery_jobs;

COMMENT ON VIEW deliveries IS 'Backward compatibility view - maps delivery_jobs to old deliveries schema. Deprecated, use delivery_jobs directly.';

-- Step 5: Update RLS policies on delivery_jobs to match what drivers need
-- Drop existing driver policies
DROP POLICY IF EXISTS "Drivers can view assigned jobs" ON delivery_jobs;
DROP POLICY IF EXISTS "Drivers can update assigned jobs" ON delivery_jobs;

-- Create new policies for driver portal
DROP POLICY IF EXISTS "Drivers can view available delivery jobs" ON delivery_jobs;
CREATE POLICY "Drivers can view available delivery jobs"
  ON delivery_jobs FOR SELECT
  USING (
    status IN ('pending', 'assigned', 'accepted') 
    OR 
    (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Drivers can claim delivery jobs" ON delivery_jobs;
CREATE POLICY "Drivers can claim delivery jobs"
  ON delivery_jobs FOR UPDATE
  USING (
    status IN ('pending', 'assigned') 
    AND 
    (driver_id IS NULL OR driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
  );

-- Step 6: Add helpful comments
COMMENT ON TABLE delivery_jobs IS 'Primary delivery tracking table. Replaces deliveries table.';
COMMENT ON TABLE deliveries_legacy IS 'Legacy deliveries table - kept for historical reference. Use delivery_jobs instead.';

-- Step 7: Verify migration
SELECT 'Migration complete' as status,
       (SELECT COUNT(*) FROM delivery_jobs WHERE status = 'pending') as pending_jobs,
       (SELECT COUNT(*) FROM deliveries_legacy) as legacy_records;


