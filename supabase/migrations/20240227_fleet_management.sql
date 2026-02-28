-- Fleet Management Portal Schema Migration
-- Migration: 20240227_fleet_management
-- Description: Creates tables for the Fleet Management Portal with multi-city support

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- ENUM TYPES
-- ============================================

-- Driver status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'driver_status') THEN
        CREATE TYPE driver_status AS ENUM (
            'pending_verification', 
            'active', 
            'suspended', 
            'inactive'
        );
    END IF;
END$$;

-- Fleet manager role enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fleet_manager_role') THEN
        CREATE TYPE fleet_manager_role AS ENUM (
            'super_admin', 
            'fleet_manager'
        );
    END IF;
END$$;

-- Document type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM (
            'id_card', 
            'driving_license', 
            'vehicle_registration', 
            'insurance', 
            'background_check', 
            'contract'
        );
    END IF;
END$$;

-- Document verification status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM (
            'pending', 
            'approved', 
            'rejected', 
            'expired'
        );
    END IF;
END$$;

-- Vehicle type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type_fleet') THEN
        CREATE TYPE vehicle_type_fleet AS ENUM (
            'motorcycle', 
            'car', 
            'bicycle', 
            'van'
        );
    END IF;
END$$;

-- Vehicle status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
        CREATE TYPE vehicle_status AS ENUM (
            'available', 
            'assigned', 
            'maintenance', 
            'retired'
        );
    END IF;
END$$;

-- Payout status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM (
            'pending', 
            'processing', 
            'paid', 
            'failed'
        );
    END IF;
END$$;

-- Driver activity type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'driver_activity_type') THEN
        CREATE TYPE driver_activity_type AS ENUM (
            'login', 
            'logout', 
            'status_change', 
            'order_assigned', 
            'order_accepted', 
            'order_completed', 
            'location_update',
            'document_uploaded', 
            'verification_status_change'
        );
    END IF;
END$$;

-- ============================================
-- CITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Qatar',
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'Asia/Qatar',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cities IS 'Cities where fleet operations are managed';

CREATE INDEX IF NOT EXISTS idx_cities_active ON cities(is_active);

-- ============================================
-- FLEET MANAGERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role fleet_manager_role NOT NULL DEFAULT 'fleet_manager',
  assigned_city_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fleet_managers IS 'Fleet managers who oversee drivers and operations';

CREATE INDEX IF NOT EXISTS idx_fleet_managers_auth ON fleet_managers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_fleet_managers_role ON fleet_managers(role);
CREATE INDEX IF NOT EXISTS idx_fleet_managers_cities ON fleet_managers USING GIN(assigned_city_ids);

-- ============================================
-- ZONES TABLE (Within Cities)
-- ============================================
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  polygon GEOGRAPHY(POLYGON, 4326), -- GeoJSON polygon for zone boundaries
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE zones IS 'Delivery zones within cities for driver assignments';

CREATE INDEX IF NOT EXISTS idx_zones_city ON zones(city_id);
CREATE INDEX IF NOT EXISTS idx_zones_polygon ON zones USING GIST(polygon);

-- ============================================
-- DRIVERS TABLE (Enhanced from existing)
-- ============================================
-- Note: The drivers table already exists in the database.
-- This section adds new columns if they don't exist.
DO $$
BEGIN
    -- Add city_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'drivers' AND column_name = 'city_id') THEN
        ALTER TABLE drivers ADD COLUMN city_id UUID REFERENCES cities(id);
    END IF;

    -- Add assigned_zone_ids column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'drivers' AND column_name = 'assigned_zone_ids') THEN
        ALTER TABLE drivers ADD COLUMN assigned_zone_ids UUID[] DEFAULT '{}';
    END IF;

    -- Add status column (using driver_status enum) if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'drivers' AND column_name = 'fleet_status') THEN
        ALTER TABLE drivers ADD COLUMN fleet_status driver_status DEFAULT 'pending_verification';
    END IF;

    -- Add cancellation_rate column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'drivers' AND column_name = 'cancellation_rate') THEN
        ALTER TABLE drivers ADD COLUMN cancellation_rate DECIMAL(5, 2) DEFAULT 0.00;
    END IF;

    -- Add profile_photo_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'drivers' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE drivers ADD COLUMN profile_photo_url TEXT;
    END IF;

    -- Add id_document_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'drivers' AND column_name = 'id_document_url') THEN
        ALTER TABLE drivers ADD COLUMN id_document_url TEXT;
    END IF;

    -- Add license_document_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'drivers' AND column_name = 'license_document_url') THEN
        ALTER TABLE drivers ADD COLUMN license_document_url TEXT;
    END IF;
