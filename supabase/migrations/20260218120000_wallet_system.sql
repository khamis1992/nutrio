-- Wallet System Migration for Nutrio
-- Phase 2A: Customer Wallet, Driver Withdrawals, Partner Payouts, Invoices

-- ========================================
-- CUSTOMER WALLETS
-- ========================================

CREATE TABLE IF NOT EXISTS public.customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(10, 2) DEFAULT 0.00 CHECK (balance >= 0),
  total_credits NUMERIC(10, 2) DEFAULT 0.00,
  total_debits NUMERIC(10, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.customer_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'bonus', 'cashback')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(10, 2) NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('topup', 'order', 'refund', 'bonus', 'cashback', 'withdrawal')),
  reference_id UUID,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Top-up packages (bonus incentives)
CREATE TABLE IF NOT EXISTS public.wallet_topup_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  bonus_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (bonus_amount >= 0),
  bonus_percentage NUMERIC(5, 2) DEFAULT 0.00 CHECK (bonus_percentage >= 0 AND bonus_percentage <= 100),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default top-up packages
INSERT INTO public.wallet_topup_packages (amount, bonus_amount, name, description, display_order) VALUES
(50, 0, 'Basic', 'Start with QAR 50', 1),
(100, 10, 'Silver', 'Get QAR 10 bonus', 2),
(200, 30, 'Gold', 'Get QAR 30 bonus', 3),
(500, 100, 'Platinum', 'Get QAR 100 bonus', 4)
ON CONFLICT DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_wallets_user_id ON public.customer_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_topup_packages_display_order ON public.wallet_topup_packages(display_order);

-- Enable RLS
ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_topup_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_wallets
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.customer_wallets;
CREATE POLICY "Users can view their own wallet"
  ON public.customer_wallets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.customer_wallets;
CREATE POLICY "Users can insert their own wallet"
  ON public.customer_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for wallet_transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view their own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage transactions" ON public.wallet_transactions;
CREATE POLICY "Service role can manage transactions"
  ON public.wallet_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for wallet_topup_packages (public read)
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.wallet_topup_packages;
CREATE POLICY "Anyone can view active packages"
  ON public.wallet_topup_packages FOR SELECT
  USING (is_active = true);

-- Function to create wallet for new users
CREATE OR REPLACE FUNCTION public.create_customer_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customer_wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create wallet on user signup
DROP TRIGGER IF EXISTS on_user_created_wallet ON auth.users;
CREATE TRIGGER on_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_customer_wallet();

-- Function to credit wallet
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id UUID,
  p_amount NUMERIC(10, 2),
  p_type TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_after NUMERIC(10, 2);
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet
  SELECT id INTO v_wallet_id 
  FROM public.customer_wallets 
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.customer_wallets (user_id)
    VALUES (p_user_id)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Update balance
  UPDATE public.customer_wallets
  SET 
    balance = balance + p_amount,
    total_credits = total_credits + p_amount,
    updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_balance_after;
  
  -- Create transaction record
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_after,
    reference_type, reference_id, description, metadata
  ) VALUES (
    v_wallet_id, p_user_id, p_type, p_amount, v_balance_after,
    p_reference_type, p_reference_id, p_description, p_metadata
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to debit wallet
CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id UUID,
  p_amount NUMERIC(10, 2),
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC(10, 2);
  v_balance_after NUMERIC(10, 2);
  v_transaction_id UUID;
BEGIN
  -- Get wallet and check balance
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM public.customer_wallets 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Current: %, Required: %', v_current_balance, p_amount;
  END IF;
  
  -- Update balance
  UPDATE public.customer_wallets
  SET 
    balance = balance - p_amount,
    total_debits = total_debits + p_amount,
    updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_balance_after;
  
  -- Create transaction record
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_after,
    reference_type, reference_id, description, metadata
  ) VALUES (
    v_wallet_id, p_user_id, 'debit', p_amount, v_balance_after,
    p_reference_type, p_reference_id, p_description, p_metadata
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- DRIVER WALLET TRANSACTIONS
-- ========================================

-- Driver wallet transactions (extends existing driver wallet)
CREATE TABLE IF NOT EXISTS public.driver_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal', 'bonus', 'adjustment')),
  amount NUMERIC(10, 2) NOT NULL,
  balance_after NUMERIC(10, 2) NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('delivery', 'withdrawal', 'bonus', 'adjustment')),
  reference_id UUID,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Driver withdrawal requests
