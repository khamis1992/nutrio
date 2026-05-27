-- Migration: Coach Monetization System
-- Enables coach pricing, client subscriptions, commission split, and earnings ledger

-- 1. Coach Pricing — coach sets their price
CREATE TABLE IF NOT EXISTS coach_pricing (
  coach_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  price_per_week decimal NOT NULL DEFAULT 0 CHECK (price_per_week >= 0),
  price_per_month decimal NOT NULL DEFAULT 0 CHECK (price_per_month >= 0),
  currency text NOT NULL DEFAULT 'QAR',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_own_pricing" ON coach_pricing FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "public_read_active_pricing" ON coach_pricing FOR SELECT TO authenticated USING (is_active = true);

-- 2. Coach Subscriptions — client subscriptions to coaches
CREATE TABLE IF NOT EXISTS coach_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('weekly', 'monthly')),
  price decimal NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  payment_method text NOT NULL DEFAULT 'wallet',
  transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coach_id, client_id, status)
);

CREATE INDEX idx_coach_subscriptions_active ON coach_subscriptions(coach_id, status) WHERE status = 'active';
CREATE INDEX idx_coach_subscriptions_client ON coach_subscriptions(client_id, status);

ALTER TABLE coach_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_view_own_subscriptions" ON coach_subscriptions FOR SELECT TO authenticated USING (coach_id = auth.uid());
CREATE POLICY "client_view_own_subscriptions" ON coach_subscriptions FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY "system_manage_subscriptions" ON coach_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Coach Earnings — immutable ledger
CREATE TABLE IF NOT EXISTS coach_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES coach_subscriptions(id) ON DELETE SET NULL,
  amount decimal NOT NULL,
  commission_pct decimal NOT NULL,
  commission_amount decimal NOT NULL,
  net_amount decimal NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('subscription', 'renewal', 'refund', 'bonus')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'refunded')),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_earnings_coach ON coach_earnings(coach_id, created_at DESC);
CREATE INDEX idx_coach_earnings_status ON coach_earnings(status, created_at);

ALTER TABLE coach_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_view_own_earnings" ON coach_earnings FOR SELECT TO authenticated USING (coach_id = auth.uid());
CREATE POLICY "admin_manage_earnings" ON coach_earnings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. Platform Commission Config — admin sets the cut
CREATE TABLE IF NOT EXISTS platform_commission_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_pct decimal NOT NULL DEFAULT 20 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  min_payout_threshold decimal NOT NULL DEFAULT 100,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default config if none exists
INSERT INTO platform_commission_config (commission_pct, min_payout_threshold)
SELECT 20, 100
WHERE NOT EXISTS (SELECT 1 FROM platform_commission_config);

ALTER TABLE platform_commission_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_commission" ON platform_commission_config FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "public_read_commission" ON platform_commission_config FOR SELECT TO authenticated USING (true);

-- 5. Auto-renewal function
CREATE OR REPLACE FUNCTION process_coach_subscription_renewal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub RECORD;
  commission RECORD;
  next_end timestamptz;
BEGIN
  -- Get commission rate
  SELECT commission_pct INTO commission FROM platform_commission_config LIMIT 1;
  IF commission IS NULL THEN
    commission := ROW(20);
  END IF;

  -- Process weekly subscriptions
  FOR sub IN SELECT * FROM coach_subscriptions WHERE status = 'active' AND plan = 'weekly' AND end_date <= now()
  LOOP
    next_end := sub.end_date + INTERVAL '7 days';
    UPDATE coach_subscriptions SET end_date = next_end, updated_at = now() WHERE id = sub.id;
    INSERT INTO coach_earnings (coach_id, client_id, subscription_id, amount, commission_pct, commission_amount, net_amount, transaction_type, status)
    VALUES (
      sub.coach_id, sub.client_id, sub.id, sub.price,
      commission.commission_pct,
      ROUND(sub.price * commission.commission_pct / 100, 2),
      ROUND(sub.price - (sub.price * commission.commission_pct / 100), 2),
      'renewal', 'pending'
    );
  END LOOP;

  -- Process monthly subscriptions
  FOR sub IN SELECT * FROM coach_subscriptions WHERE status = 'active' AND plan = 'monthly' AND end_date <= now()
  LOOP
    next_end := sub.end_date + INTERVAL '1 month';
    UPDATE coach_subscriptions SET end_date = next_end, updated_at = now() WHERE id = sub.id;
    INSERT INTO coach_earnings (coach_id, client_id, subscription_id, amount, commission_pct, commission_amount, net_amount, transaction_type, status)
    VALUES (
      sub.coach_id, sub.client_id, sub.id, sub.price,
      commission.commission_pct,
      ROUND(sub.price * commission.commission_pct / 100, 2),
      ROUND(sub.price - (sub.price * commission.commission_pct / 100), 2),
      'renewal', 'pending'
    );
  END LOOP;

  -- Expire old subscriptions
  UPDATE coach_subscriptions SET status = 'expired', updated_at = now() WHERE status = 'cancelled' AND end_date < now() - INTERVAL '30 days';
END;
$$;

-- 6. Trigger: auto-create earnings on new subscription
CREATE OR REPLACE FUNCTION create_initial_coach_earning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  comm decimal;
BEGIN
  SELECT commission_pct INTO comm FROM platform_commission_config LIMIT 1;
  IF comm IS NULL THEN comm := 20; END IF;

  INSERT INTO coach_earnings (coach_id, client_id, subscription_id, amount, commission_pct, commission_amount, net_amount, transaction_type, status)
  VALUES (
    NEW.coach_id, NEW.client_id, NEW.id, NEW.price,
    comm,
    ROUND(NEW.price * comm / 100, 2),
    ROUND(NEW.price - (NEW.price * comm / 100), 2),
    'subscription', 'pending'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coach_subscription_earning ON coach_subscriptions;
CREATE TRIGGER trigger_coach_subscription_earning
  AFTER INSERT ON coach_subscriptions
  FOR EACH ROW EXECUTE FUNCTION create_initial_coach_earning();

-- Schedule auto-renewal (runs every hour)
SELECT cron.schedule('coach-billing', '0 * * * *', 'SELECT process_coach_subscription_renewal()');

