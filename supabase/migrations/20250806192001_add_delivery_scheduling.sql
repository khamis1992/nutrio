-- Location: supabase/migrations/20250806192001_add_delivery_scheduling.sql
-- Schema Analysis: Orders table exists with basic delivery functionality
-- Integration Type: Extension - Adding delivery scheduling to existing orders
-- Dependencies: orders table (existing), users table (existing)

-- Extend existing orders table with delivery scheduling functionality
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_window_start TIME,
ADD COLUMN IF NOT EXISTS delivery_window_end TIME,
ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
ADD COLUMN IF NOT EXISTS is_recurring_delivery BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly') OR recurring_frequency IS NULL);

-- Add indexes for delivery scheduling queries
CREATE INDEX IF NOT EXISTS idx_orders_delivery_scheduled_at ON public.orders(delivery_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_next_delivery ON public.orders(user_id, delivery_scheduled_at) WHERE delivery_scheduled_at > NOW();

-- Update trigger to handle updated_at
-- (orders table already has update trigger, no need to add)

-- Mock data for testing delivery scheduling
DO $$
DECLARE
    existing_user_id UUID;
    existing_order_id UUID;
BEGIN
    -- Get existing user ID from users table
    SELECT id INTO existing_user_id FROM public.users LIMIT 1;
    
    -- Get existing order ID
    SELECT id INTO existing_order_id FROM public.orders LIMIT 1;
    
    -- Update existing orders with delivery scheduling info
    IF existing_order_id IS NOT NULL AND existing_user_id IS NOT NULL THEN
        UPDATE public.orders 
        SET 
            delivery_scheduled_at = CURRENT_TIMESTAMP + INTERVAL '1 day',
            delivery_window_start = '12:00:00'::TIME,
            delivery_window_end = '14:00:00'::TIME,
            delivery_instructions = 'Leave at front door if no answer',
            is_recurring_delivery = true,
            recurring_frequency = 'weekly'
        WHERE id = existing_order_id;

        -- Insert new test order with delivery scheduling
        INSERT INTO public.orders (
            user_id, 
            restaurant_id,
            total_amount,
            status,
            delivery_scheduled_at,
            delivery_window_start,
            delivery_window_end,
            delivery_instructions,
            is_recurring_delivery,
            recurring_frequency
        )
        SELECT 
            existing_user_id,
            restaurant_id,
            89.50,
            'scheduled',
            CURRENT_TIMESTAMP + INTERVAL '2 days',
            '18:00:00'::TIME,
            '20:00:00'::TIME,
            'Ring doorbell twice',
            false,
            null
        FROM public.orders 
        WHERE id = existing_order_id
        LIMIT 1;
    END IF;
    
    -- Log if no existing data found
    IF existing_user_id IS NULL THEN
        RAISE NOTICE 'No existing users found. Create user data first.';
    END IF;
    
    IF existing_order_id IS NULL THEN
        RAISE NOTICE 'No existing orders found. Create order data first.';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;