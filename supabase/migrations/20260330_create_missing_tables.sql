-- ============================================================
-- Nutrio: Create Missing Database Tables
-- Date: 2026-03-30
-- ============================================================

-- 1. Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, meal_id)
);

-- 2. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  would_order_again BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Addon Categories
CREATE TABLE IF NOT EXISTS addon_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Addons
CREATE TABLE IF NOT EXISTS addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES addon_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Meal Ingredients
CREATE TABLE IF NOT EXISTS meal_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  is_default BOOLEAN DEFAULT TRUE,
  is_removable BOOLEAN DEFAULT FALSE,
  is_allergen BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Meal Options (e.g., portion size, spice level)
CREATE TABLE IF NOT EXISTS meal_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  option_type TEXT NOT NULL DEFAULT 'single' CHECK (option_type IN ('single', 'multi')),
  required BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Meal Option Values (e.g., Standard, Large, Extra Large)
CREATE TABLE IF NOT EXISTS meal_option_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_option_id UUID NOT NULL REFERENCES meal_options(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Driver Profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  license_number TEXT,
  license_expiry DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
  rating DECIMAL(3,2) DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT FALSE,
  current_location GEOGRAPHY(POINT, 4326),
  current_heading INTEGER,
  current_speed DECIMAL(5,2),
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Driver Earnings
CREATE TABLE IF NOT EXISTS driver_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  earning_type TEXT NOT NULL DEFAULT 'delivery' CHECK (earning_type IN ('delivery', 'bonus', 'tip', 'adjustment')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Driver Orders
CREATE TABLE IF NOT EXISTS driver_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'en_route', 'arrived', 'picked_up', 'delivered', 'failed')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  notes TEXT
);

-- 11. Driver Shifts
CREATE TABLE IF NOT EXISTS driver_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  total_earnings DECIMAL(10,2) DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Driver Locations (history)
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  heading INTEGER,
  speed DECIMAL(5,2),
  accuracy DECIMAL(8,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Delivery Zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  area GEOGRAPHY(POLYGON, 4326),
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  estimated_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Restaurant Payouts
CREATE TABLE IF NOT EXISTS restaurant_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Restaurant Staff
CREATE TABLE IF NOT EXISTS restaurant_staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'chef', 'staff', 'driver')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id)
);

-- 16. Restaurant Hours
CREATE TABLE IF NOT EXISTS restaurant_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  special_note TEXT,
  UNIQUE(restaurant_id, day_of_week)
);

-- 17. Cuisine Types
CREATE TABLE IF NOT EXISTS cuisine_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_ar TEXT,
  image_url TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Allergen Tags
CREATE TABLE IF NOT EXISTS allergen_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_ar TEXT,
  icon TEXT,
  description TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Achievement Definitions
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  type TEXT NOT NULL DEFAULT 'streak' CHECK (type IN ('streak', 'order_count', 'weight_goal', 'workout', 'social', 'special')),
  threshold_value INTEGER NOT NULL DEFAULT 1,
  reward_xp INTEGER DEFAULT 0,
  badge_id UUID REFERENCES user_achievements(id) ON DELETE SET NULL,
  icon TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Gamification Log
CREATE TABLE IF NOT EXISTS gamification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Challenge Definitions
CREATE TABLE IF NOT EXISTS challenge_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  type TEXT NOT NULL DEFAULT 'nutrition' CHECK (type IN ('nutrition', 'fitness', 'weight', 'streak', 'social', 'custom')),
  start_date DATE NOT NULL,
  end_date DATE,
  target_value INTEGER NOT NULL DEFAULT 1,
  target_unit TEXT DEFAULT 'days',
  reward_xp INTEGER DEFAULT 0,
  reward_badge_id UUID,
  reward_description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  max_participants INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. User Challenges
CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenge_definitions(id) ON DELETE CASCADE,
  progress DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, challenge_id)
);

