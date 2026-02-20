-- Emergency Fix: Add Missing Columns
-- Fixes remaining database column errors

-- Add total_orders to restaurants if missing
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;

-- Add rating to restaurants if missing
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);

-- Ensure is_active exists
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure approval_status exists with proper type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS approval_status public.approval_status DEFAULT 'pending';

-- Add any other missing columns to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create updated_at trigger for restaurants if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
