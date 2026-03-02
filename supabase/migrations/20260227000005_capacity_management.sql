-- Migration: Capacity Management for Restaurants
-- Purpose: Prevent restaurants from being overwhelmed with orders

-- Add capacity tracking columns to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS max_meals_per_day INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS current_day_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for capacity checks
CREATE INDEX IF NOT EXISTS idx_restaurants_capacity 
ON public.restaurants(id, max_meals_per_day, current_day_orders);

-- Function to reset daily order counts
CREATE OR REPLACE FUNCTION reset_daily_capacity_counts()
RETURNS void AS $$
BEGIN
    UPDATE public.restaurants
    SET 
        current_day_orders = 0,
        daily_reset_at = NOW()
    WHERE daily_reset_at < date_trunc('day', NOW());
    
    RAISE NOTICE 'Reset daily capacity for % restaurants', 
        (SELECT COUNT(*) FROM public.restaurants WHERE daily_reset_at >= date_trunc('day', NOW()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check restaurant capacity before accepting order
CREATE OR REPLACE FUNCTION check_restaurant_capacity(p_restaurant_id UUID)
RETURNS TABLE (
    can_accept BOOLEAN,
    current_orders INTEGER,
    max_capacity INTEGER,
    remaining_capacity INTEGER,
    message TEXT
) AS $$
DECLARE
    v_restaurant RECORD;
    v_remaining INTEGER;
BEGIN
    -- Get restaurant capacity info
    SELECT 
        id,
        max_meals_per_day,
        current_day_orders,
        daily_reset_at
    INTO v_restaurant
    FROM public.restaurants
    WHERE id = p_restaurant_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE, 
            0, 
            0, 
            0, 
            'Restaurant not found'::TEXT;
        RETURN;
    END IF;
    
    -- Check if we need to reset for a new day
    IF v_restaurant.daily_reset_at < date_trunc('day', NOW()) THEN
        -- Reset the count
        UPDATE public.restaurants
        SET 
            current_day_orders = 0,
            daily_reset_at = NOW()
        WHERE id = p_restaurant_id;
        
        v_restaurant.current_day_orders := 0;
    END IF;
    
    -- Calculate remaining capacity
    v_remaining := v_restaurant.max_meals_per_day - v_restaurant.current_day_orders;
    
    -- Return capacity info
    RETURN QUERY SELECT 
        v_remaining > 0,
        v_restaurant.current_day_orders,
        v_restaurant.max_meals_per_day,
        GREATEST(v_remaining, 0),
        CASE 
            WHEN v_remaining > 0 THEN 
                format('Capacity available: %s/%s orders', 
                    v_restaurant.current_day_orders, 
                    v_restaurant.max_meals_per_day)
            ELSE 
                format('Restaurant at capacity: %s/%s orders. Try again tomorrow.',
                    v_restaurant.current_day_orders,
                    v_restaurant.max_meals_per_day)
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment order count (call when order is confirmed)
CREATE OR REPLACE FUNCTION increment_restaurant_order_count(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_capacity_check RECORD;
BEGIN
    -- Check capacity first
    SELECT * INTO v_capacity_check
    FROM check_restaurant_capacity(p_restaurant_id);
    
    IF NOT v_capacity_check.can_accept THEN
        RETURN FALSE;
    END IF;
    
    -- Increment the count
    UPDATE public.restaurants
    SET current_day_orders = current_day_orders + 1
    WHERE id = p_restaurant_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to check capacity on order insert
CREATE OR REPLACE FUNCTION trg_check_order_capacity()
RETURNS TRIGGER AS $$
DECLARE
    v_meal_restaurant_id UUID;
    v_capacity_check RECORD;
BEGIN
    -- Get restaurant ID from meal
    SELECT restaurant_id INTO v_meal_restaurant_id
    FROM public.meals
    WHERE id = NEW.meal_id;
    
    IF v_meal_restaurant_id IS NULL THEN
        RAISE EXCEPTION 'Meal not found or has no restaurant';
    END IF;
    
    -- Check capacity
    SELECT * INTO v_capacity_check
    FROM check_restaurant_capacity(v_meal_restaurant_id);
    
    IF NOT v_capacity_check.can_accept THEN
        RAISE EXCEPTION 'Restaurant has reached daily capacity: %', v_capacity_check.message;
    END IF;
    
    -- Increment count
    PERFORM increment_restaurant_order_count(v_meal_restaurant_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (optional - enable if you want strict enforcement)
-- DROP TRIGGER IF EXISTS check_capacity_before_order ON public.meal_schedules;
-- CREATE TRIGGER check_capacity_before_order
--     BEFORE INSERT ON public.meal_schedules
--     FOR EACH ROW
--     EXECUTE FUNCTION trg_check_order_capacity();

-- View for monitoring restaurant capacity
CREATE OR REPLACE VIEW restaurant_capacity_status AS
SELECT 
    r.id,
    r.name,
    r.max_meals_per_day,
    r.current_day_orders,
    (r.max_meals_per_day - r.current_day_orders) as remaining_capacity,
    CASE 
        WHEN r.current_day_orders >= r.max_meals_per_day THEN 'AT_CAPACITY'
        WHEN r.current_day_orders >= r.max_meals_per_day * 0.9 THEN 'NEAR_CAPACITY'
        WHEN r.current_day_orders >= r.max_meals_per_day * 0.75 THEN 'HIGH_USAGE'
        ELSE 'NORMAL'
    END as capacity_status,
    ROUND((r.current_day_orders::NUMERIC / NULLIF(r.max_meals_per_day, 0)) * 100, 1) as usage_percentage,
    r.daily_reset_at
FROM public.restaurants r
WHERE r.is_active = true;

-- Function to update restaurant capacity
CREATE OR REPLACE FUNCTION update_restaurant_capacity(
    p_restaurant_id UUID,
    p_max_meals_per_day INTEGER
)
RETURNS void AS $$
BEGIN
    UPDATE public.restaurants
    SET max_meals_per_day = p_max_meals_per_day
    WHERE id = p_restaurant_id;
    
    -- Log the change
    RAISE NOTICE 'Updated capacity for restaurant % to % meals per day', 
        p_restaurant_id, p_max_meals_per_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON check_restaurant_capacity IS 'Checks if restaurant can accept more orders';
COMMENT ON increment_restaurant_order_count IS 'Increments order count when order is confirmed';
COMMENT ON VIEW restaurant_capacity_status IS 'Real-time capacity status for all restaurants';

-- Grant access to partner (restaurant owner) to update their capacity
DROP POLICY IF EXISTS "Restaurant owners can update their capacity" ON public.restaurants;
CREATE POLICY "Restaurant owners can update their capacity"
ON public.restaurants FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (
    owner_id = auth.uid() 
    AND max_meals_per_day BETWEEN 10 AND 1000  -- Reasonable limits
);


