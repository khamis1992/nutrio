/*
  # إنشاء جداول المطاعم والوجبات

  1. الجداول الجديدة
    - `menu_categories` - فئات القوائم
    - `menu_items` - عناصر القائمة
    - `restaurant_orders` - طلبات المطاعم
    - `order_items` - عناصر الطلبات
    - `restaurant_analytics` - إحصائيات المطاعم

  2. الأمان
    - تفعيل RLS على جميع الجداول
    - إضافة سياسات الوصول المناسبة
*/

-- إنشاء enum لحالة الطلب
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');

-- جدول فئات القوائم
CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول عناصر القائمة
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  image_url text,
  calories integer,
  protein decimal(5,2),
  carbs decimal(5,2),
  fat decimal(5,2),
  is_available boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  preparation_time integer DEFAULT 15,
  ingredients text[],
  allergens text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول طلبات المطاعم
CREATE TABLE IF NOT EXISTS restaurant_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  order_number text UNIQUE NOT NULL,
  status order_status DEFAULT 'pending',
  subtotal decimal(10,2) NOT NULL,
  delivery_fee decimal(10,2) DEFAULT 0,
  tax_amount decimal(10,2) DEFAULT 0,
  total_amount decimal(10,2) NOT NULL,
  customer_notes text,
  delivery_address text,
  delivery_latitude decimal(10,8),
  delivery_longitude decimal(11,8),
  estimated_delivery_time timestamptz,
  confirmed_at timestamptz,
  prepared_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول عناصر الطلبات
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  special_instructions text,
  created_at timestamptz DEFAULT now()
);

-- جدول إحصائيات المطاعم
CREATE TABLE IF NOT EXISTS restaurant_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_orders integer DEFAULT 0,
  total_revenue decimal(10,2) DEFAULT 0,
  average_order_value decimal(10,2) DEFAULT 0,
  cancelled_orders integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, date)
);

-- تفعيل RLS
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_analytics ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول لفئات القوائم
CREATE POLICY "Anyone can read active menu categories"
  ON menu_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Restaurant owners can manage own categories"
  ON menu_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

-- سياسات الوصول لعناصر القائمة
CREATE POLICY "Anyone can read available menu items"
  ON menu_items
  FOR SELECT
  TO authenticated
  USING (is_available = true);

CREATE POLICY "Restaurant owners can manage own menu items"
  ON menu_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

-- سياسات الوصول للطلبات
CREATE POLICY "Customers can read own orders"
  ON restaurant_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Restaurant owners can read own restaurant orders"
  ON restaurant_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can read assigned orders"
  ON restaurant_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers d 
      WHERE d.id = driver_id 
      AND d.user_id = auth.uid()
    )
  );

-- سياسات الوصول لعناصر الطلبات
CREATE POLICY "Users can read order items for accessible orders"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurant_orders ro 
      WHERE ro.id = order_id 
      AND (
        ro.customer_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM restaurants r 
          WHERE r.id = ro.restaurant_id 
          AND r.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM drivers d 
          WHERE d.id = ro.driver_id 
          AND d.user_id = auth.uid()
        )
      )
    )
  );

-- سياسات الوصول لإحصائيات المطاعم
CREATE POLICY "Restaurant owners can read own analytics"
  ON restaurant_analytics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_restaurant_id ON restaurant_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_customer_id ON restaurant_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status ON restaurant_orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_analytics_restaurant_date ON restaurant_analytics(restaurant_id, date);