# Customer Portal Dashboard Redesign Plan

## Goal
Redesign the customer dashboard (`src/pages/Dashboard.tsx`) to look more professional and have a mobile-native feel while maintaining all existing functionality.

## Current State Analysis
The current dashboard has:
- Sticky header with hamburger menu, user avatar with greeting, notifications, logout
- Platform announcements banner
- Meal limit upsell banner (at 80% usage)
- AI behavior prediction widget
- AI adaptive goal suggestion card
- Weight prediction chart
- Daily nutrition card (calories, macros)
- "Log a Meal" CTA button
- Meals remaining widget
- Quick actions grid (4 cards: Schedule, Subscription, Favorites, Progress)
- Scheduled meal notifications
- Delivered meal notifications
- Active order banner
- Streak & motivation section (amber gradient card)
- Featured restaurants section (horizontal scroll)
- Bottom navigation (Home, Restaurants, Schedule, Affiliate, Profile)

## Design Direction

### Professional Improvements:
1. **Refined Header** - Cleaner layout, better spacing, more professional avatar/greeting
2. **Unified Card Design** - Consistent shadows, borders, and hover states
3. **Better Typography Hierarchy** - Clearer section headings, improved readability
4. **Subtle Color Usage** - More restrained accent colors, sophisticated palette
5. **Improved Visual Flow** - Better section ordering and grouping

### Mobile-Native Feel:
1. **Native-Style Header** - iOS/Android style navigation with proper safe areas
2. **Card-Based Layout** - More defined cards with rounded corners and shadows
3. **Better Touch Targets** - Larger, more obvious interactive elements
4. **Horizontal Scrolling** - Already used for restaurants, apply to other sections where appropriate
5. **Skeleton Loading** - Better loading states instead of spinners
6. **Pull-to-Refresh** - Native gesture support
7. **Compact Widgets** - More information density without clutter

## Todo Items

### 1. Header Redesign
- [ ] Simplify header layout (remove unnecessary elements)
- [ ] Improve avatar display with better VIP indication
- [ ] Cleaner notification bell icon
- [ ] Move logout to side drawer (not main header)
- [ ] Better greeting typography

### 2. Banners & Notifications Cleanup
- [ ] Make announcement banner more subtle/polished
- [ ] Improve upsell banner design (less intrusive)
- [ ] Consolidate notification areas

### 3. AI Widgets Professional Design
- [ ] Better behavior prediction widget styling
- [ ] More professional adaptive goal card
- [ ] Cleaner weight prediction chart integration

### 4. Daily Nutrition Card - Mobile Native
- [ ] Circular progress indicators (like native health apps)
- [ ] Better macro display with visual bars
- [ ] Cleaner calorie display
- [ ] More compact design

### 5. Quick Actions Grid
- [ ] Native app icon style (square with rounded corners)
- [ ] Better icon containers with consistent styling
- [ ] Remove card borders for cleaner look
- [ ] 4-column grid maintained but better spacing

### 6. Streak Section Redesign
- [ ] More compact design
- [ ] Better progress indicator
- [ ] Cleaner milestone display
- [ ] Less gradient-heavy styling

### 7. Meals Remaining Widget
- [ ] Circular or linear progress indicator
- [ ] Better visual hierarchy
- [ ] Cleaner unlimited/VIP styling

### 8. Restaurant Cards Polish
- [ ] Better image handling
- [ ] Improved favorite button placement
- [ ] Cleaner stats display
- [ ] Better hover/active states

### 9. "Log a Meal" Button
- [ ] Floating action button (FAB) style for mobile
- [ ] Better positioning (maybe fixed bottom-right on mobile)

### 10. Loading States & Animations
- [ ] Skeleton screens instead of spinners
- [ ] Smooth page transitions
- [ ] Better shimmer effects

### 11. Bottom Navigation Polish
- [ ] Already exists - verify it looks native
- [ ] Check active state styling
- [ ] Ensure proper safe area padding

### 12. Testing & Polish
- [ ] Test on various screen sizes
- [ ] Verify all functionality works
- [ ] Check dark mode compatibility
- [ ] Ensure accessibility standards

## Review Section (To be filled after completion)

---

## user_addresses Table Fix - Summary of Changes

### Date: February 26, 2026

### Issue:
The application was throwing 404 errors because the `user_addresses` table didn't exist in the Supabase database, even though the code was trying to query it.

### Changes Made:

