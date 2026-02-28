# Fleet Management Portal - System Design Document

## Executive Summary

This document provides a comprehensive architectural design for the Fleet Management Portal, a separate management interface for fleet managers to oversee drivers, vehicles, and deliveries across multiple cities with real-time GPS tracking capabilities.

---

## 1. HIGH-LEVEL ARCHITECTURE

### 1.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Fleet Web App   │  │ Driver Mobile   │  │ Admin Dashboard │             │
│  │ (React)         │  │ App (Capacitor) │  │ (Existing)      │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└───────────┼────────────────────┼────────────────────┼──────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Kong/AWS API Gateway                             │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │ Rate Limit   │  │ Auth/JWT     │  │ Request      │              │    │
│  │  │              │  │ Validation   │  │ Routing      │              │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Fleet Management Service                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │ Driver Mgmt  │  │ Vehicle Mgmt │  │ Payout Mgmt  │              │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Realtime Tracking Service                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │ WebSocket    │  │ Location     │  │ Broadcast    │              │    │
│  │  │ Server       │  │ Processor    │  │ Manager      │              │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Core Supabase Services                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │ Auth Service │  │ Edge Funcs   │  │ Storage      │              │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │   PostgreSQL     │  │     Redis        │  │   S3 Storage     │          │
│  │  (Supabase)      │  │  (Upstash/AWS)   │  │  (Documents)     │          │
│  │                  │  │                  │  │                  │          │
│  │ • Fleet Mgrs     │  │ • Live Locations │  │ • Driver Docs    │          │
│  │ • Drivers        │  │ • Session Cache  │  │ • Vehicle Images │          │
│  │ • Vehicles       │  │ • Rate Limiting  │  │                  │          │
│  │ • Cities         │  │                  │  │                  │          │
│  │ • Payouts        │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Service Communication Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                              │
└────────────────────────────────────────────────────────────────────┘

Fleet Manager          API Gateway          Fleet Service          Supabase
     │                      │                      │                   │
     │── POST /fleet/login ─>│                      │                   │
     │                      │── Validate Creds ───>│                   │
     │                      │                      │── Check Role ────>│
     │                      │                      │<─ Fleet Manager ──│
     │                      │<─ JWT Token ─────────│                   │
     │<─ Token + Cities ────│                      │                   │
     │                      │                      │                   │
     │── GET /drivers ─────>│                      │                   │
     │                      │── Validate JWT ─────>│                   │
     │                      │                      │── Filter by City ─>│
     │                      │                      │<─ Driver Data ────│
     │<─ Driver List ───────│                      │                   │

┌────────────────────────────────────────────────────────────────────┐
│                    REALTIME TRACKING FLOW                           │
└────────────────────────────────────────────────────────────────────┘

Driver App         WebSocket Server         Redis          Fleet Dashboard
    │                      │                    │                  │
    │── Connect WS ───────>│                    │                  │
    │                      │── Store Session ──>│                  │
    │<─ Connection OK ─────│                    │                  │
    │                      │                    │                  │
    │── Location Update ──>│                    │                  │
    │                      │── Cache Location ─>│                  │
    │                      │── Broadcast ──────────────────────────>│
    │                      │                    │                  │
    │── Heartbeat ────────>│                    │                  │
    │                      │── Update TTL ────>│                  │
```

### 1.3 Multi-Tenant City Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MULTI-CITY DATA ISOLATION                        │
└─────────────────────────────────────────────────────────────────────┘

Super Admin (Global Access)
         │
         ├──────────────────────────────────────────────┐
         │                                              │
         ▼                                              ▼
┌─────────────────────┐                    ┌─────────────────────┐
│   DOHA FLEET        │                    │   AL RAYYAN FLEET   │
│   Manager: Ahmed    │                    │   Manager: Sara     │
├─────────────────────┤                    ├─────────────────────┤
│ • Drivers: 45       │                    │ • Drivers: 23       │
│ • Active: 38        │                    │ • Active: 19        │
│ • Orders: 156/day   │                    │ • Orders: 89/day    │
│ • Zones: 6          │                    │ • Zones: 4          │
└─────────────────────┘                    └─────────────────────┘
         │                                              │
         │    CITY_ID = Data Isolation Boundary         │
         │                                              │
         ▼                                              ▼
┌─────────────────────┐                    ┌─────────────────────┐
│ Database Filter:    │                    │ Database Filter:    │
│ city_id = 'doha'    │                    │ city_id = 'rayyan'  │
└─────────────────────┘                    └─────────────────────┘
```

### 1.4 Component Responsibilities

| Component | Responsibility | Tech Stack |
|-----------|---------------|------------|
| **Fleet Web App** | Management interface for fleet managers | React, TypeScript, Tailwind, Mapbox |
| **Driver Mobile App** | GPS tracking, order updates | Capacitor, React Native APIs |
| **API Gateway** | Rate limiting, auth, routing | Kong / AWS API Gateway |
| **Fleet Service** | Business logic for fleet operations | Supabase Edge Functions (Deno) |
| **Realtime Service** | WebSocket handling, location broadcasting | Custom Node.js / Socket.io |
| **Redis** | Live location cache, session store | Upstash / AWS ElastiCache |
| **PostgreSQL** | Persistent data storage | Supabase |

---

## 2. DATABASE SCHEMA DESIGN

### 2.1 Core Tables

```sql
-- ============================================
-- CITIES TABLE
-- ============================================
CREATE TABLE cities (
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

CREATE INDEX idx_cities_active ON cities(is_active);

-- ============================================
-- FLEET MANAGERS TABLE
-- ============================================
CREATE TABLE fleet_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'fleet_manager')),
  assigned_city_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fleet_managers_auth ON fleet_managers(auth_user_id);
CREATE INDEX idx_fleet_managers_role ON fleet_managers(role);
CREATE INDEX idx_fleet_managers_cities ON fleet_managers USING GIN(assigned_city_ids);

-- ============================================
-- ZONES TABLE (Within Cities)
-- ============================================
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  polygon GEOGRAPHY(POLYGON, 4326), -- GeoJSON polygon for zone boundaries
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_zones_city ON zones(city_id);
CREATE INDEX idx_zones_polygon ON zones USING GIST(polygon);

-- ============================================
-- DRIVERS TABLE (Enhanced from existing)
-- ============================================
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  city_id UUID NOT NULL REFERENCES cities(id),
  assigned_zone_ids UUID[] DEFAULT '{}',
  
  -- Status: pending_verification, active, suspended, inactive
  status VARCHAR(50) DEFAULT 'pending_verification',
  
  -- Location tracking
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  location_updated_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT false,
  
  -- Performance metrics
  total_deliveries INTEGER DEFAULT 0,
  rating DECIMAL(2, 1) DEFAULT 5.0 CHECK (rating >= 1.0 AND rating <= 5.0),
  cancellation_rate DECIMAL(5, 2) DEFAULT 0.00,
  
  -- Financial
  current_balance DECIMAL(10, 2) DEFAULT 0.00,
  total_earnings DECIMAL(10, 2) DEFAULT 0.00,
  
  -- Vehicle assignment
  assigned_vehicle_id UUID,
  
  -- Documents
  profile_photo_url TEXT,
  id_document_url TEXT,
  license_document_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drivers_city ON drivers(city_id);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_online ON drivers(is_online) WHERE is_online = true;
CREATE INDEX idx_drivers_location ON drivers USING GIST(
  ll_to_earth(current_latitude, current_longitude)
) WHERE current_latitude IS NOT NULL;

-- ============================================
-- DRIVER LOCATIONS TABLE (History)
-- ============================================
CREATE TABLE driver_locations (
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

-- Partition by time for performance (monthly partitions)
CREATE INDEX idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_time ON driver_locations(recorded_at);

-- Create hypertable for TimescaleDB (if available)
-- SELECT create_hypertable('driver_locations', 'recorded_at');

-- ============================================
-- VEHICLES TABLE
-- ============================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id),
  
  -- Vehicle details
  type VARCHAR(50) NOT NULL CHECK (type IN ('motorcycle', 'car', 'bicycle', 'van')),
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
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'retired')),
  assigned_driver_id UUID REFERENCES drivers(id),
  
  -- Documents
  vehicle_photo_url TEXT,
  registration_document_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vehicles_city ON vehicles(city_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_driver ON vehicles(assigned_driver_id);
CREATE INDEX idx_vehicles_insurance_expiry ON vehicles(insurance_expiry) 
  WHERE insurance_expiry <= CURRENT_DATE + INTERVAL '30 days';

-- ============================================
-- DRIVER DOCUMENTS TABLE
-- ============================================
CREATE TABLE driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'id_card', 'driving_license', 'vehicle_registration', 
    'insurance', 'background_check', 'contract'
  )),
  document_url TEXT NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'approved', 'rejected', 'expired'
  )),
  rejection_reason TEXT,
  expiry_date DATE,
  verified_by UUID REFERENCES fleet_managers(id),
  verified_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_driver_docs_driver ON driver_documents(driver_id);
CREATE INDEX idx_driver_docs_status ON driver_documents(verification_status);
CREATE INDEX idx_driver_docs_expiry ON driver_documents(expiry_date) 
  WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days';

-- ============================================
-- DRIVER ZONES TABLE (Many-to-Many)
-- ============================================
CREATE TABLE driver_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1, -- Higher = preferred zone
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id, zone_id)
);

CREATE INDEX idx_driver_zones_driver ON driver_zones(driver_id);
CREATE INDEX idx_driver_zones_zone ON driver_zones(zone_id);

-- ============================================
-- DRIVER PAYOUTS TABLE
-- ============================================
CREATE TABLE driver_payouts (
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
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  
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

CREATE INDEX idx_payouts_driver ON driver_payouts(driver_id);
CREATE INDEX idx_payouts_city ON driver_payouts(city_id);
CREATE INDEX idx_payouts_status ON driver_payouts(status);
CREATE INDEX idx_payouts_period ON driver_payouts(period_start, period_end);
CREATE INDEX idx_payouts_idempotency ON driver_payouts(idempotency_key);

-- ============================================
-- DRIVER ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE driver_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'login', 'logout', 'status_change', 'order_assigned', 
    'order_accepted', 'order_completed', 'location_update',
    'document_uploaded', 'verification_status_change'
  )),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_driver ON driver_activity_logs(driver_id);
CREATE INDEX idx_activity_logs_type ON driver_activity_logs(activity_type);
CREATE INDEX idx_activity_logs_time ON driver_activity_logs(created_at);

-- ============================================
-- FLEET ACTIVITY LOGS TABLE (Manager Actions)
-- ============================================
CREATE TABLE fleet_activity_logs (
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

CREATE INDEX idx_fleet_logs_manager ON fleet_activity_logs(manager_id);
CREATE INDEX idx_fleet_logs_city ON fleet_activity_logs(city_id);
CREATE INDEX idx_fleet_logs_action ON fleet_activity_logs(action);
CREATE INDEX idx_fleet_logs_entity ON fleet_activity_logs(entity_type, entity_id);
CREATE INDEX idx_fleet_logs_time ON fleet_activity_logs(created_at);
```