CREATE TABLE IF NOT EXISTS public.driver_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 50), -- Minimum QAR 50
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  payment_method TEXT DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'qatarpay', 'cash')),
  bank_name TEXT,
  bank_account_number TEXT,
  account_holder_name TEXT,
  rejection_reason TEXT,
  processed_at TIMESTAMPTZ,
  transaction_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_wallet_transactions_driver_id ON public.driver_wallet_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_withdrawals_driver_id ON public.driver_withdrawals(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_withdrawals_status ON public.driver_withdrawals(status);

-- Enable RLS
ALTER TABLE public.driver_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Drivers can view their wallet transactions" ON public.driver_wallet_transactions;
CREATE POLICY "Drivers can view their wallet transactions"
  ON public.driver_wallet_transactions FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id));

DROP POLICY IF EXISTS "Drivers can view their withdrawals" ON public.driver_withdrawals;
CREATE POLICY "Drivers can view their withdrawals"
  ON public.driver_withdrawals FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id));

DROP POLICY IF EXISTS "Drivers can create withdrawals" ON public.driver_withdrawals;
CREATE POLICY "Drivers can create withdrawals"
  ON public.driver_withdrawals FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id));

-- Function to process driver withdrawal
CREATE OR REPLACE FUNCTION public.process_driver_withdrawal(
  p_driver_id UUID,
  p_amount NUMERIC(10, 2),
  p_payment_method TEXT DEFAULT 'bank_transfer',
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account_number TEXT DEFAULT NULL,
  p_account_holder_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_current_balance NUMERIC(10, 2);
  v_balance_after NUMERIC(10, 2);
  v_withdrawal_id UUID;
BEGIN
  -- Get current balance
  SELECT wallet_balance INTO v_current_balance
  FROM public.drivers
  WHERE id = p_driver_id
  FOR UPDATE;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Requested: %', v_current_balance, p_amount;
  END IF;
  
  -- Create withdrawal request
  INSERT INTO public.driver_withdrawals (
    driver_id, amount, payment_method,
    bank_name, bank_account_number, account_holder_name
  ) VALUES (
    p_driver_id, p_amount, p_payment_method,
    p_bank_name, p_bank_account_number, p_account_holder_name
  )
  RETURNING id INTO v_withdrawal_id;
  
  -- Deduct from driver balance
  UPDATE public.drivers
  SET 
    wallet_balance = wallet_balance - p_amount,
    updated_at = now()
  WHERE id = p_driver_id
  RETURNING wallet_balance INTO v_balance_after;
  
  -- Create transaction record
  INSERT INTO public.driver_wallet_transactions (
    driver_id, type, amount, balance_after,
    reference_type, reference_id, description
  ) VALUES (
    p_driver_id, 'withdrawal', p_amount, v_balance_after,
    'withdrawal', v_withdrawal_id, 'Withdrawal request created'
  );
  
  RETURN v_withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PARTNER EARNINGS & PAYOUTS
-- ========================================

-- Partner payouts (create first for FK reference)
CREATE TABLE IF NOT EXISTS public.partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  payout_method TEXT DEFAULT 'bank_transfer',
  payout_details JSONB,
  processed_at TIMESTAMPTZ,
  reference_number TEXT,
  invoice_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partner earnings tracking
CREATE TABLE IF NOT EXISTS public.partner_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  meal_schedule_id UUID REFERENCES public.meal_schedules(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  gross_amount NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10, 2) DEFAULT 0,
  net_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  payout_id UUID REFERENCES public.partner_payouts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_partner_earnings_restaurant_id ON public.partner_earnings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_partner_earnings_status ON public.partner_earnings(status);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_restaurant_id ON public.partner_payouts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_status ON public.partner_payouts(status);

-- Enable RLS
ALTER TABLE public.partner_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Partners can view their earnings" ON public.partner_earnings;
CREATE POLICY "Partners can view their earnings"
  ON public.partner_earnings FOR SELECT
  USING (auth.uid() = (SELECT owner_id FROM public.restaurants WHERE id = restaurant_id));

DROP POLICY IF EXISTS "Partners can view their payouts" ON public.partner_payouts;
CREATE POLICY "Partners can view their payouts"
  ON public.partner_payouts FOR SELECT
  USING (auth.uid() = (SELECT owner_id FROM public.restaurants WHERE id = restaurant_id));

-- Function to create partner earning from order
CREATE OR REPLACE FUNCTION public.create_partner_earning()
RETURNS TRIGGER AS $$
DECLARE
  v_meal_price NUMERIC(10, 2);
  v_platform_fee_pct NUMERIC(5, 2) := 15.00; -- 15% platform fee
  v_gross_amount NUMERIC(10, 2);
  v_platform_fee NUMERIC(10, 2);
  v_net_amount NUMERIC(10, 2);
  v_restaurant_id UUID;
BEGIN
  -- Only process for confirmed/delivered orders
  IF NEW.order_status IN ('confirmed', 'preparing', 'delivered') THEN
    -- Get meal and restaurant info
    SELECT m.price, m.restaurant_id INTO v_meal_price, v_restaurant_id
    FROM public.meals m
    WHERE m.id = NEW.meal_id;
    
    IF v_restaurant_id IS NOT NULL THEN
      v_gross_amount := COALESCE(v_meal_price, 0);
      v_platform_fee := v_gross_amount * (v_platform_fee_pct / 100);
      v_net_amount := v_gross_amount - v_platform_fee;
      
      INSERT INTO public.partner_earnings (
        restaurant_id,
        meal_schedule_id,
        gross_amount,
        platform_fee,
        net_amount
      ) VALUES (
        v_restaurant_id,
        NEW.id,
        v_gross_amount,
        v_platform_fee,
        v_net_amount
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create partner earning when order is confirmed
DROP TRIGGER IF EXISTS on_meal_schedule_confirmed ON public.meal_schedules;
CREATE TRIGGER on_meal_schedule_confirmed
  AFTER UPDATE OF order_status ON public.meal_schedules
  FOR EACH ROW
  WHEN (NEW.order_status = 'confirmed' AND OLD.order_status != 'confirmed')
  EXECUTE FUNCTION public.create_partner_earning();

-- ========================================
-- INVOICES
-- ========================================

-- Invoice records
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('subscription', 'wallet_topup', 'partner_payout', 'driver_payout', 'order')),
  amount NUMERIC(10, 2) NOT NULL,
  tax_amount NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'QAR',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  pdf_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice items (line items)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_restaurant_id ON public.invoices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_driver_id ON public.invoices(driver_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
DROP POLICY IF EXISTS "Users can view their invoices" ON public.invoices;
CREATE POLICY "Users can view their invoices"
  ON public.invoices FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id) OR
    auth.uid() = (SELECT owner_id FROM public.restaurants WHERE id = restaurant_id)
  );

