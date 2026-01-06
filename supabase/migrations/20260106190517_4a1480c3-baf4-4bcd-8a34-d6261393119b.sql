-- Add delivery fee columns to meal_schedules table
ALTER TABLE public.meal_schedules
ADD COLUMN delivery_type TEXT DEFAULT 'standard' CHECK (delivery_type IN ('standard', 'express', 'free')),
ADD COLUMN delivery_fee NUMERIC DEFAULT 0;

-- Add delivery fee settings to platform_settings
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'delivery_fees',
  '{"standard": 3.99, "express": 6.99, "free_threshold": 50, "enabled": true}'::jsonb,
  'Delivery fee configuration for customer orders'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;