### 2.2 Database Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE ENTITY RELATIONSHIPS                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   CITIES     │       │    ZONES     │       │   VEHICLES   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │◄──────│ city_id (FK) │       │ city_id (FK) │
│ name         │       │ name         │       │ type         │
│ ...          │       │ polygon      │       │ plate_number │
└──────┬───────┘       └──────┬───────┘       │ status       │
       │                      │               │ driver_id(FK)│
       │                      │               └──────┬───────┘
       │                      │                      │
       │         ┌────────────┴────────────┐         │
       │         │                         │         │
       │    ┌────▼────┐              ┌──────▼──────┐  │
       │    │DRIVER_  │              │ DRIVER_     │  │
       │    │ZONES    │              │ DOCUMENTS   │  │
       │    └────┬────┘              └─────────────┘  │
       │         │                                     │
       │    ┌────▼────┐                                │
       └───►│ DRIVERS │◄───────────────────────────────┘
            ├─────────┤
            │ id (PK) │◄──────────────────────────────────────────┐
            │ city_id │                                           │
            │ status  │                                           │
            │ current_│                                           │
            │  _lat   │                                           │
            │  _lng   │                                           │
            │ vehicle_│                                           │
            │  _id(FK)│                                           │
            └────┬────┘                                           │
                 │                                                 │
        ┌────────┴────────┬──────────────────┐                    │
        │                 │                  │                    │
   ┌────▼─────┐    ┌──────▼──────┐   ┌───────▼────────┐   ┌──────▼────────┐
   │DRIVER_   │    │DRIVER_      │   │DRIVER_PAYOUTS  │   │FLEET_ACTIVITY │
   │LOCATIONS │    │ACTIVITY_LOGS│   ├────────────────┤   │_LOGS          │
   ├──────────┤    ├─────────────┤   │ id (PK)        │   ├────────────────┤
   │ driver_id│    │ driver_id   │   │ driver_id (FK) │   │ manager_id(FK) │
   │ lat      │    │ activity_   │   │ city_id (FK)   │   │ city_id (FK)   │
   │ lng      │    │  _type      │   │ total_amount   │   │ action         │
   │ speed    │    │ details     │   │ status         │   │ entity_type    │
   └──────────┘    └─────────────┘   │ idempotency_key│   └────────────────┘
                                     └────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLEET_MANAGERS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (PK)                                                                     │
│ auth_user_id (FK) → auth.users                                              │
│ role: 'super_admin' | 'fleet_manager'                                       │
│ assigned_city_ids: UUID[]                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Row Level Security (RLS) Policies

```sql
-- ============================================
-- RLS POLICIES FOR MULTI-CITY ISOLATION
-- ============================================

-- Enable RLS on all tables
ALTER TABLE fleet_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Fleet managers can only see their assigned cities
CREATE POLICY fleet_manager_city_isolation ON drivers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fleet_managers fm
      WHERE fm.auth_user_id = auth.uid()
      AND (
        fm.role = 'super_admin'
        OR drivers.city_id = ANY(fm.assigned_city_ids)
      )
    )
  );

-- Policy: Drivers can only see their own data
CREATE POLICY driver_self_access ON drivers
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM drivers d WHERE d.id = drivers.id
    )
  );

-- Policy: Fleet managers can only manage vehicles in their cities
CREATE POLICY fleet_vehicle_access ON vehicles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fleet_managers fm
      WHERE fm.auth_user_id = auth.uid()
      AND (
        fm.role = 'super_admin'
        OR vehicles.city_id = ANY(fm.assigned_city_ids)
      )
    )
  );

-- Policy: Prevent double payout with idempotency check
CREATE OR REPLACE FUNCTION prevent_duplicate_payout()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM driver_payouts
    WHERE idempotency_key = NEW.idempotency_key
    AND status IN ('pending', 'processing', 'paid')
  ) THEN
    RAISE EXCEPTION 'Duplicate payout detected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_duplicate_payout
  BEFORE INSERT ON driver_payouts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_payout();
```

---

## 3. BACKEND API DESIGN

### 3.1 REST API Structure

