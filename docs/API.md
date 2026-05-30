# API Reference

This document describes the Supabase database schema, Edge Functions, and integration points for the Nutrio platform.

## Database Schema

### Core Tables

#### `profiles`

User profiles extending Supabase `auth.users`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (references auth.users) |
| `email` | text | User email |
| `full_name` | text | Display name |
| `phone` | text | Phone number |
| `role` | text | User role (customer, partner, admin, driver, fleet, coach) |
| `avatar_url` | text | Profile photo URL |
| `daily_calorie_target` | integer | Nutrition goal |
| `subscription_id` | uuid | References subscriptions |
| `branch_id` | uuid | References branches (for partners) |
| `created_at` | timestamptz | Account creation |

**RLS Policies:**
- Users can read own profile
- Admins can read all profiles

#### `restaurants`

Partner restaurant information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Restaurant name |
| `description` | text | Description text |
| `cuisine_type` | text[] | Array of cuisines |
| `logo_url` | text | Logo image URL |
| `cover_image_url` | text | Cover image URL |
| `is_active` | boolean | Active status |
| `rating` | decimal | Average rating |
| `owner_id` | uuid | References profiles |

#### `branches`

Restaurant branch locations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `restaurant_id` | uuid | References restaurants |
| `name` | text | Branch name |
| `address` | text | Physical address |
| `lat` | decimal | Latitude |
| `lng` | decimal | Longitude |
| `phone` | text | Branch phone |
| `opening_hours` | jsonb | Operating hours |
| `delivery_radius_km` | integer | Delivery range |

#### `meals`

Menu items with nutrition data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `branch_id` | uuid | References branches |
| `name` | text | Meal name |
| `description` | text | Description |
| `calories` | integer | Calorie count |
| `protein` | decimal | Protein (g) |
| `carbs` | decimal | Carbohydrates (g) |
| `fat` | decimal | Fat (g) |
| `price` | decimal | Meal price (QAR) |
| `image_url` | text | Meal photo |
| `diet_tags` | text[] | Diet labels (keto, vegan, etc.) |
| `is_active` | boolean | Available status |

#### `meal_schedules`

Customer orders (past/present/future).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References profiles |
| `meal_id` | uuid | References meals |
| `branch_id` | uuid | References branches |
| `scheduled_date` | date | Delivery date |
| `time_slot` | text | Delivery time |
| `status` | text | Order status |
| `quantity` | integer | Number of meals |
| `calories_consumed` | boolean | Nutrition tracking |

**Status values:** `pending`, `confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `cancelled`

#### `subscriptions`

Customer subscription plans.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References profiles |
| `plan` | text | Plan name |
| `meals_per_week` | integer | Weekly meals |
| `price` | decimal | Monthly price |
| `status` | text | Subscription status |
| `start_date` | date | Subscription start |
| `end_date` | date | Subscription end |

#### `notifications`

In-app notifications.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References profiles |
| `title` | text | Notification title |
| `message` | text | Notification body |
| `type` | text | Notification type |
| `status` | text | Read/unread |
| `created_at` | timestamptz | Created timestamp |

### Relationships

```
profiles
  ├── subscriptions (one-to-one)
  ├── meal_schedules (one-to-many)
  └── notifications (one-to-many)

restaurants
  ├── branches (one-to-many)
  └── meals (through branches)

branches
  └── meals (one-to-many)

meal_schedules
  ├── user (many-to-one → profiles)
  ├── meal (many-to-one → meals)
  └── branch (many-to-one → branches)
```

## Edge Functions

Serverless Deno functions for secure backend operations.

### Function List

| Function | Purpose |
|----------|---------|
| `auto-assign-driver` | Find and assign nearest driver to order |
| `calculate-health-score` | Compute user health metrics from inputs |
| `smart-meal-allocator` | AI-powered meal recommendations |
| `adaptive-goals` | Adjust nutrition goals based on progress |
| `send-push-notification` | Firebase/APN push notifications |
| `send-email` | Send transactional emails |
| `send-whatsapp-proxy` | WhatsApp Business API integration |
| `check-ip-location` | Qatar geo-restriction validation |
| `process-subscription-renewal` | Handle subscription billing |
| `generate-coach-report` | AI coaching insights generation |
| `restaurant-intelligence-engine` | Restaurant analytics |
| `nutrition-profile-engine` | User nutrition profile calculation |
| `behavior-prediction-engine` | Predict user behavior patterns |
| `fleet-tracking` | Real-time fleet location updates |
| `fleet-payouts` | Fleet payment processing |

### Example: auto-assign-driver

Automatically assigns the best available driver based on:
- Current location proximity
- Current order load
- Driver rating
- Delivery success rate

**Request:**
```json
POST /functions/v1/auto-assign-driver
Authorization: Bearer <token>
Content-Type: application/json