END$$;

-- Create indexes for new driver columns
CREATE INDEX IF NOT EXISTS idx_drivers_city ON drivers(city_id);
CREATE INDEX IF NOT EXISTS idx_drivers_zones ON drivers USING GIN(assigned_zone_ids);

-- ============================================
-- DRIVER LOCATIONS TABLE (History)
-- ============================================
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(8, 2), -- GPS accuracy in meters
  speed DECIMAL(6, 2), -- Speed in km/h
  heading DECIMAL(5, 2), -- Direction in degrees
  battery_level INTEGER, -- Device battery percentage
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE driver_locations IS 'Historical location tracking for drivers';

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_time ON driver_locations(recorded_at);
CREATE INDEX IF NOT EXISTS idx_driver_locations_geo ON driver_locations USING GIST(
  ll_to_earth(latitude, longitude)
);

-- ============================================
-- VEHICLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id),
  
  -- Vehicle details
  type vehicle_type_fleet NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  color VARCHAR(50),
  
  -- Registration
  plate_number VARCHAR(50) UNIQUE NOT NULL,
  registration_number VARCHAR(100),
  
  -- Insurance
  insurance_provider VARCHAR(100),
  insurance_expiry DATE,
  insurance_document_url TEXT,
  
  -- Status
  status vehicle_status DEFAULT 'available',
  assigned_driver_id UUID REFERENCES drivers(id),
  
  -- Documents
  vehicle_photo_url TEXT,
  registration_document_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vehicles IS 'Fleet vehicles assigned to drivers';

