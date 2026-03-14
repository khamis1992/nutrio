-- Add commission_rate column to restaurants table
-- commission_rate: the percentage the platform takes from each meal (e.g. 18 = 18%)
-- payout_rate: the gross per-meal price the restaurant charges
-- Net payout to restaurant = payout_rate * (1 - commission_rate / 100)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00;

COMMENT ON COLUMN restaurants.commission_rate IS
  'Platform commission percentage taken from each meal (e.g. 18.00 = 18%). Set by admin per restaurant.';
