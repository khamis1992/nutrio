# Nutrio - Phase 2 Development Plan

> **Note:** App renamed from "Nutrio Fuel" to "Nutrio"

---

## Quick Reference

| Phase | Feature | Priority | Estimated Effort | Dependencies |
|-------|---------|----------|------------------|--------------|
| Pre | App Rename to "Nutrio" | HIGH | 0.5 days | None |
| 2A | Wallet System | HIGH | 1.5 weeks | None |
| 2A | Invoice Generation | HIGH | 1 week | Wallet System |
| 2B | Push Notifications | HIGH | 1 week | Firebase Setup |
| 2B | Native Features | HIGH | 1.5 weeks | Push Notifications |
| 2B | App Store Deployment | HIGH | 1 week | All 2B features |
| 2C | GPS Location Tracking | MEDIUM | 1 week | None |
| 2C | Mapbox Integration | MEDIUM | 1.5 weeks | GPS Tracking |
| 2C | Route Optimization | MEDIUM | 1 week | Mapbox |
| 2D | Loyalty Points | MEDIUM | 1 week | None |
| 2D | Rating & Reviews | MEDIUM | 1 week | None |
| 2D | Gamification | MEDIUM | 1 week | Loyalty Points |
| 2E | Menu Management | MEDIUM | 1.5 weeks | None |
| 2F | Customer Analytics | LOW | 0.5 week | None |
| 2F | Partner Analytics | LOW | 0.5 week | None |
| 2F | Admin Analytics | LOW | 0.5 week | None |
| 2G | Support System | LOW | 1 week | None |
| 2G | Performance Optimization | LOW | 1 week | None |

**Total Estimated Effort:** 14-17 weeks

---

## Pre-Requisite: App Rename to "Nutrio"

### Files to Update:

1. **Configuration Files:**
   - `capacitor.config.ts` - appName: "Nutrio", appId: "com.nutrio.app"
   - `package.json` - name, description
   - `index.html` - title, meta tags
   - `public/` - PWA manifest, icons

2. **Code Files:**
   - `src/lib/capacitor.ts` - Deep link server references (com.nutrio.app)
   - `src/lib/whatsapp.ts` - Message templates
   - All UI components with hardcoded app name

3. **Assets:**
   - App icons (iOS/Android)
   - Splash screens
   - Logo variations

4. **External Services:**
   - Firebase project (when created)
   - App Store Connect / Google Play Console

### New App Configuration:
```
App Name: Nutrio
Bundle ID: com.nutrio.app (iOS)
Package Name: com.nutrio.app (Android)
```

---

## Phase 2A: Wallet System & Invoices

### 1. Customer Wallet

**Database Schema:**

```sql
-- Customer wallets table
CREATE TABLE customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(10, 2) DEFAULT 0.00,
  total_credits NUMERIC(10, 2) DEFAULT 0.00,
  total_debits NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wallet transactions
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES customer_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'bonus')),
  amount NUMERIC(10, 2) NOT NULL,
  balance_after NUMERIC(10, 2) NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('topup', 'order', 'refund', 'bonus', 'withdrawal')),
  reference_id UUID,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Top-up packages (bonus incentives)
CREATE TABLE wallet_topup_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(10, 2) NOT NULL,
  bonus_amount NUMERIC(10, 2) DEFAULT 0.00,
  bonus_percentage NUMERIC(5, 2) DEFAULT 0.00,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default packages
INSERT INTO wallet_topup_packages (amount, bonus_amount, name, description, display_order) VALUES
(50, 0, 'Basic', 'Start with QAR 50', 1),
(100, 10, 'Silver', 'Get QAR 10 bonus', 2),
(200, 30, 'Gold', 'Get QAR 30 bonus', 3),
(500, 100, 'Platinum', 'Get QAR 100 bonus', 4);
```

**Frontend Components:**

```
src/
├── pages/
│   └── Wallet.tsx              # Main wallet page
├── components/
│   └── wallet/
│       ├── WalletBalance.tsx   # Balance display card
│       ├── TopUpPackages.tsx   # Package selection
│       ├── TransactionHistory.tsx
│       └── TopUpDialog.tsx     # Payment dialog
├── hooks/
│   └── useWallet.ts            # Wallet data hook
```