CREATE INDEX IF NOT EXISTS idx_vehicles_city ON vehicles(city_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver ON vehicles(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_expiry ON vehicles(insurance_expiry) 
  WHERE insurance_expiry <= CURRENT_DATE + INTERVAL '30 days';

-- ============================================
-- DRIVER DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  document_url TEXT NOT NULL,
  verification_status verification_status DEFAULT 'pending',
  rejection_reason TEXT,
  expiry_date DATE,
  verified_by UUID REFERENCES fleet_managers(id),
  verified_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE driver_documents IS 'Driver document uploads and verification status';

CREATE INDEX IF NOT EXISTS idx_driver_docs_driver ON driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_docs_status ON driver_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_driver_docs_expiry ON driver_documents(expiry_date) 
  WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days';

-- ============================================
-- DRIVER ZONES TABLE (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS driver_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1, -- Higher = preferred zone
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id, zone_id)
);

COMMENT ON TABLE driver_zones IS 'Many-to-many relationship between drivers and zones';

CREATE INDEX IF NOT EXISTS idx_driver_zones_driver ON driver_zones(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_zones_zone ON driver_zones(zone_id);

-- ============================================
-- DRIVER PAYOUTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  city_id UUID NOT NULL REFERENCES cities(id),
  
  -- Payout period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Amounts
  base_earnings DECIMAL(10, 2) NOT NULL DEFAULT 0,
  bonus_amount DECIMAL(10, 2) DEFAULT 0,
  penalty_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  
  -- Status
  status payout_status DEFAULT 'pending',
  
  -- Payment details
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES fleet_managers(id),
  
  -- Metadata
  notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES fleet_managers(id),
  
  -- Idempotency
  idempotency_key VARCHAR(255) UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE driver_payouts IS 'Driver earnings and payout records';

CREATE INDEX IF NOT EXISTS idx_payouts_driver ON driver_payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_payouts_city ON driver_payouts(city_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON driver_payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_period ON driver_payouts(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payouts_idempotency ON driver_payouts(idempotency_key);

-- ============================================
-- DRIVER ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  activity_type driver_activity_type NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE driver_activity_logs IS 'Audit log of driver activities';

CREATE INDEX IF NOT EXISTS idx_activity_logs_driver ON driver_activity_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON driver_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_time ON driver_activity_logs(created_at);

-- ============================================
-- FLEET ACTIVITY LOGS TABLE (Manager Actions)
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES fleet_managers(id),
  city_id UUID REFERENCES cities(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'driver', 'vehicle', 'payout', etc.
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fleet_activity_logs IS 'Audit log of fleet manager actions';

CREATE INDEX IF NOT EXISTS idx_fleet_logs_manager ON fleet_activity_logs(manager_id);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_city ON fleet_activity_logs(city_id);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_action ON fleet_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_entity ON fleet_activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_time ON fleet_activity_logs(created_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at
DO $$
BEGIN
    -- cities
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_cities_updated_at') THEN
        CREATE TRIGGER tr_cities_updated_at
        BEFORE UPDATE ON cities
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- fleet_managers
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_fleet_managers_updated_at') THEN
        CREATE TRIGGER tr_fleet_managers_updated_at
        BEFORE UPDATE ON fleet_managers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- zones
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_zones_updated_at') THEN
        CREATE TRIGGER tr_zones_updated_at
        BEFORE UPDATE ON zones
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- drivers (only if updated_at column exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'drivers' AND column_name = 'updated_at') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_drivers_updated_at') THEN
            CREATE TRIGGER tr_drivers_updated_at
            BEFORE UPDATE ON drivers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END IF;

    -- vehicles
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_vehicles_updated_at') THEN
        CREATE TRIGGER tr_vehicles_updated_at
        BEFORE UPDATE ON vehicles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- driver_documents
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_driver_documents_updated_at') THEN
        CREATE TRIGGER tr_driver_documents_updated_at
        BEFORE UPDATE ON driver_documents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- driver_payouts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_driver_payouts_updated_at') THEN
        CREATE TRIGGER tr_driver_payouts_updated_at
        BEFORE UPDATE ON driver_payouts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- ============================================
-- DUPLICATE PAYOUT PREVENTION TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION prevent_duplicate_payout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM driver_payouts
      WHERE idempotency_key = NEW.idempotency_key
      AND status IN ('pending', 'processing', 'paid')
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Duplicate payout detected with idempotency key: %', NEW.idempotency_key;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_prevent_duplicate_payout') THEN
        CREATE TRIGGER tr_prevent_duplicate_payout
        BEFORE INSERT OR UPDATE ON driver_payouts
        FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_payout();
    END IF;
END$$;

-- ============================================
-- RLS POLICIES FOR CITY-BASED ISOLATION
-- ============================================

-- Enable RLS on all fleet tables
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is a fleet manager for a specific city
CREATE OR REPLACE FUNCTION is_fleet_manager_for_city(check_city_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
    AND fm.is_active = true
    AND (
      fm.role = 'super_admin'
      OR check_city_id = ANY(fm.assigned_city_ids)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is a super admin
CREATE OR REPLACE FUNCTION is_fleet_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM fleet_managers fm
    WHERE fm.auth_user_id = auth.uid()
    AND fm.is_active = true
    AND fm.role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cities: Super admins can manage all cities
CREATE POLICY cities_super_admin_all ON cities
  FOR ALL
  USING (is_fleet_super_admin());

-- Cities: Fleet managers can view their assigned cities
CREATE POLICY cities_fleet_manager_view ON cities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fleet_managers fm
      WHERE fm.auth_user_id = auth.uid()
      AND fm.is_active = true
      AND cities.id = ANY(fm.assigned_city_ids)
    )
  );

-- Fleet Managers: Super admins can manage all fleet managers
CREATE POLICY fleet_managers_super_admin_all ON fleet_managers
  FOR ALL
  USING (is_fleet_super_admin());

-- Fleet Managers: Managers can view their own record
CREATE POLICY fleet_managers_self_view ON fleet_managers
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Zones: Fleet managers can only see zones in their cities
CREATE POLICY zones_fleet_manager_access ON zones
  FOR ALL
  USING (is_fleet_manager_for_city(city_id));

-- Vehicles: Fleet managers can only see vehicles in their cities
CREATE POLICY vehicles_fleet_manager_access ON vehicles
  FOR ALL
  USING (is_fleet_manager_for_city(city_id));

-- Driver Documents: Fleet managers can see documents for drivers in their cities
CREATE POLICY driver_docs_fleet_manager_access ON driver_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_documents.driver_id
      AND is_fleet_manager_for_city(d.city_id)
    )
  );

-- Driver Zones: Fleet managers can see zones for drivers in their cities
CREATE POLICY driver_zones_fleet_manager_access ON driver_zones
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_zones.driver_id
      AND is_fleet_manager_for_city(d.city_id)
    )
  );

-- Driver Payouts: Fleet managers can see payouts for drivers in their cities
CREATE POLICY driver_payouts_fleet_manager_access ON driver_payouts
  FOR ALL
  USING (is_fleet_manager_for_city(city_id));

-- Driver Activity Logs: Fleet managers can see logs for drivers in their cities
CREATE POLICY driver_activity_logs_fleet_manager_access ON driver_activity_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_activity_logs.driver_id
      AND is_fleet_manager_for_city(d.city_id)
    )
  );

