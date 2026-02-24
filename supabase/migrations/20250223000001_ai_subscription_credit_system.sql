-- Migration: Create AI-Powered Subscription Credit System
-- Week 1, Phase 1: Foundation & Database Architecture
-- Security Level: CRITICAL - Financial enforcement and RLS policies

-- ==========================================
-- 1. SUBSCRIPTION PLANS (Pricing Tiers)
-- ==========================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (name IN ('Basic', 'Standard', 'Premium')),
  price_qar integer NOT NULL CHECK (price_qar > 0),
  meal_credits integer NOT NULL CHECK (meal_credits > 0),
  meal_value_qar integer DEFAULT 50 CHECK (meal_value_qar = 50),
  platform_commission_percent decimal(4,2) DEFAULT 10.00 CHECK (platform_commission_percent = 10.00),
  restaurant_payout_qar integer DEFAULT 45 CHECK (restaurant_payout_qar = 45),
  features jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed the three subscription tiers
INSERT INTO subscription_plans (name, price_qar, meal_credits, features) VALUES
  ('Basic', 2900, 58, '{"ai_recommendations": false, "priority_support": false, "weekly_planning": false}'),
  ('Standard', 3900, 78, '{"ai_recommendations": true, "priority_support": true, "weekly_planning": true}'),
  ('Premium', 4900, 98, '{"ai_recommendations": true, "priority_support": true, "weekly_planning": true, "dietitian_access": true}')
ON CONFLICT DO NOTHING;

-- ==========================================
-- 2. CREDIT TRANSACTIONS (Immutable Audit Trail)
-- ==========================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id),
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'deduction', 'bonus', 'refund', 'rollover')),
  credits_amount integer NOT NULL,
  meal_value_qar integer CHECK (meal_value_qar = 50 OR meal_value_qar IS NULL),
  description text,
  order_id uuid REFERENCES orders(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Critical: Credits cannot go negative
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS credits_remaining integer CHECK (credits_remaining >= 0),
  ADD COLUMN IF NOT EXISTS credits_used integer DEFAULT 0 CHECK (credits_used >= 0),
  ADD COLUMN IF NOT EXISTS meal_value_qar integer DEFAULT 50 CHECK (meal_value_qar = 50),
  ADD COLUMN IF NOT EXISTS last_credit_reset timestamptz,
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES subscription_plans(id);

-- ==========================================
-- 3. RESTAURANT EARNINGS (Immutable Financial Records)
-- ==========================================
CREATE TABLE IF NOT EXISTS restaurant_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) NOT NULL,
  order_id uuid REFERENCES orders(id) NOT NULL UNIQUE,
  meal_value_qar integer NOT NULL DEFAULT 50 CHECK (meal_value_qar = 50),
  platform_commission_qar integer NOT NULL DEFAULT 5 CHECK (platform_commission_qar = 5),
  restaurant_payout_qar integer NOT NULL DEFAULT 45 CHECK (restaurant_payout_qar = 45),
  commission_rate decimal(4,2) NOT NULL DEFAULT 10.00 CHECK (commission_rate = 10.00),
  is_settled boolean DEFAULT false,
  settlement_batch_id uuid,
  created_at timestamptz DEFAULT now(),
  settled_at timestamptz
);

-- ==========================================
-- 4. PAYOUT BATCHES (3-Day Settlement Cycle)
-- ==========================================
CREATE TABLE IF NOT EXISTS payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_date date NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_restaurants integer,
  total_payout_amount integer,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) NOT NULL,
  batch_id uuid REFERENCES payout_batches(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_meals integer NOT NULL CHECK (total_meals >= 0),
  total_earnings_qar integer NOT NULL CHECK (total_earnings_qar >= 0),
  payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'transferred', 'failed')),
  transfer_reference text,
  transfer_proof_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  transferred_at timestamptz
);

