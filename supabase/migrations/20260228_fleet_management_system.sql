-- Migration: Fleet Management System Tables
-- Date: 2026-02-28
-- Description: Create tables for the fleet management portal

-- ==========================================
-- FLEET MANAGERS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.fleet_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'fleet_manager')),
  assigned_city_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.fleet_managers IS 'Fleet managers who can access the fleet portal';
COMMENT ON COLUMN public.fleet_managers.auth_user_id IS 'Reference to Supabase auth user';
COMMENT ON COLUMN public.fleet_managers.assigned_city_ids IS 'Array of city IDs this manager can access';

-- ==========================================
-- CITIES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  country TEXT NOT NULL DEFAULT 'Qatar',
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  timezone TEXT DEFAULT 'Asia/Qatar',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.cities IS 'Cities where fleet operations are active';

-- ==========================================
-- ZONES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  polygon JSONB, -- GeoJSON Polygon
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.zones IS 'Operational zones within cities';

-- ==========================================
-- VEHICLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES public.cities(id),
  type TEXT NOT NULL CHECK (type IN ('motorcycle', 'car', 'bicycle', 'van')),
  make TEXT,
  model TEXT,
  year INTEGER,
  color TEXT,
  plate_number TEXT NOT NULL UNIQUE,
  registration_number TEXT,
  insurance_provider TEXT,
  insurance_expiry DATE,
  insurance_document_url TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'retired')),
  assigned_driver_id UUID REFERENCES public.drivers(id),
  vehicle_photo_url TEXT,
  registration_document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.vehicles IS 'Fleet vehicles available for driver assignment';

-- ==========================================
-- DRIVER PAYOUTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.driver_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  city_id UUID REFERENCES public.cities(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_earnings NUMERIC(10, 2) DEFAULT 0,
  bonus_amount NUMERIC(10, 2) DEFAULT 0,
  penalty_amount NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  payment_method TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.fleet_managers(id),
  notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.fleet_managers(id),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.driver_payouts IS 'Driver earnings payouts processed by fleet managers';

-- ==========================================
-- DRIVER DOCUMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('id_card', 'driving_license', 'vehicle_registration', 'insurance', 'background_check', 'contract')),
  document_url TEXT NOT NULL,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'expired')),
  rejection_reason TEXT,
  expiry_date DATE,
  verified_by UUID REFERENCES public.fleet_managers(id),
  verified_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.driver_documents IS 'Driver uploaded documents for verification';

-- ==========================================
-- FLEET ACTIVITY LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS public.fleet_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES public.fleet_managers(id),
  city_id UUID REFERENCES public.cities(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.fleet_activity_log IS 'Audit log for fleet manager actions';

-- ==========================================
-- DRIVER ACTIVITY LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS public.driver_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'logout', 'status_change', 'order_assigned', 'order_accepted', 'order_completed', 'location_update', 'document_uploaded', 'verification_status_change')),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.driver_activity_log IS 'Audit log for driver activities';

-- ==========================================
-- ADD COLUMNS TO EXISTING DRIVERS TABLE
-- ==========================================

-- Add fleet-related columns to drivers table if they don't exist
DO $$
BEGIN
  -- Add city_id if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'city_id') THEN
    ALTER TABLE public.drivers ADD COLUMN city_id UUID REFERENCES public.cities(id);
  END IF;
  
  -- Add email if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'email') THEN
    ALTER TABLE public.drivers ADD COLUMN email TEXT;
  END IF;
  
  -- Add full_name if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'full_name') THEN
    ALTER TABLE public.drivers ADD COLUMN full_name TEXT;
  END IF;
  
  -- Add assigned_zone_ids if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'assigned_zone_ids') THEN
    ALTER TABLE public.drivers ADD COLUMN assigned_zone_ids UUID[] DEFAULT '{}';
  END IF;
  
  -- Add cancellation_rate if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'cancellation_rate') THEN
    ALTER TABLE public.drivers ADD COLUMN cancellation_rate NUMERIC(5,2) DEFAULT 0;
  END IF;
  
  -- Add status if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'status') THEN
    ALTER TABLE public.drivers ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('pending_verification', 'active', 'suspended', 'inactive'));
  END IF;
END $$;

-- ==========================================
-- RLS POLICIES
-- ==========================================

ALTER TABLE public.fleet_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_activity_log ENABLE ROW LEVEL SECURITY;

-- Fleet managers can view their own record
DROP POLICY IF EXISTS "Fleet managers can view own record" ON public.fleet_managers;
CREATE POLICY "Fleet managers can view own record" ON public.fleet_managers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.fleet_managers WHERE auth_user_id = auth.uid() AND role = 'super_admin'
  ));

-- Fleet managers can update their own last_login
DROP POLICY IF EXISTS "Fleet managers can update own record" ON public.fleet_managers;
CREATE POLICY "Fleet managers can update own record" ON public.fleet_managers
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.fleet_managers WHERE auth_user_id = auth.uid() AND role = 'super_admin'
  ));

