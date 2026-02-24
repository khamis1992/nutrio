# Delivery System - Implementation Plan
## Week-by-Week Development Roadmap

---

## Overview

**Timeline**: 4 Weeks  
**Team Size**: 1-2 developers  
**Goal**: Production-ready delivery logistics system

**Prerequisites** (assumed complete):
- Order Workflow implemented
- Partner portal marks meals READY
- Customer can confirm delivery
- Admin portal exists

---

## WEEK 1: Database & Backend Foundation

### Day 1-2: Database Migrations

#### Migration 1: Create Drivers Table
```sql
-- supabase/migrations/20260224000001_create_drivers_table.sql

CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(20) DEFAULT 'car' CHECK (vehicle_type IN ('bike', 'car')),
  license_plate VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  current_location GEOGRAPHY(POINT),
  last_location_update TIMESTAMP WITH TIME ZONE,
  total_deliveries INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 5.0 CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Drivers can view own profile" 
  ON drivers FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all drivers" 
  ON drivers FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can insert drivers" 
  ON drivers FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can update drivers" 
  ON drivers FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Indexes
CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_is_online ON drivers(is_online) WHERE is_online = true;
CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location) WHERE is_online = true;

-- Trigger for updated_at
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Migration 2: Create Delivery Jobs Table
```sql
-- supabase/migrations/20260224000002_create_delivery_jobs_table.sql

