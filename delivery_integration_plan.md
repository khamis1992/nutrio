# Delivery Management System - Integration Plan
## Assumes Order Workflow Already Implemented

## Current System State (Assumed)

### ✅ Already Implemented (Order Workflow):
- `meal_schedules` table with `order_status` field
- Status workflow: PENDING → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
- Partner portal can mark meals as READY
- Status validation and history tracking
- Customer can confirm delivery

### ❌ NOT Implemented (This is what we build):
- Driver assignment system
- Driver mobile interface
- Real-time delivery tracking
- Admin delivery dashboard

## Integration Point

**When Partner marks meal as READY → Our system takes over**

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING SYSTEM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Partner marks meal as READY                                    │
│       │                                                          │
│       ▼                                                          │
│  meal_schedules.order_status = 'ready'                          │
│       │                                                          │
│       ▼                                                          │
├─────────────────────────────────────────────────────────────────┤
│                    OUR DELIVERY SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│       │                                                          │
│       ▼                                                          │
│  TRIGGER: When status = 'ready'                                 │
│       │                                                          │
│       ▼                                                          │
│  Create delivery_jobs entry                                     │
│       │                                                          │
│       ▼                                                          │
│  Assign nearest driver                                          │
│       │                                                          │
│       ▼                                                          │
│  Driver picks up → Update status to 'out_for_delivery'          │
│       │                                                          │
│       ▼                                                          │
│  Driver delivers → Update status to 'delivered'                 │
│       │                                                          │
│       ▼                                                          │
├─────────────────────────────────────────────────────────────────┤
│                    BACK TO EXISTING SYSTEM                      │
├─────────────────────────────────────────────────────────────────┤
│       │                                                          │
│       ▼                                                          │
│  Customer confirms → status = 'completed'                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema (Minimal - Plugs Into Existing)

```sql
-- NEW TABLE 1: Drivers
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  phone_number VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(20) DEFAULT 'car', -- 'bike', 'car'
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  current_location GEOGRAPHY(POINT),
  last_location_update TIMESTAMP,
  total_deliveries INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 5.0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- NEW TABLE 2: Delivery Jobs (Links to meal_schedules)
CREATE TABLE delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES meal_schedules(id) NOT NULL,
  driver_id UUID REFERENCES drivers(id),
  
  -- Status tracks delivery-specific state
  delivery_status VARCHAR(50) DEFAULT 'pending' CHECK (delivery_status IN (
    'pending',           -- Waiting for driver assignment
    'assigned',          -- Driver assigned, not yet accepted
    'accepted',          -- Driver accepted
    'picked_up',         -- Driver collected food
    'in_transit',        -- On the way to customer
    'delivered',         -- Driver marked as delivered
    'failed',            -- Could not deliver
    'cancelled'          -- Cancelled
  )),
  
  -- Timing
  assigned_at TIMESTAMP,
  accepted_at TIMESTAMP,
  picked_up_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  -- Delivery details
  delivery_notes TEXT,
  pickup_photo_url TEXT,
  delivery_photo_url TEXT,
  customer_otp VARCHAR(10), -- For verification
  
  -- Financial
  driver_earnings DECIMAL(10,2) DEFAULT 15.00, -- Fixed rate
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- NEW TABLE 3: Driver Locations (Real-time tracking)
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id),
  location GEOGRAPHY(POINT) NOT NULL,
  accuracy_meters DECIMAL(8,2),
  heading DECIMAL(5,2),
  speed_kmh DECIMAL(5,2),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_delivery_jobs_schedule_id ON delivery_jobs(schedule_id);
CREATE INDEX idx_delivery_jobs_driver_id ON delivery_jobs(driver_id);
CREATE INDEX idx_delivery_jobs_status ON delivery_jobs(delivery_status);
CREATE INDEX idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_timestamp ON driver_locations(timestamp);
```

## Trigger: Auto-Create Delivery Job

```sql
-- When meal_schedules.order_status changes to 'ready', create delivery job
CREATE OR REPLACE FUNCTION create_delivery_job_on_ready()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_status = 'ready' AND OLD.order_status != 'ready' THEN
        INSERT INTO delivery_jobs (schedule_id, delivery_status)
        VALUES (NEW.id, 'pending');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_delivery_job
AFTER UPDATE OF order_status ON meal_schedules
FOR EACH ROW
EXECUTE FUNCTION create_delivery_job_on_ready();
```

## Trigger: Sync Status Back to meal_schedules

```sql
-- When delivery job status changes, update meal_schedules
CREATE OR REPLACE FUNCTION sync_delivery_status_to_schedule()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.delivery_status = 'picked_up' AND OLD.delivery_status != 'picked_up' THEN
        UPDATE meal_schedules 
        SET order_status = 'out_for_delivery',
            updated_at = NOW()
        WHERE id = NEW.schedule_id;
    END IF;
    
    IF NEW.delivery_status = 'delivered' AND OLD.delivery_status != 'delivered' THEN
        UPDATE meal_schedules 
        SET order_status = 'delivered',
            updated_at = NOW()
        WHERE id = NEW.schedule_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_delivery_status
AFTER UPDATE OF delivery_status ON delivery_jobs
FOR EACH ROW
EXECUTE FUNCTION sync_delivery_status_to_schedule();
```

## Simplified Phases (Integration Focus)

### Phase 1: Database & Backend (Week 1)
- [ ] Create 3 tables: drivers, delivery_jobs, driver_locations
- [ ] Create triggers for auto-creation and status sync
- [ ] Build driver assignment API (nearest driver)
- [ ] Build delivery status update API
- [ ] Build admin endpoints for delivery management

