-- Add commission columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS partner_earnings numeric DEFAULT 0;

-- Add commission columns to payouts table
ALTER TABLE public.payouts
ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_order_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_deducted numeric DEFAULT 0;

-- Create function to calculate order commission
CREATE OR REPLACE FUNCTION public.calculate_order_commission()
RETURNS TRIGGER AS $$
DECLARE
  commission_rates jsonb;
  restaurant_commission numeric;
BEGIN
  -- Get commission rates from platform_settings
  SELECT value INTO commission_rates
  FROM public.platform_settings
  WHERE key = 'commission_rates';
  
  -- Default to 15% if not configured
  restaurant_commission := COALESCE((commission_rates->>'restaurant')::numeric, 15);
  
  -- Calculate commission
  NEW.commission_rate := restaurant_commission;
  NEW.commission_amount := ROUND((NEW.total_price * restaurant_commission / 100)::numeric, 2);
  NEW.partner_earnings := NEW.total_price - NEW.commission_amount;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-calculate commission on order insert/update
DROP TRIGGER IF EXISTS calculate_order_commission_trigger ON public.orders;
CREATE TRIGGER calculate_order_commission_trigger
BEFORE INSERT OR UPDATE OF total_price ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_order_commission();

-- Create function to generate partner payouts with commission
CREATE OR REPLACE FUNCTION public.generate_partner_payout(
  p_restaurant_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS uuid AS $$
DECLARE
  v_partner_id uuid;
  v_total_orders numeric;
  v_total_commission numeric;
  v_partner_earnings numeric;
  v_order_count integer;
  v_avg_commission_rate numeric;
  v_payout_id uuid;
BEGIN
  -- Get partner ID from restaurant
  SELECT owner_id INTO v_partner_id
  FROM public.restaurants
  WHERE id = p_restaurant_id;
  
  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found or has no owner';
  END IF;
  
  -- Calculate totals from orders in the period
  SELECT 
    COALESCE(SUM(total_price), 0),
    COALESCE(SUM(commission_amount), 0),
    COALESCE(SUM(partner_earnings), 0),
    COUNT(*),
    COALESCE(AVG(commission_rate), 0)
  INTO v_total_orders, v_total_commission, v_partner_earnings, v_order_count, v_avg_commission_rate
  FROM public.orders
  WHERE restaurant_id = p_restaurant_id
    AND delivery_date BETWEEN p_period_start AND p_period_end
    AND status IN ('delivered', 'completed');
  
  -- Create payout record
  INSERT INTO public.payouts (
    partner_id,
    restaurant_id,
    amount,
    status,
    period_start,
    period_end,
    order_count,
    commission_rate,
    total_order_value,
    commission_deducted
  ) VALUES (
    v_partner_id,
    p_restaurant_id,
    v_partner_earnings,
    'pending',
    p_period_start,
    p_period_end,
    v_order_count,
    v_avg_commission_rate,
    v_total_orders,
    v_total_commission
  )
  RETURNING id INTO v_payout_id;
  
  RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Allow admins to execute payout generation
GRANT EXECUTE ON FUNCTION public.generate_partner_payout(uuid, date, date) TO authenticated;