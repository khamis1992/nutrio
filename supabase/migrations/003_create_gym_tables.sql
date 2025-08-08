/*
  # إنشاء جداول الصالات الرياضية

  1. الجداول الجديدة
    - `trainers` - المدربين
    - `gym_classes` - الكلاسات الرياضية
    - `class_schedules` - جدولة الكلاسات
    - `class_bookings` - حجوزات الكلاسات
    - `gym_analytics` - إحصائيات الصالات الرياضية

  2. الأمان
    - تفعيل RLS على جميع الجداول
    - إضافة سياسات الوصول المناسبة
*/

-- إنشاء enum لحالة الحجز
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');

-- جدول المدربين
CREATE TABLE IF NOT EXISTS trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  bio text,
  specializations text[],
  image_url text,
  experience_years integer DEFAULT 0,
  rating decimal(3,2) DEFAULT 0,
  total_reviews integer DEFAULT 0,
  hourly_rate decimal(10,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول الكلاسات الرياضية
CREATE TABLE IF NOT EXISTS gym_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES trainers(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  category text,
  duration_minutes integer NOT NULL DEFAULT 60,
  max_participants integer DEFAULT 20,
  price decimal(10,2) NOT NULL,
  difficulty_level text DEFAULT 'beginner',
  equipment_needed text[],
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول جدولة الكلاسات
CREATE TABLE IF NOT EXISTS class_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES gym_classes(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES trainers(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  available_spots integer,
  booked_spots integer DEFAULT 0,
  is_cancelled boolean DEFAULT false,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول حجوزات الكلاسات
CREATE TABLE IF NOT EXISTS class_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES class_schedules(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status booking_status DEFAULT 'pending',
  booking_date timestamptz DEFAULT now(),
  payment_amount decimal(10,2),
  payment_status text DEFAULT 'pending',
  notes text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(schedule_id, customer_id)
);

-- جدول إحصائيات الصالات الرياضية
CREATE TABLE IF NOT EXISTS gym_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_bookings integer DEFAULT 0,
  total_revenue decimal(10,2) DEFAULT 0,
  cancelled_bookings integer DEFAULT 0,
  no_show_bookings integer DEFAULT 0,
  average_class_occupancy decimal(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(gym_id, date)
);

-- تفعيل RLS
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_analytics ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول للمدربين
CREATE POLICY "Anyone can read active trainers"
  ON trainers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Gym owners can manage own trainers"
  ON trainers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gyms g 
      WHERE g.id = gym_id 
      AND g.owner_id = auth.uid()
    )
  );

-- سياسات الوصول للكلاسات
CREATE POLICY "Anyone can read active gym classes"
  ON gym_classes
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Gym owners can manage own classes"
  ON gym_classes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gyms g 
      WHERE g.id = gym_id 
      AND g.owner_id = auth.uid()
    )
  );

-- سياسات الوصول لجدولة الكلاسات
CREATE POLICY "Anyone can read active schedules"
  ON class_schedules
  FOR SELECT
  TO authenticated
  USING (NOT is_cancelled);

CREATE POLICY "Gym owners can manage own schedules"
  ON class_schedules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gym_classes gc
      JOIN gyms g ON g.id = gc.gym_id
      WHERE gc.id = class_id 
      AND g.owner_id = auth.uid()
    )
  );

-- سياسات الوصول للحجوزات
CREATE POLICY "Customers can read own bookings"
  ON class_bookings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create own bookings"
  ON class_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update own bookings"
  ON class_bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Gym owners can read own gym bookings"
  ON class_bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM class_schedules cs
      JOIN gym_classes gc ON gc.id = cs.class_id
      JOIN gyms g ON g.id = gc.gym_id
      WHERE cs.id = schedule_id 
      AND g.owner_id = auth.uid()
    )
  );

-- سياسات الوصول لإحصائيات الصالات الرياضية
CREATE POLICY "Gym owners can read own analytics"
  ON gym_analytics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gyms g 
      WHERE g.id = gym_id 
      AND g.owner_id = auth.uid()
    )
  );

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_trainers_gym_id ON trainers(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_classes_gym_id ON gym_classes(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_classes_trainer_id ON gym_classes(trainer_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_class_id ON class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_start_time ON class_schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_class_bookings_schedule_id ON class_bookings(schedule_id);
CREATE INDEX IF NOT EXISTS idx_class_bookings_customer_id ON class_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_gym_analytics_gym_date ON gym_analytics(gym_id, date);