**API Functions:**
- `getWalletBalance()` - Fetch current balance
- `getTransactions(limit, offset)` - Paginated transaction history
- `initiateTopUp(packageId)` - Start top-up process
- `confirmTopUp(paymentId)` - Confirm after payment

### 2. Driver Wallet (Enhancement)

**Existing tables to enhance:**
- `drivers.wallet_balance` - Already exists
- Add `driver_wallet_transactions` table similar to customer

**New Features:**
- Withdrawal requests
- Minimum withdrawal threshold (QAR 50)
- Bank account/QatarPay integration
- Withdrawal history

### 3. Partner Payout Automation

**Database Schema:**

```sql
-- Partner earnings tracking
CREATE TABLE partner_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  meal_schedule_id UUID REFERENCES meal_schedules(id),
  gross_amount NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL,
  delivery_fee NUMERIC(10, 2) DEFAULT 0,
  net_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  payout_id UUID REFERENCES partner_payouts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partner payouts
CREATE TABLE partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  payout_method TEXT DEFAULT 'bank_transfer',
  payout_details JSONB,
  processed_at TIMESTAMPTZ,
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Invoice Generation

**Database Schema:**

```sql
-- Invoice records
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  driver_id UUID REFERENCES drivers(id),
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('subscription', 'wallet_topup', 'partner_payout', 'driver_payout')),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'QAR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice items (line items)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL
);
```

**Implementation:**
- Use `jspdf` or `@react-pdf/renderer` for PDF generation
- Email via Supabase Edge Function with Resend/SendGrid
- Invoice templates for each type

---

## Phase 2B: Mobile App Optimization

### 1. Push Notifications Integration

**Firebase Setup Required:**
1. Create Firebase project
2. Add iOS app (APNs certificates)
3. Add Android app (google-services.json)
4. Enable Cloud Messaging

**Database Schema:**

```sql
-- Device tokens
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  delivery_updates BOOLEAN DEFAULT true,
  promotions BOOLEAN DEFAULT true,
  wallet_updates BOOLEAN DEFAULT true,
  reminder_notifications BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notification history
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);
```

**Supabase Edge Function for Push:**

```typescript
// supabase/functions/send-push-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import admin from 'https://esm.sh/firebase-admin@11'

serve(async (req) => {
  const { userId, title, body, data } = await req.json()
  
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', userId)
    .eq('is_active', true)
  
  const messages = tokens.map(t => ({
    token: t.token,
    notification: { title, body },
    data
  }))
  
  const response = await admin.messaging().sendEach(messages)
  return new Response(JSON.stringify(response), { status: 200 })
})
```

**Frontend Integration:**

```typescript
// src/lib/notifications.ts
import { PushNotifications } from '@capacitor/push-notifications';

export async function initPushNotifications() {
  const result = await PushNotifications.requestPermissions();
  
  if (result.receive === 'granted') {
    await PushNotifications.register();
    
    PushNotifications.addListener('registration', async ({ value: token }) => {
      await supabase.from('device_tokens').upsert({
        user_id: user.id,
        token,
        platform: Capacitor.getPlatform(),
        device_info: await Device.getInfo()
      });
    });
    
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Show in-app notification
    });
    
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handleDeepLink(action.notification.data);
    });
  }
}
```

### 2. Native Features

**Biometric Authentication:**

```typescript
// src/lib/biometric.ts
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Authenticate to access Nutrio',
      title: 'Nutrio Authentication',
    });
    return true;
  } catch {
    return false;
  }
}
```

**Camera for Delivery Photos:**

```typescript
// src/lib/camera.ts
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export async function takeDeliveryPhoto(): Promise<string | null> {
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
  });
  return `data:image/jpeg;base64,${photo.base64String}`;
}
```

**Background Location Tracking:**

```typescript
// src/lib/background-location.ts
import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';

