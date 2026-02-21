# Admin User Management Features Implementation Plan

## Overview
Implement missing admin features:
1. **View Orders** - View user's order/meal scheduling history
2. **Edit Roles** - Manage user roles (admin, user, restaurant, etc.)
3. **Suspend User** - Block/unblock user from platform

---

## Phase 1: View Orders Feature

### Purpose
Allow admins to view all meal schedules and orders for any specific user.

### Database Queries Needed

```sql
-- Get user's meal schedules
SELECT 
  ms.id,
  ms.scheduled_date,
  ms.meal_type,
  ms.is_completed,
  ms.created_at,
  m.name as meal_name,
  m.calories,
  m.protein_g,
  r.name as restaurant_name
FROM meal_schedules ms
JOIN meals m ON ms.meal_id = m.id
JOIN restaurants r ON m.restaurant_id = r.id
WHERE ms.user_id = 'USER_ID'
ORDER BY ms.scheduled_date DESC;

-- Get order statistics
SELECT 
  COUNT(*) as total_orders,
  COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_orders,
  SUM(m.calories) as total_calories,
  MIN(ms.scheduled_date) as first_order,
  MAX(ms.scheduled_date) as last_order
FROM meal_schedules ms
JOIN meals m ON ms.meal_id = m.id
WHERE ms.user_id = 'USER_ID';
```

### UI Components Needed

1. **OrderHistoryCard Component**
```tsx
interface OrderHistoryCardProps {
  userId: string;
}

// Features:
- List view of all scheduled meals
- Filter by date range
- Filter by meal type (breakfast/lunch/dinner/snack)
- Filter by completion status
- Sort by date
- Pagination (10 items per page)
- Export to CSV button
```

2. **OrderStatistics Component**
```tsx
// Shows:
- Total meals scheduled
- Completed vs pending ratio
- Total calories consumed
- Favorite restaurants
- Most ordered meal types
- Order frequency chart
```

### API/Functions Needed

```typescript
// src/hooks/useUserOrders.ts
export const useUserOrders = (userId: string) => {
  // Fetch orders with pagination
  // Real-time updates
  // Filter and sort options
}

// src/services/orderService.ts
export const getUserOrders = async (
  userId: string, 
  filters?: OrderFilters
) => Promise<Order[]>;

export const exportUserOrders = async (
  userId: string
) => Promise<Blob>;
```

### Implementation Steps

1. **Create database view** for efficient querying (1 hour)
2. **Build OrderHistoryCard component** (4 hours)
   - List layout with meal cards
   - Date filtering
   - Status badges
3. **Build OrderStatistics component** (3 hours)
   - Charts using recharts
   - Summary cards
4. **Add to User Details sheet** (1 hour)
   - New tab for Orders
5. **Testing** (2 hours)

**Estimated Time: 11 hours**

---

## Phase 2: Edit Roles Feature

### Purpose
Allow admins to assign/remove roles from users (user, admin, restaurant, driver, etc.)

### Database Schema

Already exists:
- `user_roles` table with columns: `user_id`, `role`

### Available Roles
```typescript
type UserRole = 
  | "user"           // Regular customer
  | "admin"          // Platform admin
  | "restaurant"     // Restaurant owner
  | "driver"         // Delivery driver
  | "staff"          // Restaurant staff
  | "gym_owner";     // Gym/fitness center owner
```

### UI Components Needed

1. **RoleManager Component**
```tsx
interface RoleManagerProps {
  userId: string;
  currentRoles: UserRole[];
  onRolesChange: (roles: UserRole[]) => void;
}

// Features:
- Checkbox list of all available roles
- Visual indicators for each role
- Add/remove functionality
- Confirmation dialog for sensitive roles (admin)
- Show role descriptions on hover
```

2. **RoleBadge Component**
```tsx
// Shows role with appropriate color/icon
// user: blue, admin: red, restaurant: orange, etc.
```

### API/Functions Needed

```typescript
// src/services/userRoleService.ts

export const getAvailableRoles = (): UserRole[] => {
  return ["user", "admin", "restaurant", "driver", "staff", "gym_owner"];
};

export const addUserRole = async (
  userId: string, 
  role: UserRole
): Promise<void> => {
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role });
  
  if (error) throw error;
};

export const removeUserRole = async (
  userId: string, 
  role: UserRole
): Promise<void> => {
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);
  
  if (error) throw error;
};

export const updateUserRoles = async (
  userId: string, 
  roles: UserRole[]
): Promise<void> => {
  // Delete existing roles
  await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  
  // Insert new roles
  if (roles.length > 0) {
    const { error } = await supabase
      .from("user_roles")
      .insert(roles.map(role => ({ user_id: userId, role })));
    
    if (error) throw error;
  }
};
```

### RLS Policies Update

```sql
-- Ensure admin can manage roles
CREATE POLICY "Admins can manage user roles"
  ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

### Implementation Steps

1. **Create RoleManager component** (3 hours)
   - Checkbox list UI
   - Role descriptions
   - Confirmation dialogs
2. **Add role service functions** (2 hours)
3. **Integrate with User Details** (1 hour)
   - Replace "coming soon" with actual component
4. **Add audit logging** (2 hours)
   - Log role changes
   - Show in activity feed
5. **Testing** (2 hours)

**Estimated Time: 10 hours**

---

## Phase 3: Suspend User Feature

### Purpose
Temporarily or permanently block users from accessing the platform.

### Database Changes

```sql
-- Add status field to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
CHECK (status IN ('active', 'suspended', 'blocked'));

-- Add suspension reason
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Add suspended at timestamp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Add suspended by (admin user)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id);

