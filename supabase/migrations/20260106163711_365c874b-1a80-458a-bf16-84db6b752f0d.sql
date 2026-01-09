-- Add order_status column to meal_schedules for granular status tracking
ALTER TABLE public.meal_schedules 
ADD COLUMN order_status text NOT NULL DEFAULT 'pending';

-- Add a check constraint for valid status values
ALTER TABLE public.meal_schedules
ADD CONSTRAINT valid_order_status CHECK (order_status IN ('pending', 'confirmed', 'preparing', 'delivered'));

-- Create an index for faster status queries
CREATE INDEX idx_meal_schedules_order_status ON public.meal_schedules(order_status);