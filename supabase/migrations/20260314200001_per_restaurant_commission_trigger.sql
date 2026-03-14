-- Update commission trigger to use per-restaurant commission_rate
-- instead of the global platform_settings value.
-- Falls back to global rate, then 18% if neither is set.

CREATE OR REPLACE FUNCTION public.calculate_order_commission()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_commission numeric;
  global_commission numeric;
BEGIN
  -- 1. Try to get the per-restaurant commission rate
  SELECT r.commission_rate INTO restaurant_commission
  FROM public.restaurants r
  WHERE r.id = NEW.restaurant_id;

  -- 2. If the restaurant has a commission_rate set and > 0, use it
  IF restaurant_commission IS NOT NULL AND restaurant_commission > 0 THEN
    NEW.commission_rate := restaurant_commission;
  ELSE
    -- 3. Fall back to the global platform setting
    SELECT COALESCE((value->>'restaurant')::numeric, 18)
    INTO global_commission
    FROM public.platform_settings
    WHERE key = 'commission_rates';

    NEW.commission_rate := COALESCE(global_commission, 18);
  END IF;

  -- Calculate commission and partner earnings
  NEW.commission_amount := ROUND((NEW.total_price * NEW.commission_rate / 100)::numeric, 2);
  NEW.partner_earnings := NEW.total_price - NEW.commission_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