#### 1. Created Migration (supabase/migrations/20260226000000_ensure_user_addresses_table.sql)
- **Created:** Comprehensive migration to create `user_addresses` table if it doesn't exist
- **Features:**
  - Stores delivery addresses with fields: label, address_line1, address_line2, city, state, postal_code, country, phone, is_default, delivery_instructions
  - References auth.users(id) with CASCADE delete
  - RLS policies for users (CRUD their own addresses) and partners (view addresses for their orders)
  - Indexes on user_id and is_default for performance
  - Auto-updated_at trigger
  - Trigger to ensure only one default address per user
  - Default country changed to 'Qatar' to match the app's market

#### 2. Added Type Definition (src/integrations/supabase/types.ts)
- **Added:** Complete `user_addresses` table definition to the Database types
- **Includes:** Row, Insert, Update types and Relationships to users table

### Database Schema:
```sql
user_addresses (
  id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id: UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  label: TEXT NOT NULL DEFAULT 'Home'
  address_line1: TEXT NOT NULL
  address_line2: TEXT
  city: TEXT NOT NULL
  state: TEXT
  postal_code: TEXT NOT NULL
  country: TEXT NOT NULL DEFAULT 'Qatar'
  phone: TEXT
  is_default: BOOLEAN DEFAULT false
  delivery_instructions: TEXT
  created_at: TIMESTAMP WITH TIME ZONE DEFAULT now()
  updated_at: TIMESTAMP WITH TIME ZONE DEFAULT now()
)
```

### RLS Policies:
- Users can view/create/update/delete their own addresses
- Partners can view addresses for customers who have orders at their restaurant

### Next Steps:
To apply this migration to your Supabase project, run:
```bash
npx supabase db push
```

Or execute the SQL directly in the Supabase SQL Editor.

---

## Partner Orders Workflow Fix - Summary of Changes

### Date: February 26, 2026

### Issues Identified:
1. **PartnerOrders.tsx** was doing direct table updates (`supabase.from("meal_schedules").update()`) instead of using the database function that validates role-based permissions
2. **MealDetail.tsx** was not setting `order_status` when creating meal schedules, leaving it to database defaults
3. **Supabase Types** were missing the `update_order_status` RPC function definition

### Changes Made:

#### 1. Fixed PartnerOrders.tsx (src/pages/partner/PartnerOrders.tsx)
- **Changed:** `updateOrderStatus` function now uses the `update_order_status` RPC function instead of direct table updates
- **Why:** The database function includes role-based validation (partner can only do: pending→confirmed, confirmed→preparing, preparing→ready, and cancellations before ready)
- **Code change:**
  ```typescript
  // Before: Direct table update (bypassed role validation)
  const { error: updateError } = await supabase
    .from("meal_schedules")
    .update({ order_status: newStatus })
    .eq("id", orderId);

  // After: Using RPC function with role validation
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_user_role: "partner",
  });
  ```

#### 2. Fixed MealDetail.tsx (src/pages/MealDetail.tsx)
- **Changed:** Added `order_status: "pending"` when creating meal schedules
- **Why:** Ensures all new orders start with a proper status
- **Code change:**
  ```typescript
  const { error } = await supabase.from("meal_schedules").insert({
    user_id: user!.id,
    meal_id: meal.id,
    scheduled_date: format(selectedDate, "yyyy-MM-dd"),
    meal_type: selectedMealType,
    is_completed: false,
    order_status: "pending",  // <-- Added this
  });
  ```

#### 3. Added Supabase Type Definition (src/integrations/supabase/types.ts)
- **Changed:** Added `update_order_status` to Functions interface
- **Why:** TypeScript needs to know about the RPC function for type checking
- **Code added:**
  ```typescript
  update_order_status: {
    Args: {
      p_order_id: string
      p_new_status: string
      p_user_role: string
    }
    Returns: boolean
  }
  ```

### Database Context:
- The database already has:
  - `update_order_status` function with role-based validation
  - `validate_order_status_transition` trigger for status transition rules
  - RLS policies allowing partners to update their restaurant's meal schedules
  - Proper status constraint: pending → confirmed → preparing → ready → out_for_delivery → delivered → completed

### Testing Instructions:
1. Create a new meal schedule as a customer
2. Log in as a partner for that restaurant
3. Go to `/partner/orders`
4. The order should appear with status "Pending"
5. Test the action buttons:
   - "Accept Order" → changes to "Confirmed"
   - "Start Preparing" → changes to "Preparing"
   - "Mark Ready" → changes to "Ready"
   - "Cancel Order" → changes to "Cancelled" (available until ready)

### Files Modified:
- `src/pages/partner/PartnerOrders.tsx`
- `src/pages/MealDetail.tsx`
- `src/integrations/supabase/types.ts`

### Verification:
- TypeScript type check passes (`npm run typecheck`)
- RLS policies for partner access to meal_schedules already exist in database