```yaml
# ==========================================
# FLEET MANAGEMENT API SPECIFICATION
# ==========================================

openapi: 3.0.0
info:
  title: Fleet Management API
  version: 1.0.0
  description: API for managing fleet operations across multiple cities

servers:
  - url: https://api.nutriofuel.com/fleet
    description: Production server

security:
  - BearerAuth: []

paths:
  # ==========================================
  # AUTHENTICATION
  # ==========================================
  /auth/login:
    post:
      summary: Fleet Manager Login
      security: []  # Public endpoint
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string, format: email }
                password: { type: string, minLength: 8 }
      responses:
        200:
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  token: { type: string }
                  refreshToken: { type: string }
                  user:
                    type: object
                    properties:
                      id: { type: string }
                      email: { type: string }
                      fullName: { type: string }
                      role: { type: string, enum: [super_admin, fleet_manager] }
                      assignedCities: { type: array, items: { type: string } }

  /auth/refresh:
    post:
      summary: Refresh Access Token
      security: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [refreshToken]
              properties:
                refreshToken: { type: string }

  /auth/logout:
    post:
      summary: Logout
      responses:
        200:
          description: Logout successful

  # ==========================================
  # FLEET DASHBOARD
  # ==========================================
  /dashboard:
    get:
      summary: Get Fleet Dashboard Data
      parameters:
        - name: cityId
          in: query
          schema: { type: string }
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  totalDrivers: { type: integer }
                  activeDrivers: { type: integer }
                  onlineDrivers: { type: integer }
                  ordersInProgress: { type: integer }
                  todayDeliveries: { type: integer }
                  averageDeliveryTime: { type: number }
                  cityFilter:
                    type: array
                    items:
                      type: object
                      properties:
                        id: { type: string }
                        name: { type: string }
                        driverCount: { type: integer }

  # ==========================================
  # DRIVER MANAGEMENT
  # ==========================================
  /drivers:
    get:
      summary: List Drivers
      parameters:
        - name: cityId
          in: query
          schema: { type: string }
        - name: status
          in: query
          schema: { type: string, enum: [pending_verification, active, suspended, inactive] }
        - name: zoneId
          in: query
          schema: { type: string }
        - name: isOnline
          in: query
          schema: { type: boolean }
        - name: search
          in: query
          schema: { type: string }
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/Driver' }
                  pagination:
                    type: object
                    properties:
                      page: { type: integer }
                      limit: { type: integer }
                      total: { type: integer }
                      totalPages: { type: integer }

    post:
      summary: Create New Driver
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [email, phone, fullName, cityId]
              properties:
                email: { type: string }
                phone: { type: string }
                fullName: { type: string }
                cityId: { type: string }
                zoneIds: { type: array, items: { type: string } }
      responses:
        201:
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Driver' }

  /drivers/{id}:
    get:
      summary: Get Driver Details
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        200:
          content:
            application/json:
              schema:
                allOf:
                  - { $ref: '#/components/schemas/Driver' }
                  - type: object
                    properties:
                      documents: { type: array, items: { $ref: '#/components/schemas/Document' } }
                      vehicle: { $ref: '#/components/schemas/Vehicle' }
                      recentActivity: { type: array, items: { $ref: '#/components/schemas/ActivityLog' } }
                      earnings:
                        type: object
                        properties:
                          total: { type: number }
                          thisMonth: { type: number }
                          pendingPayout: { type: number }

    put:
      summary: Update Driver
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                fullName: { type: string }
                phone: { type: string }
                cityId: { type: string }
                zoneIds: { type: array, items: { type: string } }
                assignedVehicleId: { type: string }

    delete:
      summary: Delete Driver (Soft delete)
      responses:
        204:
          description: Driver deleted

  /drivers/{id}/status:
    patch:
      summary: Update Driver Status
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [status]
              properties:
                status: { type: string, enum: [pending_verification, active, suspended, inactive] }
                reason: { type: string }
      responses:
        200:
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Driver' }

  /drivers/{id}/documents:
    post:
      summary: Upload Driver Document
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                documentType: { type: string }
                file: { type: string, format: binary }
                expiryDate: { type: string, format: date }
    get:
      summary: List Driver Documents
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/Document' }

  /drivers/{id}/location:
    get:
      summary: Get Driver Current Location
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  latitude: { type: number }
                  longitude: { type: number }
                  accuracy: { type: number }
                  lastUpdated: { type: string, format: date-time }
                  isOnline: { type: boolean }

  /drivers/{id}/performance:
    get:
      summary: Get Driver Performance Metrics
      parameters:
        - name: period
          in: query
          schema: { type: string, enum: [7d, 30d, 90d], default: 30d }
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  totalDeliveries: { type: integer }
                  completedDeliveries: { type: integer }
                  cancelledDeliveries: { type: integer }
                  averageRating: { type: number }
                  averageDeliveryTime: { type: number }
                  onTimeRate: { type: number }
                  earnings: { type: number }

  # ==========================================
  # VEHICLE MANAGEMENT
  # ==========================================
  /vehicles:
    get:
      summary: List Vehicles
      parameters:
        - name: cityId
          in: query
          schema: { type: string }
        - name: status
          in: query
          schema: { type: string }
        - name: type
          in: query
          schema: { type: string }
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/Vehicle' }

    post:
      summary: Create Vehicle
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [cityId, type, plateNumber]
              properties:
                cityId: { type: string }
                type: { type: string, enum: [motorcycle, car, bicycle, van] }
                make: { type: string }
                model: { type: string }
                year: { type: integer }
                color: { type: string }
                plateNumber: { type: string }
                insuranceExpiry: { type: string, format: date }

  /vehicles/{id}:
    get:
      summary: Get Vehicle Details
      responses:
        200:
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Vehicle' }

    put:
      summary: Update Vehicle
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                make: { type: string }
                model: { type: string }
                status: { type: string }
                assignedDriverId: { type: string }
                insuranceExpiry: { type: string, format: date }

  /vehicles/{id}/assign:
    post:
      summary: Assign Vehicle to Driver
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [driverId]
              properties:
                driverId: { type: string }

  # ==========================================
  # PAYOUT MANAGEMENT
  # ==========================================
  /payouts:
    get:
      summary: List Payouts
      parameters:
        - name: cityId
          in: query
          schema: { type: string }
        - name: driverId
          in: query
          schema: { type: string }
        - name: status
          in: query
          schema: { type: string }
        - name: startDate
          in: query
          schema: { type: string, format: date }
        - name: endDate
          in: query
          schema: { type: string, format: date }
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/Payout' }
                  summary:
                    type: object
                    properties:
                      totalAmount: { type: number }
                      pendingAmount: { type: number }
                      paidAmount: { type: number }
                      driverCount: { type: integer }

    post:
      summary: Process Payout
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [driverId, periodStart, periodEnd, totalAmount]
              properties:
                driverId: { type: string }
                periodStart: { type: string, format: date }
                periodEnd: { type: string, format: date }
                baseEarnings: { type: number }
                bonusAmount: { type: number }
                penaltyAmount: { type: number }
                totalAmount: { type: number }
                notes: { type: string }
                idempotencyKey: { type: string }
      responses:
        201:
          description: Payout created
        409:
          description: Duplicate payout detected

  /payouts/{id}/process:
    post:
      summary: Mark Payout as Paid
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                paymentMethod: { type: string }
                paymentReference: { type: string }
                notes: { type: string }
      responses:
        200:
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Payout' }

  /payouts/bulk:
    post:
      summary: Process Bulk Payouts
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [cityId, periodStart, periodEnd]
              properties:
                cityId: { type: string }
                periodStart: { type: string, format: date }
                periodEnd: { type: string, format: date }
                driverIds: { type: array, items: { type: string } }
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  processed: { type: integer }
                  failed: { type: integer }
                  payouts: { type: array, items: { $ref: '#/components/schemas/Payout' } }

  # ==========================================
  # CITIES & ZONES
  # ==========================================
  /cities:
    get:
      summary: List Cities (Accessible to Manager)
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id: { type: string }
                    name: { type: string }
                    nameAr: { type: string }
                    driverCount: { type: integer }
                    activeDriverCount: { type: integer }

  /cities/{id}/zones:
    get:
      summary: List Zones in City
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id: { type: string }
                    name: { type: string }
                    nameAr: { type: string }
                    driverCount: { type: integer }

  # ==========================================
  # TRACKING
  # ==========================================
  /tracking/drivers:
    get:
      summary: Get All Online Drivers Locations
      parameters:
        - name: cityId
          in: query
          schema: { type: string }
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    driverId: { type: string }
                    driverName: { type: string }
                    latitude: { type: number }
                    longitude: { type: number }
                    isOnline: { type: boolean }
                    lastUpdated: { type: string, format: date-time }
                    currentOrderId: { type: string }

  /tracking/drivers/{id}/history:
    get:
      summary: Get Driver Location History
      parameters:
        - name: startTime
          in: query
          required: true
          schema: { type: string, format: date-time }
        - name: endTime
          in: query
          required: true
          schema: { type: string, format: date-time }
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    latitude: { type: number }
                    longitude: { type: number }
                    speed: { type: number }
                    recordedAt: { type: string, format: date-time }

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Driver:
      type: object
      properties:
        id: { type: string }
        email: { type: string }
        phone: { type: string }
        fullName: { type: string }
        cityId: { type: string }
        cityName: { type: string }
        status: { type: string }
        isOnline: { type: boolean }
        currentLatitude: { type: number }
        currentLongitude: { type: number }
        totalDeliveries: { type: integer }
        rating: { type: number }
        currentBalance: { type: number }
        assignedVehicleId: { type: string }
        createdAt: { type: string, format: date-time }

    Vehicle:
      type: object
      properties:
        id: { type: string }
        type: { type: string }
        make: { type: string }
        model: { type: string }
        year: { type: integer }
        color: { type: string }
        plateNumber: { type: string }
        status: { type: string }
        assignedDriverId: { type: string }
        assignedDriverName: { type: string }
        insuranceExpiry: { type: string, format: date }
        daysUntilInsuranceExpiry: { type: integer }

    Payout:
      type: object
      properties:
        id: { type: string }
        driverId: { type: string }
        driverName: { type: string }
        periodStart: { type: string, format: date }
        periodEnd: { type: string, format: date }
        baseEarnings: { type: number }
        bonusAmount: { type: number }
        penaltyAmount: { type: number }
        totalAmount: { type: number }
        status: { type: string }
        paymentMethod: { type: string }
        paymentReference: { type: string }
        paidAt: { type: string, format: date-time }
        notes: { type: string }

    Document:
      type: object
      properties:
        id: { type: string }
        documentType: { type: string }
        documentUrl: { type: string }
        verificationStatus: { type: string }
        expiryDate: { type: string, format: date }
        uploadedAt: { type: string, format: date-time }

    ActivityLog:
      type: object
      properties:
        id: { type: string }
        activityType: { type: string }
        details: { type: object }
        createdAt: { type: string, format: date-time }
```