DROP POLICY IF EXISTS "Service role can manage invoices" ON public.invoices;
CREATE POLICY "Service role can manage invoices"
  ON public.invoices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for invoice_items
DROP POLICY IF EXISTS "Users can view their invoice items" ON public.invoice_items;
CREATE POLICY "Users can view their invoice items"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices 
      WHERE id = invoice_items.invoice_id 
      AND (
        auth.uid() = user_id OR
        auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id) OR
        auth.uid() = (SELECT owner_id FROM public.restaurants WHERE id = restaurant_id)
      )
    )
  );

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(
  p_type TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number TEXT;
  v_count INTEGER;
BEGIN
  -- Set prefix based on type
  v_prefix := CASE p_type
    WHEN 'subscription' THEN 'SUB'
    WHEN 'wallet_topup' THEN 'WAL'
    WHEN 'partner_payout' THEN 'PTR'
    WHEN 'driver_payout' THEN 'DRV'
    WHEN 'order' THEN 'ORD'
    ELSE 'INV'
  END;
  
  -- Get next number
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 9) AS INTEGER)), 0) + 1
  INTO v_count
  FROM public.invoices
  WHERE invoice_number LIKE v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-%';
  
  v_number := v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(v_count::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create wallet topup invoice
CREATE OR REPLACE FUNCTION public.create_wallet_topup_invoice(
  p_user_id UUID,
  p_amount NUMERIC(10, 2),
  p_bonus_amount NUMERIC(10, 2) DEFAULT 0,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_total_amount NUMERIC(10, 2);
BEGIN
  v_invoice_number := public.generate_invoice_number('wallet_topup');
  v_total_amount := p_amount + p_bonus_amount;
  
  -- Create invoice
  INSERT INTO public.invoices (
    invoice_number,
    user_id,
    invoice_type,
    amount,
    total_amount,
    status,
    paid_at,
    metadata
  ) VALUES (
    v_invoice_number,
    p_user_id,
    'wallet_topup',
    p_amount,
    v_total_amount,
    'paid',
    now(),
    jsonb_build_object(
      'bonus_amount', p_bonus_amount,
      'payment_reference', p_payment_reference
    )
  )
  RETURNING id INTO v_invoice_id;
  
  -- Create invoice items
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, total_price)
  VALUES 
    (v_invoice_id, 'Wallet Top-up', 1, p_amount, p_amount);
  
  IF p_bonus_amount > 0 THEN
    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, total_price)
    VALUES (v_invoice_id, 'Bonus Credit', 1, p_bonus_amount, p_bonus_amount);
  END IF;
  
  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PAYMENT RECORDS
