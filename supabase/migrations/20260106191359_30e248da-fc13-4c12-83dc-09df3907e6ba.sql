-- Create meal_addons table for restaurant add-on offerings
CREATE TABLE public.meal_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'extras' CHECK (category IN ('premium_ingredients', 'sides', 'extras', 'drinks')),
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create schedule_addons to track add-ons selected for scheduled meals
CREATE TABLE public.schedule_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.meal_schedules(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.meal_addons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, addon_id)
);

-- Enable RLS on meal_addons
ALTER TABLE public.meal_addons ENABLE ROW LEVEL SECURITY;

-- Anyone can view available add-ons for approved restaurant meals
CREATE POLICY "Anyone can view available meal addons"
ON public.meal_addons
FOR SELECT
USING (
  is_available = true 
  AND EXISTS (
    SELECT 1 FROM meals m
    JOIN restaurants r ON r.id = m.restaurant_id
    WHERE m.id = meal_addons.meal_id
    AND m.is_available = true
    AND r.approval_status = 'approved'
    AND r.is_active = true
  )
);

-- Partners can manage add-ons for their meals
CREATE POLICY "Partners can manage addons for their meals"
ON public.meal_addons
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM meals m
    JOIN restaurants r ON r.id = m.restaurant_id
    WHERE m.id = meal_addons.meal_id
    AND r.owner_id = auth.uid()
  )
);

-- Admins can manage all add-ons
CREATE POLICY "Admins can manage all meal addons"
ON public.meal_addons
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable RLS on schedule_addons
ALTER TABLE public.schedule_addons ENABLE ROW LEVEL SECURITY;

-- Users can view their own schedule add-ons
CREATE POLICY "Users can view their schedule addons"
ON public.schedule_addons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meal_schedules ms
    WHERE ms.id = schedule_addons.schedule_id
    AND ms.user_id = auth.uid()
  )
);

-- Users can create add-ons for their schedules
CREATE POLICY "Users can create schedule addons"
ON public.schedule_addons
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM meal_schedules ms
    WHERE ms.id = schedule_addons.schedule_id
    AND ms.user_id = auth.uid()
  )
);

-- Partners can view schedule add-ons for their meals
CREATE POLICY "Partners can view schedule addons for their meals"
ON public.schedule_addons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meal_schedules ms
    JOIN meals m ON m.id = ms.meal_id
    JOIN restaurants r ON r.id = m.restaurant_id
    WHERE ms.id = schedule_addons.schedule_id
    AND r.owner_id = auth.uid()
  )
);

-- Create trigger for updated_at on meal_addons
CREATE TRIGGER update_meal_addons_updated_at
BEFORE UPDATE ON public.meal_addons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add addons_total column to meal_schedules for quick total calculation
ALTER TABLE public.meal_schedules
ADD COLUMN addons_total NUMERIC DEFAULT 0;