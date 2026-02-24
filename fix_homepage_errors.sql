-- Standalone fix for homepage errors
-- Run this SQL directly in Supabase SQL Editor

-- ==========================================
-- FIX 1: Add meal_scheduled notification type
-- ==========================================

-- Check if notification_type is an enum
DO $$
DECLARE
    v_enum_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'notification_type'
        AND n.nspname = 'public'
    ) INTO v_enum_exists;

    IF v_enum_exists THEN
        -- Add value to enum (will fail silently if already exists)
        BEGIN
            ALTER TYPE public.notification_type ADD VALUE 'meal_scheduled';
        EXCEPTION
            WHEN duplicate_object THEN
                NULL; -- Already exists, ignore
        END;
        RAISE NOTICE 'Added meal_scheduled to notification_type enum';
    ELSE
        RAISE NOTICE 'notification_type is not an enum, no changes needed';
    END IF;
END $$;

-- ==========================================
-- FIX 2: Ensure notifications table has required columns
-- ==========================================

-- Add status column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN status TEXT DEFAULT 'unread';
        CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
        RAISE NOTICE 'Added status column to notifications';
    END IF;
END $$;

-- Add data column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'data'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN data JSONB DEFAULT '{}';
        RAISE NOTICE 'Added data column to notifications';
    END IF;
END $$;

-- Create notification_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'notification_status'
        AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.notification_status AS ENUM ('unread', 'read', 'archived');
        RAISE NOTICE 'Created notification_status enum';
    END IF;
END $$;

-- ==========================================
-- FIX 3: Ensure meal_schedules has required columns
-- ==========================================

DO $$
BEGIN
    -- Add order_status if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'order_status'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN order_status TEXT DEFAULT 'pending';
        CREATE INDEX IF NOT EXISTS idx_meal_schedules_order_status ON public.meal_schedules(order_status);
    END IF;

    -- Add addons_total if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'addons_total'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN addons_total NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- Add delivery_fee if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'delivery_fee'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0;
    END IF;

    -- Add delivery_type if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'delivery_type'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN delivery_type TEXT DEFAULT 'pickup';
    END IF;

    -- Add restaurant_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'restaurant_id'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN restaurant_id UUID REFERENCES public.restaurants(id);
        CREATE INDEX IF NOT EXISTS idx_meal_schedules_restaurant_id ON public.meal_schedules(restaurant_id);
    END IF;
END $$;

-- Backfill restaurant_id from meals
UPDATE public.meal_schedules ms
SET restaurant_id = m.restaurant_id
FROM public.meals m
WHERE ms.meal_id = m.id
AND ms.restaurant_id IS NULL;

-- ==========================================
-- FIX 4: Refresh PostgREST schema cache
-- ==========================================
NOTIFY pgrst, 'reload schema';

-- Success message
SELECT 'Homepage fixes applied successfully!' as result;
