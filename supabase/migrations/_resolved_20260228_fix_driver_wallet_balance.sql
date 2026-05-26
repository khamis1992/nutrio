-- Migration: Add trigger to update driver wallet_balance from delivery_jobs
-- Date: 2026-02-28
-- Description: When a delivery_job is completed, credit the driver's wallet_balance

-- Create trigger function to credit driver wallet on delivery completion
CREATE OR REPLACE FUNCTION credit_driver_wallet_from_jobs()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes TO 'delivered'
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    -- Credit driver wallet with the driver_earnings amount
    UPDATE public.drivers
    SET 
      wallet_balance = COALESCE(wallet_balance, 0) + COALESCE(NEW.driver_earnings, 0),
      total_deliveries = COALESCE(total_deliveries, 0) + 1,
      updated_at = NOW()
    WHERE id = NEW.driver_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON credit_driver_wallet_from_jobs IS 
'Credits driver wallet_balance when a delivery_job is marked as delivered';

-- Apply trigger to delivery_jobs table
DROP TRIGGER IF EXISTS trg_credit_driver_wallet ON delivery_jobs;
CREATE TRIGGER trg_credit_driver_wallet
  AFTER UPDATE ON delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION credit_driver_wallet_from_jobs();

-- Grant permissions
GRANT EXECUTE ON credit_driver_wallet_from_jobs TO authenticated;

-- Update existing delivered jobs to sync wallet balances (optional - run manually if needed)
-- This recalculates wallet_balance for all drivers based on completed delivery_jobs
/*
UPDATE public.drivers d
SET 
  wallet_balance = COALESCE((
    SELECT SUM(COALESCE(dj.driver_earnings, 0))
    FROM delivery_jobs dj
    WHERE dj.driver_id = d.id 
    AND dj.status = 'delivered'
  ), 0),
  total_deliveries = COALESCE((
    SELECT COUNT(*)
    FROM delivery_jobs dj
    WHERE dj.driver_id = d.id 
    AND dj.status = 'delivered'
  ), 0),
  updated_at = NOW();
*/

SELECT 'Trigger created successfully' as status;