export async function startLocationTracking(driverId: string) {
  await BackgroundGeolocation.initialize({
    desiredAccuracy: 10,
    distanceFilter: 10,
    interval: 5000, // 5 seconds
    notification: {
      title: 'Nutrio Driver',
      text: 'Location tracking active',
    },
  });
  
  BackgroundGeolocation.on('location', async (location) => {
    await supabase.from('driver_locations').insert({
      driver_id: driverId,
      lat: location.latitude,
      lng: location.longitude,
      recorded_at: new Date().toISOString(),
    });
  });
  
  await BackgroundGeolocation.start();
}
```

**Database for Location:**

```sql
-- Driver location history
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  accuracy NUMERIC(6, 2),
  speed NUMERIC(6, 2),
  heading NUMERIC(6, 2),
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Current driver location (for realtime)
CREATE TABLE driver_current_locations (
  driver_id UUID PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  accuracy NUMERIC(6, 2),
  heading NUMERIC(6, 2),
  speed NUMERIC(6, 2),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE driver_current_locations;
```

### 3. App Store Deployment

**iOS App Store Checklist:**
- [ ] Apple Developer Account ($99/year)
- [ ] App ID: com.nutrio.app
- [ ] Provisioning profiles (Development & Distribution)
- [ ] App Store Connect app record
- [ ] Screenshots (6.5" iPhone, 5.5" iPhone, 12.9" iPad)
- [ ] App icon (1024x1024)
- [ ] Privacy Policy URL
- [ ] Support URL
- [ ] Age rating questionnaire

**Google Play Store Checklist:**
- [ ] Google Play Developer Account ($25 one-time)
- [ ] App signing key
- [ ] Store listing (title, description, screenshots)
- [ ] High-res icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Privacy Policy URL
- [ ] Content rating questionnaire

**ASO (App Store Optimization):**
- Title: "Nutrio - Healthy Meal Delivery"
- Keywords: healthy food, meal delivery, nutrition, diet, Qatar
- Description highlights:
  - Subscription-based healthy meals
  - Track nutrition goals
  - Real-time delivery tracking
  - Partner with top restaurants

---

## Phase 2C: Real-Time Driver Tracking

### 1. GPS Location Tracking

**Implementation:**
- Driver location updates every 5 seconds
- Batch insert to reduce database writes
- Real-time broadcast via Supabase Realtime

**Supabase Realtime Subscription (Customer View):**

```typescript
const channel = supabase
  .channel('driver-tracking')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'driver_current_locations',
    filter: `driver_id=eq.${delivery.driver_id}`
  }, (payload) => {
    const { lat, lng } = payload.new;
    updateDriverMarker(lat, lng);
    recalculateETA(lat, lng);
  })
  .subscribe();
```

### 2. Mapbox Integration

**Setup:**
1. Create Mapbox account
2. Get access token
3. Add to environment: `VITE_MAPBOX_TOKEN`

**Dependencies:**
```bash
npm install mapbox-gl @types/mapbox-gl
```

**Map Component:**

```typescript
// src/components/maps/DeliveryMap.tsx
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

interface DeliveryMapProps {
  pickup: { lat: number; lng: number; address: string };
  delivery: { lat: number; lng: number; address: string };
  driverLocation?: { lat: number; lng: number };
}

export function DeliveryMap({ pickup, delivery, driverLocation }: DeliveryMapProps) {
  // Map initialization with markers for pickup, delivery, and driver
  // Real-time driver marker updates
  // Route visualization
}
```

**Route Calculation:**

```typescript
export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distance: number; duration: number; geometry: string }> {
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?` +
    new URLSearchParams({
      access_token: import.meta.env.VITE_MAPBOX_TOKEN,
      geometries: 'geojson',
      overview: 'full',
    })
  );
  
  const data = await response.json();
  return {
    distance: data.routes[0].distance,
    duration: data.routes[0].duration,
    geometry: data.routes[0].geometry.coordinates,
  };
}
```

### 3. Route Optimization

**Multi-Delivery Route using Mapbox Optimization API:**

```typescript
export async function optimizeRoute(
  start: { lat: number; lng: number },
  stops: DeliveryStop[]
): Promise<DeliveryStop[]> {
  const coordinates = [
    [start.lng, start.lat],
    ...stops.map(s => [s.lng, s.lat])
  ];

  const response = await fetch(
    `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates.join(';')}?` +
    new URLSearchParams({
      access_token: import.meta.env.VITE_MAPBOX_TOKEN,
      source: 'first',
      roundtrip: 'false',
      destination: 'last',
    })
  );

  const data = await response.json();
  const optimizedOrder = data.waypoints.slice(1).map((w: any) => w.waypoint_index);
  return optimizedOrder.map((i: number) => stops[i - 1]);
}
```