-- 23. Daily Logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  calories_consumed INTEGER DEFAULT 0,
  calories_target INTEGER DEFAULT 0,
  protein_consumed DECIMAL(8,2) DEFAULT 0,
  carbs_consumed DECIMAL(8,2) DEFAULT 0,
  fat_consumed DECIMAL(8,2) DEFAULT 0,
  water_glasses INTEGER DEFAULT 0,
  steps INTEGER DEFAULT 0,
  exercise_minutes INTEGER DEFAULT 0,
  sleep_hours DECIMAL(4,1) DEFAULT 0,
  mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'bad', 'terrible')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 24. Nutrition Logs (per-meal)
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES meals(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories INTEGER DEFAULT 0,
  protein DECIMAL(8,2) DEFAULT 0,
  carbs DECIMAL(8,2) DEFAULT 0,
  fat DECIMAL(8,2) DEFAULT 0,
  fiber DECIMAL(8,2) DEFAULT 0,
  sugar DECIMAL(8,2) DEFAULT 0,
  sodium DECIMAL(8,2) DEFAULT 0,
  consumed BOOLEAN DEFAULT FALSE,
  skipped BOOLEAN DEFAULT FALSE,
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. Exercise Logs
CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  exercise_type TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  intensity TEXT CHECK (intensity IN ('low', 'moderate', 'high', 'extreme')),
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. Step Logs
CREATE TABLE IF NOT EXISTS step_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER NOT NULL DEFAULT 0,
  distance_km DECIMAL(8,2) DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'apple_health', 'google_fit', 'samsung_health', 'garmin', 'whoop', 'api')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date, source)
);

-- 27. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system', 'order_update')),
  image_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. FAQ
CREATE TABLE IF NOT EXISTS faq (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  question_ar TEXT,
  answer TEXT NOT NULL,
  answer_ar TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'orders', 'payments', 'delivery', 'subscriptions', 'nutrition', 'account', 'partners')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 29. Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL DEFAULT 'general' CHECK (feedback_type IN ('general', 'bug', 'feature_request', 'meal_rating', 'delivery', 'app')),
  subject TEXT,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
  admin_response TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 30. Meal Photos (UGC)
CREATE TABLE IF NOT EXISTS meal_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_meal ON favorites(meal_id);

CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_meal ON reviews(meal_id);
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_addons_restaurant ON addons(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_addons_category ON addons(category_id);

CREATE INDEX IF NOT EXISTS idx_meal_ingredients_meal ON meal_ingredients(meal_id);

CREATE INDEX IF NOT EXISTS idx_meal_options_meal ON meal_options(meal_id);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_user ON driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON driver_profiles(status);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_available ON driver_profiles(is_available) WHERE is_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_driver_profiles_location ON driver_profiles USING GIST(current_location);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver ON driver_earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_created ON driver_earnings(created_at);

CREATE INDEX IF NOT EXISTS idx_driver_orders_driver ON driver_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_orders_order ON driver_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_orders_status ON driver_orders(status);

CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver ON driver_shifts(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_created ON driver_locations(created_at);
CREATE INDEX IF NOT EXISTS idx_driver_locations_location ON driver_locations USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);

CREATE INDEX IF NOT EXISTS idx_restaurant_payouts_restaurant ON restaurant_payouts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_payouts_status ON restaurant_payouts(status);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date ON nutrition_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_date ON exercise_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_step_logs_user_date ON step_logs(user_id, date);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_read ON chat_messages(is_read) WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_user_challenges_user ON user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_active ON user_challenges(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_gamification_log_user ON gamification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_log_type ON gamification_log(event_type);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

CREATE INDEX IF NOT EXISTS idx_meal_photos_meal ON meal_photos(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_photos_user ON meal_photos(user_id);

-- ============================================================
-- RLS (Row Level Security) Policies
-- ============================================================

-- Enable RLS on user-scoped tables
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

-- Favorites: users can see/manage their own
CREATE POLICY "Users can view own favorites" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add own favorites" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- Reviews: users can see all, manage their own
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can create own reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);

-- Daily/Nutrition/Exercise/Step logs: users can only see their own
CREATE POLICY "Users can view own daily_logs" ON daily_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_logs" ON daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_logs" ON daily_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own nutrition_logs" ON nutrition_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nutrition_logs" ON nutrition_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nutrition_logs" ON nutrition_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own exercise_logs" ON exercise_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exercise_logs" ON exercise_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own step_logs" ON step_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own step_logs" ON step_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Chat: users can see conversations they're part of
CREATE POLICY "Users can view own chats" ON chat_messages FOR SELECT USING (auth.uid() IN (sender_id, receiver_id));
CREATE POLICY "Users can send messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own messages" ON chat_messages FOR UPDATE USING (auth.uid() = sender_id);

-- Feedback: users can view/manage their own
CREATE POLICY "Users can view own feedback" ON feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own feedback" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Meal photos: public view, users manage their own
CREATE POLICY "Anyone can view public meal photos" ON meal_photos FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);
CREATE POLICY "Users can upload meal photos" ON meal_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal photos" ON meal_photos FOR UPDATE USING (auth.uid() = user_id);

-- Driver tables: drivers can see their own data
CREATE POLICY "Drivers can view own earnings" ON driver_earnings FOR SELECT USING (
  driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Drivers can view own shifts" ON driver_shifts FOR SELECT USING (
  driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Drivers can view own locations" ON driver_locations FOR SELECT USING (
  driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Drivers can insert own locations" ON driver_locations FOR INSERT WITH CHECK (
  driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid())
);