-- ==========================================
-- 5. USER PREFERENCES (For AI Engine)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  cuisine_preferences text[], -- ['italian', 'asian', 'mediterranean', 'arabic', 'indian']
  dietary_restrictions text[], -- ['halal', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free']
  allergies text[],
  disliked_ingredients text[],
  preferred_meal_times jsonb DEFAULT '{"breakfast": "08:00", "lunch": "13:00", "dinner": "19:00"}',
  variety_preference integer CHECK (variety_preference BETWEEN 1 AND 5),
  spice_level_preference integer CHECK (spice_level_preference BETWEEN 1 AND 5),
  portion_size_preference text CHECK (portion_size_preference IN ('small', 'medium', 'large')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ==========================================
-- 6. WEEKLY MEAL PLANS (AI-Generated)
-- ==========================================
CREATE TABLE IF NOT EXISTS weekly_meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  plan_status text DEFAULT 'draft' CHECK (plan_status IN ('draft', 'active', 'completed', 'cancelled')),
  total_calories integer CHECK (total_calories >= 0),
  total_protein integer CHECK (total_protein >= 0),
  total_carbs integer CHECK (total_carbs >= 0),
  total_fats integer CHECK (total_fats >= 0),
  ai_confidence_score decimal(3,2) CHECK (ai_confidence_score BETWEEN 0 AND 1),
  user_accepted boolean DEFAULT false,
  user_modified boolean DEFAULT false,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

CREATE TABLE IF NOT EXISTS weekly_meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES weekly_meal_plans(id) ON DELETE CASCADE,
  meal_id uuid REFERENCES meals(id),
  restaurant_id uuid REFERENCES restaurants(id),
  scheduled_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories integer,
  protein integer,
  carbs integer,
  fats integer,
  is_ai_suggested boolean DEFAULT true,
  user_swapped boolean DEFAULT false,
  swap_reason text,
  order_id uuid REFERENCES orders(id),
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 7. BEHAVIOR ANALYTICS (AI Layer 4)
-- ==========================================
CREATE TABLE IF NOT EXISTS behavior_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  analyzed_period_start date NOT NULL,
  analyzed_period_end date NOT NULL,
  ordering_frequency decimal(4,2), -- meals per week
  restaurant_diversity_score decimal(3,2) CHECK (restaurant_diversity_score BETWEEN 0 AND 1),
  cuisine_diversity_score decimal(3,2) CHECK (cuisine_diversity_score BETWEEN 0 AND 1),
  meal_rating_avg decimal(2,1),
  skipped_meals_count integer DEFAULT 0,
  cancellation_rate decimal(4,2) CHECK (cancellation_rate BETWEEN 0 AND 1),
  engagement_score integer CHECK (engagement_score BETWEEN 1 AND 100),
  churn_risk_score decimal(4,2) CHECK (churn_risk_score BETWEEN 0 AND 1),
  boredom_risk_score decimal(4,2) CHECK (boredom_risk_score BETWEEN 0 AND 1),
  plan_adherence_rate decimal(4,2) CHECK (plan_adherence_rate BETWEEN 0 AND 1),
  ai_acceptance_rate decimal(4,2) CHECK (ai_acceptance_rate BETWEEN 0 AND 1),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, analyzed_period_start)
);

CREATE TABLE IF NOT EXISTS behavior_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  event_type text NOT NULL CHECK (event_type IN (
    'meal_viewed', 'meal_ordered', 'meal_skipped', 'meal_rated', 
    'plan_viewed', 'plan_modified', 'plan_accepted', 'plan_rejected',
    'restaurant_viewed', 'search_performed', 'filter_applied'
  )),
  meal_id uuid REFERENCES meals(id),
  restaurant_id uuid REFERENCES restaurants(id),
  plan_id uuid REFERENCES weekly_meal_plans(id),
  session_id text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 8. RETENTION ACTIONS (Churn Prevention)
-- ==========================================
CREATE TABLE IF NOT EXISTS retention_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  trigger_reason text NOT NULL CHECK (trigger_reason IN ('churn_risk', 'boredom_risk', 'low_engagement', 'plan_abandonment')),
  risk_score decimal(4,2) NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'recommend_new_restaurant', 'bonus_credit', 'personalized_notification',
    'dietitian_outreach', 'plan_regeneration', 'cuisine_exploration', 'discount_offer'
  )),
  action_details jsonb NOT NULL,
  was_successful boolean,
  user_response text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 9. RESTAURANT INTELLIGENCE (AI Layer 5)
