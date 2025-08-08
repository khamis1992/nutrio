/*
  # إنشاء الجداول الأساسية لنظام Nutrio

  1. الجداول الجديدة
    - `user_roles` - أدوار المستخدمين (admin, restaurant_owner, gym_owner, driver, customer)
    - `restaurants` - بيانات المطاعم
    - `gyms` - بيانات الصالات الرياضية
    - `drivers` - بيانات السائقين
    - `system_settings` - إعدادات النظام

  2. الأمان
    - تفعيل RLS على جميع الجداول
    - إضافة سياسات الوصول المناسبة لكل دور
*/

-- إنشاء enum للأدوار
CREATE TYPE user_role AS ENUM ('admin', 'restaurant_owner', 'gym_owner', 'driver', 'customer');

-- جدول أدوار المستخدمين
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'customer',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- جدول المطاعم
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  phone text,
  email text,
  address text,
  latitude decimal(10,8),
  longitude decimal(11,8),
  image_url text,
  is_active boolean DEFAULT true,
  rating decimal(3,2) DEFAULT 0,
  total_reviews integer DEFAULT 0,
  delivery_fee decimal(10,2) DEFAULT 0,
  min_order_amount decimal(10,2) DEFAULT 0,
  estimated_delivery_time integer DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول الصالات الرياضية
CREATE TABLE IF NOT EXISTS gyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  phone text,
  email text,
  address text,
  latitude decimal(10,8),
  longitude decimal(11,8),
  image_url text,
  is_active boolean DEFAULT true,
  rating decimal(3,2) DEFAULT 0,
  total_reviews integer DEFAULT 0,
  membership_fee decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول السائقين
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  vehicle_type text,
  vehicle_number text,
  license_number text,
  is_active boolean DEFAULT true,
  is_available boolean DEFAULT false,
  current_latitude decimal(10,8),
  current_longitude decimal(11,8),
  rating decimal(3,2) DEFAULT 0,
  total_deliveries integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إعدادات النظام
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول لجدول user_roles
CREATE POLICY "Users can read own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin' 
      AND ur.is_active = true
    )
  );

-- سياسات الوصول للمطاعم
CREATE POLICY "Anyone can read active restaurants"
  ON restaurants
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Restaurant owners can manage own restaurant"
  ON restaurants
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all restaurants"
  ON restaurants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin' 
      AND ur.is_active = true
    )
  );

-- سياسات الوصول للصالات الرياضية
CREATE POLICY "Anyone can read active gyms"
  ON gyms
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Gym owners can manage own gym"
  ON gyms
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all gyms"
  ON gyms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin' 
      AND ur.is_active = true
    )
  );

-- سياسات الوصول للسائقين
CREATE POLICY "Drivers can read own data"
  ON drivers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update own data"
  ON drivers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all drivers"
  ON drivers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin' 
      AND ur.is_active = true
    )
  );

-- سياسات الوصول لإعدادات النظام
CREATE POLICY "Admins can manage system settings"
  ON system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin' 
      AND ur.is_active = true
    )
  );

-- إدراج بيانات أولية
INSERT INTO system_settings (key, value, description) VALUES
('app_name', '"Nutrio"', 'اسم التطبيق'),
('delivery_fee', '5.00', 'رسوم التوصيل الافتراضية'),
('min_order_amount', '20.00', 'الحد الأدنى للطلب'),
('commission_rate', '0.15', 'نسبة العمولة من المطاعم');