-- ========================================

-- Payment transactions (for Sadad integration)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('wallet_topup', 'subscription', 'order')),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'QAR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('sadad', 'wallet', 'card')),
  gateway TEXT DEFAULT 'sadad',
  gateway_reference TEXT,
  gateway_response JSONB,
  invoice_id UUID REFERENCES public.invoices(id),
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_reference ON public.payments(gateway_reference);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their payments" ON public.payments;
CREATE POLICY "Users can view their payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;
CREATE POLICY "Service role can manage payments"
  ON public.payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_customer_wallets_updated_at ON public.customer_wallets;
CREATE TRIGGER update_customer_wallets_updated_at
  BEFORE UPDATE ON public.customer_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_withdrawals_updated_at ON public.driver_withdrawals;
CREATE TRIGGER update_driver_withdrawals_updated_at
  BEFORE UPDATE ON public.driver_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_payouts_updated_at ON public.partner_payouts;
CREATE TRIGGER update_partner_payouts_updated_at
  BEFORE UPDATE ON public.partner_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE public.customer_wallets IS 'Customer prepaid wallet balances';
COMMENT ON TABLE public.wallet_transactions IS 'Transaction history for customer wallets';
COMMENT ON TABLE public.wallet_topup_packages IS 'Available top-up packages with bonus incentives';
COMMENT ON TABLE public.driver_wallet_transactions IS 'Driver wallet transaction history';
COMMENT ON TABLE public.driver_withdrawals IS 'Driver withdrawal requests';
COMMENT ON TABLE public.partner_earnings IS 'Partner/restaurant earnings from orders';
COMMENT ON TABLE public.partner_payouts IS 'Partner payout records';
COMMENT ON TABLE public.invoices IS 'Invoice records for all transaction types';
COMMENT ON TABLE public.invoice_items IS 'Line items for invoices';
COMMENT ON TABLE public.payments IS 'Payment transaction records (Sadad integration)';
