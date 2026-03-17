-- Migration: Fleet ↔ Partner portal integration — delivery_jobs INSERT trigger
-- When the fleet portal creates a new delivery_job for a meal_schedule,
-- also fire the sync so meal_schedules.order_status becomes 'out_for_delivery'.
-- The existing UPDATE trigger (on_delivery_job_status_change) already handles
-- subsequent status changes (picked_up, delivered, etc.).

-- Extend the existing sync function to also handle INSERT events
CREATE OR REPLACE FUNCTION sync_delivery_status_to_schedule()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT: only sync if schedule_id references a real meal_schedule row
    IF TG_OP = 'INSERT' THEN
        IF NEW.schedule_id IS NOT NULL AND NEW.status IS NOT NULL THEN
            UPDATE public.meal_schedules
            SET
                order_status = NEW.status,
                updated_at   = NOW()
            WHERE id = NEW.schedule_id
              AND order_status IS DISTINCT FROM NEW.status;
        END IF;
        RETURN NEW;
    END IF;

    -- For UPDATE: only sync if status changed
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.schedule_id IS NOT NULL THEN
        UPDATE public.meal_schedules
        SET
            order_status = NEW.status,
            updated_at   = NOW()
        WHERE id = NEW.schedule_id
          AND order_status IS DISTINCT FROM NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old UPDATE-only trigger and recreate for INSERT + UPDATE
DROP TRIGGER IF EXISTS on_delivery_job_status_change ON public.delivery_jobs;

CREATE TRIGGER on_delivery_job_status_change
    AFTER INSERT OR UPDATE OF status ON public.delivery_jobs
    FOR EACH ROW
    EXECUTE FUNCTION sync_delivery_status_to_schedule();

COMMENT ON FUNCTION sync_delivery_status_to_schedule() IS
    'Syncs delivery_jobs status to meal_schedules.order_status on INSERT and status UPDATE';
