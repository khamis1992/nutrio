# Order Workflow Analysis & Proposal

## Current Problem

The user reports that when a customer marks a meal as "completed" on the partner page, this is incorrect behavior. This indicates confusion in the role-based permissions and workflow design.

## Current State Analysis

### Issues Found:
1. **No status transition validation** - Partners can jump from pending → delivered
2. **No clear role separation** - Unclear who can do what
3. **Mixed order systems** - Legacy `orders` table vs current `meal_schedules` table
4. **Missing statuses** - Database constraints don't match UI display
5. **Admin cannot manage orders** - Buttons are placeholders

## Proposed Solution

### 1. Clear Role Definitions

#### Customer Portal (`/dashboard`, `/orders/*`)
**Can:**
- ✅ Place new orders
- ✅ View order status (read-only)
- ✅ Cancel order (only if status = pending)
- ✅ Confirm delivery receipt (change status from "out_for_delivery" → "delivered")
- ❌ Cannot mark as preparing/ready
- ❌ Cannot mark as completed

**Actions Available:**
- "Cancel Order" (only when pending)
- "I Received My Order" (only when out_for_delivery)
- "Track Order" (view status)

#### Partner Portal (`/partner/*`)
**Can:**
- ✅ View incoming orders
- ✅ Accept order (pending → confirmed)
- ✅ Start preparing (confirmed → preparing)
- ✅ Mark ready for pickup/delivery (preparing → ready)
- ✅ Mark as out_for_delivery (ready → out_for_delivery)
- ✅ Cancel order (any status before delivered)
- ❌ Cannot mark as delivered (only customer/driver can)
- ❌ Cannot revert status backwards

**Actions Available:**
- "Accept Order" (Accept & confirm)
- "Start Preparing" 
- "Ready for Pickup" / "Ready for Delivery"
- "Handover to Driver"
- "Cancel Order"

#### Driver Portal (`/driver/*`) - If applicable
**Can:**
- ✅ Claim delivery
- ✅ Pick up order (ready → picked_up)
- ✅ Start delivery (picked_up → out_for_delivery)
- ✅ Mark delivered (out_for_delivery → delivered)

#### Admin Portal (`/admin/*`)
**Can:**
- ✅ View all orders
- ✅ Override/cancel any order
- ✅ View order history & logs

### 2. Proper Status Flow

```
┌─────────────┐
│   PENDING   │ ← Customer places order
└──────┬──────┘
       │ Partner accepts
       ▼
┌─────────────┐
│  CONFIRMED  │ ← Partner confirmed, preparing to cook
└──────┬──────┘
       │ Partner starts cooking
       ▼
┌─────────────┐
│  PREPARING  │ ← Cooking in progress
└──────┬──────┘
       │ Meal ready
       ▼
┌─────────────┐
│    READY    │ ← Ready for pickup/delivery
└──────┬──────┘
       │ Driver picks up / Customer pickup
       ▼
┌──────────────────┐
│OUT_FOR_DELIVERY  │ ← On the way
└────────┬─────────┘
         │ Delivered
         ▼
┌─────────────┐
│  DELIVERED  │ ← Customer confirms receipt
└──────┬──────┘
       │ Auto-complete after 24h
       ▼
┌─────────────┐
│  COMPLETED  │ ← Final state
└─────────────┘

CANCELLED can happen from: PENDING, CONFIRMED, PREPARING
```

### 3. Status Transitions Matrix

| From ↓ / To → | Pending | Confirmed | Preparing | Ready | Out for Delivery | Delivered | Completed | Cancelled |
|---------------|---------|-----------|-----------|-------|------------------|-----------|-----------|-----------|
| **Pending** | ✓ | Partner | - | - | - | - | - | Customer/Partner |
| **Confirmed** | ✗ | ✓ | Partner | - | - | - | - | Partner |
| **Preparing** | ✗ | ✗ | ✓ | Partner | - | - | - | Partner |
| **Ready** | ✗ | ✗ | ✗ | ✓ | Driver | - | - | Partner |
| **Out for Delivery** | ✗ | ✗ | ✗ | ✗ | ✓ | Driver/Customer | - | - |
| **Delivered** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | Auto | - |
| **Completed** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | - |

### 4. Database Changes Needed

#### A. Add Missing Statuses
```sql
-- Update constraint to include all statuses
ALTER TABLE public.meal_schedules
DROP CONSTRAINT IF EXISTS valid_order_status;

ALTER TABLE public.meal_schedules
ADD CONSTRAINT valid_order_status 
CHECK (order_status IN ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled'));
```

#### B. Add Status Change Log Table
```sql
-- Track who changed what and when
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES meal_schedules(id),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_by UUID REFERENCES auth.users(id),
    changed_by_role VARCHAR(20), -- 'customer', 'partner', 'driver', 'system'
    changed_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);
```

#### C. Add Validation Function
```sql
-- Prevent invalid status transitions
CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Define valid transitions
    IF OLD.order_status = 'pending' AND NEW.order_status NOT IN ('confirmed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from pending to %', NEW.order_status;
    END IF;
    
    IF OLD.order_status = 'confirmed' AND NEW.order_status NOT IN ('preparing', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from confirmed to %', NEW.order_status;
    END IF;
    
    -- Add more validations...
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 5. UI Changes Needed

#### Customer Portal
- **OrderDetail.tsx**: 
  - Show status timeline (visual progress)
  - Show "Cancel" button only when pending
  - Show "I Received My Order" button only when out_for_delivery
  - Remove any "Mark as Completed" buttons

- **OrderHistory.tsx**:
  - Add status filter
  - Show delivery progress indicator

#### Partner Portal
- **PartnerOrders.tsx**:
  - Show only allowed actions based on current status
  - "Accept Order" button (pending → confirmed)
  - "Start Preparing" button (confirmed → preparing)
  - "Mark Ready" button (preparing → ready)
  - "Handover" button (ready → out_for_delivery)
  - "Cancel Order" button (available until ready)
  - Status dropdown removed or restricted

- **Add visual order flow** showing:
  - Current status
  - What's next
  - What's already done

#### Admin Portal
- **AdminOrders.tsx**:
  - Implement "Cancel Order" functionality
  - Add status override capability
  - Show full order history/audit log

### 6. Notification Flow

| Status Change | Notify Who | Via |
|---------------|-----------|-----|
| Pending → Confirmed | Customer | Push + Email |
| Confirmed → Preparing | Customer | Push |
| Preparing → Ready | Customer + Driver | Push |
| Ready → Out for Delivery | Customer | Push + SMS |
| Out for Delivery → Delivered | Partner | Push |
| Delivered → Completed | Customer | Email (receipt) |

## Implementation Plan

### Phase 1: Database (1-2 hours)
1. Add missing statuses to constraint
2. Create status_history table
3. Add validation trigger
4. Create helper functions

### Phase 2: Backend Logic (2-3 hours)
1. Update PartnerOrders.tsx with proper actions
2. Update OrderDetail.tsx for customer actions
3. Update AdminOrders.tsx with cancel functionality
4. Add status validation in all update functions

### Phase 3: UI/UX Improvements (3-4 hours)
1. Create OrderStatusTimeline component
2. Update status badges with better colors
3. Add action button visibility logic
4. Create notification triggers

### Phase 4: Testing (2-3 hours)
1. Test all status transitions
2. Test role-based permissions
3. Test edge cases (cancellation, etc.)

**Total Estimated Time: 8-12 hours**

## Questions for You

1. **Do you have drivers in the system?** Should I include driver workflow or is it just pickup?

2. **Do customers pick up orders or only delivery?** This affects the ready → delivered flow.

3. **Should partners be able to cancel after "preparing"?** Or only until they start cooking?

4. **Do you want status history/audit logging?** This tracks who changed what.

5. **Should delivered orders auto-complete after a time period?** (e.g., 24 hours)

Please review this plan and let me know:
- ✅ Approve the workflow
- 🔄 Any changes needed
- ❌ Cancel this approach

Once approved, I'll implement it step by step.