-- ==========================================
CREATE TABLE IF NOT EXISTS restaurant_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) NOT NULL,
  analyzed_date date NOT NULL,
  demand_score integer CHECK (demand_score BETWEEN 1 AND 100),
  capacity_utilization decimal(4,2) CHECK (capacity_utilization BETWEEN 0 AND 1),
  order_growth_rate decimal(5,2), -- percentage
  customer_satisfaction decimal(2,1),
  avg_prep_time_minutes integer,
  popular_macro_categories jsonb DEFAULT '{}',
  peak_ordering_hours integer[],
  is_overloaded boolean DEFAULT false,
  overload_start_date date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, analyzed_date)
);

CREATE TABLE IF NOT EXISTS restaurant_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) NOT NULL,
  insight_type text NOT NULL CHECK (insight_type IN ('menu_optimization', 'capacity_adjustment', 'pricing_suggestion', 'demand_forecast')),
  insight_data jsonb NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 10. AI ADJUSTMENT HISTORY (Layer 3)
-- ==========================================
CREATE TABLE IF NOT EXISTS ai_nutrition_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('calorie', 'macro', 'meal_timing', 'plan_regeneration')),
  previous_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  ai_reason text NOT NULL,
  confidence_score decimal(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  user_adherence_rate decimal(4,2) CHECK (user_adherence_rate BETWEEN 0 AND 1),
  weight_velocity decimal(4,2), -- kg per week
  plateau_detected boolean DEFAULT false,
  was_accepted boolean,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ==========================================
-- CRITICAL SECURITY: ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Enable RLS on all new tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_nutrition_adjustments ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES: Users can only see their own data
-- ==========================================

-- credit_transactions: Users see own transactions, admins see all
CREATE POLICY "credit_transactions_user_own" ON credit_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- user_preferences: Users manage own preferences
CREATE POLICY "user_preferences_user_own" ON user_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- weekly_meal_plans: Users manage own plans
CREATE POLICY "weekly_meal_plans_user_own" ON weekly_meal_plans
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- weekly_meal_plan_items: Access through plan ownership
CREATE POLICY "weekly_meal_plan_items_user_own" ON weekly_meal_plan_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM weekly_meal_plans wmp 
    WHERE wmp.id = weekly_meal_plan_items.plan_id 
    AND wmp.user_id = auth.uid()
  ));

-- behavior_analytics: Users see own analytics
CREATE POLICY "behavior_analytics_user_own" ON behavior_analytics
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- behavior_events: Users see own events
CREATE POLICY "behavior_events_user_own" ON behavior_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ai_nutrition_adjustments: Users see own adjustments
CREATE POLICY "ai_nutrition_adjustments_user_own" ON ai_nutrition_adjustments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- retention_actions: Users see actions for them
CREATE POLICY "retention_actions_user_own" ON retention_actions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ==========================================
-- RLS POLICIES: Restaurants see their data only
-- ==========================================

-- restaurant_earnings: CRITICAL - Restaurants can only READ, NEVER modify
CREATE POLICY "restaurant_earnings_readonly" ON restaurant_earnings
  FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE user_id = auth.uid()
  ));

-- restaurant_payouts: Restaurants see own payouts
CREATE POLICY "restaurant_payouts_own" ON restaurant_payouts
  FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE user_id = auth.uid()
  ));

-- restaurant_analytics: Restaurants see own analytics
CREATE POLICY "restaurant_analytics_own" ON restaurant_analytics
  FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE user_id = auth.uid()
  ));

-- restaurant_ai_insights: Restaurants see own insights
CREATE POLICY "restaurant_ai_insights_own" ON restaurant_ai_insights
  FOR ALL TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE user_id = auth.uid()
  ))
  WITH CHECK (restaurant_id IN (
    SELECT id FROM restaurants WHERE user_id = auth.uid()
  ));

-- ==========================================
-- RLS POLICIES: Admin full access
-- ==========================================

