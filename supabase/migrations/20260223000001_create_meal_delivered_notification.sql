-- Migration: Auto-add delivered meals to Today's Progress notification
-- Created: 2026-02-23
-- Purpose: Notify users when order is delivered and allow them to add to progress

-- First, add meal_id to order_items if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'meal_id'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN meal_id UUID REFERENCES public.meals(id);
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_items_meal_id ON public.order_items(meal_id);

-- Function to create notification when order is delivered
CREATE OR REPLACE FUNCTION public.notify_meal_delivered()
RETURNS TRIGGER AS $$
DECLARE
    v_order_item RECORD;
    v_meal RECORD;
    v_notification_data JSONB;
BEGIN
    -- Only proceed if status changed to delivered
    IF NEW.status = 'delivered' AND (OLD IS NULL OR OLD.status != 'delivered') THEN
        
        -- Get order items with meal details
        FOR v_order_item IN 
            SELECT oi.id, oi.meal_name, oi.meal_id, oi.quantity
            FROM public.order_items oi
            WHERE oi.order_id = NEW.id
        LOOP
            -- Get meal nutritional info if meal_id exists
            IF v_order_item.meal_id IS NOT NULL THEN
                SELECT calories, protein_g, carbs_g, fat_g, name, id
                INTO v_meal
                FROM public.meals
                WHERE id = v_order_item.meal_id;
                
                IF v_meal.id IS NOT NULL THEN
                    -- Create notification with meal data
                    v_notification_data := jsonb_build_object(
                        'order_id', NEW.id,
                        'meal_id', v_meal.id,
                        'meal_name', v_meal.name,
                        'quantity', v_order_item.quantity,
                        'calories', v_meal.calories,
                        'protein_g', v_meal.protein_g,
                        'carbs_g', v_meal.carbs_g,
                        'fat_g', v_meal.fat_g,
                        'action', 'add_to_progress'
                    );
                    
                    INSERT INTO public.notifications (
                        user_id,
                        type,
                        title,
                        message,
                        status,
                        data,
                        related_entity_type,
                        related_entity_id,
                        created_at
                    ) VALUES (
                        NEW.user_id,
                        'order_delivered'::public.notification_type,
                        'Order Delivered! Add to Progress?',
                        format('%s has been delivered. Would you like to add it to your Today''s Progress?', v_meal.name),
                        'unread'::public.notification_status,
                        v_notification_data,
                        'order',
                        NEW.id,
                        NOW()
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS tr_order_delivered_notification ON public.orders;

-- Create trigger
CREATE TRIGGER tr_order_delivered_notification
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    WHEN (NEW.status = 'delivered')
    EXECUTE FUNCTION public.notify_meal_delivered();

-- Also trigger on insert if status is already delivered
CREATE TRIGGER tr_order_insert_delivered_notification
    AFTER INSERT ON public.orders
    FOR EACH ROW
    WHEN (NEW.status = 'delivered')
    EXECUTE FUNCTION public.notify_meal_delivered();

-- Function to add delivered meal to progress (can be called from frontend)
CREATE OR REPLACE FUNCTION public.add_delivered_meal_to_progress(
    p_order_id UUID,
    p_meal_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_meal RECORD;
    v_today DATE;
    v_existing_log RECORD;
BEGIN
    -- Get user_id from order
    SELECT user_id INTO v_user_id
    FROM public.orders
    WHERE id = p_order_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Get meal details
    SELECT id, name, calories, protein_g, carbs_g, fat_g
    INTO v_meal
    FROM public.meals
    WHERE id = p_meal_id;
    
    IF v_meal.id IS NULL THEN
        RAISE EXCEPTION 'Meal not found';
    END IF;
    
    -- Get today's date
    v_today := CURRENT_DATE;
    
    -- Check if there's an existing log for today
    SELECT id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g
    INTO v_existing_log
    FROM public.progress_logs
    WHERE user_id = v_user_id
    AND log_date = v_today;
    
    IF v_existing_log.id IS NOT NULL THEN
        -- Update existing log
        UPDATE public.progress_logs
        SET 
            calories_consumed = v_existing_log.calories_consumed + v_meal.calories,
            protein_consumed_g = v_existing_log.protein_consumed_g + v_meal.protein_g,
            carbs_consumed_g = v_existing_log.carbs_consumed_g + v_meal.carbs_g,
            fat_consumed_g = v_existing_log.fat_consumed_g + v_meal.fat_g,
            updated_at = NOW()
        WHERE id = v_existing_log.id;
    ELSE
        -- Create new log
        INSERT INTO public.progress_logs (
            user_id,
            log_date,
            calories_consumed,
            protein_consumed_g,
            carbs_consumed_g,
            fat_consumed_g
        ) VALUES (
            v_user_id,
            v_today,
            v_meal.calories,
            v_meal.protein_g,
            v_meal.carbs_g,
            v_meal.fat_g
        );
    END IF;
    
    -- Also save to meal history
    INSERT INTO public.meal_history (
        user_id,
        name,
        calories,
        protein_g,
        carbs_g,
        fat_g
    ) VALUES (
        v_user_id,
        v_meal.name,
        v_meal.calories,
        v_meal.protein_g,
        v_meal.carbs_g,
        v_meal.fat_g
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION public.notify_meal_delivered() IS 
    'Creates a notification when an order is marked as delivered with meal details';

COMMENT ON FUNCTION public.add_delivered_meal_to_progress(UUID, UUID) IS 
    'Adds a delivered meal to the user Today progress logs';