-- Gamification: users can view their own
CREATE POLICY "Users can view own gamification_log" ON gamification_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own challenges" ON user_challenges FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- Seed some default data
-- ============================================================

-- Default cuisine types
INSERT INTO cuisine_types (name, name_ar, sort_order) VALUES
  ('Arabic', 'عربي', 1),
  ('Mediterranean', 'متوسطي', 2),
  ('Asian', 'آسيوي', 3),
  ('Western', 'غربي', 4),
  ('Indian', 'هندي', 5),
  ('Healthy/Bowl', 'صحي/بول', 6),
  ('Grilled', 'مشوي', 7),
  ('Keto', 'كيتو', 8),
  ('Vegan', 'نباتي', 9),
  ('International', 'دولي', 10)
ON CONFLICT (name) DO NOTHING;

-- Default allergen tags
INSERT INTO allergen_tags (name, name_ar, severity) VALUES
  ('Gluten', 'غلوتين', 'high'),
  ('Dairy', 'ألبان', 'medium'),
  ('Nuts', 'مكسرات', 'high'),
  ('Eggs', 'بيض', 'medium'),
  ('Soy', 'صويا', 'medium'),
  ('Seafood', 'مأكولات بحرية', 'high'),
  ('Sesame', 'سمسم', 'high'),
  ('Shellfish', 'محار', 'high')
ON CONFLICT (name) DO NOTHING;

-- Default FAQ entries
INSERT INTO faq (question, question_ar, answer, answer_ar, category, sort_order) VALUES
  ('What is Nutrio?', 'ما هو نتريو؟', 'Nutrio is Qatar''s first multi-restaurant healthy meal subscription platform, offering meals from 20+ curated restaurants with AI-powered nutrition tracking.', 'نتريو هو أول منصة اشتراك وجبات صحية متعددة المطاعم في قطر، تقدم وجبات من أكثر من 20 مطعماً مختاراً مع تتبع تغذية مدعوم بالذكاء الاصطناعي.', 'general', 1),
  ('How does the subscription work?', 'كيف يعمل الاشتراك؟', 'Choose a plan (Lean, Core, Pro, or Elite), select your meals weekly from our partner restaurants, and get them delivered to your door. You can swap, skip, or customize anytime.', 'اختر خطة (لين، كور، برو، أو إيليت)، اختر وجباتك أسبوعياً من مطاعمنا الشريكة، واحصل عليها توصيل لباب منزلك. يمكنك التبديل أو التخطي أو التخصيص في أي وقت.', 'subscriptions', 2),
  ('What areas do you deliver to?', 'ما المناطق التي توصلون إليها؟', 'We currently deliver across Doha, Al Khor, Al Wakrah, and surrounding areas. We''re expanding coverage regularly.', 'نوصل حالياً عبر الدوحة، الخور، الوكرة، والمناطق المحيطة. نوسع التغطية بانتظام.', 'delivery', 3),
  ('Can I customize my meals?', 'هل يمكنني تخصيص وجباتي؟', 'Yes! You can remove ingredients, adjust portion sizes, choose high-protein variants, and select from our snack menu.', 'نعم! يمكنك إزالة المكونات، تعديل حجم الحصص، اختيار بدائل عالية البروتين، والاختيار من قائمة الوجبات الخفيفة.', 'orders', 4),
  ('How do I cancel or pause my subscription?', 'كيف ألغي أو أوقف اشتراكي؟', 'You can pause up to 7 days per month from your subscription settings. To cancel, go to Settings > Subscription > Cancel. No long-term contracts.', 'يمكنك الإيقاف المؤقت لمدة تصل إلى 7 أيام شهرياً من إعدادات اشتراكك. للإلغاء، اذهب إلى الإعدادات > الاشتراك > إلغاء. لا توجد عقود طويلة الأجل.', 'subscriptions', 5),
  ('What payment methods do you accept?', 'ما طرق الدفع المقبولة؟', 'We accept Sadad, credit/debit cards (Visa, Mastercard), Apple Pay, and Google Pay.', 'نقبل سداد، بطاقات الائتمان/الخصم (فيزا، ماستركارد)، آبل باي، وجوجل باي.', 'payments', 6)
ON CONFLICT DO NOTHING;
