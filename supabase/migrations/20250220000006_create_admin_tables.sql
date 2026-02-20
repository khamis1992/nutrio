-- Migration: Create all remaining admin portal tables
-- Created: 2025-02-20
-- Purpose: Create tables for affiliate applications, featured listings, milestones, subscriptions, payouts, support tickets, and more

-- =====================
-- AFFILIATE APPLICATIONS
-- =====================
CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  application_note TEXT,
  rejection_reason TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage affiliate applications" ON public.affiliate_applications;
DROP POLICY IF EXISTS "Users can view own applications" ON public.affiliate_applications;

CREATE POLICY "Admins can manage affiliate applications" ON public.affiliate_applications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own applications" ON public.affiliate_applications
  FOR SELECT USING (auth.uid() = user_id);

-- =====================
-- FEATURED LISTINGS
-- =====================
CREATE TABLE IF NOT EXISTS public.featured_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  featured_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  featured_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view featured listings" ON public.featured_listings;
DROP POLICY IF EXISTS "Admins can manage featured listings" ON public.featured_listings;

CREATE POLICY "Anyone can view featured listings" ON public.featured_listings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage featured listings" ON public.featured_listings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- REFERRAL MILESTONES
-- =====================
CREATE TABLE IF NOT EXISTS public.referral_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_count INTEGER NOT NULL CHECK (referral_count > 0),
  bonus_amount NUMERIC(10,2) NOT NULL CHECK (bonus_amount >= 0),
  bonus_type TEXT NOT NULL CHECK (bonus_type IN ('cash', 'credits')) DEFAULT 'credits',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view milestones" ON public.referral_milestones;
DROP POLICY IF EXISTS "Admins can manage milestones" ON public.referral_milestones;

CREATE POLICY "Anyone can view milestones" ON public.referral_milestones
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage milestones" ON public.referral_milestones
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- USER MILESTONE ACHIEVEMENTS
-- =====================
CREATE TABLE IF NOT EXISTS public.user_milestone_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  milestone_id UUID REFERENCES public.referral_milestones(id) ON DELETE CASCADE NOT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  bonus_claimed BOOLEAN NOT NULL DEFAULT false,
  bonus_claimed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, milestone_id)
);

ALTER TABLE public.user_milestone_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_milestone_achievements;
DROP POLICY IF EXISTS "Admins can view all achievements" ON public.user_milestone_achievements;

CREATE POLICY "Users can view own achievements" ON public.user_milestone_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all achievements" ON public.user_milestone_achievements
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- SUBSCRIPTIONS
-- =====================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'standard', 'premium')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'cancelled', 'expired')) DEFAULT 'active',
  price NUMERIC(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'yearly')),
  meals_per_week INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can manage subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- PAYOUTS (Restaurant Payouts)
-- =====================
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processed', 'rejected')) DEFAULT 'pending',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2),
  total_order_value NUMERIC(10,2),
  commission_deducted NUMERIC(10,2),
  payout_method TEXT,
  payout_reference TEXT,
  notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view own payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can manage payouts" ON public.payouts;

CREATE POLICY "Partners can view own payouts" ON public.payouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage payouts" ON public.payouts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- AFFILIATE PAYOUTS
-- =====================
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  payout_method TEXT,
  payout_reference TEXT,
  notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own affiliate payouts" ON public.affiliate_payouts;
DROP POLICY IF EXISTS "Admins can manage affiliate payouts" ON public.affiliate_payouts;

CREATE POLICY "Users can view own affiliate payouts" ON public.affiliate_payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage affiliate payouts" ON public.affiliate_payouts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- AFFILIATE COMMISSIONS
-- =====================
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  commission_amount NUMERIC(10,2) NOT NULL CHECK (commission_amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view own commissions" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "Admins can manage commissions" ON public.affiliate_commissions;

CREATE POLICY "Affiliates can view own commissions" ON public.affiliate_commissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage commissions" ON public.affiliate_commissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- SUPPORT TICKETS
-- =====================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('general', 'technical', 'billing', 'order', 'account', 'other')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.support_tickets;

CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage tickets" ON public.support_tickets
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- TICKET MESSAGES
-- =====================
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ticket messages" ON public.ticket_messages;
DROP POLICY IF EXISTS "Admins can manage ticket messages" ON public.ticket_messages;

CREATE POLICY "Users can view own ticket messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id AND st.user_id = auth.uid()
    ) AND is_internal = false
  );

CREATE POLICY "Admins can manage ticket messages" ON public.ticket_messages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- TICKET ATTACHMENTS
-- =====================
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ticket attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Admins can manage ticket attachments" ON public.ticket_attachments;

CREATE POLICY "Users can view own ticket attachments" ON public.ticket_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id AND st.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage ticket attachments" ON public.ticket_attachments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- DRIVERS
-- =====================
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  license_number TEXT,
  vehicle_type TEXT,
  vehicle_plate TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  current_location JSONB,
  rating NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5),
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view own profile" ON public.drivers;
DROP POLICY IF EXISTS "Admins can manage drivers" ON public.drivers;

CREATE POLICY "Drivers can view own profile" ON public.drivers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage drivers" ON public.drivers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- BLOCKED IPS
-- =====================
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage blocked IPs" ON public.blocked_ips;

CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- USER IP LOGS
-- =====================
CREATE TABLE IF NOT EXISTS public.user_ip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ip_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view IP logs" ON public.user_ip_logs;

CREATE POLICY "Admins can view IP logs" ON public.user_ip_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- PLATFORM SETTINGS
-- =====================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can manage platform settings" ON public.platform_settings;

CREATE POLICY "Anyone can view platform settings" ON public.platform_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage platform settings" ON public.platform_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- NOTIFICATIONS
-- =====================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_user_id ON public.affiliate_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON public.affiliate_applications(status);
CREATE INDEX IF NOT EXISTS idx_featured_listings_restaurant ON public.featured_listings(restaurant_id);
-- CREATE INDEX IF NOT EXISTS idx_featured_listings_active ON public.featured_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_referral_milestones_active ON public.referral_milestones(is_active);
CREATE INDEX IF NOT EXISTS idx_user_milestone_achievements_user ON public.user_milestone_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
-- CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payouts_restaurant ON public.payouts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_user ON public.affiliate_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_user ON public.affiliate_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_drivers_user ON public.drivers(user_id);
-- CREATE INDEX IF NOT EXISTS idx_drivers_available ON public.drivers(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON public.blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_ip_logs_user ON public.user_ip_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
-- CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