### Phase 2: Driver Mobile App (Week 2)
- [ ] Driver login/authentication
- [ ] Online/offline toggle
- [ ] View assigned jobs
- [ ] Accept/reject job
- [ ] Mark picked up (triggers status change)
- [ ] Mark delivered (triggers status change)
- [ ] Real-time location updates

### Phase 3: Admin Dashboard (Week 3)
- [ ] View all pending deliveries (jobs with status 'pending')
- [ ] Assign driver button (manual assignment)
- [ ] View driver locations on map
- [ ] Track delivery progress
- [ ] Driver management (add, edit, deactivate)

### Phase 4: Customer Features (Week 4)
- [ ] Real-time driver tracking (view on map)
- [ ] Driver info display (name, photo, vehicle)
- [ ] Call driver button
- [ ] Delivery notifications (push notifications)

## API Endpoints

### Driver Endpoints
```typescript
// Driver Auth
POST /api/drivers/login
POST /api/drivers/register

// Driver Status
POST /api/drivers/:id/online
POST /api/drivers/:id/offline
POST /api/drivers/:id/location

// Job Management
GET /api/drivers/:id/jobs/pending
POST /api/jobs/:jobId/accept
POST /api/jobs/:jobId/pickup
POST /api/jobs/:jobId/deliver
POST /api/jobs/:jobId/fail
```

### Admin Endpoints
```typescript
// Delivery Management
GET /api/admin/deliveries/pending
GET /api/admin/deliveries/active
POST /api/admin/deliveries/:jobId/assign-driver
GET /api/admin/drivers
POST /api/admin/drivers
PUT /api/admin/drivers/:id
```

### Customer Endpoints
```typescript
// Tracking
GET /api/deliveries/:scheduleId/tracking
GET /api/deliveries/:scheduleId/driver-info
```

## Driver Assignment Algorithm

```typescript
// Simple: Find nearest online driver
async function assignDriver(jobId: string) {
  const job = await getDeliveryJob(jobId);
  const restaurantLocation = await getRestaurantLocation(job.schedule_id);
  
  // Find online drivers
  const onlineDrivers = await db.drivers
    .where('is_online', true)
    .where('is_active', true)
    .get();
  
  if (onlineDrivers.length === 0) return null;
  
  // Calculate distances
  const driversWithDistance = onlineDrivers.map(driver => ({
    driver,
    distance: calculateDistance(driver.current_location, restaurantLocation)
  }));
  
  // Sort by distance
  driversWithDistance.sort((a, b) => a.distance - b.distance);
  
  // Assign nearest driver
  const nearestDriver = driversWithDistance[0].driver;
  
  await db.delivery_jobs
    .where('id', jobId)
    .update({
      driver_id: nearestDriver.id,
      delivery_status: 'assigned',
      assigned_at: new Date()
    });
  
  // Send notification to driver
  await notifyDriver(nearestDriver.id, 'New delivery job assigned');
  
  return nearestDriver;
}
```

## UI Integration

### Customer Portal (Existing Pages)

**OrderDetail.tsx** - Add tracking section:
```tsx
{order.status === 'out_for_delivery' && (
  <DeliveryTracking 
    scheduleId={order.id}
    driverInfo={order.driver}
  />
)}
```

**OrderHistory.tsx** - Add delivery status:
```tsx
// Already shows status, no changes needed
// Status comes from meal_schedules.order_status
```

### Admin Dashboard (New Pages)

**AdminDeliveries.tsx**:
```tsx
// Show pending deliveries
// Button: "Assign Driver" 
// Button: "Track on Map"
// List: Driver locations
```

### Driver Portal (New Pages)

**DriverDashboard.tsx**:
```tsx
// Toggle: Online/Offline
// List: Assigned jobs
// Button: Accept/Decline
// Button: Pickup/Delivered
// Earnings display
```

## What We DON'T Touch (Already Exists)

❌ **Partner Portal** - Partners mark meals as READY (already implemented)  
❌ **Status Workflow** - PENDING → CONFIRMED → PREPARING → READY (already implemented)  
❌ **Customer Confirmation** - Customer marks DELIVERED → COMPLETED (already implemented)  
❌ **Order History** - Status history tracking (already implemented)  

## What We BUILD (New)

✅ **Driver Management** - Register drivers, track locations  
✅ **Auto-Assignment** - When meal is READY, assign driver  
✅ **Driver Mobile App** - Accept jobs, update status  
✅ **Status Sync** - Driver actions update meal_schedules.order_status  
✅ **Real-time Tracking** - Customer sees driver location  
✅ **Admin Dashboard** - Manage deliveries and drivers  

## Testing Checklist

### Integration Testing:
- [ ] Partner marks READY → Delivery job created automatically
- [ ] Driver assigned → meal_schedules.status stays 'ready'
- [ ] Driver marks PICKED UP → meal_schedules.status changes to 'out_for_delivery'
- [ ] Driver marks DELIVERED → meal_schedules.status changes to 'delivered'
- [ ] Customer confirms → meal_schedules.status changes to 'completed'

### Flow Testing:
- [ ] Full flow: READY → assigned → accepted → picked_up → delivered → completed
- [ ] Driver rejection → Reassign to next driver
- [ ] No drivers available → Queue job, notify admin
- [ ] Driver goes offline mid-delivery → Reassign job

## Summary

This plan **plugs into the existing Order Workflow** without changing it:

1. **Partner** marks meal READY (existing)
2. **Our system** creates delivery job and assigns driver (NEW)
3. **Driver** picks up → status changes to OUT_FOR_DELIVERY (NEW)
4. **Driver** delivers → status changes to DELIVERED (NEW)
5. **Customer** confirms → status changes to COMPLETED (existing)

**Timeline: 4 weeks**  
**Tables: 3 new tables**  
**Integration: Seamless with existing meal_schedules**

---

**Ready to implement? Say "APPROVED" and I'll start with database migrations!**