**Delivery Zones:**

```sql
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  geometry JSONB NOT NULL, -- GeoJSON polygon
  delivery_fee NUMERIC(10, 2) DEFAULT 3.00,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  estimated_delivery_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true
);
```

---

## Phase 2D: Customer Loyalty & Retention

### 1. Loyalty Points System

**Database Schema:**

```sql
-- Loyalty tiers
CREATE TABLE loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  max_points INTEGER,
  point_multiplier NUMERIC(3, 2) DEFAULT 1.00,
  benefits JSONB,
  color TEXT DEFAULT '#CD7F32',
  icon_url TEXT,
  display_order INTEGER DEFAULT 0
);

INSERT INTO loyalty_tiers (name, min_points, max_points, point_multiplier, color, display_order) VALUES
('Bronze', 0, 999, 1.00, '#CD7F32', 1),
('Silver', 1000, 4999, 1.25, '#C0C0C0', 2),
('Gold', 5000, 9999, 1.50, '#FFD700', 3),
('Platinum', 10000, NULL, 2.00, '#E5E4E2', 4);

-- User loyalty profile
CREATE TABLE user_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier_id UUID NOT NULL REFERENCES loyalty_tiers(id),
  total_points INTEGER DEFAULT 0,
  available_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  points_expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Points transactions
CREATE TABLE points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'bonus', 'expiry', 'birthday')),
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Points redemption options
CREATE TABLE points_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount', 'free_delivery', 'free_meal', 'wallet_credit')),
  reward_value NUMERIC(10, 2),
  is_active BOOLEAN DEFAULT true
);

INSERT INTO points_rewards (name, description, points_required, reward_type, reward_value) VALUES
('QAR 10 Discount', 'Get QAR 10 off your next order', 500, 'discount', 10.00),
('Free Delivery', 'Free delivery on your next order', 200, 'free_delivery', 0),
('QAR 25 Discount', 'Get QAR 25 off your next order', 1000, 'discount', 25.00),
('Free Meal', 'Get a free meal (up to QAR 50)', 2500, 'free_meal', 50.00);
```

**Birthday Bonus Trigger:**

```sql
CREATE OR REPLACE FUNCTION process_birthday_bonus()
RETURNS void AS $$
-- Awards 500 bonus points to users on their birthday
-- Prevents duplicate awards
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Rating & Reviews

**Database Schema:**

```sql
-- Meal reviews
CREATE TABLE meal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  images TEXT[],
  is_verified_purchase BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id)
);

-- Restaurant reviews
CREATE TABLE restaurant_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  food_rating INTEGER,
  service_rating INTEGER,
  comment TEXT,
  images TEXT[],
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id)
);
```

### 3. Gamification

**Database Schema:**

```sql
-- Achievement definitions
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  badge_color TEXT DEFAULT '#22c55e',
  xp_reward INTEGER DEFAULT 0,
  points_reward INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true
);

INSERT INTO achievements (key, name, description, xp_reward, points_reward, category) VALUES
('first_order', 'First Steps', 'Complete your first order', 50, 50, 'orders'),
('streak_7', 'Week Warrior', 'Order 7 days in a row', 100, 100, 'orders'),
('streak_30', 'Monthly Master', 'Order 30 days in a row', 500, 500, 'orders'),
('variety_10', 'Explorer', 'Try 10 different meals', 100, 75, 'orders'),
('review_5', 'Food Critic', 'Leave 5 reviews', 75, 50, 'social'),
('referral_3', 'Network Builder', 'Refer 3 friends', 200, 200, 'social'),
('calorie_goal_7', 'On Track', 'Hit calorie goal 7 days', 100, 50, 'nutrition'),
('gold_tier', 'Golden Status', 'Reach Gold tier', 300, 300, 'loyalty');

-- User achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- User game stats
CREATE TABLE user_game_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_order_date DATE,
  total_orders INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0
);