-- Super admins can insert fleet managers
DROP POLICY IF EXISTS "Super admins can insert fleet managers" ON public.fleet_managers;
CREATE POLICY "Super admins can insert fleet managers" ON public.fleet_managers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fleet_managers WHERE auth_user_id = auth.uid() AND role = 'super_admin'
  ));

-- Cities viewable by fleet managers
DROP POLICY IF EXISTS "Fleet managers can view cities" ON public.cities;
CREATE POLICY "Fleet managers can view cities" ON public.cities
  FOR SELECT TO authenticated
  USING (true);

-- Zones viewable by fleet managers
DROP POLICY IF EXISTS "Fleet managers can view zones" ON public.zones;
CREATE POLICY "Fleet managers can view zones" ON public.zones
  FOR SELECT TO authenticated
  USING (true);

-- Vehicles manageable by fleet managers
DROP POLICY IF EXISTS "Fleet managers can view vehicles" ON public.vehicles;
CREATE POLICY "Fleet managers can view vehicles" ON public.vehicles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
    AND (fm.role = 'super_admin' OR city_id = ANY(fm.assigned_city_ids))
  ));

DROP POLICY IF EXISTS "Fleet managers can insert vehicles" ON public.vehicles;
CREATE POLICY "Fleet managers can insert vehicles" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
    AND (fm.role = 'super_admin' OR city_id = ANY(fm.assigned_city_ids))
  ));

DROP POLICY IF EXISTS "Fleet managers can update vehicles" ON public.vehicles;
CREATE POLICY "Fleet managers can update vehicles" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
    AND (fm.role = 'super_admin' OR city_id = ANY(fm.assigned_city_ids))
  ));

-- Driver payouts manageable by fleet managers
DROP POLICY IF EXISTS "Fleet managers can manage payouts" ON public.driver_payouts;
CREATE POLICY "Fleet managers can manage payouts" ON public.driver_payouts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
    AND (fm.role = 'super_admin' OR city_id = ANY(fm.assigned_city_ids))
  ));

-- Driver documents manageable by fleet managers
DROP POLICY IF EXISTS "Fleet managers can view documents" ON public.driver_documents;
CREATE POLICY "Fleet managers can view documents" ON public.driver_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Fleet managers can update document status" ON public.driver_documents;
CREATE POLICY "Fleet managers can update document status" ON public.driver_documents
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
  ));

-- Fleet activity log
DROP POLICY IF EXISTS "Fleet managers can view activity log" ON public.fleet_activity_log;
CREATE POLICY "Fleet managers can view activity log" ON public.fleet_activity_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Fleet managers can insert activity log" ON public.fleet_activity_log;
CREATE POLICY "Fleet managers can insert activity log" ON public.fleet_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
  ));

-- Driver activity log
DROP POLICY IF EXISTS "Fleet managers can view driver activity" ON public.driver_activity_log;
CREATE POLICY "Fleet managers can view driver activity" ON public.driver_activity_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
  ));

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_fleet_managers_updated_at ON public.fleet_managers;
CREATE TRIGGER update_fleet_managers_updated_at
  BEFORE UPDATE ON public.fleet_managers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cities_updated_at ON public.cities;
CREATE TRIGGER update_cities_updated_at
  BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_zones_updated_at ON public.zones;
CREATE TRIGGER update_zones_updated_at
  BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_payouts_updated_at ON public.driver_payouts;
CREATE TRIGGER update_driver_payouts_updated_at
  BEFORE UPDATE ON public.driver_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_documents_updated_at ON public.driver_documents;
CREATE TRIGGER update_driver_documents_updated_at
  BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SEED DATA
-- ==========================================

-- Insert default Qatar cities
INSERT INTO public.cities (name, name_ar, country, latitude, longitude, timezone, is_active)
VALUES 
  ('Doha', 'الدوحة', 'Qatar', 25.2854, 51.5310, 'Asia/Qatar', true),
  ('Al Wakrah', 'الوكرة', 'Qatar', 25.1657, 51.5976, 'Asia/Qatar', true),
  ('Al Khor', 'الخور', 'Qatar', 25.6843, 51.4975, 'Asia/Qatar', true),
  ('Al Rayyan', 'الريان', 'Qatar', 25.2919, 51.4244, 'Asia/Qatar', true),
  ('Umm Salal', 'أم صلال', 'Qatar', 25.4697, 51.4033, 'Asia/Qatar', true)
ON CONFLICT DO NOTHING;

-- ==========================================
-- GRANTS
-- ==========================================

GRANT ALL ON public.fleet_managers TO authenticated;
GRANT ALL ON public.cities TO authenticated;
GRANT ALL ON public.zones TO authenticated;
GRANT ALL ON public.vehicles TO authenticated;
GRANT ALL ON public.driver_payouts TO authenticated;
GRANT ALL ON public.driver_documents TO authenticated;
GRANT ALL ON public.fleet_activity_log TO authenticated;
GRANT ALL ON public.driver_activity_log TO authenticated;

SELECT 'Fleet management tables created successfully' as status;
