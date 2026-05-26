-- ============================================================================
-- Nutrio DB Remediation Phase 1: Policies, FORCE RLS, Indexes
-- ============================================================================

ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meal_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS partner_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS featured_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_nutrition_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meal_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_milestone_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS referral_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform_settings ENABLE ROW LEVEL SECURITY;

-- ORDERS
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own pending orders" ON orders;
DROP POLICY IF EXISTS "Partners can view their restaurant orders" ON orders;
DROP POLICY IF EXISTS "Drivers can view their assigned orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Admins can do everything" ON orders;
CREATE POLICY "Users can view their own orders" ON orders FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can create their own orders" ON orders FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own pending orders" ON orders FOR UPDATE USING ((select auth.uid()) = user_id AND status = 'pending');
CREATE POLICY "Partners can view their restaurant orders" ON orders FOR SELECT USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = orders.restaurant_id AND r.owner_id = (select auth.uid())));
CREATE POLICY "Drivers can view their assigned orders" ON orders FOR SELECT USING (EXISTS (SELECT 1 FROM drivers d WHERE d.id = orders.driver_id AND d.user_id = (select auth.uid())));
CREATE POLICY "Admins can manage all orders" ON orders FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can create their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins can manage subscriptions" ON subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON subscriptions FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can create their own subscriptions" ON subscriptions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Admins can manage all subscriptions" ON subscriptions FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- CUSTOMER WALLETS
DROP POLICY IF EXISTS "Users can view their own wallet" ON customer_wallets;
DROP POLICY IF EXISTS "Users can create their own wallet" ON customer_wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON customer_wallets;
CREATE POLICY "Users can view their own wallet" ON customer_wallets FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can create their own wallet" ON customer_wallets FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Admins can view all wallets" ON customer_wallets FOR SELECT USING (public.has_role((select auth.uid()), 'admin'));

-- WALLET TRANSACTIONS
DROP POLICY IF EXISTS "Users can view their own transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON wallet_transactions;
CREATE POLICY "Users can view their own transactions" ON wallet_transactions FOR SELECT USING (EXISTS (SELECT 1 FROM customer_wallets cw WHERE cw.id = wallet_transactions.wallet_id AND cw.user_id = (select auth.uid())));
CREATE POLICY "Admins can view all transactions" ON wallet_transactions FOR SELECT USING (public.has_role((select auth.uid()), 'admin'));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING ((select auth.uid()) = user_id);

-- FAVORITES
DROP POLICY IF EXISTS "Users can manage their own favorites" ON favorites;
CREATE POLICY "Users can manage their own favorites" ON favorites FOR ALL USING ((select auth.uid()) = user_id);

-- DRIVERS
DROP POLICY IF EXISTS "Drivers can view own profile" ON drivers;
DROP POLICY IF EXISTS "Admins can manage drivers" ON drivers;
CREATE POLICY "Drivers can view own profile" ON drivers FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can manage drivers" ON drivers FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- RESTAURANTS
DROP POLICY IF EXISTS "Partners can manage their restaurants" ON restaurants;
DROP POLICY IF EXISTS "Admins can manage all restaurants" ON restaurants;
CREATE POLICY "Partners can manage their restaurants" ON restaurants FOR ALL USING (owner_id = (select auth.uid()));
CREATE POLICY "Admins can manage all restaurants" ON restaurants FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- MEALS
DROP POLICY IF EXISTS "Partners can manage their meals" ON meals;
DROP POLICY IF EXISTS "Admins can manage all meals" ON meals;
CREATE POLICY "Partners can manage their meals" ON meals FOR ALL USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = meals.restaurant_id AND r.owner_id = (select auth.uid())));
CREATE POLICY "Admins can manage all meals" ON meals FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- PAYOUTS
DROP POLICY IF EXISTS "Partners can view own payouts" ON payouts;
DROP POLICY IF EXISTS "Admins can manage payouts" ON payouts;
DROP POLICY IF EXISTS "Partners can view their payouts" ON payouts;
CREATE POLICY "Partners can view own payouts" ON payouts FOR SELECT USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = payouts.restaurant_id AND r.owner_id = (select auth.uid())));
CREATE POLICY "Admins can manage payouts" ON payouts FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (public.has_role((select auth.uid()), 'admin'));

