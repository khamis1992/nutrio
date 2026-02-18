-- Driver App Tables Migration
-- Run this in your Supabase SQL Editor

-- Add 'driver' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';

-- Create delivery_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
    CREATE TYPE public.delivery_status AS ENUM (
      'pending',
      'claimed',
      'picked_up',
      'on_the_way',
      'delivered',
      'cancelled'
    );
  END IF;
END$$;

-- Create vehicle_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type') THEN
    CREATE TYPE public.vehicle_type AS ENUM (
      'bike',
      'scooter',
      'motorcycle',
      'car'
    );
  END IF;
END$$;

-- Create drivers table
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  vehicle_type public.vehicle_type DEFAULT 'bike',
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  license_number TEXT,
  is_online BOOLEAN DEFAULT false,
  current_lat NUMERIC(10, 7),
  current_lng NUMERIC(10, 7),
  total_deliveries INTEGER DEFAULT 0,
  rating NUMERIC(3, 2) DEFAULT 0,
  wallet_balance NUMERIC(10, 2) DEFAULT 0,
  approval_status public.approval_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create deliveries table
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.meal_schedules(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.delivery_status DEFAULT 'pending',
  pickup_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC(10, 7),
  delivery_lng NUMERIC(10, 7),
  estimated_distance_km NUMERIC(6, 2),
  delivery_fee NUMERIC(10, 2) DEFAULT 3.00,
  tip_amount NUMERIC(10, 2) DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_photo_url TEXT,
  delivery_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create driver_payouts table
CREATE TABLE IF NOT EXISTS public.driver_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  payout_method TEXT,
  payout_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create driver_reviews table
CREATE TABLE IF NOT EXISTS public.driver_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(delivery_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_is_online ON public.drivers(is_online);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON public.deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_restaurant_id ON public.deliveries(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON public.deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver_id ON public.driver_payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_reviews_driver_id ON public.driver_reviews(driver_id);

-- Enable Row Level Security
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Drivers can view their own data" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can update their own data" ON public.drivers;
DROP POLICY IF EXISTS "Anyone can insert driver during signup" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can view available deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can claim and update deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "System can create deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can view their own payouts" ON public.driver_payouts;
DROP POLICY IF EXISTS "Drivers can request payouts" ON public.driver_payouts;
DROP POLICY IF EXISTS "Drivers can view their reviews" ON public.driver_reviews;
DROP POLICY IF EXISTS "Users can create reviews for their deliveries" ON public.driver_reviews;

-- RLS Policies for drivers table
CREATE POLICY "Drivers can view their own data"
  ON public.drivers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update their own data"
  ON public.drivers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert driver during signup"
  ON public.drivers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for deliveries table
CREATE POLICY "Drivers can view available deliveries"
  ON public.deliveries FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id) OR
    (status = 'pending' AND driver_id IS NULL)
  );

CREATE POLICY "Drivers can claim and update deliveries"
  ON public.deliveries FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id));

CREATE POLICY "System can create deliveries"
  ON public.deliveries FOR INSERT
  WITH CHECK (true);

-- RLS Policies for driver_payouts table
CREATE POLICY "Drivers can view their own payouts"
  ON public.driver_payouts FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id));

CREATE POLICY "Drivers can request payouts"
  ON public.driver_payouts FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id));

-- RLS Policies for driver_reviews table
CREATE POLICY "Drivers can view their reviews"
  ON public.driver_reviews FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id));

CREATE POLICY "Users can create reviews for their deliveries"
  ON public.driver_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically create delivery when meal_schedules status changes to 'preparing'
CREATE OR REPLACE FUNCTION create_delivery_for_schedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_status = 'preparing' AND OLD.order_status != 'preparing' THEN
    INSERT INTO public.deliveries (
      schedule_id,
      restaurant_id,
      user_id,
      pickup_address,
      delivery_address,
      delivery_fee,
      tip_amount
    )
    SELECT 
      NEW.id,
      m.restaurant_id,
      NEW.user_id,
      COALESCE(r.address, 'Restaurant Address'),
      COALESCE(ua.address_line1 || ' ' || COALESCE(ua.address_line2, '') || ', ' || ua.city, 'Customer Address'),
      3.00,
      0
    FROM public.meals m
    JOIN public.restaurants r ON r.id = m.restaurant_id
    LEFT JOIN public.user_addresses ua ON ua.user_id = NEW.user_id AND ua.is_default = true
    WHERE m.id = NEW.meal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create delivery when schedule is being prepared
DROP TRIGGER IF EXISTS on_schedule_preparing ON public.meal_schedules;
CREATE TRIGGER on_schedule_preparing
  AFTER UPDATE ON public.meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION create_delivery_for_schedule();

-- Function to update driver wallet after delivery
CREATE OR REPLACE FUNCTION credit_driver_wallet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    UPDATE public.drivers
    SET 
      wallet_balance = wallet_balance + NEW.delivery_fee + NEW.tip_amount,
      total_deliveries = total_deliveries + 1,
      updated_at = now()
    WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to credit driver wallet on delivery completion
DROP TRIGGER IF EXISTS on_delivery_complete ON public.deliveries;
CREATE TRIGGER on_delivery_complete
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION credit_driver_wallet();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_drivers_updated_at ON public.drivers;
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_payouts_updated_at ON public.driver_payouts;
CREATE TRIGGER update_driver_payouts_updated_at
  BEFORE UPDATE ON public.driver_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
