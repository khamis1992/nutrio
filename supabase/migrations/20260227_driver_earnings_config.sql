-- Migration: Driver Earnings Configuration System
-- Purpose: Allow admin to customize driver earnings per order with flexible rules

-- Create driver_earning_rules table for flexible earnings configuration
CREATE TABLE IF NOT EXISTS public.driver_earning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('global', 'city', 'restaurant', 'distance', 'time_of_day')),
  name TEXT NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  percentage_of_delivery_fee NUMERIC(5, 2) NOT NULL DEFAULT 80.00,
  min_earning NUMERIC(10, 2) DEFAULT 0,
  max_earning NUMERIC(10, 2) DEFAULT NULL,
  conditions JSONB DEFAULT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient rule lookup
CREATE INDEX IF NOT EXISTS idx_driver_earning_rules_lookup 
ON driver_earning_rules(rule_type, is_active, priority DESC, valid_from, valid_until);

-- Create index for conditions JSONB queries
CREATE INDEX IF NOT EXISTS idx_driver_earning_rules_conditions 
ON driver_earning_rules USING gin(conditions);

-- Add driver_settings to platform_settings for simple global config
INSERT INTO public.platform_settings (key, value, description) VALUES
('driver_settings', '{
  "minimum_payout_threshold": 10,
  "default_base_earning": 0,
  "default_percentage": 80,
  "enable_distance_tiers": false,
  "enable_city_multipliers": false,
  "enable_restaurant_specific": false
}'::jsonb, 'Driver earnings and payout configuration')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Add comment explaining the table
COMMENT ON TABLE public.driver_earning_rules IS 
'Flexible driver earnings rules. Rules evaluated by priority (highest first), first matching rule wins.';

-- Comments on columns
COMMENT ON COLUMN driver_earning_rules.rule_type IS 
'global=default, city=specific city rates, restaurant=restaurant-specific, distance=distance-based tiers, time_of_day=peak hour rates';

COMMENT ON COLUMN driver_earning_rules.conditions IS 
'JSON conditions: {"city": "Doha", "distance_min": 0, "distance_max": 5, "restaurant_id": "uuid", "time_start": "08:00", "time_end": "10:00"}';

COMMENT ON COLUMN driver_earning_rules.base_amount IS 
'Fixed amount per order (e.g., 5 QAR flat fee)';

COMMENT ON COLUMN driver_earning_rules.percentage_of_delivery_fee IS 
'Percentage of delivery fee driver receives (e.g., 80 = 80%%)';

-- Insert default global rule
INSERT INTO public.driver_earning_rules (
  rule_type, 
  name, 
  base_amount, 
  percentage_of_delivery_fee, 
  priority, 
  is_active,
  conditions
) VALUES (
  'global',
  'Default Global Rate',
  0,
  80.00,
  0,
  true,
  NULL
) ON CONFLICT DO NOTHING;

-- Example: City-specific rule for Doha (higher priority)
-- Uncomment and modify as needed:
-- INSERT INTO public.driver_earning_rules (
--   rule_type, name, base_amount, percentage_of_delivery_fee, priority, conditions
-- ) VALUES (
--   'city', 'Doha Premium Rate', 5.00, 85.00, 10, '{"city": "Doha"}'
-- );

-- Example: Distance tier rule
-- Uncomment and modify as needed:
-- INSERT INTO public.driver_earning_rules (
--   rule_type, name, base_amount, percentage_of_delivery_fee, priority, conditions
-- ) VALUES 
--   ('distance', 'Short Distance (0-3km)', 3.00, 80.00, 20, '{"distance_min": 0, "distance_max": 3}'),
--   ('distance', 'Medium Distance (3-7km)', 5.00, 80.00, 20, '{"distance_min": 3, "distance_max": 7}'),
--   ('distance', 'Long Distance (7km+)', 8.00, 85.00, 20, '{"distance_min": 7}');

