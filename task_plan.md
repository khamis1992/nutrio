# Implementation Plan: Leaflet Map Integration for Live Driver Tracking

## Goal
Add interactive Leaflet maps to the Nutrio Fuel driver tracking system, enabling real-time driver location visualization, route tracking, and dynamic ETA calculations for both customers and drivers.

## Current State Analysis

### What Exists
- ✅ Real-time GPS tracking (10-second updates)
- ✅ Location storage in database (PostGIS POINT)
- ✅ Speed, heading, accuracy metadata
- ✅ Supabase realtime subscriptions
- ✅ Customer and driver tracking UIs (text-based)
- ✅ Admin delivery monitoring

### What's Missing
- ❌ Interactive map visualization
- ❌ Route tracking/path history (polyline)
- ❌ Dynamic ETA based on real-time position
- ❌ In-app turn-by-turn navigation
- ❌ Visual driver location on customer view

## Implementation Phases

### Phase 1: Setup & Dependencies (30 mins)
- [ ] Install Leaflet and React-Leaflet packages
- [ ] Add Leaflet CSS to index.html
- [ ] Create MapProvider context for map state management
- [ ] Add map tile configuration (OpenStreetMap default)
- [ ] Create base Map component wrapper

**Dependencies to install:**
```bash
npm install leaflet react-leaflet @types/leaflet
```

**Files to modify:**
- `package.json` - add dependencies
- `src/index.html` - add Leaflet CSS CDN
- `src/main.tsx` - import Leaflet CSS

### Phase 2: Core Map Components (1 hour)
- [ ] Create `MapContainer` component with responsive sizing
- [ ] Create `DriverMarker` component with animated pulse effect
- [ ] Create `RoutePolyline` component for path visualization
- [ ] Create `RestaurantMarker` and `CustomerMarker` components
- [ ] Create `MapBounds` component to auto-fit all markers
- [ ] Add map controls (zoom, fullscreen option)

**New files:**
- `src/components/maps/MapContainer.tsx`
- `src/components/maps/DriverMarker.tsx`
- `src/components/maps/RoutePolyline.tsx`
- `src/components/maps/Markers.tsx`
- `src/components/maps/index.ts`

### Phase 3: Customer Delivery Tracking Map (1.5 hours)
- [ ] Update `CustomerDeliveryTracker` to include map
- [ ] Show driver current position with animated marker
- [ ] Show restaurant pickup location
- [ ] Show customer delivery location
- [ ] Display route polyline (driver path history)
- [ ] Auto-center map on driver position updates
- [ ] Add distance remaining calculation
- [ ] Style map for mobile responsiveness

**Files to modify:**
- `src/components/customer/CustomerDeliveryTracker.tsx`
- `src/pages/DeliveryTracking.tsx`

### Phase 4: Driver Navigation Map (1.5 hours)
- [ ] Create `DriverNavigationMap` component
- [ ] Show current driver position
- [ ] Show route to pickup (restaurant)
- [ ] Show route to delivery (customer)
- [ ] Display turn-by-turn instructions (basic)
- [ ] Add "Navigate with Google Maps" fallback button
- [ ] Optimize for mobile/driver view

**New files:**
- `src/components/driver/DriverNavigationMap.tsx`

### Phase 5: Admin Live Map Dashboard (1 hour)
- [ ] Create `AdminLiveMap` component
- [ ] Show all online drivers as markers
- [ ] Show all active deliveries
- [ ] Cluster markers when zoomed out
- [ ] Click driver to see details and assigned job
- [ ] Click delivery to see route

**New files:**
- `src/components/admin/AdminLiveMap.tsx`
- Update `src/pages/admin/AdminDeliveries.tsx`

### Phase 6: Route History & Polyline (1 hour)
- [ ] Fetch driver location history from database
- [ ] Create polyline from location points
- [ ] Color-code polyline by speed (green=slow, red=fast)
- [ ] Show path only for current delivery job
- [ ] Clear polyline when delivery completes

**Files to modify:**
- `src/integrations/supabase/delivery.ts` - add fetchLocationHistory
- Map components to display polyline

### Phase 7: Dynamic ETA Calculation (45 mins)
- [ ] Create ETA calculation utility
- [ ] Use Haversine distance + average speed
- [ ] Consider traffic (optional: Google Distance Matrix API)
- [ ] Update ETA every location update
- [ ] Show ETA in customer view
- [ ] Show ETA in driver view

