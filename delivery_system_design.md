# Delivery Logistics System - Comprehensive Design Document

## Executive Summary

This document outlines a complete delivery management system for Nutrio Fuel that handles the complex logistics of multi-restaurant meal delivery while maintaining food quality and customer satisfaction.

## 1. The Core Challenge: Multi-Restaurant Orders

### Problem Statement
When a customer orders meals from multiple restaurants (e.g., breakfast from Restaurant A, lunch from Restaurant B, dinner from Restaurant C), we face:

1. **Different Prep Times**: Each restaurant has different cooking speeds
2. **Food Temperature**: Hot meals get cold while waiting for others
3. **Driver Efficiency**: Multiple pickup locations vs. direct routes
4. **Customer Experience**: Wait time vs. multiple deliveries

### Solution: "Smart Batching with Priority Queue"

Instead of trying to deliver everything at once, we use intelligent order management:

```
┌─────────────────────────────────────────────────────────────┐
│                    ORDER FLOW                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Customer Orders:                                           │
│  ├── Breakfast from Restaurant A (Ready: 8:00 AM)          │
│  ├── Lunch from Restaurant B (Ready: 12:00 PM)             │
│  └── Dinner from Restaurant C (Ready: 6:00 PM)             │
│                                                             │
│  System Decision:                                          │
│  ├── If "Individual Delivery": 3 separate trips            │
│  ├── If "Batch Delivery": Wait until all ready (6:00 PM)   │
│  └── If "Smart Batch": Group by time proximity             │
│      └── Breakfast alone (8:00 AM)                         │
│      └── Lunch alone (12:00 PM)                            │
│      └── Dinner alone (6:00 PM)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 2. Delivery Modes Explained

### Mode 1: Individual Delivery (Fastest Per Meal)
- **How it works**: Each meal delivered as soon as it's ready
- **Best for**: Customers who want meals ASAP, don't mind multiple deliveries
- **Driver approach**: Single pickup, single delivery
- **Cost**: May have multiple delivery fees (or subscription covers all)
- **Example**: 
  - 8:00 AM - Driver picks up breakfast, delivers to customer
  - 12:00 PM - Different driver picks up lunch, delivers
  - 6:00 PM - Another driver picks up dinner, delivers

### Mode 2: Batch Delivery (One Trip, Longer Wait)
- **How it works**: All meals collected first, then delivered together
- **Best for**: Customers who prefer one delivery time, patient
- **Driver approach**: Multiple pickups, one delivery
- **Risk**: Food quality (cold breakfast, soggy lunch)
- **Mitigation**: Thermal bags, time limits (max 30 min between first pickup and delivery)
- **Example**:
  - 6:00 PM - Driver picks up from Restaurant C (dinner)
  - 6:05 PM - Driver picks up from Restaurant B (lunch kept warm)
  - 6:10 PM - Driver picks up from Restaurant A (breakfast kept warm)
  - 6:20 PM - Driver delivers all three meals to customer

### Mode 3: Smart Batch (Hybrid - RECOMMENDED DEFAULT)
- **How it works**: System intelligently groups by time proximity
- **Logic**: If meals ready within 30 minutes of each other, batch them
- **Best for**: Balance of convenience and food quality
- **Example**:
  - Breakfast at 8:00 AM → Delivered alone
  - Lunch at 12:00 PM → Delivered alone  
  - Snack at 3:30 PM + Dinner at 6:00 PM → Batched (within 2.5 hours? No, separate)
  - Actually: All delivered individually if >30 min apart

## 3. Driver Assignment Algorithm

### Algorithm: "Nearest Available Driver with Capacity Check"

```typescript
interface Driver {
  id: string;
  currentLocation: { lat: number; lng: number };
  status: 'available' | 'busy' | 'offline';
  currentOrders: number;
  maxCapacity: number;
  vehicleType: 'bike' | 'car';
}

interface DeliveryJob {
  id: string;
  restaurantLocation: { lat: number; lng: number };
  customerLocation: { lat: number; lng: number };
  readyTime: Date;
  priority: 'normal' | 'express';
}