-- Fleet Activity Logs: Fleet managers can see logs for their cities
CREATE POLICY fleet_activity_logs_fleet_manager_access ON fleet_activity_logs
  FOR ALL
  USING (
    city_id IS NULL OR is_fleet_manager_for_city(city_id)
  );

-- ============================================
-- DRIVER ACCESS POLICIES (Self-access)
-- ============================================

-- Drivers can see their own zones
CREATE POLICY driver_zones_self_access ON driver_zones
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_zones.driver_id
      AND d.user_id = auth.uid()
    )
  );

-- Drivers can see their own documents
CREATE POLICY driver_documents_self_access ON driver_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_documents.driver_id
      AND d.user_id = auth.uid()
    )
  );

-- Drivers can see their own payouts
CREATE POLICY driver_payouts_self_access ON driver_payouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_payouts.driver_id
      AND d.user_id = auth.uid()
    )
  );

-- Drivers can see their own activity logs
CREATE POLICY driver_activity_logs_self_access ON driver_activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_activity_logs.driver_id
      AND d.user_id = auth.uid()
    )
  );

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert Qatar cities if they don't exist
INSERT INTO cities (name, name_ar, country, latitude, longitude, timezone, is_active)
VALUES 
  ('Doha', 'الدوحة', 'Qatar', 25.2854, 51.5310, 'Asia/Qatar', true),
  ('Al Rayyan', 'الريان', 'Qatar', 25.2919, 51.4244, 'Asia/Qatar', true),
  ('Al Wakrah', 'الوكرة', 'Qatar', 25.1657, 51.5976, 'Asia/Qatar', true),
  ('Al Khor', 'الخور', 'Qatar', 25.6804, 51.4969, 'Asia/Qatar', true),
  ('Umm Salal', 'أم صلال', 'Qatar', 25.4697, 51.4033, 'Asia/Qatar', true),
  ('Al Shamal', 'الشمال', 'Qatar', 26.1154, 51.2247, 'Asia/Qatar', true)
ON CONFLICT DO NOTHING;
