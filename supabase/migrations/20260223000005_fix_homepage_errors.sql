-- Migration: Fix home page notification and meal schedule query issues
-- Created: 2026-02-23
-- Purpose: Add missing notification_type value and fix schema issues

-- =====================
-- FIX 1: Add meal_scheduled to notification_type enum
-- =====================

-- First, check if notification_type is an enum or text with check constraint
DO $$
DECLARE
    v_enum_exists boolean;
    v_check_constraint_exists boolean;
BEGIN
    -- Check if notification_type enum exists
    SELECT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'notification_type'
        AND n.nspname = 'public'
    ) INTO v_enum_exists;

    IF v_enum_exists THEN
        -- It's an enum, add the new value
        ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'meal_scheduled';
        RAISE NOTICE 'Added meal_scheduled to notification_type enum';
    ELSE
        -- Check if there's a check constraint on notifications.type
        SELECT EXISTS (
            SELECT 1 FROM information_schema.check_constraints cc
            JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
            WHERE ccu.table_name = 'notifications'
            AND ccu.column_name = 'type'
        ) INTO v_check_constraint_exists;

        IF v_check_constraint_exists THEN
            -- Drop the check constraint and recreate with new value
            ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
            ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
                CHECK (type IN ('order_update', 'meal_reminder', 'subscription_alert', 'general', 'meal_scheduled', 'order_delivered'));
            RAISE NOTICE 'Updated notifications_type_check constraint to include meal_scheduled';
        ELSE
            -- No constraint found, assume it's plain text
            RAISE NOTICE 'No enum or check constraint found on notifications.type - treating as plain text';
        END IF;
    END IF;
END $$;

-- =====================
-- FIX 2: Add status and data columns to notifications if missing
-- =====================

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

-- Add data column if not exists (using data instead of metadata to match code)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'data'
    ) THEN
        -- Rename metadata to data if metadata exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'metadata'
        ) THEN
            ALTER TABLE public.notifications RENAME COLUMN metadata TO data;
            RAISE NOTICE 'Renamed metadata column to data';
        ELSE
            ALTER TABLE public.notifications ADD COLUMN data JSONB DEFAULT '{}';
            RAISE NOTICE 'Added data column to notifications';
        END IF;
    END IF;
END $$;

-- =====================
-- FIX 3: Add notification_status enum if it doesn't exist
-- =====================

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

-- Update status column to use enum if it's plain text
DO $$
DECLARE
    v_enum_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'notification_status'
        AND n.nspname = 'public'
    ) INTO v_enum_exists;

    IF v_enum_exists THEN
        -- Alter column to use enum
        ALTER TABLE public.notifications 
            ALTER COLUMN status TYPE public.notification_status 
            USING status::public.notification_status;
        RAISE NOTICE 'Converted status column to notification_status enum';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not convert status column to enum: %', SQLERRM;
END $$;

-- =====================
-- FIX 4: Ensure meal_schedules has proper columns for order tracking
-- =====================

-- Add order_status column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'order_status'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN order_status TEXT DEFAULT 'pending';
        CREATE INDEX IF NOT EXISTS idx_meal_schedules_order_status ON public.meal_schedules(order_status);
        RAISE NOTICE 'Added order_status column to meal_schedules';
    END IF;
END $$;

-- Add addons_total column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'addons_total'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN addons_total NUMERIC(10,2) DEFAULT 0;
        RAISE NOTICE 'Added addons_total column to meal_schedules';
    END IF;
END $$;

-- Add delivery_fee column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'delivery_fee'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0;
        RAISE NOTICE 'Added delivery_fee column to meal_schedules';
    END IF;
END $$;

-- Add delivery_type column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'delivery_type'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN delivery_type TEXT DEFAULT 'pickup';
        RAISE NOTICE 'Added delivery_type column to meal_schedules';
    END IF;
END $$;

-- =====================
-- FIX 5: Add restaurant_id to meal_schedules for easier querying
-- =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_schedules' 
        AND column_name = 'restaurant_id'
    ) THEN
        ALTER TABLE public.meal_schedules ADD COLUMN restaurant_id UUID REFERENCES public.restaurants(id);
        CREATE INDEX IF NOT EXISTS idx_meal_schedules_restaurant_id ON public.meal_schedules(restaurant_id);
        RAISE NOTICE 'Added restaurant_id column to meal_schedules';
    END IF;
END $$;

-- Backfill restaurant_id from meals table
UPDATE public.meal_schedules ms
SET restaurant_id = m.restaurant_id
FROM public.meals m
WHERE ms.meal_id = m.id
AND ms.restaurant_id IS NULL;

-- =====================
-- FIX 6: Ensure meals to restaurants FK relationship exists
-- =====================

-- The FK should already exist from the base migration, but let's ensure it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'meals'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.column_name = 'restaurant_id'
    ) THEN
        -- Add FK constraint if it doesn't exist
        ALTER TABLE public.meals 
        ADD CONSTRAINT meals_restaurant_id_fkey 
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK constraint meals_restaurant_id_fkey';
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