function assignDriver(job: DeliveryJob, drivers: Driver[]): Driver | null {
  // Filter available drivers with capacity
  const availableDrivers = drivers.filter(d => 
    d.status === 'available' && 
    d.currentOrders < d.maxCapacity
  );
  
  if (availableDrivers.length === 0) return null;
  
  // Calculate distance from each driver to restaurant
  const driversWithDistance = availableDrivers.map(driver => ({
    driver,
    distance: calculateDistance(driver.currentLocation, job.restaurantLocation),
    estimatedTime: estimateTravelTime(driver.currentLocation, job.restaurantLocation, driver.vehicleType)
  }));
  
  // Sort by distance (closest first)
  driversWithDistance.sort((a, b) => a.distance - b.distance);
  
  // Return nearest driver
  return driversWithDistance[0]?.driver || null;
}
```

### Distance Calculation
- **Primary**: Haversine formula for straight-line distance (fast)
- **Secondary**: Google Maps Distance Matrix API for actual route time (when available)
- **Cache**: Store driver locations updated every 30 seconds

### Driver Capacity Rules
- **Bike**: Max 2 orders (limited space)
- **Car**: Max 5 orders (thermal bags in trunk)
- **Batch orders** count as 1 order slot

## 4. Database Schema Design

### New Tables

```sql
-- Driver management
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  vehicle_type VARCHAR(20) CHECK (vehicle_type IN ('bike', 'car')),
  license_plate VARCHAR(20),
  phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  current_location GEOGRAPHY(POINT),
  last_location_update TIMESTAMP,
  max_capacity INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Delivery jobs
CREATE TABLE delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES meal_schedules(id),
  driver_id UUID REFERENCES drivers(id),
  status VARCHAR(50) CHECK (status IN (
    'pending',           -- Waiting for restaurant
    'ready_for_pickup',  -- Restaurant marked ready
    'assigned',          -- Driver assigned
    'picked_up',         -- Driver collected food
    'in_transit',        -- On the way to customer
    'delivered',         -- Successfully delivered
    'failed',            -- Could not deliver
    'cancelled'          -- Order cancelled
  )),
  batch_id UUID,       -- For grouping multiple orders
  pickup_time TIMESTAMP,
  delivery_time TIMESTAMP,
  delivery_notes TEXT,
  customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
  driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
  delivery_fee DECIMAL(10,2),
  driver_earnings DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Batches for grouped deliveries
CREATE TABLE delivery_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id),
  status VARCHAR(50),
  estimated_pickup_time TIMESTAMP,
  estimated_delivery_time TIMESTAMP,
  actual_delivery_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Driver availability schedule
CREATE TABLE driver_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT true
);

-- Customer delivery preferences
CREATE TABLE customer_delivery_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  default_mode VARCHAR(20) DEFAULT 'smart_batch' 
    CHECK (default_mode IN ('individual', 'batch', 'smart_batch')),
  preferred_delivery_time TIME, -- e.g., prefer deliveries at 12 PM
  special_instructions TEXT,
  building_name VARCHAR(100),
  apartment_number VARCHAR(20),
  floor_number INTEGER,
  has_elevator BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-time driver locations (for tracking)
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id),
  location GEOGRAPHY(POINT),
  accuracy_meters DECIMAL(8,2),
  heading DECIMAL(5,2),
  speed_kmh DECIMAL(5,2),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Delivery zones (for assigning drivers to areas)
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  boundary GEOGRAPHY(POLYGON),
  center GEOGRAPHY(POINT),
  is_active BOOLEAN DEFAULT true
);

-- Driver zone assignments
CREATE TABLE driver_zones (
  driver_id UUID REFERENCES drivers(id),
  zone_id UUID REFERENCES delivery_zones(id),
  PRIMARY KEY (driver_id, zone_id)
);
```

## 5. Admin Dashboard Features

### Main Dashboard View
```
┌──────────────────────────────────────────────────────────────┐
│ DELIVERY DASHBOARD                              [Refresh]   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 TODAY'S OVERVIEW                                          │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│  │ Pending: 12  │ Assigned: 8  │ In Transit: 5│ Done: 45   │ │
│  └──────────────┴──────────────┴──────────────┴────────────┘ │
│                                                               │
│  🗺️ LIVE MAP (Google Maps integration)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • Driver 1: Moving to pickup                         │ │
│  │  • Driver 2: Has 3 orders, delivering                 │ │
│  │  • Driver 3: Available, at Zone A                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  📋 ACTIVE DELIVERIES                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Assign] [Reassign] [Cancel] [Message Driver]         │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Customer │ Restaurant    │ Driver      │ Status       │ │
│  │──────────│───────────────│─────────────│──────────────│ │
│  │ Ahmed    │ Healthy Bites │ Mohammed    │ Picked Up    │ │
│  │ Sara     │ Green Kitchen │ Ali         │ In Transit   │ │
│  │ Khalid   │ Fresh Foods   │ (Unassigned)│ Ready        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  🚗 DRIVER STATUS                                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Name      │ Status    │ Location   │ Orders  │ Rating │ │
│  │───────────│───────────│────────────│─────────│────────│ │
│  │ Mohammed  │ On Trip   │ West Bay   │ 2/3     │ 4.8 ⭐ │ │
│  │ Ali       │ Available │ The Pearl  │ 0/3     │ 4.9 ⭐ │ │
│  │ Hassan    │ Offline   │ —          │ —       │ 4.7 ⭐ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Key Admin Actions