-- Weekly challenges
CREATE TABLE weekly_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,
  goal_value INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL,
  points_reward INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Leaderboard view
CREATE MATERIALIZED VIEW leaderboard_weekly AS
SELECT 
  u.id as user_id,
  p.full_name,
  p.avatar_url,
  ugs.xp,
  ugs.level,
  ugs.current_streak,
  RANK() OVER (ORDER BY ugs.xp DESC) as rank
FROM user_game_stats ugs
JOIN auth.users u ON u.id = ugs.user_id
JOIN profiles p ON p.user_id = u.id
ORDER BY ugs.xp DESC;
```

---

## Phase 2E: Partner/Restaurant Enhancements

### 1. Menu Management

**Database Enhancements:**

```sql
-- Meal availability schedules
CREATE TABLE meal_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT true,
  max_quantity INTEGER,
  UNIQUE(meal_id, day_of_week)
);

-- Meal variants (sizes, options)
CREATE TABLE meal_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_adjustment NUMERIC(10, 2) DEFAULT 0,
  calories_adjustment INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0
);

-- Enhanced nutritional info
ALTER TABLE meals ADD COLUMN IF NOT EXISTS nutritional_info JSONB DEFAULT '{
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0,
  "sodium": 0,
  "sugar": 0,
  "serving_size": "1 portion",
  "allergens": []
}'::jsonb;
```

---

## Phase 2F: Analytics & Reporting

### Customer Analytics
- Personal nutrition reports
- Weekly/monthly summaries
- Goal tracking visualizations
- Calorie intake charts

### Partner Analytics
- Revenue dashboards
- Popular items report
- Customer demographics
- Peak hours analysis
- Order volume trends

### Admin Analytics
- Platform-wide metrics
- Revenue reports
- User growth charts
- Delivery performance
- Geographic distribution

---

## Phase 2G: Operational Improvements

### 1. Support System

**Database Schema:**

```sql
-- Support tickets
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT CHECK (category IN ('order', 'delivery', 'payment', 'account', 'other')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Ticket messages
CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  attachments TEXT[],
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FAQ management
CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0
);
```

### 2. Performance Optimization

**Bundle Splitting:**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/*'],
          'vendor-charts': ['recharts', 'chart.js'],
          'vendor-maps': ['mapbox-gl'],
        },
      },
    },
  },
});
```

**Image Optimization:**
- Convert images to WebP format
- Implement lazy loading
- Use responsive images
- CDN caching

**Query Optimization:**
- Add database indexes
- Implement query caching
- Use database views for complex queries

---

## Implementation Timeline

| Week | Phase | Tasks |
|------|-------|-------|
| 1-2 | Pre + 2A | App Rename + Wallet System |
| 3 | 2A | Invoice Generation |
| 4-5 | 2B | Push Notifications |
| 6-7 | 2B | Native Features |
| 8 | 2B | App Store Submission |
| 9-10 | 2C | GPS + Mapbox Integration |
| 11 | 2C | Route Optimization |
| 12-13 | 2D | Loyalty Points |
| 14 | 2D | Reviews & Gamification |
| 15-16 | 2E | Menu Management |
| 17 | 2F+2G | Analytics + Polish |

---

## Environment Variables Required

```env
# App Configuration
VITE_APP_NAME=Nutrio
VITE_APP_ID=com.nutrio.app

# Existing
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ULTRAMSG_INSTANCE_ID=
VITE_ULTRAMSG_TOKEN=

# New for Phase 2
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=

# Email Service (for invoices)
RESEND_API_KEY=your_resend_key
```

---

## Questions to Clarify

1. **Payment Gateway:** Which payment gateway for wallet top-ups?
   - Stripe (international)
   - QatarPay (local)
   - Both

2. **Map Provider:** Confirmed Mapbox? (Alternative: Google Maps - higher cost)

3. **Email Service:** Which email provider for invoices?
   - Resend (recommended)
   - SendGrid
   - AWS SES

4. **App Store Accounts:** Do you have Apple Developer and Google Play Developer accounts?

5. **Firebase Project:** Should I create a new Firebase project or do you have one?

---

*Plan created: February 2026*
