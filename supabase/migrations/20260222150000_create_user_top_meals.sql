-- Create user_top_meals table for user's personalized top meals
CREATE TABLE IF NOT EXISTS public.user_top_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_auto_added BOOLEAN DEFAULT FALSE,
    order_count INTEGER DEFAULT 1,
    last_ordered_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, meal_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_top_meals_user_id ON public.user_top_meals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_top_meals_meal_id ON public.user_top_meals(meal_id);

-- Enable RLS
ALTER TABLE public.user_top_meals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own top meals"
    ON public.user_top_meals
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own top meals"
    ON public.user_top_meals
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own top meals"
    ON public.user_top_meals
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to automatically add meals to top meals when ordered
CREATE OR REPLACE FUNCTION public.add_meal_to_top_meals()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update the meal in user's top meals
    INSERT INTO public.user_top_meals (user_id, meal_id, is_auto_added, order_count, last_ordered_at)
    VALUES (NEW.user_id, NEW.meal_id, TRUE, 1, NEW.created_at)
    ON CONFLICT (user_id, meal_id) 
    DO UPDATE SET
        order_count = public.user_top_meals.order_count + 1,
        last_ordered_at = NEW.created_at,
        is_auto_added = TRUE
    WHERE public.user_top_meals.user_id = NEW.user_id 
      AND public.user_top_meals.meal_id = NEW.meal_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically add meals when an order is created
DROP TRIGGER IF EXISTS trigger_add_to_top_meals ON public.orders;
CREATE TRIGGER trigger_add_to_top_meals
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.add_meal_to_top_meals();

-- Function to clean up old auto-added meals (older than 3 days with less than 5 orders)
CREATE OR REPLACE FUNCTION public.cleanup_old_top_meals()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_top_meals
    WHERE is_auto_added = TRUE
      AND order_count < 5
      AND last_ordered_at < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON TABLE public.user_top_meals IS 'Stores user''s top meals based on ordering history and manual additions';
