-- Migration: Sync delivery status back to meal_schedules
-- Fixes issue where customer sees "delivered" but partner sees old status

-- Function to sync delivery_jobs status to meal_schedules
CREATE OR REPLACE FUNCTION sync_delivery_status_to_schedule()
RETURNS TRIGGER AS $$
BEGIN
    -- Only sync if status changed and schedule_id exists
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.schedule_id IS NOT NULL THEN
        UPDATE public.meal_schedules
        SET 
            order_status = NEW.status,
            updated_at = NOW()
        WHERE id = NEW.schedule_id
          AND order_status != NEW.status; -- Avoid unnecessary updates
          
        RAISE NOTICE 'Synced delivery status % to meal_schedule %', NEW.status, NEW.schedule_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_delivery_job_status_change ON public.delivery_jobs;

-- Create trigger to sync status changes
CREATE TRIGGER on_delivery_job_status_change
    AFTER UPDATE OF status ON public.delivery_jobs
    FOR EACH ROW
    EXECUTE FUNCTION sync_delivery_status_to_schedule();

-- Add comment for documentation
COMMENT ON FUNCTION sync_delivery_status_to_schedule() IS 
    'Syncs delivery_jobs.status changes back to meal_schedules.order_status to keep customer/partner portals in sync';

-- Fix any existing out-of-sync orders
UPDATE public.meal_schedules ms
SET 
    order_status = dj.status,
    updated_at = NOW()
FROM public.delivery_jobs dj
WHERE dj.schedule_id = ms.id
  AND dj.status IN ('out_for_delivery', 'picked_up', 'on_the_way', 'delivered')
  AND ms.order_status != dj.status;

-- Report how many were fixed
DO $$
DECLARE
    fixed_count INTEGER;
BEGIN
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE 'Fixed % out-of-sync orders', fixed_count;
END $$;