**New files:**
- `src/lib/eta-calculator.ts`

### Phase 8: Styling & Polish (45 mins)
- [ ] Create custom marker icons (driver car, restaurant, customer home)
- [ ] Add pulse animation for driver marker
- [ ] Style map container for dark/light theme
- [ ] Add loading states for map
- [ ] Handle map errors gracefully
- [ ] Mobile touch optimization

### Phase 9: Testing & Integration (30 mins)
- [ ] Test with real location updates
- [ ] Verify real-time marker movement
- [ ] Test mobile responsiveness
- [ ] Check performance with many markers
- [ ] Verify polyline renders correctly
- [ ] Test admin dashboard with multiple drivers

## Technical Architecture

### Data Flow
```
Driver GPS (10s) → DriverLayout → delivery.ts API → Supabase DB
                                              ↓
Customer Map ← Realtime Sub ← driver_locations table
```

### Map State Management
```typescript
interface MapState {
  driverLocation: { lat: number; lng: number } | null;
  restaurantLocation: { lat: number; lng: number } | null;
  customerLocation: { lat: number; lng: number } | null;
  routeHistory: Array<{ lat: number; lng: number }>;
  eta: string | null;
  distanceRemaining: number | null;
}
```

### Key Components Structure
```
src/components/maps/
├── MapContainer.tsx      # Base map with tile layer
├── DriverMarker.tsx      # Animated driver position marker
├── RoutePolyline.tsx     # Path visualization
├── Markers.tsx           # Restaurant & customer markers
├── MapBounds.tsx         # Auto-fit markers
└── index.ts              # Exports

src/components/driver/
├── DriverNavigationMap.tsx   # Driver-side navigation

src/components/admin/
├── AdminLiveMap.tsx          # Admin dashboard map

src/lib/
├── eta-calculator.ts         # ETA calculation utilities
```

## Design Decisions

### Map Provider
- **OpenStreetMap** (free, no API key needed)
- Optional: Mapbox for custom styling (requires API key)

### Marker Icons
- Driver: Custom car icon with rotation based on heading
- Restaurant: Utensils icon (FontAwesome/Lucide)
- Customer: Home icon

### Color Scheme
- Route polyline: Gradient based on speed or single brand color
- Driver marker: Primary brand color with pulse animation
- Restaurant: Orange/amber
- Customer: Green/emerald

### Mobile Considerations
- Maps should be full-width on mobile
- Minimize height to 300-400px to show other info
- Touch gestures enabled (pinch zoom, pan)
- Driver view optimized for landscape if needed

## Database Queries Needed

### Fetch Location History
```typescript
const { data } = await supabase
  .from('driver_locations')
  .select('lat, lng, timestamp, speed_kmh')
  .eq('driver_id', driverId)
  .gte('timestamp', deliveryStartTime)
  .order('timestamp', { ascending: true });
```

## Testing Checklist

- [ ] Map loads correctly on customer page
- [ ] Driver marker updates in real-time
- [ ] Polyline shows path from pickup to current position
- [ ] Map auto-centers on driver
- [ ] Mobile view is responsive
- [ ] Admin dashboard shows all drivers
- [ ] ETA updates correctly
- [ ] No console errors
- [ ] Performance is smooth (< 60fps)

## Estimated Timeline

**Total: ~8 hours**
- Phase 1: 30 mins
- Phase 2: 1 hour
- Phase 3: 1.5 hours
- Phase 4: 1.5 hours
- Phase 5: 1 hour
- Phase 6: 1 hour
- Phase 7: 45 mins
- Phase 8: 45 mins
- Phase 9: 30 mins

## Success Criteria

1. ✅ Customers can see driver's live position on a map
2. ✅ Route path is visible from restaurant to current position
3. ✅ ETA updates dynamically based on driver speed and distance
4. ✅ Drivers have a navigation view with pickup and delivery locations
5. ✅ Admins can see all online drivers on a live map
6. ✅ Maps work smoothly on mobile devices
7. ✅ Location updates happen in real-time (10-second intervals)

## Status
**Currently in Phase 1** - Setting up dependencies and base components