CREATE TABLE delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES meal_schedules(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  
  -- Delivery status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Waiting for assignment
    'assigned',          -- Driver assigned, not yet accepted
    'accepted',          -- Driver accepted
    'picked_up',         -- Driver collected food
    'in_transit',        -- On the way to customer
    'delivered',         -- Driver marked delivered
    'failed',            -- Could not deliver
    'cancelled'          -- Cancelled
  )),
  
  -- Timing
  assigned_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  
  -- Details
  failure_reason TEXT,
  delivery_notes TEXT,
  pickup_photo_url TEXT,
  delivery_photo_url TEXT,
  customer_otp VARCHAR(10),
  
  -- Financial
  delivery_fee DECIMAL(10,2) DEFAULT 15.00,
  driver_earnings DECIMAL(10,2) DEFAULT 15.00,
  
  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE delivery_jobs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Drivers can view assigned jobs" 
  ON delivery_jobs FOR SELECT 
  USING (driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Customers can view own delivery jobs" 
  ON delivery_jobs FOR SELECT 
  USING (schedule_id IN (
    SELECT id FROM meal_schedules WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all delivery jobs" 
  ON delivery_jobs FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Indexes
CREATE INDEX idx_delivery_jobs_schedule_id ON delivery_jobs(schedule_id);
CREATE INDEX idx_delivery_jobs_driver_id ON delivery_jobs(driver_id);
CREATE INDEX idx_delivery_jobs_status ON delivery_jobs(status);
CREATE INDEX idx_delivery_jobs_created_at ON delivery_jobs(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_delivery_jobs_updated_at
  BEFORE UPDATE ON delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Migration 3: Create Driver Locations Table
```sql
-- supabase/migrations/20260224000003_create_driver_locations_table.sql

CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  location GEOGRAPHY(POINT) NOT NULL,
  accuracy_meters DECIMAL(8,2),
  heading DECIMAL(5,2),
  speed_kmh DECIMAL(5,2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Drivers can insert own locations" 
  ON driver_locations FOR INSERT 
  WITH CHECK (driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all locations" 
  ON driver_locations FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Customers can view driver locations for their orders" 
  ON driver_locations FOR SELECT 
  USING (driver_id IN (
    SELECT driver_id FROM delivery_jobs 
    WHERE schedule_id IN (
      SELECT id FROM meal_schedules WHERE user_id = auth.uid()
    )
  ));

-- Indexes
CREATE INDEX idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_timestamp ON driver_locations(timestamp);
CREATE INDEX idx_driver_locations_location ON driver_locations USING GIST(location);

-- Retention: Keep only last 24 hours of location data
-- Run this as a scheduled job (cron)
CREATE OR REPLACE FUNCTION cleanup_old_driver_locations()
RETURNS void AS $$
BEGIN
  DELETE FROM driver_locations 
  WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
```

#### Migration 4: Triggers for Status Sync
```sql
-- supabase/migrations/20260224000004_create_delivery_triggers.sql

-- Trigger 1: Auto-create delivery job when meal is marked READY
CREATE OR REPLACE FUNCTION create_delivery_job_on_ready()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_status = 'ready' AND OLD.order_status != 'ready' THEN
    -- Check if job already exists
    IF NOT EXISTS (
      SELECT 1 FROM delivery_jobs 
      WHERE schedule_id = NEW.id
    ) THEN
      INSERT INTO delivery_jobs (schedule_id, status)
      VALUES (NEW.id, 'pending');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_delivery_job
  AFTER UPDATE OF order_status ON meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION create_delivery_job_on_ready();

-- Trigger 2: Sync driver pickup to meal_schedules status
CREATE OR REPLACE FUNCTION sync_pickup_to_schedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'picked_up' AND OLD.status != 'picked_up' THEN
    UPDATE meal_schedules 
    SET order_status = 'out_for_delivery',
        updated_at = NOW()
    WHERE id = NEW.schedule_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_pickup
  AFTER UPDATE OF status ON delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_pickup_to_schedule();

-- Trigger 3: Sync driver delivery to meal_schedules status
CREATE OR REPLACE FUNCTION sync_delivery_to_schedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    UPDATE meal_schedules 
    SET order_status = 'delivered',
        updated_at = NOW()
    WHERE id = NEW.schedule_id;
    
    -- Update driver stats
    UPDATE drivers 
    SET total_deliveries = total_deliveries + 1,
        total_earnings = total_earnings + NEW.driver_earnings,
        updated_at = NOW()
    WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_delivery
  AFTER UPDATE OF status ON delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_delivery_to_schedule();
```

### Day 3-4: Backend API Development

#### API 1: Driver Management
```typescript
// src/integrations/supabase/delivery.ts

import { supabase } from "./client";

// Driver goes online
export async function driverGoOnline(driverId: string) {
  const { data, error } = await supabase
    .from("drivers")
    .update({ 
      is_online: true,
      last_location_update: new Date().toISOString()
    })
    .eq("id", driverId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Driver goes offline
export async function driverGoOffline(driverId: string) {
  const { data, error } = await supabase
    .from("drivers")
    .update({ 
      is_online: false,
      current_location: null
    })
    .eq("id", driverId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Update driver location
export async function updateDriverLocation(
  driverId: string,
  location: { lat: number; lng: number },
  accuracy?: number,
  heading?: number,
  speed?: number
) {
  // Update driver current location
  const { error: driverError } = await supabase
    .from("drivers")
    .update({
      current_location: `POINT(${location.lng} ${location.lat})`,
      last_location_update: new Date().toISOString()
    })
    .eq("id", driverId);
  
  if (driverError) throw driverError;
  
  // Store location history
  const { error: locationError } = await supabase
    .from("driver_locations")
    .insert({
      driver_id: driverId,
      location: `POINT(${location.lng} ${location.lat})`,
      accuracy_meters: accuracy,
      heading: heading,
      speed_kmh: speed
    });
  
  if (locationError) throw locationError;
}
```

#### API 2: Job Assignment Algorithm
```typescript
// src/lib/delivery/assignment.ts

import { supabase } from "@/integrations/supabase/client";

interface Location {
  lat: number;
  lng: number;
}

interface Driver {
  id: string;
  user_id: string;
  current_location: any;
  rating: number;
  total_deliveries: number;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth's radius in km
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get restaurant location from schedule
async function getRestaurantLocation(scheduleId: string): Promise<Location> {
  const { data, error } = await supabase
    .from("meal_schedules")
    .select(`
      meal:meal_id(
        restaurant:restaurant_id(
          address
        )
      )
    `)
    .eq("id", scheduleId)
    .single();
  
  if (error || !data) throw error || new Error("Schedule not found");
  
  // For MVP, use hardcoded coordinates or geocode address
  // In production, restaurants should have lat/lng stored
  return { lat: 25.276987, lng: 51.520008 }; // Doha center as fallback
}

// Find and assign nearest driver
export async function assignDriverToJob(jobId: string): Promise<Driver | null> {
  // Get job details
  const { data: job, error: jobError } = await supabase
    .from("delivery_jobs")
    .select("schedule_id")
    .eq("id", jobId)
    .eq("status", "pending")
    .single();
  
  if (jobError || !job) return null;
  
  // Get restaurant location
  const restaurantLocation = await getRestaurantLocation(job.schedule_id);
  
  // Find online drivers
  const { data: drivers, error: driverError } = await supabase
    .from("drivers")
    .select("id, user_id, current_location, rating, total_deliveries")
    .eq("is_online", true)
    .eq("is_active", true)
    .not("current_location", "is", null);
  
  if (driverError || !drivers || drivers.length === 0) return null;
  
  // Calculate distances
  const driversWithDistance = drivers.map(driver => {
    // Parse location from PostGIS format
    const locationMatch = driver.current_location?.match(/POINT\(([^ ]+) ([^)]+)\)/);
    if (!locationMatch) return null;
    
    const driverLoc = {
      lat: parseFloat(locationMatch[2]),
      lng: parseFloat(locationMatch[1])
    };
    
    return {
      ...driver,
      distance: calculateDistance(driverLoc, restaurantLocation)
    };
  }).filter(Boolean) as (Driver & { distance: number })[];
  
  if (driversWithDistance.length === 0) return null;
  
  // Sort by distance and rating
  driversWithDistance.sort((a, b) => {
    // Prioritize distance, then rating
    if (Math.abs(a.distance - b.distance) < 0.5) {
      return b.rating - a.rating;
    }
    return a.distance - b.distance;
  });
  
  const selectedDriver = driversWithDistance[0];
  
  // Assign driver to job
  const { error: updateError } = await supabase
    .from("delivery_jobs")
    .update({
      driver_id: selectedDriver.id,
      status: "assigned",
      assigned_at: new Date().toISOString()
    })
    .eq("id", jobId);
  
  if (updateError) throw updateError;
  
  // Send notification to driver (implement later)
  // await notifyDriver(selectedDriver.user_id, "New delivery job assigned");
  
  return selectedDriver;
}

// Auto-assign all pending jobs (admin function)
export async function autoAssignAllPendingJobs(): Promise<{
  assigned: number;
  failed: number;
}> {
  const { data: pendingJobs, error } = await supabase
    .from("delivery_jobs")
    .select("id")
    .eq("status", "pending");
  
  if (error || !pendingJobs) throw error;
  
  let assigned = 0;
  let failed = 0;
  
  for (const job of pendingJobs) {
    try {
      const driver = await assignDriverToJob(job.id);
      if (driver) {
        assigned++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
    }
  }
  
  return { assigned, failed };
}
```

#### API 3: Driver Job Actions
```typescript
// src/lib/delivery/driver-actions.ts

import { supabase } from "@/integrations/supabase/client";

// Driver accepts job
export async function driverAcceptJob(driverId: string, jobId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .eq("status", "assigned")
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Driver marks picked up
export async function driverPickupJob(
  driverId: string, 
  jobId: string,
  photoUrl?: string
) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
      pickup_photo_url: photoUrl
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .eq("status", "accepted")
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Driver marks delivered
export async function driverDeliverJob(
  driverId: string,
  jobId: string,
  otp?: string,
  photoUrl?: string,
  notes?: string
) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      customer_otp: otp,
      delivery_photo_url: photoUrl,
      delivery_notes: notes
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .eq("status", "picked_up")
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Driver marks failed
export async function driverFailJob(
  driverId: string,
  jobId: string,
  reason: string
) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: reason
    })
    .eq("id", jobId)
    .eq("driver_id", driverId)
    .in("status", ["assigned", "accepted", "picked_up"])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Get driver's current job
export async function getDriverCurrentJob(driverId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      schedule:schedule_id(
        *,
        meal:meal_id(
          name,
          restaurant:restaurant_id(
            name,
            address,
            phone_number
          )
        ),
        user:user_id(
          email,
          raw_user_meta_data
        )
      )
    `)
    .eq("driver_id", driverId)
    .in("status", ["assigned", "accepted", "picked_up"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data;
}

// Get driver's job history
export async function getDriverJobHistory(driverId: string, limit = 20) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      schedule:schedule_id(
        meal:meal_id(name),
        user:user_id(raw_user_meta_data)
      )
    `)
    .eq("driver_id", driverId)
    .in("status", ["delivered", "failed", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}
```

#### API 4: Admin Management
```typescript
// src/lib/delivery/admin.ts

import { supabase } from "@/integrations/supabase/client";

// Get all pending deliveries
export async function getPendingDeliveries() {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      driver:driver_id(*),
      schedule:schedule_id(
        *,
        meal:meal_id(name, image_url),
        user:user_id(
          email,
          raw_user_meta_data
        )
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  
  if (error) throw error;
  return data;
}

// Get all active deliveries
export async function getActiveDeliveries() {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      driver:driver_id(*),
      schedule:schedule_id(
        *,
        meal:meal_id(name, image_url),
        user:user_id(
          email,
          raw_user_meta_data
        )
      )
    `)
    .in("status", ["assigned", "accepted", "picked_up"])
    .order("created_at", { ascending: true });
  
  if (error) throw error;
  return data;
}

// Get all online drivers with locations
export async function getOnlineDrivers() {
  const { data, error } = await supabase
    .from("drivers")
    .select(`
      *,
      user:user_id(email, raw_user_meta_data)
    `)
    .eq("is_online", true)
    .eq("is_active", true);
  
  if (error) throw error;
  return data;
}

// Manually assign driver to job
export async function adminAssignDriver(jobId: string, driverId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      driver_id: driverId,
      status: "assigned",
      assigned_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Reassign job to different driver
export async function adminReassignDriver(jobId: string, newDriverId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      driver_id: newDriverId,
      status: "assigned",
      assigned_at: new Date().toISOString()
    })
    .eq("id", jobId)
    .in("status", ["assigned", "accepted"])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Cancel delivery job
export async function adminCancelJob(jobId: string, reason: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .update({
      status: "cancelled",
      failure_reason: reason
    })
    .eq("id", jobId)
    .not("status", "in", ["delivered", "failed", "cancelled"])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Get delivery statistics
export async function getDeliveryStats(dateRange?: { start: string; end: string }) {
  let query = supabase
    .from("delivery_jobs")
    .select("status, created_at");
  
  if (dateRange) {
    query = query
      .gte("created_at", dateRange.start)
      .lte("created_at", dateRange.end);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  // Calculate stats
  const stats = {
    total: data.length,
    pending: data.filter(j => j.status === "pending").length,
    assigned: data.filter(j => j.status === "assigned").length,
    picked_up: data.filter(j => j.status === "picked_up").length,
    delivered: data.filter(j => j.status === "delivered").length,
    failed: data.filter(j => j.status === "failed").length,
    cancelled: data.filter(j => j.status === "cancelled").length
  };
  
  return stats;
}
```

#### API 5: Customer Tracking
```typescript
// src/lib/delivery/tracking.ts

import { supabase } from "@/integrations/supabase/client";

// Get delivery tracking info for customer
export async function getDeliveryTracking(scheduleId: string) {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(`
      *,
      driver:driver_id(
        id,
        phone_number,
        vehicle_type,
        rating,
        total_deliveries,
        current_location,
        user:user_id(
          raw_user_meta_data
        )
      )
    `)
    .eq("schedule_id", scheduleId)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// Get driver current location
export async function getDriverLocation(driverId: string) {
  const { data, error } = await supabase
    .from("driver_locations")
    .select("*")
    .eq("driver_id", driverId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// Subscribe to delivery updates (real-time)
export function subscribeToDeliveryUpdates(
  scheduleId: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel(`delivery-${scheduleId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "delivery_jobs",
        filter: `schedule_id=eq.${scheduleId}`
      },
      callback
    )
    .subscribe();
}
```

### Day 5: Testing & Validation

- [ ] Run all database migrations
- [ ] Test driver online/offline
- [ ] Test location updates
- [ ] Test job assignment algorithm
- [ ] Test all driver actions
- [ ] Test admin functions
- [ ] Run typecheck
- [ ] Write API tests

**Week 1 Deliverables:**
- ✅ 4 database migration files
- ✅ Complete backend API
- ✅ Assignment algorithm
- ✅ Status sync triggers
- ✅ All API functions

---

## WEEK 2: Driver Mobile Application

### Day 1-2: Driver App Foundation

#### Component 1: Driver Layout & Navigation
```typescript
// src/components/driver/DriverLayout.tsx

import { useState, useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  History, 
  User, 
  Power,
  MapPin
} from "lucide-react";

export function DriverLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDriverProfile();
  }, [user]);

  const fetchDriverProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("user_id", user.id)
      .single();
    
    if (error) {
      console.error("Error fetching driver:", error);
      navigate("/driver/register");
      return;
    }
    
    setDriver(data);
    setIsOnline(data.is_online);
    setLoading(false);
  };

  const toggleOnline = async () => {
    if (!driver) return;
    
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    if (newStatus) {
      await driverGoOnline(driver.id);
      startLocationTracking();
    } else {
      await driverGoOffline(driver.id);
      stopLocationTracking();
    }
  };

  // ... location tracking logic

  if (loading) return <DriverSkeleton />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">Nutrio Driver</h1>
            <p className="text-sm opacity-80">
              {isOnline ? "🟢 Online" : "🔴 Offline"}
            </p>
          </div>
          <Button
            variant={isOnline ? "destructive" : "secondary"}
            size="sm"
            onClick={toggleOnline}
          >
            <Power className="w-4 h-4 mr-2" />
            {isOnline ? "Go Offline" : "Go Online"}
          </Button>
        </div>
        
        {isOnline && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4" />
            <span>Location sharing active</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet context={{ driver, isOnline }} />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-background border-t border-border p-2">
        <div className="flex justify-around">
          <NavButton to="/driver" icon={Home} label="Home" />
          <NavButton to="/driver/history" icon={History} label="History" />
          <NavButton to="/driver/profile" icon={User} label="Profile" />
        </div>
      </nav>
    </div>
  );
}
```

#### Component 2: Driver Home (Job List)
```typescript
// src/pages/driver/DriverHome.tsx

import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  getDriverCurrentJob, 
  driverAcceptJob,
  getDriverJobHistory 
} from "@/lib/delivery/driver-actions";
import { 
  MapPin, 
  Clock, 
  Star, 
  Navigation,
  Phone,
  CheckCircle2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function DriverHome() {
  const { driver, isOnline } = useOutletContext<{ driver: any; isOnline: boolean }>();
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [job, history] = await Promise.all([
        getDriverCurrentJob(driver.id),
        getDriverJobHistory(driver.id, 5)
      ]);
      
      setCurrentJob(job);
      setRecentJobs(history || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      await driverAcceptJob(driver.id, currentJob.id);
      toast({ title: "Job accepted!" });
      fetchData();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not accept job",
        variant: "destructive" 
      });
    }
  };

  if (loading) return <DriverSkeleton />;

  return (
    <div className="p-4 space-y-4">
      {/* Stats Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{driver.total_earnings || 0}</p>
              <p className="text-xs text-muted-foreground">QAR Earned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{driver.total_deliveries || 0}</p>
              <p className="text-xs text-muted-foreground">Deliveries</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Job */}
      {currentJob ? (
        <CurrentJobCard job={currentJob} onUpdate={fetchData} />
      ) : (
        <Card className="bg-muted">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              {isOnline 
                ? "No active jobs. Waiting for assignments..."
                : "Go online to receive delivery requests"
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      <div>
        <h2 className="font-semibold mb-3">Recent Deliveries</h2>
        <div className="space-y-2">
          {recentJobs.map((job) => (
            <JobHistoryCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Day 3-4: Job Workflow Components

#### Component 3: New Job Notification (Modal)
```typescript
// src/components/driver/NewJobModal.tsx

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  driverAcceptJob, 
  driverRejectJob 
} from "@/lib/delivery/driver-actions";
import { MapPin, Clock, DollarSign, Navigation } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  job: any;
  driverId: string;
  onClose: () => void;
}

export function NewJobModal({ job, driverId, onClose }: Props) {
  const [countdown, setCountdown] = useState(60);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      handleReject(); // Auto-reject on timeout
    }
  }, [countdown]);

  const handleAccept = async () => {
    setResponding(true);
    try {
      await driverAcceptJob(driverId, job.id);
      toast({ title: "Job accepted!" });
      onClose();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Job no longer available",
        variant: "destructive" 
      });
      onClose();
    }
  };

  const handleReject = async () => {
    setResponding(true);
    try {
      await driverRejectJob(driverId, job.id);
    } catch (err) {
      console.error("Error rejecting job:", err);
    }
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Navigation className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">New Delivery Request</h2>
          <p className="text-sm text-muted-foreground">
            Auto-decline in {countdown}s
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{job.schedule.meal.restaurant.name}</p>
              <p className="text-sm text-muted-foreground">
                {job.schedule.meal.restaurant.address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm">Pickup in ~10 minutes</p>
          </div>

          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            <p className="font-medium">{job.driver_earnings} QAR</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleReject}
            disabled={responding}
          >
            Decline
          </Button>
          <Button 
            className="flex-1"
            onClick={handleAccept}
            disabled={responding}
          >
            Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### Component 4: Active Job (Pickup & Delivery)
```typescript
// src/components/driver/ActiveJobCard.tsx

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  driverPickupJob, 
  driverDeliverJob,
  driverFailJob 
} from "@/lib/delivery/driver-actions";
import { 
  MapPin, 
  Phone, 
  Navigation,
  Camera,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  job: any;
  onUpdate: () => void;
}

export function ActiveJobCard({ job, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");

  const handlePickup = async () => {
    setLoading(true);
    try {
      // In real app, would take photo here
      await driverPickupJob(job.driver_id, job.id);
      toast({ title: "Pickup confirmed!" });
      onUpdate();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not confirm pickup",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeliver = async () => {
    setLoading(true);
    try {
      await driverDeliverJob(job.driver_id, job.id, otp || undefined);
      toast({ title: "Delivery completed!" });
      onUpdate();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not confirm delivery",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    assigned: { label: "New Job", color: "bg-blue-500" },
    accepted: { label: "Navigate to Pickup", color: "bg-yellow-500" },
    picked_up: { label: "Deliver to Customer", color: "bg-orange-500" }
  };

  const config = statusConfig[job.status as keyof typeof statusConfig];

  return (
    <Card className="border-2 border-primary">
      <CardContent className="p-4 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge className={config.color}>{config.label}</Badge>
          <span className="text-sm text-muted-foreground">
            {job.status === "assigned" && "Accept to start"}
            {job.status === "accepted" && "Go to restaurant"}
            {job.status === "picked_up" && "Go to customer"}
          </span>
        </div>

        {/* Restaurant Info (Pickup) */}
        {job.status !== "picked_up" && (
          <div className="bg-muted p-3 rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Pickup Location
            </h3>
            <p className="font-medium">{job.schedule.meal.restaurant.name}</p>
            <p className="text-sm text-muted-foreground">
              {job.schedule.meal.restaurant.address}
            </p>
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={() => window.open(
                `https://maps.google.com/?q=${encodeURIComponent(job.schedule.meal.restaurant.address)}`,
                '_blank'
              )}
            >
              <Navigation className="w-4 h-4 mr-2" />
              Navigate
            </Button>
          </div>
        )}

        {/* Customer Info (Delivery) */}
        {job.status === "picked_up" && (
          <div className="bg-muted p-3 rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Delivery Location
            </h3>
            <p className="font-medium">
              {job.schedule.user.raw_user_meta_data?.name || "Customer"}
            </p>
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={() => {/* Navigate to customer */}}
            >
              <Navigation className="w-4 h-4 mr-2" />
              Navigate
            </Button>
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={() => window.open(`tel:${job.schedule.user.raw_user_meta_data?.phone}`)}
            >
              <Phone className="w-4 h-4 mr-2" />
              Call Customer
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        {job.status === "accepted" && (
          <Button 
            className="w-full h-14"
            onClick={handlePickup}
            disabled={loading}
          >
            <Camera className="w-5 h-5 mr-2" />
            Confirm Pickup
          </Button>
        )}

        {job.status === "picked_up" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter OTP (if required)"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <Button 
              className="w-full h-14"
              onClick={handleDeliver}
              disabled={loading}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Confirm Delivery
            </Button>
          </div>
        )}

        {/* Emergency Actions */}
        <Button 
          variant="ghost" 
          className="w-full text-destructive"
          onClick={() => {/* Report issue */}}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Report Issue
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Day 5: Driver App Testing

- [ ] Test driver registration
- [ ] Test online/offline toggle
- [ ] Test location tracking
- [ ] Test job assignment flow
- [ ] Test pickup workflow
- [ ] Test delivery workflow
- [ ] Test job history
- [ ] Test earnings display

**Week 2 Deliverables:**
- ✅ Complete driver mobile app
- ✅ Real-time job assignment
- ✅ Pickup & delivery workflow
- ✅ Navigation integration
- ✅ Earnings tracking

---

## WEEK 3: Admin Dashboard & Partner Integration

### Day 1-2: Admin Delivery Dashboard

#### Page 1: AdminDeliveries.tsx
```typescript
// src/pages/admin/AdminDeliveries.tsx

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  getPendingDeliveries,
  getActiveDeliveries,
  autoAssignAllPendingJobs,
  adminAssignDriver,
  getOnlineDrivers
} from "@/lib/delivery/admin";
import { 
  Truck, 
  Clock, 
  MapPin,
  User,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminDeliveries() {
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    assigned: 0,
    picked_up: 0,
    delivered: 0
  });
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [pending, active, drivers] = await Promise.all([
        getPendingDeliveries(),
        getActiveDeliveries(),
        getOnlineDrivers()
      ]);
      
      setPendingJobs(pending || []);
      setActiveJobs(active || []);
      setOnlineDrivers(drivers || []);
      
      // Calculate stats
      setStats({
        pending: pending?.length || 0,
        assigned: active?.filter(j => j.status === "assigned").length || 0,
        picked_up: active?.filter(j => j.status === "picked_up").length || 0,
        delivered: active?.filter(j => j.status === "delivered").length || 0
      });
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    setAssigning(true);
    try {
      const result = await autoAssignAllPendingJobs();
      toast({ 
        title: "Auto-assign complete",
        description: `${result.assigned} assigned, ${result.failed} failed`
      });
      fetchData();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not auto-assign",
        variant: "destructive" 
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Delivery Management</h1>
          <p className="text-muted-foreground">
            Manage all delivery operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading && "animate-spin"}`} />
            Refresh
          </Button>
          <Button 
            onClick={handleAutoAssign}
            disabled={assigning || pendingJobs.length === 0}
          >
            <Truck className="w-4 h-4 mr-2" />
            Auto-Assign All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard 
          title="Pending" 
          value={stats.pending} 
          icon={Clock}
          color="bg-yellow-500"
        />
        <StatsCard 
          title="Assigned" 
          value={stats.assigned} 
          icon={User}
          color="bg-blue-500"
        />
        <StatsCard 
          title="In Transit" 
          value={stats.picked_up} 
          icon={Truck}
          color="bg-orange-500"
        />
        <StatsCard 
          title="Delivered Today" 
          value={stats.delivered} 
          icon={CheckCircle2}
          color="bg-green-500"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeJobs.length})
          </TabsTrigger>
          <TabsTrigger value="drivers">
            Online Drivers ({onlineDrivers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingJobs.length === 0 ? (
            <EmptyState message="No pending deliveries" />
          ) : (
            pendingJobs.map((job) => (
              <PendingJobCard 
                key={job.id} 
                job={job} 
                drivers={onlineDrivers}
                onUpdate={fetchData}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeJobs.length === 0 ? (
            <EmptyState message="No active deliveries" />
          ) : (
            activeJobs.map((job) => (
              <ActiveJobCard key={job.id} job={job} />
            ))
          )}
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          {onlineDrivers.length === 0 ? (
            <EmptyState message="No online drivers" />
          ) : (
            onlineDrivers.map((driver) => (
              <DriverCard key={driver.id} driver={driver} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Day 3: Partner Portal Updates

#### Component: PartnerDeliveryHandoff.tsx
```typescript
// src/components/partner/PartnerDeliveryHandoff.tsx

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { 
  Truck, 
  MapPin, 
  Phone,
  Clock,
  CheckCircle2,
  Printer
} from "lucide-react";

interface Props {
  order: any;
}

export function PartnerDeliveryHandoff({ order }: Props) {
  const [deliveryJob, setDeliveryJob] = useState<any>(null);

  useEffect(() => {
    // Subscribe to delivery job updates
    const subscription = supabase
      .channel(`delivery-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_jobs",
          filter: `schedule_id=eq.${order.id}`
        },
        (payload) => setDeliveryJob(payload.new)
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [order.id]);

  if (!deliveryJob) {
    return (
      <Card className="bg-muted">
        <CardContent className="p-6 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p>Waiting for driver assignment...</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    pending: { label: "Finding Driver", color: "bg-yellow-500" },
    assigned: { label: "Driver Assigned", color: "bg-blue-500" },
    accepted: { label: "Driver Coming", color: "bg-blue-500" },
    picked_up: { label: "Picked Up", color: "bg-green-500" },
    delivered: { label: "Delivered", color: "bg-green-500" }
  };

  const config = statusConfig[deliveryJob.status as keyof typeof statusConfig];

  return (
    <Card className="border-2 border-primary">
      <CardContent className="p-6 space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <Badge className={config.color}>{config.label}</Badge>
          {deliveryJob.status === "picked_up" && (
            <span className="text-sm text-muted-foreground">
              Handed over at {format(new Date(deliveryJob.picked_up_at), "h:mm a")}
            </span>
          )}
        </div>

        {/* QR Code (Show until picked up) */}
        {deliveryJob.status !== "picked_up" && deliveryJob.status !== "delivered" && (
          <div className="text-center space-y-3">
            <p className="font-medium">Show this QR to driver:</p>
            <div className="inline-block p-4 bg-white rounded-lg">
              <QRCodeSVG 
                value={deliveryJob.id} 
                size={200}
                level="H"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Order #{order.id.slice(-6)}
            </p>
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Print QR Code
            </Button>
          </div>
        )}

        {/* Driver Info (When assigned) */}
        {deliveryJob.driver && deliveryJob.status !== "delivered" && (
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Driver Information
            </h4>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {deliveryJob.driver.user?.raw_user_meta_data?.name || "Driver"}
                </p>
                <p className="text-sm text-muted-foreground">
                  ⭐ {deliveryJob.driver.rating} • {deliveryJob.driver.total_deliveries} deliveries
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open(`tel:${deliveryJob.driver.phone_number}`)}
            >
              <Phone className="w-4 h-4 mr-2" />
              Call Driver
            </Button>
          </div>
        )}

        {/* Delivery Complete */}
        {deliveryJob.status === "delivered" && (
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p className="font-semibold text-green-700">Successfully Delivered</p>
            <p className="text-sm text-green-600">
              {format(new Date(deliveryJob.delivered_at), "MMM d, h:mm a")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Day 4-5: Real-time Features & Testing

#### Real-time Tracking Component
```typescript
// src/components/delivery/LiveTracking.tsx

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Navigation, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  scheduleId: string;
  driverId: string;
}

export function LiveTracking({ scheduleId, driverId }: Props) {
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [eta, setEta] = useState<string>("Calculating...");

  useEffect(() => {
    // Subscribe to driver location updates
    const subscription = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${driverId}`
        },
        (payload) => {
          setDriverLocation(payload.new);
          calculateETA(payload.new.location);
        }
      )
      .subscribe();

    // Get initial location
    fetchDriverLocation();

    return () => subscription.unsubscribe();
  }, [driverId]);

  const fetchDriverLocation = async () => {
    const { data } = await supabase
      .from("driver_locations")
      .select("*")
      .eq("driver_id", driverId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();
    
    if (data) {
      setDriverLocation(data);
      calculateETA(data.location);
    }
  };

  const calculateETA = (location: any) => {
    // Parse PostGIS point
    const match = location?.match(/POINT\(([^ ]+) ([^)]+)\)/);
    if (!match) return;
    
    const driverLng = parseFloat(match[1]);
    const driverLat = parseFloat(match[2]);
    
    // In real app, use Google Maps Distance Matrix API
    // For now, estimate based on straight-line distance
    setEta("5-8 minutes");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="aspect-video bg-muted rounded-lg relative overflow-hidden">
          {/* Placeholder for map - integrate Google Maps or Mapbox */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">
                Driver is on the way
              </p>
            </div>
          </div>
          
          {/* Driver marker */}
          {driverLocation && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg animate-pulse" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Arriving in</p>
            <p className="text-2xl font-bold text-primary">{eta}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <Navigation className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Phone className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Week 3 Deliverables:**
- ✅ Admin delivery dashboard
- ✅ Real-time delivery management
- ✅ Partner QR code handoff
- ✅ Live tracking component
- ✅ Driver assignment interface

---

## WEEK 4: Customer Features, Testing & Launch

### Day 1-2: Customer Portal Updates

#### Page: Customer Order Tracking
```typescript
// src/pages/OrderTracking.tsx (Update existing)

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  getDeliveryTracking,
  subscribeToDeliveryUpdates 
} from "@/lib/delivery/tracking";
import { LiveTracking } from "@/components/delivery/LiveTracking";
import { 
  Truck, 
  CheckCircle2, 
  Clock,
  MapPin,
  Phone
} from "lucide-react";
import { format } from "date-fns";

export default function OrderTracking() {
  const { orderId } = useParams();
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDelivery();
    
    // Subscribe to real-time updates
    const subscription = subscribeToDeliveryUpdates(orderId!, (payload) => {
      setDelivery(payload.new);
    });

    return () => subscription.unsubscribe();
  }, [orderId]);

  const fetchDelivery = async () => {
    try {
      const data = await getDeliveryTracking(orderId!);
      setDelivery(data);
    } catch (err) {
      console.error("Error fetching delivery:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStep = () => {
    const steps = ["assigned", "accepted", "picked_up", "delivered"];
    const currentIndex = steps.indexOf(delivery?.status);
    return currentIndex >= 0 ? currentIndex : 0;
  };

  return (
    <div className="container max-w-md mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold">Order #{orderId?.slice(-6)}</h1>
        <p className="text-muted-foreground">
          {delivery?.schedule.meal.name}
        </p>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <TimelineStep 
              icon={Clock}
              label="Order Confirmed"
              time={delivery?.schedule.created_at}
              completed={true}
            />
            <TimelineStep 
              icon={CheckCircle2}
              label="Preparing"
              completed={true}
            />
            <TimelineStep 
              icon={CheckCircle2}
              label="Ready for Pickup"
              completed={delivery?.status !== "pending"}
              active={delivery?.status === "assigned"}
            />
            <TimelineStep 
              icon={Truck}
              label="Out for Delivery"
              completed={["picked_up", "delivered"].includes(delivery?.status)}
              active={delivery?.status === "picked_up"}
            />
            <TimelineStep 
              icon={MapPin}
              label="Delivered"
              completed={delivery?.status === "delivered"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Live Tracking */}
      {delivery?.status === "picked_up" && delivery?.driver && (
        <LiveTracking 
          scheduleId={orderId!}
          driverId={delivery.driver_id}
        />
      )}

      {/* Driver Info */}
      {delivery?.driver && delivery?.status !== "delivered" && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Your Driver</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {delivery.driver.user?.raw_user_meta_data?.name || "Driver"}
                </p>
                <p className="text-sm text-muted-foreground">
                  ⭐ {delivery.driver.rating} • {delivery.driver.vehicle_type}
                </p>
              </div>
              <Button variant="outline" size="icon">
                <Phone className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Complete */}
      {delivery?.status === "delivered" && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-3 text-green-500" />
            <h3 className="text-xl font-bold text-green-700">Delivered!</h3>
            <p className="text-green-600">
              Your order was delivered at{" "}
              {format(new Date(delivery.delivered_at), "h:mm a")}
            </p>
            <Button className="mt-4 w-full">
              Confirm Receipt
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Day 3-4: Testing & Edge Cases

#### Test Plan Document
```typescript
// tests/delivery-system.test.ts

describe("Delivery System", () => {
  describe("Driver Assignment", () => {
    it("should create delivery job when meal marked ready", async () => {
      // Test trigger
    });
    
    it("should assign nearest online driver", async () => {
      // Test assignment algorithm
    });
    
    it("should handle no drivers available", async () => {
      // Test queue behavior
    });
    
    it("should reassign when driver rejects", async () => {
      // Test reassignment
    });
  });

  describe("Status Transitions", () => {
    it("should sync pickup to meal_schedules", async () => {
      // Test trigger sync
    });
    
    it("should sync delivery to meal_schedules", async () => {
      // Test trigger sync
    });
    
    it("should prevent invalid status changes", async () => {
      // Test validation
    });
  });

  describe("Real-time Tracking", () => {
    it("should update driver location", async () => {
      // Test location updates
    });
    
    it("should broadcast to customers", async () => {
      // Test WebSocket
    });
    
    it("should clean up old locations", async () => {
      // Test retention
    });
  });
});
```

#### Edge Case Testing
- [ ] Driver goes offline mid-delivery
- [ ] Customer not available
- [ ] Wrong address
- [ ] Restaurant delays
- [ ] Multiple assignments
- [ ] App crashes
- [ ] Network failures

### Day 5: Launch Preparation

#### Final Checklist
- [ ] All database migrations applied
- [ ] Backend APIs tested
- [ ] Driver app tested on mobile
- [ ] Admin dashboard tested
- [ ] Customer tracking tested
- [ ] Real-time updates working
- [ ] Push notifications configured
- [ ] Error monitoring setup
- [ ] Documentation complete

#### Launch Strategy
1. **Soft Launch**: 1-2 drivers, limited area
2. **Monitor**: Track all metrics for 1 week
3. **Iterate**: Fix issues, optimize
4. **Scale**: Add more drivers, expand area

---

## SUMMARY: 4-Week Implementation

### Week 1: Foundation
- ✅ 4 database migrations
- ✅ Complete backend API
- ✅ Assignment algorithm
- ✅ Status sync triggers

### Week 2: Driver App
- ✅ Mobile interface
- ✅ Job assignment flow
- ✅ Pickup & delivery
- ✅ Real-time tracking

### Week 3: Admin & Partner
- ✅ Admin dashboard
- ✅ Partner QR handoff
- ✅ Driver management
- ✅ Live operations

### Week 4: Customer & Launch
- ✅ Customer tracking
- ✅ Complete testing
- ✅ Edge cases handled
- ✅ Launch ready

---

## Deliverables

### Database
- `20260224000001_create_drivers_table.sql`
- `20260224000002_create_delivery_jobs_table.sql`
- `20260224000003_create_driver_locations_table.sql`
- `20260224000004_create_delivery_triggers.sql`

### Backend APIs
- `src/integrations/supabase/delivery.ts`
- `src/lib/delivery/assignment.ts`
- `src/lib/delivery/driver-actions.ts`
- `src/lib/delivery/admin.ts`
- `src/lib/delivery/tracking.ts`

### Frontend Components
- Driver: `DriverLayout`, `DriverHome`, `ActiveJobCard`, `NewJobModal`
- Admin: `AdminDeliveries`, `PendingJobCard`, `DriverCard`
- Partner: `PartnerDeliveryHandoff`, `QRCodeDisplay`
- Customer: `OrderTracking`, `LiveTracking`, `TimelineStep`

### Documentation
- ✅ `delivery_analysis.md` - Deep analysis
- ✅ `delivery_implementation_plan.md` - This document

---

## READY TO IMPLEMENT?

**This plan gives you:**
- Week-by-week breakdown
- Complete code examples
- Database migrations
- API specifications
- UI components
- Testing checklist
- Launch strategy

**Say "START IMPLEMENTATION" and I'll begin with Week 1 (Database migrations)!**