1. **Auto-Assign All**: Click to run assignment algorithm on all pending orders
2. **Manual Assign**: Drag-and-drop orders to specific drivers
3. **Reassign**: Move order from one driver to another
4. **Batch Operations**: Select multiple orders and batch them
5. **Emergency**: Mark driver as emergency contact for issue resolution
6. **Analytics**: View delivery times, success rates, driver performance

## 6. Driver Mobile Interface

### Driver App Screens

```
┌──────────────────────────────────────┐
│ DRIVER APP                            │
├──────────────────────────────────────┤
│                                       │
│  🏠 HOME SCREEN                       │
│  ┌─────────────────────────────────┐ │
│  │  Status: ONLINE ●               │ │
│  │  Location: Al Sadd              │ │
│  │  Earnings Today: 120 QAR        │ │
│  │  Orders Completed: 8            │ │
│  └─────────────────────────────────┘ │
│                                       │
│  📦 NEW ORDER (Notification)          │
│  ┌─────────────────────────────────┐ │
│  │ 🍽️ Pickup: Healthy Bites        │ │
│  │ 📍 Al Waab Street               │ │
│  │ ⏱️ Ready in: 10 mins            │ │
│  │ 💰 Earnings: 15 QAR             │ │
│  │                                 │ │
│  │ [Accept] [Decline]              │ │
│  └─────────────────────────────────┘ │
│                                       │
│  📍 NAVIGATION                        │
│  ┌─────────────────────────────────┐ │
│  │ [Google Maps Integration]       │ │
│  │                                 │ │
│  │ Step 1: Go to Healthy Bites     │ │
│  │    └─ 2.3 km • 8 mins           │ │
│  │                                 │ │
│  │ Step 2: Deliver to Ahmed        │ │
│  │    └─ 1.1 km • 4 mins           │ │
│  │                                 │ │
│  │ [Mark as Picked Up]             │ │
│  │ [Mark as Delivered]             │ │
│  └─────────────────────────────────┘ │
│                                       │
└──────────────────────────────────────┘
```

### Driver Workflow

1. **Login** → Go Online
2. **Receive Order** → Accept/Decline (10-second timeout)
3. **Navigate to Restaurant** → Show directions
4. **Pickup** → Show order code, collect food
5. **Mark Picked Up** → Take photo of food (optional)
6. **Navigate to Customer** → Real-time tracking begins
7. **Deliver** → Get customer signature or OTP
8. **Mark Delivered** → Rate customer, get paid

## 7. Customer Experience

### Customer View

```
┌──────────────────────────────────────┐
│ YOUR DELIVERY                         │
├──────────────────────────────────────┤
│                                       │
│  📦 ORDER STATUS                      │
│  ┌─────────────────────────────────┐ │
│  │                                 │ │
│  │  🍳 [===] Restaurant preparing  │ │
│  │      10:00 AM                   │ │
│  │  🚴 [   ] Driver picking up     │ │
│  │      (Estimated: 10:15 AM)      │ │
│  │  🏠 [   ] On the way to you     │ │
│  │      (Estimated: 10:30 AM)      │ │
│  │                                 │ │
│  └─────────────────────────────────┘ │
│                                       │
│  👤 YOUR DRIVER                       │
│  ┌─────────────────────────────────┐ │
│  │  📷 [Driver Photo]              │ │
│  │  Mohammed A.                    │ │
│  │  ⭐ 4.8 Rating                  │ │
│  │  🚗 Toyota Camry • Silver       │ │
│  │                                 │ │
│  │  [Call Driver] [Message]        │ │
│  └─────────────────────────────────┘ │
│                                       │
│  🗺️ LIVE TRACKING                    │
│  ┌─────────────────────────────────┐ │
│  │  [Interactive Map]              │ │
│  │  Driver is 5 mins away          │ │
│  └─────────────────────────────────┘ │
│                                       │
└──────────────────────────────────────┘
```