-- Create function to calculate driver earnings
CREATE OR REPLACE FUNCTION calculate_driver_earnings(
  p_delivery_fee NUMERIC,
  p_tip_amount NUMERIC DEFAULT 0,
  p_city TEXT DEFAULT NULL,
  p_restaurant_id UUID DEFAULT NULL,
  p_distance_km NUMERIC DEFAULT NULL,
  p_order_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS NUMERIC AS $$
DECLARE
  v_rule RECORD;
  v_base_amount NUMERIC := 0;
  v_percentage NUMERIC := 80;
  v_earnings NUMERIC;
BEGIN
  -- Find the highest priority matching rule
  SELECT * INTO v_rule
  FROM driver_earning_rules
  WHERE is_active = true
    AND valid_from <= p_order_time
    AND (valid_until IS NULL OR valid_until >= p_order_time)
    AND (
      -- Global rule (fallback)
      rule_type = 'global'
      -- City-specific rule
      OR (rule_type = 'city' AND conditions->>'city' = p_city)
      -- Restaurant-specific rule
      OR (rule_type = 'restaurant' AND (conditions->>'restaurant_id')::UUID = p_restaurant_id)
      -- Distance-based rule
      OR (
        rule_type = 'distance' 
        AND p_distance_km IS NOT NULL
        AND (
          (conditions->>'distance_min')::NUMERIC IS NULL OR p_distance_km >= (conditions->>'distance_min')::NUMERIC
        )
        AND (
          (conditions->>'distance_max')::NUMERIC IS NULL OR p_distance_km < (conditions->>'distance_max')::NUMERIC
        )
      )
      -- Time of day rule
      OR (
        rule_type = 'time_of_day'
        AND conditions->>'time_start' IS NOT NULL
        AND conditions->>'time_end' IS NOT NULL
        AND TO_CHAR(p_order_time AT TIME ZONE 'Asia/Qatar', 'HH24:MI') BETWEEN 
            conditions->>'time_start' AND conditions->>'time_end'
      )
    )
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;

  -- Use rule values if found, otherwise use defaults
  IF FOUND THEN
    v_base_amount := v_rule.base_amount;
    v_percentage := v_rule.percentage_of_delivery_fee;
  ELSE
    -- Fallback to platform_settings defaults
    SELECT (value->>'default_base_earning')::NUMERIC,
           (value->>'default_percentage')::NUMERIC
    INTO v_base_amount, v_percentage
    FROM platform_settings
    WHERE key = 'driver_settings';
    
    -- Ensure we have defaults even if settings missing
    v_base_amount := COALESCE(v_base_amount, 0);
    v_percentage := COALESCE(v_percentage, 80);
  END IF;

  -- Calculate earnings: base + (delivery_fee * percentage/100) + tip
  v_earnings := v_base_amount + (p_delivery_fee * v_percentage / 100) + COALESCE(p_tip_amount, 0);

  -- Apply min/max constraints if rule has them
  IF v_rule.min_earning IS NOT NULL THEN
    v_earnings := GREATEST(v_earnings, v_rule.min_earning);
  END IF;
  
  IF v_rule.max_earning IS NOT NULL THEN
    v_earnings := LEAST(v_earnings, v_rule.max_earning);
  END IF;

  RETURN ROUND(v_earnings, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON calculate_driver_earnings IS 
'Calculates driver earnings based on configurable rules. Priority: city > restaurant > distance > time > global';

-- Create trigger function to auto-calculate earnings on delivery_jobs insert/update
CREATE OR REPLACE FUNCTION trigger_calculate_driver_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate if delivery_fee or tip changed
  IF TG_OP = 'INSERT' OR 
     (TG_OP = 'UPDATE' AND (
       NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR
       NEW.tip_amount IS DISTINCT FROM OLD.tip_amount
     )) THEN
    
    NEW.driver_earnings := calculate_driver_earnings(
      COALESCE(NEW.delivery_fee, 0),
      COALESCE(NEW.tip_amount, 0),
      NULL, -- city - could be enhanced with location lookup
      NEW.restaurant_id,
      NULL, -- distance - could be calculated from coordinates
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to delivery_jobs table
DROP TRIGGER IF EXISTS trg_calculate_driver_earnings ON delivery_jobs;
CREATE TRIGGER trg_calculate_driver_earnings
  BEFORE INSERT OR UPDATE ON delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_driver_earnings();

-- RLS Policies for driver_earning_rules (admin only)
ALTER TABLE driver_earning_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage driver earning rules" ON driver_earning_rules;
CREATE POLICY "Admins can manage driver earning rules"
  ON driver_earning_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Anyone can view active driver earning rules" ON driver_earning_rules;
CREATE POLICY "Anyone can view active driver earning rules"
  ON driver_earning_rules
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_driver_earning_rules_updated_at ON driver_earning_rules;
CREATE TRIGGER trg_driver_earning_rules_updated_at
  BEFORE UPDATE ON driver_earning_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.driver_earning_rules TO authenticated;
GRANT EXECUTE ON calculate_driver_earnings TO authenticated;

-- Recalculate existing delivery_jobs with new formula (optional - for historical consistency)
-- Uncomment if you want to update existing records:
-- UPDATE delivery_jobs 
-- SET driver_earnings = calculate_driver_earnings(
--   COALESCE(delivery_fee, 0),
--   COALESCE(tip_amount, 0),
--   NULL,
--   restaurant_id,
--   NULL,
--   created_at
-- )
-- WHERE status NOT IN ('delivered', 'cancelled');