-- USER ROLES
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can view all roles" ON user_roles FOR SELECT USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- SUPPORT TICKETS
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON support_tickets;
CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can manage tickets" ON support_tickets FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- AFFILIATE COMMISSIONS
DROP POLICY IF EXISTS "Affiliates can view own commissions" ON affiliate_commissions;
DROP POLICY IF EXISTS "Admins can manage commissions" ON affiliate_commissions;
CREATE POLICY "Affiliates can view own commissions" ON affiliate_commissions FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can manage commissions" ON affiliate_commissions FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- AFFILIATE PAYOUTS
DROP POLICY IF EXISTS "Users can view own affiliate payouts" ON affiliate_payouts;
DROP POLICY IF EXISTS "Admins can manage affiliate payouts" ON affiliate_payouts;
CREATE POLICY "Users can view own affiliate payouts" ON affiliate_payouts FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can manage affiliate payouts" ON affiliate_payouts FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- USER MILESTONE ACHIEVEMENTS
DROP POLICY IF EXISTS "Users can view own achievements" ON user_milestone_achievements;
DROP POLICY IF EXISTS "Admins can view all achievements" ON user_milestone_achievements;
CREATE POLICY "Users can view own achievements" ON user_milestone_achievements FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can view all achievements" ON user_milestone_achievements FOR SELECT USING (public.has_role((select auth.uid()), 'admin'));

