-- Recovery Credits System for Nutrio
-- Tables: recovery_partners, member_recovery_credits, recovery_bookings

-- 1. Recovery Partners (spas, cryotherapy centers, massage studios)
CREATE TABLE IF NOT EXISTS recovery_partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  logo_url TEXT,
  cover_url TEXT,
  address TEXT,
  city TEXT DEFAULT 'Doha',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone TEXT,
  website TEXT,
  opening_hours JSONB DEFAULT '{}',
  services JSONB DEFAULT '[]',
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Member Recovery Credits
CREATE TABLE IF NOT EXISTS member_recovery_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_credits INTEGER DEFAULT 0,
  used_credits INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  UNIQUE(user_id, period_start)
);

-- 3. Recovery Bookings
CREATE TABLE IF NOT EXISTS recovery_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES recovery_partners(id),
  service_name TEXT,
  credits_used INTEGER DEFAULT 1,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled', 'no_show')),
  qr_code TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recovery_partners_city ON recovery_partners(city);
CREATE INDEX IF NOT EXISTS idx_recovery_partners_active ON recovery_partners(is_active);
CREATE INDEX IF NOT EXISTS idx_member_recovery_credits_user ON member_recovery_credits(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_member_recovery_credits_period ON member_recovery_credits(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_recovery_bookings_user ON recovery_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_bookings_partner ON recovery_bookings(partner_id);
CREATE INDEX IF NOT EXISTS idx_recovery_bookings_date ON recovery_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_recovery_bookings_status ON recovery_bookings(status);

-- RLS
ALTER TABLE recovery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_recovery_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_bookings ENABLE ROW LEVEL SECURITY;

-- recovery_partners: public read, admin manage
CREATE POLICY "Partners are viewable by everyone" ON recovery_partners
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admin can manage partners" ON recovery_partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- member_recovery_credits: users see own, system manages
CREATE POLICY "Users see own credits" ON member_recovery_credits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own credits" ON member_recovery_credits
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update credits" ON member_recovery_credits
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- recovery_bookings: users see own, system manages
CREATE POLICY "Users see own bookings" ON recovery_bookings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bookings" ON recovery_bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bookings" ON recovery_bookings
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed Data: Doha-based recovery partners
INSERT INTO recovery_partners (name, name_ar, description, description_ar, address, city, latitude, longitude, phone, website, opening_hours, services, rating, review_count) VALUES
(
  'Serenity Spa & Wellness',
  'سبا سيرينيتي للعافية',
  'Premium spa offering deep tissue massage, aromatherapy, and traditional Turkish hammam experiences in the heart of Doha.',
  'سبا فاخر يقدم مساج الأنسجة العميقة والعلاج بالروائح وتجربة الحمام التركي التقليدي في قلب الدوحة.',
  'The Pearl-Qatar, Porto Arabia, Tower 12',
  'Doha', 25.3213, 51.5215, '+974 4412 3456', 'https://serenityspa.qa',
  '{"sun":{"open":"09:00","close":"22:00"},"mon":{"open":"09:00","close":"22:00"},"tue":{"open":"09:00","close":"22:00"},"wed":{"open":"09:00","close":"22:00"},"thu":{"open":"09:00","close":"23:00"},"fri":{"open":"10:00","close":"23:00"},"sat":{"open":"09:00","close":"22:00"}}',
  '[{"name":"Deep Tissue Massage","name_ar":"مساج الأنسجة العميقة","duration_min":60,"credits_required":1,"description":"Intensive muscle work targeting deep layers of tissue"},{"name":"Hot Stone Therapy","name_ar":"العلاج بالأحجار الساخنة","duration_min":75,"credits_required":2,"description":"Heated basalt stones for deep relaxation"},{"name":"Turkish Hammam","name_ar":"الحمام التركي","duration_min":90,"credits_required":2,"description":"Traditional cleansing ritual with steam and exfoliation"}]',
  4.8, 142
),
(
  'CryoQatar Recovery Center',
  'مركز كريو قطر للاستشفاء',
  'State-of-the-art cryotherapy and cold plunge facility designed for athletes and wellness enthusiasts.',
  'مرفق علاج بالتبريد وانغمار بارد متطور مصمم للرياضيين وعشاق العافية.',
  'Lusail City, Marina District, Building 47',
  'Doha', 25.3850, 51.5215, '+974 4487 8901', 'https://cryoqatar.qa',
  '{"sun":{"open":"07:00","close":"21:00"},"mon":{"open":"06:00","close":"21:00"},"tue":{"open":"06:00","close":"21:00"},"wed":{"open":"06:00","close":"21:00"},"thu":{"open":"06:00","close":"21:00"},"fri":{"open":"08:00","close":"20:00"},"sat":{"open":"08:00","close":"20:00"}}',
  '[{"name":"Whole Body Cryotherapy","name_ar":"العلاج بالتبريد للجسم كامل","duration_min":3,"credits_required":1,"description":"-110°C nitrogen chamber for rapid recovery"},{"name":"Localized Cryotherapy","name_ar":"العلاج بالتبريد الموضعي","duration_min":15,"credits_required":1,"description":"Targeted cold therapy for specific injuries"},{"name":"Cold Plunge + Sauna","name_ar":"الانغمار البارد والساونا","duration_min":45,"credits_required":2,"description":"Contrast therapy alternating cold plunge and infrared sauna"}]',
  4.6, 89
),
(
  'Zen Float Therapy',
  'زن للعلاج بالطفو',
  'Float tank therapy center offering sensory deprivation pods for deep mental and physical restoration.',
  'مركز علاج بالأحواض العائمة يقدم كبائن حرمان حسي للاستعادة الذهنية والجسدية العميقة.',
  'West Bay, Al Mirqab Street, Villa 23',
  'Doha', 25.2960, 51.5340, '+974 4403 2233', 'https://zenfloat.qa',
  '{"sun":{"open":"10:00","close":"20:00"},"mon":{"open":"09:00","close":"20:00"},"tue":{"open":"09:00","close":"20:00"},"wed":{"open":"09:00","close":"20:00"},"thu":{"open":"09:00","close":"21:00"},"fri":{"open":"10:00","close":"18:00"},"sat":{"open":"10:00","close":"18:00"}}',
  '[{"name":"Float Session (60min)","name_ar":"جلسة طفو (60 دقيقة)","duration_min":60,"credits_required":2,"description":"Epsom salt float pod, zero gravity experience"},{"name":"Float + Massage Combo","name_ar":"طفو + مساج","duration_min":120,"credits_required":3,"description":"Float session followed by 30min relaxation massage"}]',
  4.9, 67
),
(
  'Doha Sports Massage',
  'مساج الدوحة الرياضي',
  'Specialized sports massage and physiotherapy center catering to athletes and active individuals.',
  'مركز مساج رياضي وعلاج طبيعي متخصص يخدم الرياضيين والأشخاص النشطين.',
  'Al Sadd, Ibn Khaldoun Street, 2nd Floor',
  'Doha', 25.3050, 51.4980, '+974 4421 5567', 'https://dohasportsmassage.qa',
  '{"sun":{"open":"08:00","close":"21:00"},"mon":{"open":"08:00","close":"21:00"},"tue":{"open":"08:00","close":"21:00"},"wed":{"open":"08:00","close":"21:00"},"thu":{"open":"08:00","close":"21:00"},"fri":{"open":"09:00","close":"17:00"},"sat":{"open":"09:00","close":"17:00"}}',
  '[{"name":"Sports Deep Tissue","name_ar":"مساج رياضي عميق","duration_min":60,"credits_required":1,"description":"Targeted sports massage for muscle recovery"},{"name":"Post-Workout Recovery","name_ar":"استشفاء بعد التمرين","duration_min":45,"credits_required":1,"description":"Quick recovery session focusing on worked muscle groups"},{"name":"Cupping Therapy","name_ar":"العلاج بالحجامة","duration_min":30,"credits_required":1,"description":"Traditional cupping for circulation and recovery"}]',
  4.7, 113
),
(
  'The Healing Room',
  'غرفة الشفاء',
  'Holistic wellness center combining massage, meditation, and alternative therapies in a tranquil setting.',
  'مركز عافية شامل يجمع بين المساج والتأمل والعلاجات البديلة في بيئة هادئة.',
  'Katara Cultural Village, Building 15',
  'Doha', 25.3560, 51.5260, '+974 4475 1122', 'https://thehealingroom.qa',
  '{"sun":{"open":"09:00","close":"21:00"},"mon":{"open":"09:00","close":"21:00"},"tue":{"open":"09:00","close":"21:00"},"wed":{"open":"09:00","close":"21:00"},"thu":{"open":"09:00","close":"22:00"},"fri":{"open":"10:00","close":"22:00"},"sat":{"open":"10:00","close":"20:00"}}',
  '[{"name":"Aromatherapy Massage","name_ar":"مساج العلاج بالروائح","duration_min":60,"credits_required":1,"description":"Essential oils massage for stress relief"},{"name":"Sound Healing Session","name_ar":"جلسة العلاج بالصوت","duration_min":45,"credits_required":1,"description":"Tibetan singing bowls and frequency therapy"},{"name":"Guided Meditation + Massage","name_ar":"تأمل موجّه + مساج","duration_min":90,"credits_required":2,"description":"30min meditation followed by 60min massage"}]',
  4.5, 54
),
(
  'IceMan Cryotherapy & Recovery',
  'آيس مان للتبريد والاستشفاء',
  'Premium cryotherapy lounge with compression therapy and infrared treatments.',
  'صالة علاج بالتبريد فاخرة مع علاج الضغط والأشعة تحت الحمراء.',
  'Aspire Zone, Sport City, Block A',
  'Doha', 25.2850, 51.4430, '+974 4498 3344', 'https://iceman.qa',
  '{"sun":{"open":"07:00","close":"20:00"},"mon":{"open":"06:00","close":"20:00"},"tue":{"open":"06:00","close":"20:00"},"wed":{"open":"06:00","close":"20:00"},"thu":{"open":"06:00","close":"20:00"},"fri":{"open":"08:00","close":"18:00"},"sat":{"open":"08:00","close":"18:00"}}',
  '[{"name":"Cryotherapy Session","name_ar":"جلسة العلاج بالتبريد","duration_min":3,"credits_required":1,"description":"Full body cryo session at -120°C"},{"name":"Normatec Compression","name_ar":"ضغط نورماتك","duration_min":30,"credits_required":1,"description":"Pneumatic compression boots for leg recovery"},{"name":"Infrared Sauna","name_ar":"الساونا بالأشعة تحت الحمراء","duration_min":30,"credits_required":1,"description":"Far infrared heat therapy for detox and pain relief"}]',
  4.4, 78
);