### 3.2 Driver Location Update API

```typescript
// ==========================================
// DRIVER MOBILE APP - LOCATION UPDATE API
// ==========================================

// POST /api/drivers/location/update
// Called by driver mobile app every 5-10 seconds when online

interface LocationUpdateRequest {
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy: number;      // GPS accuracy in meters
  speed?: number;        // km/h
  heading?: number;      // degrees (0-360)
  batteryLevel?: number; // 0-100
  timestamp: string;     // ISO 8601
}

interface LocationUpdateResponse {
  success: boolean;
  serverTime: string;
  nextUpdateInterval: number; // seconds (adaptive)
}

// Rate limiting: 1 request per 5 seconds per driver
// Authentication: Driver JWT token
```

---

## 4. WEBSOCKET ARCHITECTURE

### 4.1 WebSocket Server Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET ARCHITECTURE                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   DRIVER MOBILE APP  │         │   FLEET DASHBOARD    │
│   (WebSocket Client) │         │   (WebSocket Client) │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │  1. Connect                    │  1. Connect
           │  2. Authenticate (JWT)         │  2. Authenticate (JWT)
           │  3. Join room: driver:{id}     │  3. Join room: fleet:{cityId}
           │                                │
           ▼                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET SERVER (Node.js + Socket.io)           │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Connection Manager                        │   │
│  │  • Handle connect/disconnect                                 │   │
│  │  • JWT validation                                            │   │
│  │  • Room management                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Message Router                            │   │
│  │  • location:update  →  Broadcast to fleet rooms              │   │
│  │  • driver:status    →  Notify relevant fleet rooms           │   │
│  │  • order:assigned   →  Notify specific driver                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Redis Adapter                             │   │
│  │  • Multi-server synchronization                              │   │
│  │  • Pub/sub for cross-server messaging                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
           │                                ▲
           │                                │
           ▼                                │
┌────────────────────────────────────────────────────────────────────┐
│                         REDIS CLUSTER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Location    │  │   Session    │  │   Pub/Sub    │              │
│  │    Store     │  │    Store     │  │   Channel    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 WebSocket Events

```typescript
// ==========================================
// WEBSOCKET EVENT DEFINITIONS
// ==========================================

// ==================== DRIVER APP EVENTS ====================

// Client → Server: Driver location update
interface LocationUpdateEvent {
  event: 'location:update';
  data: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number;
    heading?: number;
    batteryLevel?: number;
    timestamp: string;
  };
}

// Client → Server: Driver goes online/offline
interface StatusUpdateEvent {
  event: 'driver:status';
  data: {
    isOnline: boolean;
    reason?: 'user_action' | 'app_background' | 'timeout' | 'order_complete';
  };
}

// Server → Client: Order assignment
interface OrderAssignedEvent {
  event: 'order:assigned';
  data: {
    orderId: string;
    pickupLocation: {
      latitude: number;
      longitude: number;
      address: string;
    };
    deliveryLocation: {
      latitude: number;
      longitude: number;
      address: string;
    };
    estimatedEarnings: number;
    expiresAt: string; // Acceptance window expiry
  };
}

// Server → Client: Connection acknowledgment
interface ConnectionAckEvent {
  event: 'connection:ack';
  data: {
    driverId: string;
    connectedAt: string;
    updateInterval: number; // Recommended update frequency in seconds
  };
}

// ==================== FLEET DASHBOARD EVENTS ====================

// Server → Client: Driver location broadcast
interface DriverLocationBroadcastEvent {
  event: 'fleet:driver_location';
  data: {
    driverId: string;
    driverName: string;
    cityId: string;
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    isOnline: boolean;
    currentOrderId?: string;
    timestamp: string;
  };
}

// Server → Client: Driver status change
interface DriverStatusChangeEvent {
  event: 'fleet:driver_status';
  data: {
    driverId: string;
    driverName: string;
    previousStatus: string;
    currentStatus: string;
    cityId: string;
    timestamp: string;
  };
}

// Server → Client: Fleet statistics update
interface FleetStatsUpdateEvent {
  event: 'fleet:stats_update';
  data: {
    cityId: string;
    totalDrivers: number;
    onlineDrivers: number;
    activeOrders: number;
    timestamp: string;
  };
}

// Client → Server: Subscribe to specific city
interface SubscribeCityEvent {
  event: 'fleet:subscribe_city';
  data: {
    cityId: string;
  };
}

// Client → Server: Request driver location history
interface RequestLocationHistoryEvent {
  event: 'fleet:request_history';
  data: {
    driverId: string;
    startTime: string;
    endTime: string;
  };
}
```

### 4.3 WebSocket Server Implementation

