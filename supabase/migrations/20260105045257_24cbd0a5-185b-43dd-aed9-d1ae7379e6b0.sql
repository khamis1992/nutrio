-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'partner', 'admin');

-- Create enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');

-- Create enum for subscription plan
CREATE TYPE public.subscription_plan AS ENUM ('weekly', 'monthly');

-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled');

-- Create enum for restaurant approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for health goal
CREATE TYPE public.health_goal AS ENUM ('lose', 'gain', 'maintain');

-- Create enum for activity level
CREATE TYPE public.activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');

-- Create enum for gender
CREATE TYPE public.gender_type AS ENUM ('male', 'female');

-- =====================
-- USER ROLES TABLE (separate from profiles for security)
-- =====================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================
-- SECURITY DEFINER FUNCTION for role checking
-- =====================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get current user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'partner' THEN 2 
      ELSE 3 
    END
  LIMIT 1
$$;

-- =====================
-- PROFILES TABLE
-- =====================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  gender gender_type,
  age INTEGER CHECK (age >= 13 AND age <= 120),
  height_cm NUMERIC(5,2) CHECK (height_cm > 0 AND height_cm < 300),
  current_weight_kg NUMERIC(5,2) CHECK (current_weight_kg > 0 AND current_weight_kg < 500),
  target_weight_kg NUMERIC(5,2) CHECK (target_weight_kg > 0 AND target_weight_kg < 500),
  health_goal health_goal,
  activity_level activity_level,
  daily_calorie_target INTEGER,
  protein_target_g INTEGER,
  carbs_target_g INTEGER,
  fat_target_g INTEGER,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================
-- RESTAURANTS TABLE
-- =====================
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  approval_status approval_status DEFAULT 'pending',
  rating NUMERIC(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  total_orders INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- =====================
-- DIET TAGS TABLE
-- =====================
CREATE TABLE public.diet_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.diet_tags ENABLE ROW LEVEL SECURITY;

-- =====================
-- MEALS TABLE
-- =====================
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  calories INTEGER NOT NULL CHECK (calories >= 0),
  protein_g NUMERIC(5,1) NOT NULL CHECK (protein_g >= 0),
  carbs_g NUMERIC(5,1) NOT NULL CHECK (carbs_g >= 0),
  fat_g NUMERIC(5,1) NOT NULL CHECK (fat_g >= 0),
  fiber_g NUMERIC(5,1) DEFAULT 0,
  prep_time_minutes INTEGER DEFAULT 15,
  is_available BOOLEAN DEFAULT true,
  rating NUMERIC(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  order_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

-- =====================
-- MEAL DIET TAGS (junction table)
-- =====================
CREATE TABLE public.meal_diet_tags (
  meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  diet_tag_id UUID REFERENCES public.diet_tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (meal_id, diet_tag_id)
);

ALTER TABLE public.meal_diet_tags ENABLE ROW LEVEL SECURITY;

-- =====================
-- SUBSCRIPTIONS TABLE
-- =====================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan subscription_plan NOT NULL,
  status subscription_status DEFAULT 'pending',
  price NUMERIC(10,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- =====================
-- ORDERS TABLE
-- =====================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  status order_status DEFAULT 'pending',
  total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  delivery_date DATE NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- =====================
-- ORDER ITEMS TABLE
-- =====================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- =====================
-- PROGRESS LOGS TABLE
-- =====================
CREATE TABLE public.progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2) CHECK (weight_kg > 0 AND weight_kg < 500),
  calories_consumed INTEGER DEFAULT 0,
  protein_consumed_g INTEGER DEFAULT 0,
  carbs_consumed_g INTEGER DEFAULT 0,
  fat_consumed_g INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

-- =====================
-- MEAL SCHEDULE TABLE
-- =====================
CREATE TABLE public.meal_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  scheduled_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, scheduled_date, meal_type)
);

ALTER TABLE public.meal_schedules ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES
-- =====================

-- User Roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Restaurants policies
CREATE POLICY "Anyone can view approved restaurants" ON public.restaurants
  FOR SELECT USING (approval_status = 'approved' AND is_active = true);

CREATE POLICY "Partners can view their own restaurants" ON public.restaurants
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Partners can manage their own restaurants" ON public.restaurants
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all restaurants" ON public.restaurants
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Diet Tags policies (public read)
CREATE POLICY "Anyone can view diet tags" ON public.diet_tags
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage diet tags" ON public.diet_tags
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Meals policies
CREATE POLICY "Anyone can view available meals from approved restaurants" ON public.meals
  FOR SELECT USING (
    is_available = true AND 
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = restaurant_id 
      AND approval_status = 'approved' 
      AND is_active = true
    )
  );

CREATE POLICY "Partners can manage meals for their restaurants" ON public.meals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = restaurant_id 
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all meals" ON public.meals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Meal Diet Tags policies
CREATE POLICY "Anyone can view meal diet tags" ON public.meal_diet_tags
  FOR SELECT USING (true);

CREATE POLICY "Partners can manage meal tags for their meals" ON public.meal_diet_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.meals m
      JOIN public.restaurants r ON m.restaurant_id = r.id
      WHERE m.id = meal_id AND r.owner_id = auth.uid()
    )
  );

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subscriptions" ON public.subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Orders policies
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Partners can view orders for their restaurants" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants 
      WHERE id = restaurant_id 
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all orders" ON public.orders
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Order Items policies
CREATE POLICY "Users can view their own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id = order_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create order items for their orders" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id = order_id 
      AND user_id = auth.uid()
    )
  );

-- Progress Logs policies
CREATE POLICY "Users can view their own progress" ON public.progress_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own progress" ON public.progress_logs
  FOR ALL USING (auth.uid() = user_id);

-- Meal Schedules policies
CREATE POLICY "Users can view their own schedules" ON public.meal_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own schedules" ON public.meal_schedules
  FOR ALL USING (auth.uid() = user_id);

-- =====================
-- TRIGGERS for updated_at
-- =====================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meals_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_progress_logs_updated_at
  BEFORE UPDATE ON public.progress_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- TRIGGER: Auto-create profile and user role on signup
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- INDEXES for performance
-- =====================
CREATE INDEX idx_meals_restaurant ON public.meals(restaurant_id);
CREATE INDEX idx_meals_available ON public.meals(is_available) WHERE is_available = true;
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX idx_orders_date ON public.orders(delivery_date);
CREATE INDEX idx_progress_user_date ON public.progress_logs(user_id, log_date);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_meal_schedules_user_date ON public.meal_schedules(user_id, scheduled_date);