## 8. Edge Cases & Solutions

### Case 1: No Available Drivers
- **Solution**: Queue order, notify customer of delay, offer pickup option
- **Fallback**: Partner with third-party delivery (Talabat, Deliveroo) for overflow

### Case 2: Driver Can't Find Customer
- **Solution**: 
  1. Driver calls customer via app (masked number)
  2. Customer shares live location
  3. After 10 min, mark as failed, return food
  4. Charge customer half delivery fee

### Case 3: Restaurant Delayed
- **Solution**:
  1. Restaurant updates status in partner app
  2. System notifies driver of delay
  3. Driver can take other orders meanwhile
  4. Customer gets real-time updates

### Case 4: Food Quality Issue
- **Solution**:
  1. Customer reports issue in app with photo
  2. Admin reviews and approves refund
  3. Restaurant gets feedback
  4. Driver not penalized (unless photo shows damage)

### Case 5: Batch Order - One Restaurant Delayed
- **Solution**:
  1. System detects delay > 15 minutes
  2. Splits batch: Deliver ready meals first
  3. Assigns second driver for delayed meal
  4. Waives extra delivery fee for customer

## 9. Implementation Phases

### Phase 1: Core Delivery (MVP)
- Single-restaurant orders only
- Individual delivery mode
- Basic driver assignment
- Admin dashboard - list view only

### Phase 2: Multi-Restaurant Support
- Batch delivery mode
- Smart batching algorithm
- Driver capacity management
- Real-time tracking

### Phase 3: Advanced Features
- Smart batching with ML optimization
- Predictive prep time estimation
- Dynamic pricing (surge pricing during busy times)
- Customer delivery preferences

### Phase 4: Scale
- Multiple cities
- Third-party driver integration
- Drone delivery pilots (future)

## 10. Success Metrics

- **Delivery Time**: Average < 30 mins from restaurant ready
- **Success Rate**: > 95% deliveries completed successfully
- **Customer Satisfaction**: > 4.5/5 rating
- **Driver Utilization**: > 70% of drivers busy during peak hours
- **Cost Efficiency**: < 15 QAR average delivery cost

## 11. Technical Requirements

### Backend Services Needed
1. **Real-time Location Service**: WebSocket/Socket.io for driver tracking
2. **Geolocation Service**: Calculate distances, optimize routes
3. **Notification Service**: Push notifications to drivers and customers
4. **Matching Engine**: Assign drivers to orders in real-time
5. **Analytics Service**: Track performance metrics

### Third-Party Integrations
- **Google Maps API**: Navigation, distance calculation, route optimization
- **Firebase Cloud Messaging**: Push notifications
- **Twilio**: SMS notifications (backup)

### Infrastructure
- **PostgreSQL**: Main database (already using)
- **Redis**: Caching driver locations, session management
- **WebSocket Server**: Real-time updates
- **Queue System**: Background job processing (Bull/Redis)

## 12. Business Rules

### Delivery Fees (Suggested)
- **Individual**: 10 QAR per delivery
- **Batch**: 15 QAR total (savings for customer)
- **Smart Batch**: 10-15 QAR based on distance
- **Subscription**: All deliveries included (current model)

### Driver Earnings
- **Per Delivery**: 70% of delivery fee
- **Batch Bonus**: +5 QAR for handling multiple orders
- **Peak Hour Bonus**: +3 QAR during 12-2 PM, 6-8 PM
- **Minimum Guarantee**: 50 QAR per 4-hour shift

### Quality Control
- **Max Wait Time**: Driver shouldn't wait > 10 mins at restaurant
- **Food Handling**: Thermal bags mandatory, temperature checks
- **Photo Proof**: Optional photo at pickup for quality assurance
- **Customer Verification**: OTP or signature required

## Next Steps

1. **Review this plan** with stakeholders
2. **Approve Phase 1** scope
3. **Create detailed technical specifications**
4. **Design database migrations**
5. **Build MVP** (6-8 weeks estimated)

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-23  
**Status**: Pending Review
