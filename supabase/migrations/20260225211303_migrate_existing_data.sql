-- Migration: Migrate Existing Data to Credit System
-- Week 1, Phase 1: Data Migration
-- Converts existing subscriptions to new credit-based system

-- ==========================================
-- 1. BACKUP EXISTING SUBSCRIPTION DATA
-- ==========================================
CREATE TABLE IF NOT EXISTS subscriptions_backup_pre_credit_migration AS
SELECT * FROM subscriptions;

COMMENT ON TABLE subscriptions_backup_pre_credit_migration IS 'Backup of subscriptions table before credit system migration - Created 2025-02-23';

-- ==========================================
-- 2. MIGRATE EXISTING SUBSCRIPTIONS TO CREDIT SYSTEM
-- ==========================================

-- First, ensure all subscriptions have a plan_id
-- Map existing tiers to new plan structure
UPDATE subscriptions s
SET plan_id = sp.id
FROM subscription_plans sp
WHERE s.tier = lower(sp.name)
  AND s.plan_id IS NULL;

-- For subscriptions with unmatched tiers, default to Standard plan
UPDATE subscriptions
SET plan_id = (SELECT id FROM subscription_plans WHERE name = 'Standard')
WHERE plan_id IS NULL;

-- Calculate and set credits based on plan
UPDATE subscriptions s
SET 
  credits_remaining = sp.meal_credits - COALESCE(s.meals_used_this_week, 0),
  credits_used = COALESCE(s.meals_used_this_week, 0),
  meal_value_qar = 50,
  last_credit_reset = COALESCE(s.week_start_date, CURRENT_DATE)
FROM subscription_plans sp
WHERE s.plan_id = sp.id
  AND s.credits_remaining IS NULL;

-- Ensure credits_remaining never exceeds plan total
UPDATE subscriptions s
SET credits_remaining = sp.meal_credits
FROM subscription_plans sp
WHERE s.plan_id = sp.id
  AND s.credits_remaining > sp.meal_credits;

-- ==========================================
-- 3. CREATE CREDIT TRANSACTION RECORDS FOR EXISTING USAGE
-- ==========================================

-- Record initial credit allocations for active subscriptions
INSERT INTO credit_transactions (
  user_id,
  subscription_id,
  transaction_type,
  credits_amount,
  meal_value_qar,
  description,
  metadata,
  created_at
)
SELECT 
  s.user_id,
  s.id,
  'purchase',
  sp.meal_credits,
  50,
  'Initial subscription - ' || sp.name || ' Plan (Migrated)',
  jsonb_build_object(
    'migrated', true,
    'migration_date', CURRENT_DATE,
    'original_tier', s.tier,
    'original_price', s.price_qar
  ),
  COALESCE(s.created_at, now())
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM credit_transactions ct 
    WHERE ct.subscription_id = s.id 
    AND ct.transaction_type = 'purchase'
  );

-- ==========================================
-- 4. MIGRATE EXISTING ORDERS TO EARNINGS RECORDS
-- ==========================================

-- Create earnings records for orders that don't have them yet
INSERT INTO restaurant_earnings (
  restaurant_id,
  order_id,
  meal_value_qar,
  platform_commission_qar,
  restaurant_payout_qar,
  commission_rate,
  is_settled,
  created_at
)
SELECT 
  o.restaurant_id,
  o.id,
  50,
  5,
  45,
  10.00,
  true, -- Mark existing orders as already settled (for migration purposes)
  o.created_at
FROM orders o
WHERE o.status NOT IN ('cancelled', 'refunded', 'pending')
  AND NOT EXISTS (
    SELECT 1 FROM restaurant_earnings re 
    WHERE re.order_id = o.id
  );

-- ==========================================
-- 5. CREATE DEFAULT USER PREFERENCES
-- ==========================================

-- Create default preferences for existing users
INSERT INTO user_preferences (
  user_id,
  cuisine_preferences,
  dietary_restrictions,
  variety_preference,
  spice_level_preference,
  portion_size_preference,
  created_at
)
SELECT 
  p.id,
  ARRAY[]::text[], -- Empty arrays, will be filled by user later
  ARRAY[]::text[],
  3, -- Medium variety preference
  3, -- Medium spice
  'medium',
  now()
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_preferences up 
  WHERE up.user_id = p.id
);

-- ==========================================
-- 6. VALIDATION CHECKS
-- ==========================================

-- Check for any subscriptions without credits
DO $$
DECLARE
  v_invalid_count integer;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM subscriptions
  WHERE credits_remaining IS NULL 
    OR credits_used IS NULL
    OR plan_id IS NULL;
  
  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % subscriptions without proper credit setup', v_invalid_count;
  ELSE
    RAISE NOTICE 'All subscriptions have been successfully migrated to credit system';
  END IF;
END $$;

-- Verify credit totals match plan allocations
DO $$
DECLARE
  v_mismatch_count integer;
BEGIN
  SELECT COUNT(*) INTO v_mismatch_count
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE (s.credits_remaining + s.credits_used) != sp.meal_credits;
  
  IF v_mismatch_count > 0 THEN
    RAISE WARNING 'Found % subscriptions with credit mismatches', v_mismatch_count;
  ELSE
    RAISE NOTICE 'All credit totals are consistent';
  END IF;
END $$;

-- ==========================================
-- 7. CREATE MIGRATION LOG
-- ==========================================
CREATE TABLE IF NOT EXISTS migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name text NOT NULL,
  migration_date timestamptz DEFAULT now(),
  records_affected integer,
  status text,
  notes text
);

INSERT INTO migration_log (migration_name, records_affected, status, notes)
SELECT 
  'credit_system_migration',
  COUNT(*),
  'completed',
  'Migrated subscriptions to credit-based system'
FROM subscriptions
WHERE plan_id IS NOT NULL;

-- ==========================================
-- 8. POST-MIGRATION VERIFICATION
-- ==========================================

-- Summary statistics
SELECT 
  'Migration Summary' as report,
  (SELECT COUNT(*) FROM subscriptions WHERE plan_id IS NOT NULL) as subscriptions_migrated,
  (SELECT COUNT(*) FROM credit_transactions WHERE metadata->>'migrated' = 'true') as credit_transactions_created,
  (SELECT COUNT(*) FROM restaurant_earnings WHERE created_at < now() - interval '1 minute') as earnings_records_created,
  (SELECT COUNT(*) FROM user_preferences) as user_preferences_created;

-- Credit distribution by plan
SELECT 
  sp.name as plan_name,
  COUNT(s.id) as subscriber_count,
  SUM(s.credits_remaining) as total_credits_remaining,
  SUM(s.credits_used) as total_credits_used,
  AVG(s.credits_remaining) as avg_credits_remaining
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.status = 'active'
GROUP BY sp.name;

-- ==========================================
-- 9. CLEANUP (Optional - Run manually after verification)
-- ==========================================

-- Only run this after confirming migration success:
-- DROP TABLE IF EXISTS subscriptions_backup_pre_credit_migration;

COMMENT ON TABLE migration_log IS 'Log of all database migrations performed';