-- AFFILIATE APPLICATIONS
DROP POLICY IF EXISTS "Users can view own applications" ON affiliate_applications;
DROP POLICY IF EXISTS "Admins can manage affiliate applications" ON affiliate_applications;
CREATE POLICY "Users can view own applications" ON affiliate_applications FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can manage affiliate applications" ON affiliate_applications FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- USER NUTRITION LOG
DROP POLICY IF EXISTS "Users can view their own nutrition logs" ON user_nutrition_log;
DROP POLICY IF EXISTS "Users can insert their own nutrition logs" ON user_nutrition_log;
DROP POLICY IF EXISTS "Users can update their own nutrition logs" ON user_nutrition_log;
DROP POLICY IF EXISTS "Users can delete their own nutrition logs" ON user_nutrition_log;
DROP POLICY IF EXISTS "Admins can manage all nutrition logs" ON user_nutrition_log;
CREATE POLICY "Users can view their own nutrition logs" ON user_nutrition_log FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own nutrition logs" ON user_nutrition_log FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own nutrition logs" ON user_nutrition_log FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own nutrition logs" ON user_nutrition_log FOR DELETE USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can manage all nutrition logs" ON user_nutrition_log FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- MEAL TRANSLATIONS
DROP POLICY IF EXISTS "Partners can manage their meal translations" ON meal_translations;
DROP POLICY IF EXISTS "Admins can manage all translations" ON meal_translations;
CREATE POLICY "Partners can manage their meal translations" ON meal_translations FOR ALL USING (EXISTS (SELECT 1 FROM meals m JOIN restaurants r ON m.restaurant_id = r.id WHERE m.id = meal_translations.meal_id AND r.owner_id = (select auth.uid())));
CREATE POLICY "Admins can manage all translations" ON meal_translations FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- FEATURED LISTINGS
DROP POLICY IF EXISTS "Admins can manage featured listings" ON featured_listings;
DROP POLICY IF EXISTS "Partners can view their own featured listings" ON featured_listings;
DROP POLICY IF EXISTS "Partners can create featured listings for their restaurants" ON featured_listings;
DROP POLICY IF EXISTS "Admins can manage all featured listings" ON featured_listings;
CREATE POLICY "Admins can manage featured listings" ON featured_listings FOR ALL USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Partners can view their own featured listings" ON featured_listings FOR SELECT USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = featured_listings.restaurant_id AND r.owner_id = (select auth.uid())));
CREATE POLICY "Partners can create featured listings for their restaurants" ON featured_listings FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = featured_listings.restaurant_id AND r.owner_id = (select auth.uid())));
CREATE POLICY "Admins can manage all featured listings" ON featured_listings FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- TICKET MESSAGES
DROP POLICY IF EXISTS "Users can view own ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Admins can manage ticket messages" ON ticket_messages;
CREATE POLICY "Users can view own ticket messages" ON ticket_messages FOR SELECT USING (EXISTS (SELECT 1 FROM support_tickets st WHERE st.id = ticket_id AND st.user_id = (select auth.uid())) AND is_internal = false);
CREATE POLICY "Admins can manage ticket messages" ON ticket_messages FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- TICKET ATTACHMENTS
DROP POLICY IF EXISTS "Users can view own ticket attachments" ON ticket_attachments;
DROP POLICY IF EXISTS "Admins can manage ticket attachments" ON ticket_attachments;
CREATE POLICY "Users can view own ticket attachments" ON ticket_attachments FOR SELECT USING (EXISTS (SELECT 1 FROM support_tickets st WHERE st.id = ticket_id AND st.user_id = (select auth.uid())));
CREATE POLICY "Admins can manage ticket attachments" ON ticket_attachments FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- FORCE RLS
ALTER TABLE IF EXISTS orders FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meal_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_wallets FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meals FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS restaurants FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payouts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS partner_earnings FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_commissions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_payouts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drivers FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_nutrition_log FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS progress_logs FORCE ROW LEVEL SECURITY;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_delivery_jobs_schedule_id ON delivery_jobs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_delivery_jobs_driver_id ON delivery_jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_meal_id ON order_items(meal_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_type_date ON wallet_transactions(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_reviews_meal_id ON meal_reviews(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_reviews_user_id ON meal_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant_id ON restaurant_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_user_id ON restaurant_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_id ON progress_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_date ON progress_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_id ON body_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_history_user_id ON meal_history(user_id);
CREATE INDEX IF NOT EXISTS idx_water_entries_user_id ON water_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON support_tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id ON ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_order_id ON affiliate_commissions(order_id);

CREATE INDEX IF NOT EXISTS idx_meals_active_restaurant ON meals(restaurant_id, created_at DESC) WHERE deleted_at IS NULL AND is_available = true;
CREATE INDEX IF NOT EXISTS idx_meal_schedules_active_user ON meal_schedules(user_id, scheduled_date DESC) WHERE order_status NOT IN ('cancelled','completed');
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(id) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_active_user ON orders(user_id, created_at DESC) WHERE status NOT IN ('cancelled','delivered');
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE status = 'unread';

-- CRON
SELECT cron.schedule('refresh-analytics-daily-stats', '0 3 * * *', 'SELECT refresh_analytics_stats();')
WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- REALTIME
ALTER TABLE IF EXISTS orders REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS drivers REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS meal_schedules REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS notifications REPLICA IDENTITY FULL;

-- MEAL SCHEDULE RLS STATUS PROTECTION
DROP POLICY IF EXISTS "Users can update own schedules except order_status" ON meal_schedules;
DROP POLICY IF EXISTS "Admins can update schedules except order_status" ON meal_schedules;
DROP POLICY IF EXISTS "Partners can update schedule delivery details" ON meal_schedules;

CREATE POLICY "Users can update own schedules except order_status" ON meal_schedules FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id AND order_status = (SELECT ms.order_status FROM meal_schedules ms WHERE ms.id = meal_schedules.id));
CREATE POLICY "Admins can update schedules except order_status" ON meal_schedules FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()), 'admin')) WITH CHECK (public.has_role((select auth.uid()), 'admin') AND order_status = (SELECT ms.order_status FROM meal_schedules ms WHERE ms.id = meal_schedules.id));
CREATE POLICY "Partners can update schedule delivery details" ON meal_schedules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM meals m INNER JOIN restaurants r ON r.id = m.restaurant_id WHERE m.id = meal_schedules.meal_id AND r.owner_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM meals m INNER JOIN restaurants r ON r.id = m.restaurant_id WHERE m.id = meal_schedules.meal_id AND r.owner_id = (select auth.uid())) AND order_status = (SELECT ms.order_status FROM meal_schedules ms WHERE ms.id = meal_schedules.id));

-- CANCELLATION REASON COLUMN
ALTER TABLE IF EXISTS meal_schedules ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