-- subscription_plans: Admin-only modification
CREATE POLICY "subscription_plans_admin_all" ON subscription_plans
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- subscription_plans: All users can view active plans
CREATE POLICY "subscription_plans_public_read" ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

-- payout_batches: Admin-only
CREATE POLICY "payout_batches_admin_all" ON payout_batches
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- credit_transactions: Admin can view all for audit
CREATE POLICY "credit_transactions_admin_all" ON credit_transactions
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- restaurant_earnings: Admin full access
CREATE POLICY "restaurant_earnings_admin_all" ON restaurant_earnings
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- behavior_analytics: Admin can view all
CREATE POLICY "behavior_analytics_admin_all" ON behavior_analytics
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- restaurant_analytics: Admin can view all
CREATE POLICY "restaurant_analytics_admin_all" ON restaurant_analytics
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- retention_actions: Admin can manage all
CREATE POLICY "retention_actions_admin_all" ON retention_actions
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ==========================================
-- CRITICAL: Prevent ANY modification of financial records by non-admins
-- ==========================================

-- credit_transactions: IMMUTABLE - No updates/deletes allowed
CREATE POLICY "credit_transactions_no_update" ON credit_transactions
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "credit_transactions_no_delete" ON credit_transactions
  FOR DELETE TO authenticated
  USING (false);

-- restaurant_earnings: IMMUTABLE after creation - Only admin can update settlement status
CREATE POLICY "restaurant_earnings_no_update_nonadmin" ON restaurant_earnings
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "restaurant_earnings_no_delete" ON restaurant_earnings
  FOR DELETE TO authenticated
  USING (false);

-- payout_batches: Admin-only modification
CREATE POLICY "payout_batches_no_update_nonadmin" ON payout_batches
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- ==========================================
-- INDEXES FOR PERFORMANCE (10K+ users scale)
-- ==========================================

-- Subscription and credit indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_credits ON subscriptions(user_id, credits_remaining) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_date ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_order ON credit_transactions(order_id);

-- Weekly plan indexes
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plans_user_date ON weekly_meal_plans(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_items_plan ON weekly_meal_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_items_meal ON weekly_meal_plan_items(meal_id);

-- Behavior analytics indexes
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_user_date ON behavior_analytics(user_id, analyzed_period_start DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_user_type ON behavior_events(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_date ON behavior_events(created_at DESC);

-- Financial indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_earnings_restaurant ON restaurant_earnings(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_earnings_settled ON restaurant_earnings(is_settled, created_at) WHERE is_settled = false;
CREATE INDEX IF NOT EXISTS idx_restaurant_earnings_batch ON restaurant_earnings(settlement_batch_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_payouts_restaurant ON restaurant_payouts(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_payouts_batch ON restaurant_payouts(batch_id);

-- Restaurant analytics indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_analytics_restaurant_date ON restaurant_analytics(restaurant_id, analyzed_date DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_analytics_overloaded ON restaurant_analytics(is_overloaded, analyzed_date) WHERE is_overloaded = true;

-- Retention indexes
CREATE INDEX IF NOT EXISTS idx_retention_actions_user ON retention_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_actions_success ON retention_actions(was_successful) WHERE was_successful IS NULL;

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_meal_plans_updated_at BEFORE UPDATE ON weekly_meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON TABLE subscription_plans IS 'Fixed subscription tiers with immutable pricing and commission structure';
COMMENT ON TABLE credit_transactions IS 'Immutable audit trail of all credit transactions - NO UPDATES ALLOWED';
COMMENT ON TABLE restaurant_earnings IS 'Financial records with fixed commission - Immutable except for settlement status by admin';
COMMENT ON TABLE restaurant_earnings IS 'CRITICAL: commission_rate, meal_value_qar, platform_commission_qar, and restaurant_payout_qar are FIXED and cannot be modified';
COMMENT ON COLUMN subscriptions.credits_remaining IS 'Must be >= 0, enforced by CHECK constraint';
COMMENT ON COLUMN subscriptions.credits_used IS 'Counter for used credits, must be >= 0';