{
  "delivery_id": "uuid",
  "schedule_id": "uuid",
  "pickup_lat": 25.2854,
  "pickup_lng": 51.5310,
  "delivery_lat": 25.2654,
  "delivery_lng": 51.5210,
  "restaurant_id": "uuid",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "driver_id": "uuid",
  "driver_name": "Ahmed",
  "estimated_arrival": "15 minutes"
}
```

### Example: send-push-notification

Sends push notification via Firebase Cloud Messaging or Apple Push Notification service.

**Request:**
```json
POST /functions/v1/send-push-notification
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "title": "Order Delivered",
  "message": "Your meal has been delivered!",
  "type": "delivery",
  "data": {
    "order_id": "uuid",
    "action": "view_order"
  }
}
```

### Example: process-subscription-renewal

Handles subscription billing cycle.

**Trigger:** Scheduled cron (daily at midnight)

**Process:**
1. Find expiring subscriptions
2. Process payment via SADAD
3. Update subscription dates
4. Decrement meal credits
5. Notify user

## Row Level Security (RLS)

All tables have RLS enabled with role-based policies.

### Example Policies

```sql
-- Customers can view their own orders
CREATE POLICY "Users can view own meal schedules"
  ON meal_schedules FOR SELECT
  USING (auth.uid() = user_id);

-- Partners can manage meals for their branches
CREATE POLICY "Partners manage own meals"
  ON meals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM branches
      JOIN restaurants ON branches.restaurant_id = restaurants.id
      WHERE branches.id = meals.branch_id
      AND restaurants.owner_id = auth.uid()
    )
  );

-- Admins have full access to all tables
CREATE POLICY "Admins have full access"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
```

## Realtime Subscriptions

Enable realtime for time-critical data:

### Enabled Tables

- `meal_schedules` - Order status updates
- `notifications` - New notification alerts
- `driver_locations` - Live delivery tracking
- `chat_messages` - Coach-client chat

### Frontend Usage

```tsx
import { supabase } from '@/integrations/supabase/client';

// Subscribe to order updates
const channel = supabase
  .channel('order-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'meal_schedules',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Order updated:', payload);
    }
  )
  .subscribe();

// Cleanup
useEffect(() => {
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## RPC Functions

PostgreSQL functions callable from the frontend.

### `cancel_meal_schedule`

Cancel a scheduled meal and restore credits.

```tsx
const { data, error } = await supabase.rpc('cancel_meal_schedule', {
  schedule_id: 'uuid'
});
```

### `complete_meal_atomic`

Mark meal as consumed atomically.

```tsx
const { data, error } = await supabase.rpc('complete_meal_atomic', {
  schedule_id: 'uuid'
});
```

### `get_user_stats`

Fetch aggregate stats for a user.

```tsx
const { data, error } = await supabase.rpc('get_user_stats', {
  user_id: 'uuid'
});
```

## Storage Buckets

### `avatars`

Public bucket for user profile photos.

**Path:** `{user_id}/{filename}`

**Policy:** Users can upload own avatar, public read.

### `meal-images`

Public bucket for meal photos.

**Path:** `{branch_id}/{meal_id}/{filename}`

**Policy:** Partners can upload for own meals.

### `restaurant-logos`

Public bucket for restaurant logos.

**Path:** `{restaurant_id}/logo.{ext}`

## Webhooks

### SADAD Payment Webhook

**Endpoint:** `/functions/v1/sadad-payment`

Handles payment callbacks from SADAD payment gateway.

**Payload:**
```json
{
  "transaction_id": "string",
  "status": "success|failed",
  "amount": 100.00,
  "user_id": "uuid"
}
```

### WhatsApp Webhook

**Endpoint:** `/functions/v1/process-whatsapp-notifications`

Handles incoming WhatsApp messages for customer support.

## Rate Limiting

Edge functions implement rate limiting via shared utility:

```typescript
// supabase/functions/_shared/rateLimiter.ts
export async function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): Promise<boolean>;
```

## Error Handling

All functions follow standard error format:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {}
  }
}
```

## See Also

- [README.md](../README.md) - Project overview
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [SETUP.md](../SETUP.md) - Setup guide
- Supabase Dashboard - https://supabase.com/dashboard