```typescript
// ==========================================
// WEBSOCKET SERVER - NODE.JS + SOCKET.IO
// ==========================================

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';

// Redis clients for adapter
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

const io = new Server({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Use Redis adapter for multi-server scaling
io.adapter(createAdapter(pubClient, subClient));

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    socket.data.user = decoded;
    
    // Determine user type from JWT claims
    if (decoded.role === 'driver') {
      socket.data.type = 'driver';
      socket.data.driverId = decoded.driverId;
    } else if (['fleet_manager', 'super_admin'].includes(decoded.role)) {
      socket.data.type = 'fleet';
      socket.data.managerId = decoded.userId;
      socket.data.assignedCities = decoded.assignedCities || [];
    }
    
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const { type, driverId, managerId, assignedCities } = socket.data;
  
  console.log(`[WS] ${type} connected:`, type === 'driver' ? driverId : managerId);

  // ==================== DRIVER CONNECTION HANDLING ====================
  if (type === 'driver') {
    // Join driver-specific room
    socket.join(`driver:${driverId}`);
    
    // Update driver online status in Redis
    redisClient.hSet(`driver:${driverId}:status`, {
      isOnline: 'true',
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    });
    
    // Acknowledge connection with recommended update interval
    socket.emit('connection:ack', {
      driverId,
      connectedAt: new Date().toISOString(),
      updateInterval: 5 // Update every 5 seconds
    });

    // Handle location updates
    socket.on('location:update', async (data) => {
      try {
        // Validate data
        if (!data.latitude || !data.longitude) {
          return socket.emit('error', { message: 'Invalid location data' });
        }

        // Store in Redis with TTL (5 minutes)
        const locationKey = `driver:${driverId}:location`;
        await redisClient.hSet(locationKey, {
          latitude: data.latitude.toString(),
          longitude: data.longitude.toString(),
          accuracy: data.accuracy?.toString() || '0',
          speed: data.speed?.toString() || '0',
          heading: data.heading?.toString() || '0',
          batteryLevel: data.batteryLevel?.toString() || '0',
          timestamp: data.timestamp || new Date().toISOString()
        });
        await redisClient.expire(locationKey, 300); // 5 minute TTL

        // Get driver's city for broadcasting
        const driverData = await getDriverCity(driverId);
        
        // Broadcast to fleet managers in the same city
        const broadcastData = {
          driverId,
          driverName: driverData.full_name,
          cityId: driverData.city_id,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed || 0,
          heading: data.heading || 0,
          isOnline: true,
          timestamp: data.timestamp || new Date().toISOString()
        };

        // Emit to city-specific fleet room
        io.to(`fleet:${driverData.city_id}`).emit('fleet:driver_location', broadcastData);
        
        // Also emit to super admins (all cities)
        io.to('fleet:all').emit('fleet:driver_location', broadcastData);

        // Persist to database asynchronously
        persistLocationUpdate(driverId, data).catch(console.error);

      } catch (error) {
        console.error('[WS] Location update error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Handle driver status changes
    socket.on('driver:status', async (data) => {
      await redisClient.hSet(`driver:${driverId}:status`, {
        isOnline: data.isOnline.toString(),
        status: data.reason || 'user_action'
      });
      
      // Notify fleet managers
      const driverData = await getDriverCity(driverId);
      io.to(`fleet:${driverData.city_id}`).emit('fleet:driver_status', {
        driverId,
        driverName: driverData.full_name,
        currentStatus: data.isOnline ? 'online' : 'offline',
        cityId: driverData.city_id,
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      await redisClient.hSet(`driver:${driverId}:status`, {
        isOnline: 'false',
        disconnectedAt: new Date().toISOString()
      });
      
      // Update database
      await updateDriverOfflineStatus(driverId);
      
      console.log(`[WS] Driver disconnected: ${driverId}`);
    });
  }

  // ==================== FLEET MANAGER CONNECTION HANDLING ====================
  if (type === 'fleet') {
    // Join appropriate rooms based on role
    if (socket.data.user.role === 'super_admin') {
      // Super admin can see all cities
      socket.join('fleet:all');
    } else {
      // Fleet manager joins only their assigned cities
      assignedCities.forEach((cityId: string) => {
        socket.join(`fleet:${cityId}`);
      });
    }

    // Handle city subscription requests
    socket.on('fleet:subscribe_city', (data) => {
      // Validate manager has access to this city
      if (socket.data.user.role === 'super_admin' || 
          assignedCities.includes(data.cityId)) {
        socket.join(`fleet:${data.cityId}`);
        socket.emit('fleet:subscribed', { cityId: data.cityId });
      } else {
        socket.emit('error', { message: 'Unauthorized city access' });
      }
    });

    // Handle location history requests
    socket.on('fleet:request_history', async (data) => {
      try {
        // Verify driver belongs to manager's city
        const driverData = await getDriverCity(data.driverId);
        if (socket.data.user.role !== 'super_admin' && 
            !assignedCities.includes(driverData.city_id)) {
          return socket.emit('error', { message: 'Unauthorized driver access' });
        }

        const history = await getDriverLocationHistory(
          data.driverId, 
          data.startTime, 
          data.endTime
        );
        
        socket.emit('fleet:location_history', {
          driverId: data.driverId,
          locations: history
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to fetch location history' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Fleet manager disconnected: ${managerId}`);
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[WS] Shutting down gracefully...');
  io.close(() => {
    console.log('[WS] Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.WS_PORT || 3001;
io.listen(PORT);
console.log(`[WS] Server listening on port ${PORT}`);
```

### 4.4 Fallback Polling Strategy

```typescript
// ==========================================
// FALLBACK POLLING MECHANISM
// ==========================================

// When WebSocket connection fails, use HTTP polling

class LocationTrackingService {
  private wsConnected: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private fallbackInterval: number = 10000; // 10 seconds for polling

  constructor(private driverId: string, private authToken: string) {}

  async connect() {
    try {
      // Attempt WebSocket connection
      this.socket = io(WS_URL, {
        auth: { token: this.authToken },
        transports: ['websocket', 'polling'] // Fallback to polling
      });

      this.socket.on('connect', () => {
        this.wsConnected = true;
        this.stopPolling();
        console.log('[Tracking] WebSocket connected');
      });

      this.socket.on('disconnect', () => {
        this.wsConnected = false;
        this.startPolling();
        console.log('[Tracking] WebSocket disconnected, falling back to polling');
      });

    } catch (error) {
      console.error('[Tracking] WebSocket connection failed:', error);
      this.startPolling();
    }
  }

  private startPolling() {
    if (this.pollingInterval) return;
    
    this.pollingInterval = setInterval(async () => {
      try {
        const position = await this.getCurrentPosition();
        
        await fetch('/api/drivers/location/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({
            driverId: this.driverId,
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
            timestamp: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error('[Tracking] Polling error:', error);
      }
    }, this.fallbackInterval);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        reject,
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
}
```

---

## 5. FRONTEND STRUCTURE

### 5.1 React Project Structure

```
src/
├── fleet/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── FleetLayout.tsx          # Main layout with sidebar
│   │   │   ├── FleetSidebar.tsx         # Navigation sidebar
│   │   │   ├── FleetHeader.tsx          # Top header with city selector
│   │   │   └── FleetMobileNav.tsx       # Mobile bottom navigation
│   │   ├── dashboard/
│   │   │   ├── DashboardStats.tsx       # KPI cards
│   │   │   ├── DriversStatusChart.tsx   # Online/offline chart
│   │   │   ├── OrdersProgressWidget.tsx # Active orders widget
│   │   │   └── RecentActivityFeed.tsx   # Activity log
│   │   ├── map/
│   │   │   ├── LiveMap.tsx              # Interactive map component
│   │   │   ├── DriverMarker.tsx         # Custom driver marker
│   │   │   ├── DriverPopup.tsx          # Marker popup with info
│   │   │   ├── MapControls.tsx          # Zoom, filter controls
│   │   │   └── RouteOverlay.tsx         # Show delivery routes
│   │   ├── drivers/
│   │   │   ├── DriverList.tsx           # Driver table/list
│   │   │   ├── DriverCard.tsx           # Individual driver card
│   │   │   ├── DriverFilters.tsx        # Filter controls
│   │   │   ├── DriverStatusBadge.tsx    # Status indicator
│   │   │   ├── DriverDetailModal.tsx    # Driver details modal
│   │   │   ├── DriverForm.tsx           # Create/edit driver form
│   │   │   ├── DocumentUpload.tsx       # Document upload component
│   │   │   └── DriverPerformance.tsx    # Performance metrics
│   │   ├── vehicles/
│   │   │   ├── VehicleList.tsx
│   │   │   ├── VehicleCard.tsx
│   │   │   ├── VehicleForm.tsx
│   │   │   └── VehicleAssignment.tsx
│   │   ├── payouts/
│   │   │   ├── PayoutList.tsx
│   │   │   ├── PayoutCalculator.tsx
│   │   │   ├── PayoutFilters.tsx
│   │   │   ├── BulkPayoutModal.tsx
│   │   │   └── PayoutReceipt.tsx
│   │   └── common/
│   │       ├── CitySelector.tsx         # City dropdown selector
│   │       ├── ZoneSelector.tsx         # Zone multi-select
│   │       ├── StatusFilter.tsx         # Status filter dropdown
│   │       ├── DateRangePicker.tsx      # Date range selection
│   │       └── SearchInput.tsx          # Search component
│   ├── pages/
│   │   ├── FleetLogin.tsx               # Login page
│   │   ├── FleetDashboard.tsx           # Main dashboard
│   │   ├── DriverManagement.tsx         # Driver list page
│   │   ├── DriverDetail.tsx             # Single driver view
│   │   ├── VehicleManagement.tsx        # Vehicle list page
│   │   ├── LiveTracking.tsx             # Real-time map view
│   │   ├── PayoutManagement.tsx         # Payouts list
│   │   ├── PayoutProcessing.tsx         # Process payouts
│   │   └── FleetSettings.tsx            # Settings page
│   ├── hooks/
│   │   ├── useFleetAuth.ts              # Fleet auth context
│   │   ├── useDrivers.ts                # Driver data hooks
│   │   ├── useVehicles.ts               # Vehicle data hooks
│   │   ├── usePayouts.ts                # Payout data hooks
│   │   ├── useLiveTracking.ts           # WebSocket tracking hook
│   │   ├── useCityFilter.ts             # City filter state
│   │   └── useFleetStats.ts             # Dashboard stats hook
│   ├── services/
│   │   ├── fleetApi.ts                  # API client
│   │   ├── trackingSocket.ts            # WebSocket service
│   │   └── mapService.ts                # Map utility functions
│   ├── context/
│   │   ├── FleetAuthContext.tsx         # Auth provider
│   │   ├── TrackingContext.tsx          # Real-time tracking provider
│   │   └── CityContext.tsx              # City filter provider
│   ├── types/
│   │   ├── fleet.ts                     # TypeScript interfaces
│   │   └── tracking.ts                  # Tracking types
│   └── utils/
│       ├── cityGuards.ts                # City access validation
│       └── formatters.ts                # Data formatters
```

### 5.2 Key Components Implementation

```typescript
// ==========================================
// FLEET LAYOUT COMPONENT
// ==========================================

// src/fleet/components/layout/FleetLayout.tsx
import { Outlet } from 'react-router-dom';
import { FleetSidebar } from './FleetSidebar';
import { FleetHeader } from './FleetHeader';
import { TrackingProvider } from '@/fleet/context/TrackingContext';
import { CityProvider } from '@/fleet/context/CityContext';

export function FleetLayout() {
  return (
    <CityProvider>
      <TrackingProvider>
        <div className="flex h-screen bg-gray-50">
          <FleetSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <FleetHeader />
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </TrackingProvider>
    </CityProvider>
  );
}

// ==========================================
// LIVE TRACKING MAP COMPONENT
// ==========================================

// src/fleet/components/map/LiveMap.tsx
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { useTracking } from '@/fleet/context/TrackingContext';
import { useCity } from '@/fleet/context/CityContext';
import { DriverMarker } from './DriverMarker';

interface DriverLocation {
  driverId: string;
  driverName: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  currentOrderId?: string;
}

export function LiveMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  
  const { drivers, isConnected } = useTracking();
  const { selectedCity } = useCity();
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: selectedCity ? [selectedCity.longitude, selectedCity.latitude] : [51.5074, 25.2854], // Default: Doha
      zoom: 12
    });

    map.current.addControl(new mapboxgl.NavigationControl());
    map.current.addControl(new mapboxgl.FullscreenControl());

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [selectedCity]);

  // Update markers when drivers change
  useEffect(() => {
    if (!map.current) return;

    drivers.forEach((driver: DriverLocation) => {
      const markerId = driver.driverId;
      const existingMarker = markersRef.current.get(markerId);

      if (existingMarker) {
        // Update position
        existingMarker.setLngLat([driver.longitude, driver.latitude]);
      } else {
        // Create new marker
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = `<div class="marker-${driver.isOnline ? 'online' : 'offline'}"></div>`;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([driver.longitude, driver.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div class="p-2">
                <h3 class="font-semibold">${driver.driverName}</h3>
                <p class="text-sm text-gray-600">
                  ${driver.isOnline ? '🟢 Online' : '🔴 Offline'}
                </p>
                ${driver.currentOrderId ? `<p class="text-sm">Order: #${driver.currentOrderId.slice(-6)}</p>` : ''}
              </div>
            `)
          )
          .addTo(map.current!);

        markersRef.current.set(markerId, marker);
      }
    });

    // Remove markers for offline drivers
    markersRef.current.forEach((marker, driverId) => {
      const driver = drivers.find((d: DriverLocation) => d.driverId === driverId);
      if (!driver || !driver.isOnline) {
        marker.remove();
        markersRef.current.delete(driverId);
      }
    });
  }, [drivers]);

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden">
      <div ref={mapContainer} className="h-full w-full" />
      
      {/* Connection status indicator */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium">
          {isConnected ? 'Live Tracking' : 'Reconnecting...'}
        </span>
      </div>

      {/* Driver count overlay */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2">
        <p className="text-sm text-gray-600">Online Drivers</p>
        <p className="text-2xl font-bold">
          {drivers.filter((d: DriverLocation) => d.isOnline).length}
        </p>
      </div>
    </div>
  );
}

// ==========================================
// TRACKING CONTEXT & WEBSOCKET HOOK
// ==========================================

// src/fleet/context/TrackingContext.tsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useFleetAuth } from '@/fleet/hooks/useFleetAuth';
import { useCity } from './CityContext';

interface DriverLocation {
  driverId: string;
  driverName: string;
  cityId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  isOnline: boolean;
  currentOrderId?: string;
  timestamp: string;
}

interface TrackingContextType {
  drivers: DriverLocation[];
  isConnected: boolean;
  selectedDriver: string | null;
  setSelectedDriver: (id: string | null) => void;
}

const TrackingContext = createContext<TrackingContextType | null>(null);

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  
  const { token, user } = useFleetAuth();
  const { selectedCities } = useCity();

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token) return;

    const newSocket = io(import.meta.env.VITE_WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('[Tracking] Connected to real-time server');
      setIsConnected(true);
      
      // Subscribe to assigned cities
      if (user?.role === 'super_admin') {
        // Super admin subscribes to all
      } else {
        selectedCities.forEach(city => {
          newSocket.emit('fleet:subscribe_city', { cityId: city.id });
        });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('[Tracking] Disconnected');
      setIsConnected(false);
    });

    // Handle incoming driver location updates
    newSocket.on('fleet:driver_location', (data: DriverLocation) => {
      setDrivers(prev => {
        const index = prev.findIndex(d => d.driverId === data.driverId);
        if (index >= 0) {
          // Update existing
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        // Add new
        return [...prev, data];
      });
    });

    // Handle driver status changes
    newSocket.on('fleet:driver_status', (data: { driverId: string; currentStatus: string }) => {
      if (data.currentStatus === 'offline') {
        setDrivers(prev => prev.filter(d => d.driverId !== data.driverId));
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, user, selectedCities]);

  // Fetch initial driver locations via REST API
  useEffect(() => {
    if (!selectedCities.length) return;

    const fetchInitialLocations = async () => {
      try {
        const response = await fetch(
          `/api/fleet/tracking/drivers?cityId=${selectedCities[0].id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();
        setDrivers(data);
      } catch (error) {
        console.error('Failed to fetch initial locations:', error);
      }
    };

    fetchInitialLocations();
  }, [selectedCities, token]);

  return (
    <TrackingContext.Provider value={{ 
      drivers, 
      isConnected, 
      selectedDriver, 
      setSelectedDriver 
    }}>
      {children}
    </TrackingContext.Provider>
  );
}

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (!context) throw new Error('useTracking must be used within TrackingProvider');
  return context;
};

// ==========================================
// CITY FILTER COMPONENT
// ==========================================

// src/fleet/components/common/CitySelector.tsx
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useCity } from '@/fleet/context/CityContext';
import { useFleetAuth } from '@/fleet/hooks/useFleetAuth';

export function CitySelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedCities, setSelectedCities, availableCities } = useCity();
  const { user } = useFleetAuth();

  // Super admin can select multiple cities
  const isMultiSelect = user?.role === 'super_admin';

  const toggleCity = (cityId: string) => {
    if (isMultiSelect) {
      setSelectedCities(prev => {
        const exists = prev.find(c => c.id === cityId);
        if (exists) {
          return prev.filter(c => c.id !== cityId);
        }
        const city = availableCities.find(c => c.id === cityId);
        return city ? [...prev, city] : prev;
      });
    } else {
      const city = availableCities.find(c => c.id === cityId);
      if (city) setSelectedCities([city]);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
      >
        <span className="font-medium">
          {selectedCities.length === 0 
            ? 'Select City' 
            : selectedCities.length === 1 
              ? selectedCities[0].name 
              : `${selectedCities.length} Cities Selected`
          }
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-64 bg-white border rounded-lg shadow-lg z-50">
          {availableCities.map(city => (
            <button
              key={city.id}
              onClick={() => toggleCity(city.id)}
              className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{city.name}</span>
                <span className="text-sm text-gray-500">
                  {city.driverCount} drivers
                </span>
              </div>
              {selectedCities.find(c => c.id === city.id) && (
                <Check className="w-4 h-4 text-green-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// DRIVER LIST WITH REAL-TIME STATUS
// ==========================================

// src/fleet/components/drivers/DriverList.tsx
import { useState } from 'react';
import { useDrivers } from '@/fleet/hooks/useDrivers';
import { useTracking } from '@/fleet/context/TrackingContext';
import { useCity } from '@/fleet/context/CityContext';
import { DriverCard } from './DriverCard';
import { DriverFilters } from './DriverFilters';
import { Input } from '@/components/ui/input';

export function DriverList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { selectedCities } = useCity();
  const { drivers: trackingDrivers } = useTracking();
  const { drivers, isLoading, pagination } = useDrivers({
    cityIds: selectedCities.map(c => c.id),
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined
  });

  // Merge REST API data with real-time tracking data
  const mergedDrivers = drivers.map(driver => {
    const trackingData = trackingDrivers.find(t => t.driverId === driver.id);
    return {
      ...driver,
      isOnline: trackingData?.isOnline ?? driver.isOnline,
      currentLatitude: trackingData?.latitude ?? driver.currentLatitude,
      currentLongitude: trackingData?.longitude ?? driver.currentLongitude,
      locationUpdatedAt: trackingData?.timestamp ?? driver.locationUpdatedAt
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Drivers</h1>
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search drivers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <DriverFilters 
            status={statusFilter}
            onStatusChange={setStatusFilter}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mergedDrivers.map(driver => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
      </div>
    </div>
  );
}

// ==========================================
// FLEET ROUTES CONFIGURATION
// ==========================================

// src/fleet/routes.tsx
import { Route } from 'react-router-dom';
import { FleetLayout } from './components/layout/FleetLayout';
import { FleetLogin } from './pages/FleetLogin';
import { FleetDashboard } from './pages/FleetDashboard';
import { DriverManagement } from './pages/DriverManagement';
import { DriverDetail } from './pages/DriverDetail';
import { VehicleManagement } from './pages/VehicleManagement';
import { LiveTracking } from './pages/LiveTracking';
import { PayoutManagement } from './pages/PayoutManagement';
import { ProtectedFleetRoute } from './components/ProtectedFleetRoute';

export const fleetRoutes = (
  <>
    <Route path="/fleet/login" element={<FleetLogin />} />
    <Route element={<ProtectedFleetRoute />}>
      <Route path="/fleet" element={<FleetLayout />}>
        <Route index element={<FleetDashboard />} />
        <Route path="drivers" element={<DriverManagement />} />
        <Route path="drivers/:id" element={<DriverDetail />} />
        <Route path="vehicles" element={<VehicleManagement />} />
        <Route path="tracking" element={<LiveTracking />} />
        <Route path="payouts" element={<PayoutManagement />} />
      </Route>
    </Route>
  </>
);
```

---

## 6. SCALABILITY & PERFORMANCE RECOMMENDATIONS

### 6.1 Database Optimization

```sql
-- ============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ============================================

-- 1. Composite indexes for common queries
CREATE INDEX idx_drivers_city_status ON drivers(city_id, status);
CREATE INDEX idx_drivers_city_online ON drivers(city_id, is_online) WHERE is_online = true;
CREATE INDEX idx_payouts_driver_status ON driver_payouts(driver_id, status);
CREATE INDEX idx_payouts_city_period ON driver_payouts(city_id, period_start, period_end);

-- 2. Partial indexes for active records
CREATE INDEX idx_active_drivers ON drivers(city_id, id) WHERE status = 'active';
CREATE INDEX idx_pending_documents ON driver_documents(driver_id) WHERE verification_status = 'pending';

-- 3. GIN indexes for JSON/array columns
CREATE INDEX idx_fleet_logs_details ON fleet_activity_logs USING GIN(details);

-- 4. Expression indexes for common filters
CREATE INDEX idx_vehicles_insurance_alert ON vehicles 
  ((insurance_expiry <= CURRENT_DATE + INTERVAL '30 days')) 
  WHERE insurance_expiry IS NOT NULL;

-- 5. BRIN indexes for time-series data (location history)
CREATE INDEX idx_locations_time_brin ON driver_locations 
  USING BRIN(recorded_at) WITH (pages_per_range = 128);
```

### 6.2 Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CACHING LAYER ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                         REDIS CACHE                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    CACHE TIERS                               │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                             │   │
│  │  L1: Hot Cache (5-10 seconds)                               │   │
│  │  ├── driver:{id}:location          → Current GPS coords    │   │
│  │  ├── driver:{id}:status            → Online/offline status │   │
│  │  └── fleet:{cityId}:online_count   → Real-time counters    │   │
│  │                                                             │   │
│  │  L2: Warm Cache (1-5 minutes)                                │   │
│  │  ├── driver:{id}:profile           → Driver details        │   │
│  │  ├── city:{id}:stats               → Aggregated metrics    │   │
│  │  └── zone:{id}:drivers             → Zone assignments      │   │
│  │                                                             │   │
│  │  L3: Cold Cache (1-24 hours)                                 │   │
│  │  ├── payouts:{cityId}:{period}     → Payout summaries      │   │
│  │  ├── reports:{type}:{params}       → Generated reports     │   │
│  │  └── documents:{driverId}          → Document metadata     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘

CACHE INVALIDATION STRATEGIES:
├── Write-Through:  Location updates write to Redis + DB simultaneously
├── Cache-Aside:    Application manages cache misses
├── TTL-Based:      Automatic expiration (configured per tier)
└── Event-Based:    WebSocket events trigger selective invalidation
```

```typescript
// ==========================================
// CACHE SERVICE IMPLEMENTATION
// ==========================================

import { Redis } from 'ioredis';

class FleetCache {
  private redis: Redis;
  
  // TTL constants (seconds)
  private readonly TTL = {
    LOCATION: 300,      // 5 minutes
    STATUS: 60,         // 1 minute
    PROFILE: 300,       // 5 minutes
    STATS: 300,         // 5 minutes
    PAYOUT: 86400,      // 24 hours
    REPORT: 3600        // 1 hour
  };

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  // Driver location cache
  async getDriverLocation(driverId: string) {
    const key = `driver:${driverId}:location`;
    const data = await this.redis.hgetall(key);
    if (!data.latitude) return null;
    return {
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      timestamp: data.timestamp
    };
  }

  async setDriverLocation(driverId: string, location: any) {
    const key = `driver:${driverId}:location`;
    await this.redis.hmset(key, {
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      timestamp: location.timestamp
    });
    await this.redis.expire(key, this.TTL.LOCATION);
  }

  // City statistics cache
  async getCityStats(cityId: string) {
    const key = `city:${cityId}:stats`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setCityStats(cityId: string, stats: any) {
    const key = `city:${cityId}:stats`;
    await this.redis.setex(key, this.TTL.STATS, JSON.stringify(stats));
  }

  // Invalidate cache on updates
  async invalidateDriverCache(driverId: string) {
    const keys = [
      `driver:${driverId}:location`,
      `driver:${driverId}:status`,
      `driver:${driverId}:profile`
    ];
    await this.redis.del(...keys);
  }

  // Batch operations for efficiency
  async getMultipleDriverLocations(driverIds: string[]) {
    const pipeline = this.redis.pipeline();
    driverIds.forEach(id => {
      pipeline.hgetall(`driver:${id}:location`);
    });
    return pipeline.exec();
  }
}

export const fleetCache = new FleetCache();
```

### 6.3 WebSocket Scaling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET HORIZONTAL SCALING                              │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │   LOAD BALANCER     │
                    │    (HAProxy/NGINX)  │
                    │   Sticky Sessions   │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │  WS Server  │     │  WS Server  │     │  WS Server  │
    │    #1       │     │    #2       │     │    #3       │
    │  (Node.js)  │     │  (Node.js)  │     │  (Node.js)  │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   REDIS CLUSTER     │
                    │   (Pub/Sub Adapter) │
                    └─────────────────────┘

SCALING STRATEGIES:

1. Sticky Sessions
   - Route same driver to same WS server
   - NGINX config:
     ```
     upstream websocket_servers {
       ip_hash;  # Sticky sessions
       server ws1:3001;
       server ws2:3001;
       server ws3:3001;
     }
     ```

2. Redis Pub/Sub
   - Cross-server message broadcasting
   - All servers subscribe to same channels
   - Automatic synchronization

3. Connection Limits
   - Max 10,000 connections per WS server
   - Auto-scale based on connection count
   - Kubernetes HPA configuration:
     ```yaml
     apiVersion: autoscaling/v2
     kind: HorizontalPodAutoscaler
     spec:
       scaleTargetRef:
         name: websocket-server
       minReplicas: 3
       maxReplicas: 20
       metrics:
       - type: Pods
         pods:
           metric:
             name: websocket_connections
           target:
             type: AverageValue
             averageValue: "8000"
     ```

4. Connection Recovery
   - Client-side reconnection logic
   - Exponential backoff
   - State synchronization on reconnect
```

### 6.4 Performance Benchmarks & Targets

| Metric | Target | Optimization Strategy |
|--------|--------|----------------------|
| **API Response Time** | < 100ms (p95) | Caching, connection pooling, query optimization |
| **WebSocket Latency** | < 50ms | Edge deployment, Redis pub/sub, binary protocols |
| **Location Update Rate** | 5-10 seconds | Adaptive frequency based on movement |
| **Map Rendering** | < 100 markers @ 60fps | Clustering, viewport culling, WebGL |
| **Concurrent Drivers** | 10,000+ per city | Horizontal scaling, sharding |
| **Database Writes** | 10,000 TPS | Batch inserts, async processing |
| **Dashboard Load Time** | < 2 seconds | Lazy loading, code splitting, CDN |

### 6.5 Infrastructure Recommendations

```yaml
# ==========================================
# PRODUCTION INFRASTRUCTURE SETUP
# ==========================================

# 1. Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fleet-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fleet-api
  template:
    spec:
      containers:
      - name: api
        image: nutrio/fleet-api:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
---
# 2. WebSocket Server Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-server
spec:
  replicas: 5
  template:
    spec:
      containers:
      - name: websocket
        image: nutrio/websocket-server:latest
        ports:
        - containerPort: 3001
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
# 3. Database Read Replicas
# Use Supabase or AWS RDS with read replicas
# for dashboard queries and reporting

# 4. CDN Configuration
# CloudFront / Cloudflare for static assets
# and API response caching

# 5. Monitoring Stack
# - Prometheus + Grafana for metrics
# - ELK Stack for centralized logging
# - PagerDuty for alerting
# - Sentry for error tracking
```

### 6.6 Security Checklist

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY IMPLEMENTATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

AUTHENTICATION & AUTHORIZATION
├── ✅ JWT-based authentication with short expiry (15 min)
├── ✅ Refresh token rotation
├── ✅ Role-based access control (RBAC)
├── ✅ City-level data isolation (RLS policies)
├── ✅ MFA for Super Admin accounts
└── ✅ Session invalidation on logout

DATA PROTECTION
├── ✅ All API endpoints use HTTPS/TLS 1.3
├── ✅ Database encryption at rest (AES-256)
├── ✅ Sensitive fields encrypted (PII)
├── ✅ API request/response validation (Zod/Joi)
└── ✅ SQL injection prevention (parameterized queries)

RATE LIMITING
├── ✅ Location updates: 1 req/5 sec per driver
├── ✅ API requests: 100 req/min per user
├── ✅ Login attempts: 5 attempts/15 min per IP
└── ✅ Bulk operations: Rate limited per city

AUDIT & COMPLIANCE
├── ✅ All actions logged with user, timestamp, IP
├── ✅ Document upload virus scanning
├── ✅ GDPR-compliant data deletion
├── ✅ 90-day log retention
└── ✅ Quarterly security audits

WEBSOCKET SECURITY
├── ✅ Token-based authentication on connection
├── ✅ Origin validation
├── ✅ Message size limits (1KB)
├── ✅ Connection limits per IP
└── ✅ Heartbeat/ping to detect stale connections
```

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)
- [ ] Database schema migration
- [ ] Fleet manager authentication system
- [ ] Basic dashboard with city filtering
- [ ] Driver CRUD operations

### Phase 2: Real-Time Tracking (Weeks 3-4)
- [ ] WebSocket server setup
- [ ] Driver mobile app GPS integration
- [ ] Live map with driver markers
- [ ] Location history tracking

### Phase 3: Vehicle & Document Management (Weeks 5-6)
- [ ] Vehicle CRUD and assignment
- [ ] Document upload and verification workflow
- [ ] Insurance expiry alerts
- [ ] Driver performance metrics

### Phase 4: Payout System (Weeks 7-8)
- [ ] Earnings calculation engine
- [ ] Payout processing with idempotency
- [ ] Bulk payout operations
- [ ] Payout history and receipts

### Phase 5: Advanced Features (Weeks 9-10)
- [ ] Zone management
- [ ] Advanced analytics and reporting
- [ ] Mobile-responsive improvements
- [ ] Performance optimization

### Phase 6: Production Hardening (Weeks 11-12)
- [ ] Security audit and penetration testing
- [ ] Load testing (10k+ concurrent drivers)
- [ ] Documentation and training materials
- [ ] Production deployment

---

## 8. APPENDIX

### A. Database Migration Script

```sql
-- Run this migration to set up Fleet Management tables
-- File: supabase/migrations/20240227_fleet_management.sql

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Include all CREATE TABLE statements from Section 2.1
-- Include all CREATE INDEX statements from Section 2.3
-- Include all RLS policies from Section 2.3

-- Add comments for documentation
COMMENT ON TABLE fleet_managers IS 'Fleet management users with city-level access control';
COMMENT ON TABLE drivers IS 'Delivery drivers with real-time location tracking';
COMMENT ON TABLE driver_locations IS 'Time-series location data for route tracking';
COMMENT ON TABLE vehicles IS 'Fleet vehicles with insurance tracking';
COMMENT ON TABLE driver_payouts IS 'Driver earnings and payout records with idempotency';
```

### B. Environment Variables Template

```bash
# Fleet Management Portal Environment Variables

# Database
DATABASE_URL=postgresql://...
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://...
REDIS_CLUSTER_MODE=true

# WebSocket
WS_PORT=3001
WS_MAX_CONNECTIONS=10000
WS_HEARTBEAT_INTERVAL=25000

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=900
JWT_REFRESH_EXPIRY=604800

# Mapbox
MAPBOX_TOKEN=pk.your-token

# File Storage
S3_BUCKET=fleet-documents
S3_REGION=me-south-1

# Rate Limiting
RATE_LIMIT_API=100
RATE_LIMIT_LOCATION=12

# Monitoring
SENTRY_DSN=https://...
POSTHOG_KEY=phc_...
```

### C. API Error Codes

```typescript
const ERROR_CODES = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'AUTH001',
  AUTH_TOKEN_EXPIRED: 'AUTH002',
  AUTH_UNAUTHORIZED: 'AUTH003',
  
  // City Access
  CITY_ACCESS_DENIED: 'CITY001',
  CITY_NOT_FOUND: 'CITY002',
  
  // Drivers
  DRIVER_NOT_FOUND: 'DRV001',
  DRIVER_ALREADY_EXISTS: 'DRV002',
  DRIVER_NOT_VERIFIED: 'DRV003',
  
  // Vehicles
  VEHICLE_NOT_FOUND: 'VEH001',
  VEHICLE_ALREADY_ASSIGNED: 'VEH002',
  VEHICLE_PLATE_EXISTS: 'VEH003',
  
  // Payouts
  PAYOUT_DUPLICATE: 'PAY001',
  PAYOUT_INVALID_AMOUNT: 'PAY002',
  PAYOUT_ALREADY_PROCESSED: 'PAY003',
  
  // Documents
  DOCUMENT_INVALID_TYPE: 'DOC001',
  DOCUMENT_TOO_LARGE: 'DOC002',
  DOCUMENT_VERIFICATION_FAILED: 'DOC003',
  
  // System
  RATE_LIMIT_EXCEEDED: 'SYS001',
  INTERNAL_ERROR: 'SYS500'
};
```

---

## Document Information

- **Version**: 1.0.0
- **Last Updated**: 2024-02-27
- **Author**: System Architecture Team
- **Reviewers**: Engineering Lead, Security Team, Product Manager
- **Status**: Ready for Implementation