-- Create user_suspensions table for history
CREATE TABLE IF NOT EXISTS public.user_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('suspended', 'unsuspended')),
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view suspension history"
  ON public.user_suspensions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create suspension records"
  ON public.user_suspensions FOR INSERT
  USING (public.has_role(auth.uid(), 'admin'));
```

### UI Components Needed

1. **SuspendUserDialog Component**
```tsx
interface SuspendUserDialogProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuspend: (reason: string) => void;
}

// Features:
- Reason text input (required)
- Suspension type: Temporary / Permanent
- If temporary: Duration selector (1 day, 7 days, 30 days, custom)
- Confirmation checkbox
- Warning message about consequences
```

2. **UserStatusBadge Component**
```tsx
// Shows status with color:
// active: green, suspended: yellow, blocked: red
// Click to view suspension details
```

3. **SuspensionHistory Component**
```tsx
// Shows table of:
// - Date suspended
// - Reason
// - Admin who performed action
// - Duration (if temporary)
// - Date unsuspended (if applicable)
```

### API/Functions Needed

```typescript
// src/services/userStatusService.ts

export const suspendUser = async (
  userId: string,
  reason: string,
  duration?: number // days, undefined = permanent
): Promise<void> => {
  const suspendedUntil = duration 
    ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
    : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      status: duration ? 'suspended' : 'blocked',
      suspension_reason: reason,
      suspended_at: new Date().toISOString(),
      suspended_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .eq("user_id", userId);

  if (error) throw error;

  // Log suspension
  await supabase.from("user_suspensions").insert({
    user_id: userId,
    action: 'suspended',
    reason,
    performed_by: (await supabase.auth.getUser()).data.user?.id,
  });
};

export const unsuspendUser = async (
  userId: string,
  reason?: string
): Promise<void> => {
  const { error } = await supabase
    .from("profiles")
    .update({
      status: 'active',
      suspension_reason: null,
      suspended_at: null,
      suspended_by: null,
    })
    .eq("user_id", userId);

  if (error) throw error;

  // Log unsuspension
  await supabase.from("user_suspensions").insert({
    user_id: userId,
    action: 'unsuspended',
    reason: reason || 'Manual restore',
    performed_by: (await supabase.auth.getUser()).data.user?.id,
  });
};

export const getSuspensionHistory = async (
  userId: string
): Promise<SuspensionRecord[]> => {
  const { data, error } = await supabase
    .from("user_suspensions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};
```

### Login Flow Update

Update `AuthContext.tsx` to check user status:

```typescript
const signIn = async (email: string, password: string) => {
  try {
    // ... IP check code ...

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Check if user is suspended
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, suspension_reason, suspended_until")
      .eq("user_id", data.user.id)
      .single();

    if (profile?.status === 'suspended' || profile?.status === 'blocked') {
      await supabase.auth.signOut();
      return { 
        error: new Error(
          profile.suspension_reason 
            ? `Account suspended: ${profile.suspension_reason}`
            : "Your account has been suspended. Please contact support."
        ) 
      };
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};
```

### Implementation Steps

1. **Database migrations** (2 hours)
   - Add status columns
   - Create suspensions table
   - Update RLS policies
2. **Create SuspendUserDialog** (3 hours)
3. **Add status checks to login** (2 hours)
4. **Create SuspensionHistory component** (2 hours)
5. **Update UserStatusBadge** (1 hour)
6. **Add to User Details** (1 hour)
7. **Testing** (2 hours)

**Estimated Time: 13 hours**

---

## Total Implementation Timeline

| Feature | Hours | Priority |
|---------|-------|----------|
| View Orders | 11 | High |
| Edit Roles | 10 | High |
| Suspend User | 13 | Medium |
| **Total** | **34 hours** | |

### Recommended Implementation Order:

**Week 1:**
- Day 1-2: View Orders (database + UI)
- Day 3: View Orders (integration + testing)

**Week 2:**
- Day 1-2: Edit Roles (UI + service functions)
- Day 3: Edit Roles (testing + polish)

**Week 3:**
- Day 1-2: Suspend User (database + core logic)
- Day 3: Suspend User (UI + login integration)

---

## Testing Checklist

### View Orders
- [ ] Shows correct orders for user
- [ ] Filters work (date, type, status)
- [ ] Pagination works
- [ ] Export to CSV works
- [ ] Real-time updates work

### Edit Roles
- [ ] Can add roles
- [ ] Can remove roles
- [ ] Confirmation for admin role
- [ ] Changes reflect immediately
- [ ] Audit log created

### Suspend User
- [ ] Can suspend user
- [ ] Can unsuspend user
- [ ] Suspended user can't login
- [ ] Reason stored correctly
- [ ] History tracked
- [ ] Email notification sent (optional)

---

## Files to Create/Modify

### New Files:
- `src/components/admin/OrderHistoryCard.tsx`
- `src/components/admin/OrderStatistics.tsx`
- `src/components/admin/RoleManager.tsx`
- `src/components/admin/SuspendUserDialog.tsx`
- `src/components/admin/SuspensionHistory.tsx`
- `src/hooks/useUserOrders.ts`
- `src/services/orderService.ts`
- `src/services/userRoleService.ts`
- `src/services/userStatusService.ts`

### Modified Files:
- `src/pages/admin/AdminUsers.tsx` - Add components
- `src/contexts/AuthContext.tsx` - Add status check
- Database migrations

---

## Next Steps

1. **Approve this plan** ✅
2. **Prioritize features** (suggest: View Orders first)
3. **Create database migrations**
4. **Build components one by one**
5. **Test thoroughly**

Would you like me to start implementing any of these features?
